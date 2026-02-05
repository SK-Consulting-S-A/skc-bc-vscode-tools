import * as vscode from "vscode";
import * as http from "http";
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

  let transport: { handlePostMessage(req: unknown, res: unknown): Promise<void> } | null = null;

  const mcpServer = new Server(
    { name: "skc-lm-bridge", version: "1.0.0" },
    {
      capabilities: {
        tools: {
          listChanged: true
        }
      }
    }
  );

  const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = req.url || "";
    log(`Incoming ${req.method} request to: ${url}`);

    if (req.method === "GET" && url.startsWith("/sse")) {
      log("SSE client connected from " + (req.headers['user-agent'] || 'unknown'));
      try {
        transport = new SSEServerTransport("/messages", res);
        log("SSE transport created, connecting server...");
        await mcpServer.connect(transport);
        log("Server connected to SSE transport");
      } catch (err: any) {
        log("Error setting up SSE connection:", err.message);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: err.message }));
        }
      }
      return;
    }

    if (req.method === "POST" && url.startsWith("/messages")) {
      log("Received POST to /messages, content-type:", req.headers['content-type'] || 'none');
      if (!transport) {
        log("ERROR: No transport available - SSE connection not established yet");
        res.writeHead(503);
        res.end(JSON.stringify({ error: "No SSE connection established" }));
        return;
      }

      try {
        log("Passing request to SSE transport...");
        await transport.handlePostMessage(req, res);
        log("Message handled successfully");
      } catch (err: any) {
        log("ERROR handling message:", err.message, err.stack);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: err.message }));
        }
      }
      return;
    }

    // 404 for unknown routes
    log(`404 Not Found: ${req.method} ${url}`);
    res.writeHead(404);
    res.end("Not Found");
  });

  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: { name: string; description: string; inputSchema: object }[] = [];
    const toolsByExtension: Record<string, string[]> = {};

    vscode.extensions.all.forEach((ext) => {
      const lmTools = ext.packageJSON?.contributes?.languageModelTools;
      if (lmTools && Array.isArray(lmTools)) {
        const extToolNames: string[] = [];
        for (const t of lmTools as any[]) {
          const toolName = t.name ?? "unknown";

          // Use modelDescription (preferred by AI) or fallback to description
          const description = t.modelDescription || t.description || t.displayName || `Tool from ${ext.id}`;

          // Try with the actual schema - validate it's proper JSON Schema
          let inputSchema = { type: "object", properties: {} };
          if (t.inputSchema && typeof t.inputSchema === "object") {
            try {
              // Ensure it has the minimum required structure
              if (t.inputSchema.type && t.inputSchema.properties) {
                inputSchema = t.inputSchema;
              }
            } catch (e) {
              log(`Warning: Invalid schema for tool ${toolName}, using empty schema`);
            }
          }

          tools.push({
            name: toolName,
            description: description,
            inputSchema: inputSchema
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

    const response = { tools };
    log(`Returning ${tools.length} tools to MCP client`);
    return response;
  });

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request: { params: { name: string; arguments?: Record<string, unknown> } }) => {
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
  const initialTools: { name: string; extensionId: string; description: string; hasSchema: boolean }[] = [];
  vscode.extensions.all.forEach((ext) => {
    const lmTools = ext.packageJSON?.contributes?.languageModelTools;
    if (lmTools && Array.isArray(lmTools)) {
      for (const t of lmTools as any[]) {
        if (t.name) {
          const description = t.modelDescription || t.displayName || t.description || "(no description)";
          const hasSchema = Boolean(t.inputSchema && typeof t.inputSchema === "object");
          initialTools.push({
            name: t.name,
            extensionId: ext.id,
            description: description,
            hasSchema: hasSchema
          });
        }
      }
    }
  });

  server.listen(port, () => {
    channel.appendLine(`[SKC] ✓ LM Bridge server started successfully!`);
    channel.appendLine(`[SKC] Connection URL: http://localhost:${port}/sse`);
    channel.appendLine("");

    // Show discovered tools
    if (initialTools.length > 0) {
      channel.appendLine(`[SKC] 🔧 Discovered ${initialTools.length} Language Model Tool(s):`);
      const toolsByExt: Record<string, typeof initialTools> = {};
      initialTools.forEach((tool) => {
        if (!toolsByExt[tool.extensionId]) {
          toolsByExt[tool.extensionId] = [];
        }
        toolsByExt[tool.extensionId].push(tool);
      });
      for (const [extId, tools] of Object.entries(toolsByExt)) {
        channel.appendLine(`[SKC]    • ${extId}:`);
        tools.forEach(tool => {
          const schemaStatus = tool.hasSchema ? "✓" : "⚠️ no schema";
          channel.appendLine(`[SKC]      - ${tool.name} [${schemaStatus}]`);
          if (tool.description && tool.description !== "(no description)") {
            channel.appendLine(`[SKC]        ${tool.description.substring(0, 80)}${tool.description.length > 80 ? "..." : ""}`);
          }
        });
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

  server.on("error", (err: Error) => {
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
      server.close();
      log("Server stopped.");
    }
  });
}
