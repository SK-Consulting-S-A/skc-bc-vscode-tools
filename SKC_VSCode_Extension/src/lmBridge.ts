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
    channel.appendLine("[SKC] LM Bridge is disabled (skc.enableLmBridge).");
    return;
  }

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
    vscode.extensions.all.forEach((ext) => {
      const lmTools = ext.packageJSON?.contributes?.languageModelTools;
      if (lmTools && Array.isArray(lmTools)) {
        for (const t of lmTools as { name?: string; description?: string }[]) {
          tools.push({
            name: t.name ?? "unknown",
            description: t.description ?? `Tool from ${ext.id}`,
            inputSchema: { type: "object", properties: {} }
          });
        }
      }
    });
    log("ListTools: found", tools.length, "tools", tools.map((t) => t.name));
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
    log(`Server listening on http://localhost:${port}/sse`);
  });

  listener.on("error", (err: Error) => {
    channel.appendLine(`[SKC LM Bridge] Server error: ${err.message}`);
  });

  context.subscriptions.push({
    dispose: () => {
      listener.close();
      log("Server stopped.");
    }
  });
}
