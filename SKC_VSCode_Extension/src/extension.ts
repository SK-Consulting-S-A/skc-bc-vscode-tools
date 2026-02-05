import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import {
  commands,
  ConfigurationTarget,
  env,
  ExtensionContext,
  OutputChannel,
  extensions,
  window,
  workspace,
  Uri,
  Range,
  Selection,
  TextEditorRevealType
} from "vscode";
import type { SourceFileItem, TargetLanguageItem } from "./translationsView";
// Heavy modules (translationsView, translationService, lmBridge, translationTools) are loaded lazily in setImmediate
// so activation returns quickly and "Activating..." does not hang.

const OUTPUT_CHANNEL_NAME = "SKC Tools";
const STATE_KEY = "skc.presetsApplied";
const STATE_VERSION_KEY = "skc.presetsVersion";
const STATE_NEWS_SHOWN_KEY = "skc.newsShownForVersion";
const STATE_LAST_EXTENSION_IDS_KEY = "skc.lastAppliedExtensionIds";

export async function activate(context: ExtensionContext): Promise<void> {
  const channel = window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  context.subscriptions.push(channel);

  const currentVersion = (context.extension?.packageJSON?.version as string | undefined) ?? "unknown";
  channel.appendLine("=".repeat(60));
  channel.appendLine(`SKC Tools v${currentVersion} - Business Central Development Toolkit`);
  channel.appendLine("=".repeat(60));
  channel.appendLine(`[SKC] Extension activated in ${env.appName}`);
  channel.appendLine(`[SKC] Workspace: ${workspace.workspaceFolders?.[0]?.uri.fsPath ?? "No workspace"}`);
  channel.appendLine("");

  const storedVersion = context.globalState.get<string>(STATE_VERSION_KEY);
  const isNewVersion = Boolean(currentVersion && storedVersion !== currentVersion);

  const applyCommand = commands.registerCommand("skc.applyPresets", async () => {
    await applyPresets(context, channel, false);
  });
  context.subscriptions.push(applyCommand);

  const installSkillsCommand = commands.registerCommand("skc.installSkills", async () => {
    await installSkills(context, channel);
    void window.showInformationMessage("SKC Cursor skills installed.");
  });
  context.subscriptions.push(installSkillsCommand);

  const configureAuthCommand = commands.registerCommand("skc.configureMcpAuth", async () => {
    const saved = await promptAndSaveMcpSecrets(context);
    const message = saved
      ? "SKC MCP credentials saved."
      : "No MCP credentials were saved.";
    void window.showInformationMessage(message);
  });
  context.subscriptions.push(configureAuthCommand);

  // Defer view, LM Bridge, and startup tasks so activate() returns immediately (avoids long "Activating...").
  // Start LM Bridge first (so Cursor's MCP client can connect to localhost:7878 without ECONNREFUSED).
  setImmediate(() => {
    void (async () => {
      const isCursor = env.appName.includes("Cursor");
      if (isCursor) {
        const { startLmBridge } = await import("./lmBridge");
        startLmBridge(context, channel);
      }

      const [
        { TranslationsProvider, SourceFileItem: SourceFileItemClass, TargetLanguageItem: TargetLanguageItemClass },
        { translateFile, createTranslationFile },
        { registerTranslationTools }
      ] = await Promise.all([
        import("./translationsView"),
        import("./translationService"),
        import("./translationTools")
      ]);

      const translationsProvider = new TranslationsProvider();
      const translationsView = window.createTreeView("skc.translationsView", {
        treeDataProvider: translationsProvider,
        showCollapseAll: false
      });
      context.subscriptions.push(translationsView);
      context.subscriptions.push({ dispose: () => translationsProvider.dispose() });

      context.subscriptions.push(commands.registerCommand(
        "skc.translateFile",
        async (item?: SourceFileItem | TargetLanguageItem) => {
          if (item instanceof SourceFileItemClass) {
            await translateFile(item.resourceUri, channel, item.workspaceFolder);
            translationsProvider.refresh();
          } else if (item instanceof TargetLanguageItemClass) {
            await translateFile(item.sourceFile.resourceUri, channel, item.sourceFile.workspaceFolder, item.language);
            translationsProvider.refresh();
          } else {
            void window.showWarningMessage("Please select a file from the Translations view.");
          }
        }
      ));
      context.subscriptions.push(commands.registerCommand(
        "skc.createTranslationFile",
        async (sourceFile?: SourceFileItem, language?: string) => {
          if (sourceFile && language) {
            await createTranslationFile(sourceFile.resourceUri, language, channel);
            translationsProvider.refresh();
          }
        }
      ));
      context.subscriptions.push(commands.registerCommand("skc.refreshTranslations", () => translationsProvider.refresh()));
      context.subscriptions.push(commands.registerCommand(
        "skc.openTransUnit",
        async (fileUri: Uri, unitId: string) => {
          try {
            const document = await workspace.openTextDocument(fileUri);
            const editor = await window.showTextDocument(document);
            const text = document.getText();
            const searchPattern = new RegExp(`<trans-unit\\s+id="${unitId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'i');
            const match = searchPattern.exec(text);
            if (match) {
              const position = document.positionAt(match.index);
              const range = new Range(position, position);
              editor.selection = new Selection(position, position);
              editor.revealRange(range, TextEditorRevealType.InCenter);
            } else {
              void window.showWarningMessage(`Could not find translation unit with ID: ${unitId}`);
            }
          } catch (err) {
            void window.showErrorMessage(`Failed to open translation unit: ${err}`);
          }
        }
      ));
      context.subscriptions.push(commands.registerCommand(
        "skc.filterUntranslated",
        async (item: TargetLanguageItem) => {
          try {
            const document = await workspace.openTextDocument(item.resourceUri);
            await window.showTextDocument(document);
            await commands.executeCommand("editor.actions.findWithArgs", {
              searchString: 'state="needs-translation"',
              isRegex: false,
              matchWholeWord: false,
              isCaseSensitive: false
            });
          } catch (err) {
            void window.showErrorMessage(`Failed to filter untranslated units: ${err}`);
          }
        }
      ));
      context.subscriptions.push(commands.registerCommand(
        "skc.configureTranslationUrl",
        async () => {
          const cfg = workspace.getConfiguration("skc");
          const currentUrl = cfg.get<string>("azureFunctionUrl", "");
          const url = await window.showInputBox({
            prompt: "Enter the Azure Translation Function URL",
            placeHolder: "https://your-function.azurewebsites.net/api/github-webhook",
            value: currentUrl,
            ignoreFocusOut: true,
            validateInput: (value) => {
              if (!value.trim()) return "URL cannot be empty";
              try {
                new URL(value);
                return null;
              } catch {
                return "Please enter a valid URL";
              }
            }
          });
          if (url !== undefined) {
            await cfg.update("azureFunctionUrl", url.trim(), true);
            void window.showInformationMessage("Azure Translation Function URL saved.");
          }
        }
      ));

      registerTranslationTools(context, channel);

      const autoApply = true;
      const alreadyApplied = context.globalState.get<boolean>(STATE_KEY, false);
      if (autoApply && (!alreadyApplied || isNewVersion)) {
        void applyPresets(context, channel, true).catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          channel.appendLine(`[SKC] Startup preset apply failed: ${msg}`);
        });
      }
      void showNewsIfNeeded(context, channel, currentVersion, isNewVersion).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        channel.appendLine(`[SKC] News notification failed: ${msg}`);
      });
    })();
  });
}

async function applyPresets(
  context: ExtensionContext,
  channel: OutputChannel,
  silent: boolean
): Promise<void> {
  const cfg = workspace.getConfiguration("skc");
  const skipInstalled = cfg.get<boolean>("skipInstalledExtensions", true);
  const presetPath = cfg.get<string>("presetFilePath", "").trim();
  const mcpPath = cfg.get<string>("mcpFilePath", "").trim();
  const extensionsPath = cfg.get<string>("extensionsFilePath", "").trim();
  const installSkillsOnApply = cfg.get<boolean>("installSkillsOnApplyPresets", true);

  channel.appendLine(`[SKC] Applying presets...`);
  channel.appendLine(`[SKC] Preset path: ${presetPath || "(empty)"}`);
  channel.appendLine(`[SKC] MCP path: ${mcpPath || "(empty)"}`);
  channel.appendLine(`[SKC] Extensions path: ${extensionsPath || "(empty)"}`);

  const { settings, extensions: presetExtensions } = await readPresetFile(presetPath, context, channel);
  const mcpServersRaw = await readMcpFile(mcpPath, context, channel);
  const mcpServers = await injectMcpSecrets(context, channel, mcpServersRaw, silent);
  const extraExtensions = await readExtensionsFile(extensionsPath, context, channel);

  const settingsToApply = settings ? { ...settings } : {};
  channel.appendLine(`[SKC] Loaded ${Object.keys(settingsToApply).length} settings from preset file.`);
  const removeMcpsNotInPreset = cfg.get<boolean>("removeMcpsNotInPreset", true);
  const mcpServersToApply = resolveMcpServersToApply(mcpServers, removeMcpsNotInPreset, channel);
  if (mcpServersToApply !== undefined) {
    settingsToApply["mcp.servers"] = mcpServersToApply;
    channel.appendLine(`[SKC] Set mcp.servers to ${mcpServersToApply.length} server(s) (preset only: ${removeMcpsNotInPreset}).`);
  }
  const extensionsToInstall = Array.from(
    new Set([
      ...(presetExtensions ?? []),
      ...(extraExtensions ?? [])
    ])
  );

  const uninstallRemoved = cfg.get<boolean>("uninstallExtensionsRemovedFromPreset", false);
  await uninstallExtensionsRemovedFromPreset(context, channel, extensionsToInstall, uninstallRemoved);

  await ensureExtensions(channel, skipInstalled, extensionsToInstall);
  await context.globalState.update(STATE_LAST_EXTENSION_IDS_KEY, extensionsToInstall);

  await applySettings(channel, settingsToApply);
  const writeCursorMcpFile = cfg.get<boolean>("writeCursorMcpFile", true);
  // Write Cursor mcp.json whenever we have a resolved list (including empty), so removals and version updates stay in sync.
  if (writeCursorMcpFile && mcpServersToApply !== undefined) {
    await writeCursorMcpFileIfNeeded(channel, mcpServersToApply);
  }
  if (installSkillsOnApply) {
    await installSkills(context, channel);
  }

  await context.globalState.update(STATE_KEY, true);
  const currentVersion = (context.extension?.packageJSON?.version as string | undefined) ?? undefined;
  if (currentVersion) {
    await context.globalState.update(STATE_VERSION_KEY, currentVersion);
  }

  if (!silent) {
    void window.showInformationMessage("SKC presets applied.");
  }
}

/**
 * Returns the mcp.servers value to apply: preset only (optionally removing others), or preset merged with existing.
 */
function resolveMcpServersToApply(
  presetMcpServers: unknown[] | undefined,
  removeOthers: boolean,
  channel: OutputChannel
): unknown[] | undefined {
  if (!Array.isArray(presetMcpServers)) {
    return undefined;
  }
  if (removeOthers) {
    return presetMcpServers;
  }
  const config = workspace.getConfiguration();
  const current = config.get<unknown[]>("mcp.servers");
  const currentList = Array.isArray(current) ? current : [];
  const presetIds = new Set(
    presetMcpServers.map((s) => (s && typeof s === "object" && "id" in s ? (s as { id: string }).id : undefined)).filter(Boolean)
  );
  const merged = [...presetMcpServers];
  for (const entry of currentList) {
    if (entry && typeof entry === "object" && "id" in entry) {
      const id = (entry as { id: string }).id;
      if (id && !presetIds.has(id)) {
        merged.push(entry);
      }
    }
  }
  channel.appendLine(`[SKC] Merged MCP: ${presetMcpServers.length} from preset + ${merged.length - presetMcpServers.length} existing kept.`);
  return merged;
}

async function applySettings(
  channel: OutputChannel,
  settings: Record<string, unknown>
): Promise<void> {
  const config = workspace.getConfiguration();

  const settingsCount = Object.keys(settings).length;
  channel.appendLine(`[SKC] Applying ${settingsCount} settings...`);

  if (settingsCount === 0) {
    channel.appendLine(`[SKC] WARNING: No settings to apply! Check if preset file was loaded correctly.`);
    return;
  }

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const [key, value] of Object.entries(settings)) {
    // Try to get current value - if it exists, the setting is known
    const current = config.get(key, undefined);
    const knownSetting = current !== undefined || config.has(key);

    if (!knownSetting) {
      channel.appendLine(`[SKC] ${key} is not recognized by VS Code; skipping.`);
      skippedCount++;
      continue;
    }

    const unchanged = JSON.stringify(current) === JSON.stringify(value);

    if (unchanged) {
      channel.appendLine(`[SKC] ${key} already set to target value; skipping.`);
      skippedCount++;
      continue;
    }

    const isSensitive = key === "mcp.servers";
    if (!isSensitive) {
      channel.appendLine(`[SKC] Updating ${key} from ${JSON.stringify(current)} to ${JSON.stringify(value)}.`);
    } else {
      channel.appendLine(`[SKC] Updating ${key} (secrets applied, not logged).`);
    }
    try {
      await config.update(key, value, ConfigurationTarget.Global);

      // Verify the setting was actually written
      const verifyValue = config.get(key, undefined);
      const matches = JSON.stringify(verifyValue) === JSON.stringify(value);

      if (matches) {
        channel.appendLine(`[SKC] Successfully updated ${key}.`);
        updatedCount++;
      } else if (!isSensitive) {
        channel.appendLine(`[SKC] WARNING: ${key} was updated but verification failed. Expected: ${JSON.stringify(value)}, Got: ${JSON.stringify(verifyValue)}`);
        errorCount++;
      } else {
        channel.appendLine(`[SKC] WARNING: ${key} was updated but verification failed (value not logged).`);
        errorCount++;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      channel.appendLine(`[SKC] ERROR: Failed to update ${key}: ${message}`);
      errorCount++;
    }
  }

  channel.appendLine(`[SKC] Settings summary: ${updatedCount} updated, ${skippedCount} skipped, ${errorCount} errors.`);

  // Final verification - verify a few sample settings were actually written
  if (updatedCount > 0) {
    channel.appendLine(`[SKC] Verifying settings were written to settings.json...`);
    const sampleKeys = Object.keys(settings).slice(0, 3); // Check first 3 settings
    for (const key of sampleKeys) {
      const finalValue = config.get(key, undefined);
      const expectedValue = settings[key];
      const matches = JSON.stringify(finalValue) === JSON.stringify(expectedValue);
      const sensitive = key === "mcp.servers";
      if (matches) {
        channel.appendLine(`[SKC] ✓ Verified: ${key} is set correctly`);
      } else if (sensitive) {
        channel.appendLine(`[SKC] ✗ Warning: ${key} verification failed (value not logged).`);
      } else {
        channel.appendLine(`[SKC] ✗ Warning: ${key} verification failed. Expected: ${JSON.stringify(expectedValue)}, Got: ${JSON.stringify(finalValue)}`);
      }
    }
    channel.appendLine(`[SKC] Note: Settings file location: %APPDATA%\\Code\\User\\settings.json (Windows)`);
  }
}

async function installSkills(context: ExtensionContext, channel: OutputChannel): Promise<void> {
  const cfg = workspace.getConfiguration("skc");
  const overwriteExisting = cfg.get<boolean>("overwriteExistingSkills", false);

  const sourceRoot = path.join(context.extensionPath, "skills");
  const targetRoot = path.join(os.homedir(), ".cursor", "skills");

  if (!(await pathExists(sourceRoot))) {
    channel.appendLine(`[SKC] Skills folder not found at ${sourceRoot}; skipping skill install.`);
    return;
  }

  await fs.mkdir(targetRoot, { recursive: true });
  const entries = await fs.readdir(sourceRoot, { withFileTypes: true });
  const skillDirs = entries.filter((entry) => entry.isDirectory());

  if (skillDirs.length === 0) {
    channel.appendLine(`[SKC] No skills found in ${sourceRoot}; skipping skill install.`);
    return;
  }

  channel.appendLine(`[SKC] Installing ${skillDirs.length} skill bundle(s) to ${targetRoot}...`);
  let installedCount = 0;
  let skippedCount = 0;

  for (const dir of skillDirs) {
    const src = path.join(sourceRoot, dir.name);
    const dest = path.join(targetRoot, dir.name);

    const destExists = await pathExists(dest);
    if (destExists && !overwriteExisting) {
      channel.appendLine(`[SKC] Skill '${dir.name}' already exists; skipping (set skc.overwriteExistingSkills to overwrite).`);
      skippedCount++;
      continue;
    }

    await copyDirectory(src, dest);
    channel.appendLine(`[SKC] ${destExists ? "Updated" : "Installed"} skills from ${dir.name}.`);
    installedCount++;
  }

  channel.appendLine(`[SKC] Skills summary: ${installedCount} installed/updated, ${skippedCount} skipped.`);
}

async function copyDirectory(source: string, target: string): Promise<void> {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "__pycache__" || entry.name === ".git") {
      continue;
    }

    const srcPath = path.join(source, entry.name);
    const destPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
      continue;
    }

    if (entry.isFile()) {
      if (entry.name.endsWith(".pyc")) {
        continue;
      }
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * If enabled, uninstalls any installed extension that is not in the current preset list.
 * The preset list is the single source of truth; only SKC VS Tools is always kept.
 * Built-in extensions are skipped (they cannot be uninstalled).
 */
async function uninstallExtensionsRemovedFromPreset(
  context: ExtensionContext,
  channel: OutputChannel,
  extensionsToInstall: string[],
  enabled: boolean
): Promise<void> {
  if (!enabled) {
    return;
  }
  const allowedSet = new Set(extensionsToInstall);
  const myId = context.extension?.id;
  // Snapshot list so we don't iterate over a changing array (e.g. if uninstall triggers updates)
  const allExtensions = [...extensions.all];
  for (const ext of allExtensions) {
    if (ext.id === myId || allowedSet.has(ext.id)) {
      continue;
    }
    // Skip built-in extensions (they cannot be uninstalled; path typically under app's resources/extensions)
    const extPath = ext.extensionPath ?? "";
    if (extPath.includes(`${path.sep}resources${path.sep}`) || extPath.includes(`${path.sep}app${path.sep}extensions${path.sep}`)) {
      continue;
    }
    channel.appendLine(`[SKC] Uninstalling ${ext.id} (not in preset list)...`);
    try {
      await commands.executeCommand("workbench.extensions.uninstallExtension", ext);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/built-in|Built-in|cannot be uninstalled/i.test(msg)) {
        channel.appendLine(`[SKC] Skipping built-in extension ${ext.id} (cannot be uninstalled).`);
      } else {
        channel.appendLine(`[SKC] Failed to uninstall ${ext.id}: ${msg}`);
      }
    }
  }
}

async function ensureExtensions(
  channel: OutputChannel,
  skipInstalled: boolean,
  extensionsToInstall: string[]
): Promise<void> {
  for (const id of extensionsToInstall) {
    const isInstalled = extensions.getExtension(id) !== undefined;

    if (isInstalled && skipInstalled) {
      channel.appendLine(`[SKC] ${id} already installed; skipping.`);
      continue;
    }

    channel.appendLine(`[SKC] Installing ${id}...`);
    await commands.executeCommand("workbench.extensions.installExtension", id);
  }
}

export function deactivate(): void {
  // Nothing to clean up.
}

type PresetFileShape = {
  settings?: Record<string, unknown>;
  extensions?: unknown;
};

type McpFileShape = {
  servers?: unknown;
  mcpServers?: unknown;
};

type ExtensionsFileShape = {
  extensions?: unknown;
};

async function readPresetFile(
  presetPath: string | undefined,
  context: ExtensionContext,
  channel: OutputChannel
): Promise<{ settings?: Record<string, unknown>; extensions?: string[] }> {
  if (!presetPath) {
    return {};
  }

  const resolvedPath = await resolvePath(presetPath, context);
  if (!resolvedPath) {
    channel.appendLine(`[SKC] Unable to resolve preset path '${presetPath}'; no presets applied.`);
    return {};
  }

  try {
    const raw = await fs.readFile(resolvedPath, "utf8");
    const parsed: PresetFileShape = JSON.parse(raw);

    const settings =
      parsed.settings && typeof parsed.settings === "object" && !Array.isArray(parsed.settings)
        ? parsed.settings
        : undefined;
    const extensions =
      Array.isArray(parsed.extensions) && parsed.extensions.every((e) => typeof e === "string")
        ? (parsed.extensions as string[])
        : undefined;

    channel.appendLine(`[SKC] Loaded preset file from ${resolvedPath}.`);
    return { settings, extensions };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    channel.appendLine(`[SKC] Failed to read preset file at ${resolvedPath}: ${message}`);
    return {};
  }
}

async function readMcpFile(
  mcpPath: string | undefined,
  context: ExtensionContext,
  channel: OutputChannel
): Promise<unknown[] | undefined> {
  if (!mcpPath) {
    return undefined;
  }

  const resolvedPath = await resolvePath(mcpPath, context);
  if (!resolvedPath) {
    channel.appendLine(`[SKC] Unable to resolve MCP path '${mcpPath}'; keeping existing mcp.servers.`);
    return undefined;
  }

  try {
    const raw = await fs.readFile(resolvedPath, "utf8");
    const parsed: unknown = JSON.parse(raw);

    const servers =
      isRecord(parsed) && Array.isArray(parsed.servers)
        ? (parsed.servers as unknown[])
        : Array.isArray(parsed)
          ? parsed
          : isRecord(parsed) && isRecord(parsed.mcpServers)
            ? convertCursorMcpServersToArray(parsed.mcpServers, resolvedPath, channel)
            : undefined;

    if (!servers) {
      channel.appendLine(
        `[SKC] MCP file at ${resolvedPath} did not contain a 'servers' array, a top-level array, or a 'mcpServers' object; leaving mcp.servers unchanged.`
      );
      return undefined;
    }

    channel.appendLine(`[SKC] Loaded MCP servers from ${resolvedPath}.`);
    return servers;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    channel.appendLine(`[SKC] Failed to read MCP file at ${resolvedPath}: ${message}`);
    return undefined;
  }
}

function convertCursorMcpServersToArray(
  mcpServers: Record<string, unknown>,
  sourcePath: string,
  channel: OutputChannel
): unknown[] | undefined {
  const result: unknown[] = [];

  for (const [id, cfg] of Object.entries(mcpServers)) {
    if (!isRecord(cfg)) {
      channel.appendLine(
        `[SKC] MCP file at ${sourcePath} contains non-object mcpServers entry for ${JSON.stringify(id)}; skipping.`
      );
      continue;
    }

    const server: Record<string, unknown> = { ...cfg };
    if (typeof server.id !== "string") {
      server.id = id;
    }

    result.push(server);
  }

  return result.length > 0 ? result : undefined;
}

async function readExtensionsFile(
  extensionsPath: string | undefined,
  context: ExtensionContext,
  channel: OutputChannel
): Promise<string[] | undefined> {
  if (!extensionsPath) {
    return undefined;
  }

  const resolvedPath = await resolvePath(extensionsPath, context);
  if (!resolvedPath) {
    channel.appendLine(`[SKC] Unable to resolve extensions path '${extensionsPath}'; no additional extensions applied.`);
    return undefined;
  }

  try {
    const raw = await fs.readFile(resolvedPath, "utf8");
    const parsed: ExtensionsFileShape = JSON.parse(raw);
    const ext =
      parsed.extensions && Array.isArray(parsed.extensions)
        ? parsed.extensions
        : Array.isArray(parsed as unknown)
          ? (parsed as string[])
          : undefined;

    const valid =
      ext && ext.every((e) => typeof e === "string") ? (ext as string[]) : undefined;

    if (!valid) {
      channel.appendLine(
        `[SKC] Extensions file at ${resolvedPath} did not contain a string array; ignoring.`
      );
      return undefined;
    }

    channel.appendLine(`[SKC] Loaded extensions from ${resolvedPath}.`);
    return valid;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    channel.appendLine(`[SKC] Failed to read extensions file at ${resolvedPath}: ${message}`);
    return undefined;
  }
}

/**
 * Writes MCP servers to the Cursor user path (e.g. %USERPROFILE%\.cursor\mcp.json on Windows)
 * in Cursor's expected format ({ "mcpServers": { "id": { ...config } } }).
 * Uses the same list as settings (preset-only or merged per removeMcpsNotInPreset), so removals
 * and version updates stay in sync: if an MCP is removed from the preset, it is removed here too.
 */
async function writeCursorMcpFileIfNeeded(
  channel: OutputChannel,
  mcpServers: unknown[]
): Promise<void> {
  const cursorDir = path.join(os.homedir(), ".cursor");
  const mcpFilePath = path.join(cursorDir, "mcp.json");

  const mcpServersObj: Record<string, unknown> = {};
  for (const entry of mcpServers) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const server = entry as Record<string, unknown>;
    const id = typeof server.id === "string" ? server.id : undefined;
    if (!id) {
      channel.appendLine(`[SKC] Skipping MCP server without id when writing ${mcpFilePath}.`);
      continue;
    }
    mcpServersObj[id] = server;
  }

  try {
    await fs.mkdir(cursorDir, { recursive: true });
    const content = JSON.stringify({ mcpServers: mcpServersObj }, null, 2);
    await fs.writeFile(mcpFilePath, content, "utf8");
    const count = Object.keys(mcpServersObj).length;
    channel.appendLine(`[SKC] Wrote ${count} MCP server(s) to ${mcpFilePath}.`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    channel.appendLine(`[SKC] Failed to write ${mcpFilePath}: ${message}`);
  }
}

async function resolvePath(
  configuredPath: string,
  context: ExtensionContext
): Promise<string | undefined> {
  if (!configuredPath) {
    return undefined;
  }

  if (configuredPath === "cursor-global") {
    const cursorGlobalMcpPath = path.join(os.homedir(), ".cursor", "mcp.json");
    return (await pathExists(cursorGlobalMcpPath)) ? cursorGlobalMcpPath : undefined;
  }

  if (path.isAbsolute(configuredPath)) {
    return (await pathExists(configuredPath)) ? configuredPath : undefined;
  }

  const workspaceFolder = workspace.workspaceFolders?.[0]?.uri.fsPath;
  const candidates = [
    ...(workspaceFolder ? [path.join(workspaceFolder, configuredPath)] : []),
    path.join(context.extensionPath, configuredPath)
  ];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function injectMcpSecrets(
  context: ExtensionContext,
  channel: OutputChannel,
  servers: unknown[] | undefined,
  silent: boolean
): Promise<unknown[] | undefined> {
  if (!servers || !Array.isArray(servers)) {
    return servers;
  }

  const allowPrompt = !silent;
  let githubToken: string | undefined;
  let context7ApiKey: string | undefined;
  const hydrated: unknown[] = [];

  for (const server of servers) {
    if (!isRecord(server) || typeof server.id !== "string") {
      hydrated.push(server);
      continue;
    }

    const copy: Record<string, unknown> = { ...server };
    const headers = isRecord(copy.headers) ? { ...copy.headers } : {};

    if (copy.id === "github") {
      if (!githubToken) {
        githubToken = await getOrPromptSecret(
          context,
          "skc.githubToken",
          "Enter a GitHub MCP token (PAT or MCP token). Stored securely.",
          allowPrompt
        );
      }
      if (githubToken) {
        headers.Authorization = githubToken.startsWith("Bearer ")
          ? githubToken
          : `Bearer ${githubToken}`;
      } else {
        channel.appendLine(
          "[SKC] No GitHub token available; 'github' MCP server will be applied without Authorization."
        );
      }
    }

    if (copy.id === "context7") {
      if (!context7ApiKey) {
        context7ApiKey = await getOrPromptSecret(
          context,
          "skc.context7ApiKey",
          "Enter the Context7 API key. Stored securely.",
          allowPrompt
        );
      }
      if (context7ApiKey) {
        headers.CONTEXT7_API_KEY = context7ApiKey;
      } else {
        channel.appendLine(
          "[SKC] No Context7 API key available; 'context7' MCP server will be applied without CONTEXT7_API_KEY."
        );
      }
    }

    if (Object.keys(headers).length > 0) {
      copy.headers = headers;
    }

    hydrated.push(copy);
  }

  return hydrated;
}

async function getOrPromptSecret(
  context: ExtensionContext,
  key: string,
  prompt: string,
  allowPrompt: boolean
): Promise<string | undefined> {
  const existing = await context.secrets.get(key);
  if (existing) {
    return existing;
  }

  if (!allowPrompt) {
    return undefined;
  }

  const value = await window.showInputBox({
    prompt,
    ignoreFocusOut: true,
    password: true
  });
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  await context.secrets.store(key, trimmed);
  return trimmed;
}

async function promptAndSaveMcpSecrets(context: ExtensionContext): Promise<boolean> {
  const githubToken = await getOrPromptSecret(
    context,
    "skc.githubToken",
    "Enter a GitHub MCP token (PAT or MCP token). Stored securely.",
    true
  );
  const context7ApiKey = await getOrPromptSecret(
    context,
    "skc.context7ApiKey",
    "Enter the Context7 API key. Stored securely.",
    true
  );

  return Boolean(githubToken || context7ApiKey);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function showNewsIfNeeded(
  context: ExtensionContext,
  channel: OutputChannel,
  currentVersion: string | undefined,
  isNewVersion: boolean
): Promise<void> {
  const cfg = workspace.getConfiguration("skc");
  const showNews = cfg.get<boolean>("showNewsOnStartup", true);
  const autoOpenNews = cfg.get<boolean>("autoOpenNewsPage", false);
  const newsFilePath = cfg.get<string>("newsFilePath", "").trim();

  if (!showNews) {
    return;
  }

  // Check if news was already shown for this version
  const newsShownForVersion = context.globalState.get<string>(STATE_NEWS_SHOWN_KEY);
  const shouldShowNews = isNewVersion || newsShownForVersion !== currentVersion;

  if (!shouldShowNews) {
    channel.appendLine(`[SKC] News already shown for version ${currentVersion}.`);
    return;
  }

  // Try to find and show the news file
  const resolvedNewsPath = await resolvePath(newsFilePath || "presets/NEWS.md", context);

  if (!resolvedNewsPath) {
    channel.appendLine(`[SKC] News file not found at '${newsFilePath || "presets/NEWS.md"}'; skipping news notification.`);
    return;
  }

  try {
    // Read the news file to check if it has content
    const newsContent = await fs.readFile(resolvedNewsPath, "utf8");

    if (!newsContent.trim()) {
      channel.appendLine(`[SKC] News file is empty; skipping notification.`);
      return;
    }

    channel.appendLine(`[SKC] Showing news from ${resolvedNewsPath}`);
    const newsUri = Uri.file(resolvedNewsPath);

    // Auto-open news page if configured
    if (autoOpenNews) {
      // Open markdown preview in a new tab at the top
      await commands.executeCommand("markdown.showPreviewToSide", newsUri);
      channel.appendLine(`[SKC] Auto-opened news file in preview mode (new tab).`);
      // Mark as shown
      if (currentVersion) {
        await context.globalState.update(STATE_NEWS_SHOWN_KEY, currentVersion);
      }
      return;
    }

    // Show notification with options
    const action = await window.showInformationMessage(
      `📰 SKC Tools ${currentVersion ? `v${currentVersion}` : ""} - What's New?`,
      "View News",
      "Dismiss"
    );

    if (action === "View News") {
      // Open markdown preview in a new tab
      await commands.executeCommand("markdown.showPreviewToSide", newsUri);
      channel.appendLine(`[SKC] Opened news file in preview mode (new tab).`);
    }

    // Mark news as shown for this version
    if (currentVersion) {
      await context.globalState.update(STATE_NEWS_SHOWN_KEY, currentVersion);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    channel.appendLine(`[SKC] Failed to show news: ${message}`);
  }
}
