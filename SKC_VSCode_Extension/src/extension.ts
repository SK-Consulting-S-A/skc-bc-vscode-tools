import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import {
  commands,
  ConfigurationTarget,
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
import { TranslationsProvider, SourceFileItem, TargetLanguageItem, AddLanguageItem } from "./translationsView";
import { translateFile, createTranslationFile } from "./translationService";

const OUTPUT_CHANNEL_NAME = "SKC Presets";
const STATE_KEY = "skc.presetsApplied";
const STATE_VERSION_KEY = "skc.presetsVersion";
const STATE_NEWS_SHOWN_KEY = "skc.newsShownForVersion";

export async function activate(context: ExtensionContext): Promise<void> {
  const channel = window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  context.subscriptions.push(channel);

  const currentVersion = (context.extension?.packageJSON?.version as string | undefined) ?? undefined;
  const storedVersion = context.globalState.get<string>(STATE_VERSION_KEY);
  const isNewVersion = Boolean(currentVersion && storedVersion !== currentVersion);

  const applyCommand = commands.registerCommand("skc.applyPresets", async () => {
    await applyPresets(context, channel, false);
  });
  context.subscriptions.push(applyCommand);

  const configureAuthCommand = commands.registerCommand("skc.configureMcpAuth", async () => {
    const saved = await promptAndSaveMcpSecrets(context);
    const message = saved
      ? "SKC MCP credentials saved."
      : "No MCP credentials were saved.";
    void window.showInformationMessage(message);
  });
  context.subscriptions.push(configureAuthCommand);

  // Register Translations View
  const translationsProvider = new TranslationsProvider();
  const translationsView = window.createTreeView("skc.translationsView", {
    treeDataProvider: translationsProvider,
    showCollapseAll: false
  });
  context.subscriptions.push(translationsView);
  context.subscriptions.push({ dispose: () => translationsProvider.dispose() });

  // Register Translate File command
  const translateFileCommand = commands.registerCommand(
    "skc.translateFile",
    async (item?: SourceFileItem | TargetLanguageItem) => {
      if (item instanceof SourceFileItem) {
        // Translate source file - will prompt for target language
        await translateFile(item.resourceUri, channel, item.workspaceFolder);
        translationsProvider.refresh();
      } else if (item instanceof TargetLanguageItem) {
        // Translate specific target file
        await translateFile(item.sourceFile.resourceUri, channel, item.sourceFile.workspaceFolder, item.language);
        translationsProvider.refresh();
      } else {
        void window.showWarningMessage("Please select a file from the Translations view.");
      }
    }
  );
  context.subscriptions.push(translateFileCommand);

  // Register Create Translation File command
  const createTranslationFileCommand = commands.registerCommand(
    "skc.createTranslationFile",
    async (sourceFile?: SourceFileItem, language?: string) => {
      if (sourceFile && language) {
        await createTranslationFile(sourceFile.resourceUri, language, channel);
        translationsProvider.refresh();
      }
    }
  );
  context.subscriptions.push(createTranslationFileCommand);

  // Register Refresh Translations command
  const refreshTranslationsCommand = commands.registerCommand(
    "skc.refreshTranslations",
    () => {
      translationsProvider.refresh();
    }
  );
  context.subscriptions.push(refreshTranslationsCommand);

  // Register Open Translation Unit command
  const openTransUnitCommand = commands.registerCommand(
    "skc.openTransUnit",
    async (fileUri: Uri, unitId: string) => {
      try {
        // Open the file
        const document = await workspace.openTextDocument(fileUri);
        const editor = await window.showTextDocument(document);

        // Search for the trans-unit with the specified ID
        const text = document.getText();
        const searchPattern = new RegExp(`<trans-unit\\s+id="${unitId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'i');
        const match = searchPattern.exec(text);

        if (match) {
          // Calculate the position and reveal it
          const position = document.positionAt(match.index);
          const range = new Range(position, position);
          
          // Reveal and select the line
          editor.selection = new Selection(position, position);
          editor.revealRange(range, TextEditorRevealType.InCenter);
        } else {
          void window.showWarningMessage(`Could not find translation unit with ID: ${unitId}`);
        }
      } catch (err) {
        void window.showErrorMessage(`Failed to open translation unit: ${err}`);
      }
    }
  );
  context.subscriptions.push(openTransUnitCommand);

  // Register Filter Untranslated command - opens file and triggers Find with search pattern
  const filterUntranslatedCommand = commands.registerCommand(
    "skc.filterUntranslated",
    async (item: TargetLanguageItem) => {
      try {
        // Open the file
        const document = await workspace.openTextDocument(item.resourceUri);
        await window.showTextDocument(document);

        // Trigger Find with search for untranslated units
        // Use state="needs-translation" pattern
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
  );
  context.subscriptions.push(filterUntranslatedCommand);

  // Register Configure Translation URL command
  const configureTranslationUrlCommand = commands.registerCommand(
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
          if (!value.trim()) {
            return "URL cannot be empty";
          }
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
  );
  context.subscriptions.push(configureTranslationUrlCommand);

  // Always apply presets on startup (forced to true)
  const autoApply = true;
  const alreadyApplied = context.globalState.get<boolean>(STATE_KEY, false);

  if (autoApply && (!alreadyApplied || isNewVersion)) {
    await applyPresets(context, channel, true);
  }

  // Show news notification on startup (especially for new versions)
  await showNewsIfNeeded(context, channel, currentVersion, isNewVersion);
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
  if (Array.isArray(mcpServers) && mcpServers.length > 0) {
    settingsToApply["mcp.servers"] = mcpServers;
    channel.appendLine(`[SKC] Added ${mcpServers.length} MCP server(s) to settings.`);
  }
  const extensionsToInstall = Array.from(
    new Set([
      ...(presetExtensions ?? []),
      ...(extraExtensions ?? [])
    ])
  );

  await ensureExtensions(channel, skipInstalled, extensionsToInstall);
  await applySettings(channel, settingsToApply);

  await context.globalState.update(STATE_KEY, true);
  const currentVersion = (context.extension?.packageJSON?.version as string | undefined) ?? undefined;
  if (currentVersion) {
    await context.globalState.update(STATE_VERSION_KEY, currentVersion);
  }

  if (!silent) {
    void window.showInformationMessage("SKC presets applied.");
  }
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

    channel.appendLine(`[SKC] Updating ${key} from ${JSON.stringify(current)} to ${JSON.stringify(value)}.`);
    try {
      await config.update(key, value, ConfigurationTarget.Global);

      // Verify the setting was actually written
      const verifyValue = config.get(key, undefined);
      const matches = JSON.stringify(verifyValue) === JSON.stringify(value);

      if (matches) {
        channel.appendLine(`[SKC] Successfully updated ${key}.`);
        updatedCount++;
      } else {
        channel.appendLine(`[SKC] WARNING: ${key} was updated but verification failed. Expected: ${JSON.stringify(value)}, Got: ${JSON.stringify(verifyValue)}`);
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
      if (matches) {
        channel.appendLine(`[SKC] ✓ Verified: ${key} is set correctly`);
      } else {
        channel.appendLine(`[SKC] ✗ Warning: ${key} verification failed. Expected: ${JSON.stringify(expectedValue)}, Got: ${JSON.stringify(finalValue)}`);
      }
    }
    channel.appendLine(`[SKC] Note: Settings file location: %APPDATA%\\Code\\User\\settings.json (Windows)`);
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
