import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { randomUUID } from "crypto";

export function getCopilotCliHome(): string {
  return process.env.COPILOT_HOME
    ? path.resolve(process.env.COPILOT_HOME)
    : path.join(os.homedir(), ".copilot");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function convertVariables(value: unknown, allowVariables = false): unknown {
  if (typeof value === "string") {
    return value.replace(/\$\{([^}]+)\}/g, (_match, reference: string) => {
      if (!allowVariables || /^(workspaceFolder|workspaceFolderBasename|userHome|file|fileWorkspaceFolder|relativeFile|relativeFileDirname|fileBasename|fileBasenameNoExtension|fileExtname|fileDirname|fileDirnameBasename|cwd|lineNumber|selectedText|execPath|pathSeparator|\/)$/.test(reference)) {
        throw new Error("Unsupported VS Code variable");
      }
      const name = reference.replace(/^(input|env):/, "");
      if (!/^[A-Za-z_][A-Za-z0-9_]*(?::-.*)?$/.test(name)) {
        throw new Error("Unsupported VS Code variable");
      }
      return `\${${name}}`;
    });
  }
  if (Array.isArray(value)) return value.map(item => convertVariables(item, allowVariables));
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, convertVariables(item, allowVariables || key === "env" || key === "headers")]));
  }
  return value;
}

export function convertCopilotCliServers(
  servers: unknown[],
  log: (message: string) => void
): Record<string, unknown> {
  const result = new Map<string, unknown>();
  for (const entry of servers) {
    if (!isRecord(entry) || typeof entry.id !== "string" || !entry.id) continue;
    const { id, ...server } = entry;
    const type = server.type ?? (typeof server.command === "string" ? "stdio" : undefined);
    const local = type === "stdio" || type === "local";
    if (
      (local && (typeof server.command !== "string" || !server.command.trim())) ||
      (!local && ((type !== "http" && type !== "sse") || typeof server.url !== "string"))
    ) {
      log(`[SKC] Copilot CLI: skipped "${id}" — unsupported MCP server configuration.`);
      continue;
    }
    try {
      result.set(id, convertVariables({
        ...server,
        ...(local ? { args: server.args ?? [] } : {}),
        type: local ? "local" : type,
        tools: server.tools ?? ["*"]
      }));
    } catch {
      log(`[SKC] Copilot CLI: skipped "${id}" — replace unsupported VS Code variables in a CLI-specific entry.`);
    }
  }
  return Object.fromEntries(result);
}

export async function writeCopilotCliMcpFile(
  copilotHome: string,
  servers: unknown[],
  log: (message: string) => void
): Promise<void> {
  const converted = convertCopilotCliServers(servers, log);
  await updateCopilotCliMcpFile(copilotHome, existing => {
    const current = isRecord(existing.mcpServers) ? existing.mcpServers : {};
    // Preserve user servers, credentials, disabled state, and tool restrictions on repeated installs.
    const mcpServers = { ...converted, ...current };
    log(`[SKC] Configuring ${Object.keys(mcpServers).length} MCP server(s) for Copilot CLI ${path.join(copilotHome, "mcp-config.json")}.`);
    return { ...existing, mcpServers };
  });
}

async function readCopilotCliMcpFile(copilotHome: string): Promise<Record<string, unknown>> {
  const filePath = path.join(copilotHome, "mcp-config.json");
  let existing: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(filePath, "utf8"));
    if (!isRecord(parsed) || (parsed.mcpServers !== undefined && !isRecord(parsed.mcpServers))) {
      throw new Error("Invalid Copilot CLI MCP configuration");
    }
    existing = parsed;
  } catch (error: unknown) {
    if (!isRecord(error) || error.code !== "ENOENT") {
      throw new Error(`Cannot read Copilot CLI MCP configuration at ${filePath}; existing file left unchanged.`);
    }
  }

  return existing;
}

async function saveCopilotCliMcpFile(copilotHome: string, config: Record<string, unknown>): Promise<void> {
  let filePath = path.join(copilotHome, "mcp-config.json");
  try {
    filePath = await fs.realpath(filePath);
  } catch (error: unknown) {
    if (!isRecord(error) || error.code !== "ENOENT") throw error;
  }
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, JSON.stringify(config, null, "\t") + "\n", { flag: "wx", mode: 0o600 });
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

async function updateCopilotCliMcpFile(
  copilotHome: string,
  update: (existing: Record<string, unknown>) => Record<string, unknown> | undefined
): Promise<void> {
  await fs.mkdir(copilotHome, { recursive: true, mode: 0o700 });
  const lockPath = path.join(copilotHome, "mcp-config.json.skc-lock");
  let lock: Awaited<ReturnType<typeof fs.open>> | undefined;
  for (let attempt = 0; attempt < 50 && !lock; attempt++) {
    try {
      lock = await fs.open(lockPath, "wx", 0o600);
    } catch (error: unknown) {
      if (!isRecord(error) || error.code !== "EEXIST") throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  if (!lock) throw new Error(`Copilot CLI configuration is busy. If no SKC setup is running, remove the stale lock at ${lockPath} and retry.`);
  try {
    const config = update(await readCopilotCliMcpFile(copilotHome));
    if (config) await saveCopilotCliMcpFile(copilotHome, config);
  } finally {
    await lock.close();
    await fs.rm(lockPath, { force: true });
  }
}

export async function updateCopilotCliBridgeConfig(
  copilotHome: string,
  url: string,
  token?: string
): Promise<void> {
  await updateCopilotCliMcpFile(copilotHome, existing => {
    const servers = isRecord(existing.mcpServers) ? { ...existing.mcpServers } : {};
    const id = "skc-vscode-tools";
    if (token) {
      servers[id] = { type: "http", url, headers: { Authorization: ["Bearer", token].join(" ") }, tools: ["*"], timeout: 660_000 };
    } else if (isRecord(servers[id]) && servers[id].url === url) {
      delete servers[id];
    } else {
      return undefined;
    }
    return { ...existing, mcpServers: servers };
  });
}
