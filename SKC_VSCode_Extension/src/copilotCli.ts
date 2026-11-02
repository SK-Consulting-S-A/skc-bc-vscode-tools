import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

export function getCopilotCliHome(): string {
  return process.env.COPILOT_HOME
    ? path.resolve(process.env.COPILOT_HOME)
    : path.join(os.homedir(), ".copilot");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function convertVariables(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/\$\{([^}]+)\}/g, (_match, reference: string) => {
      if (/^(workspaceFolder|workspaceFolderBasename|userHome|file|fileWorkspaceFolder|relativeFile|relativeFileDirname|fileBasename|fileBasenameNoExtension|fileExtname|fileDirname|fileDirnameBasename|cwd|lineNumber|selectedText|execPath|pathSeparator|\/)$/.test(reference)) {
        throw new Error("Unsupported VS Code variable");
      }
      const name = reference.replace(/^(input|env):/, "");
      if (!/^[A-Za-z_][A-Za-z0-9_]*(?::-.*)?$/.test(name)) {
        throw new Error("Unsupported VS Code variable");
      }
      return `\${${name}}`;
    });
  }
  if (Array.isArray(value)) return value.map(convertVariables);
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, convertVariables(item)]));
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

  const converted = convertCopilotCliServers(servers, log);
  const current = isRecord(existing.mcpServers) ? existing.mcpServers : {};
  // Preserve user servers, credentials, disabled state, and tool restrictions on repeated installs.
  const mcpServers = { ...converted, ...current };
  await fs.mkdir(copilotHome, { recursive: true, mode: 0o700 });
  await fs.writeFile(filePath, JSON.stringify({ ...existing, mcpServers }, null, "\t") + "\n", { mode: 0o600 });
  log(`[SKC] Wrote ${Object.keys(mcpServers).length} MCP server(s) to Copilot CLI ${filePath}.`);
}
