import * as vscode from "vscode";
import express from "express";
import type { OutputChannel } from "vscode";

const DEFAULT_PORT = 7878;

export function startLmBridge(
  context: vscode.ExtensionContext,
  channel: OutputChannel
): void {
  const cfg = vscode.workspace.getConfiguration("skc");
  const enabled = cfg.get<boolean>("enableLmBridge", true);
  const port = cfg.get<number>("lmBridgePort", DEFAULT_PORT);

  if (!enabled) {
    channel.appendLine("[SKC] LM Bridge is disabled (skc.enableLmBridge = false).");
    channel.appendLine("[SKC] To enable: Set 'skc.enableLmBridge' to true in settings.");
    return;
  }

  channel.appendLine("");
  channel.appendLine("─".repeat(60));
  channel.appendLine("[SKC] Starting LM Bridge MCP Server...");
  channel.appendLine(`[SKC] Purpose: Expose VS Code Language Model tools to Cursor AI`);
  channel.appendLine(`[SKC] Port: ${port}`);

  // Use require() with .js extensions for proper module resolution with bundlers
  const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
  const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js");
  const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");

  const log = (msg: string, ...args: unknown[]) => {
    const line =
      args.length
        ? `${msg} ${args.map((a) => (typeof a === "object" ? JSON.stringify(a) : a)).join(" ")}`
        : msg;
    channel.appendLine(`[SKC LM Bridge] ${line}`);
  };

  const app = express();
  let transport: { handlePostMessage(req: unknown, res: unknown): Promise<void> } | null = null;

  const server = new Server(
    { name: "skc-lm-bridge", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: { name: string; description: string; inputSchema: object }[] = [];
    const toolsByExtension: Record<string, string[]> = {};

    vscode.extensions.all.forEach((ext) => {
      const lmTools = ext.packageJSON?.contributes?.languageModelTools;
      if (lmTools && Array.isArray(lmTools)) {
        const extToolNames: string[] = [];
        for (const t of lmTools as { name?: string; description?: string }[]) {
          const toolName = t.name ?? "unknown";
          tools.push({
            name: toolName,
            description: t.description ?? `Tool from ${ext.id}`,
            inputSchema: { type: "object", properties: {} }
          });
          extToolNames.push(toolName);
        }
        if (extToolNames.length > 0) {
          toolsByExtension[ext.id] = extToolNames;
        }
      }
    });

    log(`ListTools request: Found ${tools.length} tool(s) from ${Object.keys(toolsByExtension).length} extension(s)`);
    for (const [extId, toolNames] of Object.entries(toolsByExtension)) {
      log(`  - ${extId}: ${toolNames.join(", ")}`);
    }

    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request: { params: { name: string; arguments?: Record<string, unknown> } }) => {
    const toolName = request.params.name;
    log("CallTool:", toolName);
    try {
      const lm = (vscode as unknown as { lm?: { invokeTool: (name: string, args: object) => Promise<unknown> } }).lm;
      if (!lm?.invokeTool) {
        throw new Error("vscode.lm.invokeTool is not available.");
      }
      const result = await lm.invokeTool(toolName, request.params.arguments ?? {});
      log("CallTool OK:", toolName);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }]
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log("CallTool ERROR:", toolName, message);
      return {
        content: [{ type: "text" as const, text: `Error calling ${toolName}: ${message}` }],
        isError: true
      };
    }
  });

  // Discover tools on startup
  const initialTools: { name: string; extensionId: string }[] = [];
  vscode.extensions.all.forEach((ext) => {
    const lmTools = ext.packageJSON?.contributes?.languageModelTools;
    if (lmTools && Array.isArray(lmTools)) {
      for (const t of lmTools as { name?: string }[]) {
        if (t.name) {
          initialTools.push({ name: t.name, extensionId: ext.id });
        }
      }
    }
  });

  app.get("/sse", async (_req, res) => {
    log("SSE client connected");
    transport = new SSEServerTransport("/messages", res);
    await server.connect(transport);
  });

  app.post("/messages", async (req, res) => {
    if (transport) {
      await transport.handlePostMessage(req, res);
    }
  });

  const listener = app.listen(port, () => {
    channel.appendLine(`[SKC] ✓ LM Bridge server started successfully!`);
    channel.appendLine(`[SKC] Connection URL: http://localhost:${port}/sse`);
    channel.appendLine("");

    // Show discovered tools
    if (initialTools.length > 0) {
      channel.appendLine(`[SKC] 🔧 Discovered ${initialTools.length} Language Model Tool(s):`);
      const toolsByExt: Record<string, string[]> = {};
      initialTools.forEach(({ name, extensionId }) => {
        if (!toolsByExt[extensionId]) {
          toolsByExt[extensionId] = [];
        }
        toolsByExt[extensionId].push(name);
      });
      for (const [extId, tools] of Object.entries(toolsByExt)) {
        channel.appendLine(`[SKC]    • ${extId}:`);
        tools.forEach(tool => channel.appendLine(`[SKC]      - ${tool}`));
      }
      channel.appendLine("");
    } else {
      channel.appendLine("[SKC] ⚠️  No Language Model Tools found in installed extensions.");
      channel.appendLine("");
    }

    channel.appendLine("[SKC] 📋 To connect Cursor AI to this MCP server:");
    channel.appendLine("[SKC]    1. Open Cursor Settings (Ctrl/Cmd + Shift + J)");
    channel.appendLine("[SKC]    2. Go to 'Model Context Protocol' section");
    channel.appendLine("[SKC]    3. Add this server configuration:");
    channel.appendLine("");
    channel.appendLine(`[SKC]       {`);
    channel.appendLine(`[SKC]         "id": "skc-lm-bridge",`);
    channel.appendLine(`[SKC]         "type": "sse",`);
    channel.appendLine(`[SKC]         "url": "http://localhost:${port}/sse"`);
    channel.appendLine(`[SKC]       }`);
    channel.appendLine("");
    channel.appendLine("[SKC] Cursor will now be able to call these tools via MCP!");
    channel.appendLine("─".repeat(60));
    channel.appendLine("");
  });

  listener.on("error", (err: Error) => {
    channel.appendLine("");
    channel.appendLine(`[SKC LM Bridge] ❌ Server error: ${err.message}`);
    if (err.message.includes("EADDRINUSE")) {
      channel.appendLine(`[SKC LM Bridge] Port ${port} is already in use.`);
      channel.appendLine(`[SKC LM Bridge] Change 'skc.lmBridgePort' in settings or stop the conflicting process.`);
    }
    channel.appendLine("─".repeat(60));
  });

  context.subscriptions.push({
    dispose: () => {
      listener.close();
      log("Server stopped.");
    }
  });
}
