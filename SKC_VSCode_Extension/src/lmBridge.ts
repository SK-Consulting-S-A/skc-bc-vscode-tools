import * as vscode from "vscode";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
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

  // Helper function to find AL project folders (containing app.json)
  function findAlProjectFolders(): vscode.WorkspaceFolder[] {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const alFolders: vscode.WorkspaceFolder[] = [];

    log(`Scanning ${folders.length} workspace folder(s) for AL projects...`);
    for (const folder of folders) {
      const appJsonPath = path.join(folder.uri.fsPath, "app.json");
      const hasAppJson = fs.existsSync(appJsonPath);
      log(`  - ${folder.name}: ${folder.uri.fsPath} ${hasAppJson ? "[AL PROJECT ✓]" : "[not AL project]"}`);

      if (hasAppJson) {
        alFolders.push(folder);
      }
    }

    return alFolders;
  }

  // Helper function to get the best workspace folder for AL tools
  function getBestAlWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
    const alFolders = findAlProjectFolders();

    if (alFolders.length === 0) {
      // No AL projects found, return first workspace folder
      log("No AL project folders found (no app.json), using first workspace folder");
      return vscode.workspace.workspaceFolders?.[0];
    }

    if (alFolders.length === 1) {
      return alFolders[0];
    }

    // Multiple AL projects - prefer the active editor's folder, or first non-.AL-Go folder
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      const editorFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
      if (editorFolder && alFolders.includes(editorFolder)) {
        log(`Using active editor's AL project folder: ${editorFolder.name}`);
        return editorFolder;
      }
    }

    // Prefer folders that don't contain ".AL-Go" in the name
    const nonAlGoFolders = alFolders.filter(f => !f.name.includes(".AL-Go") && !f.uri.fsPath.includes(".AL-Go"));
    if (nonAlGoFolders.length > 0) {
      log(`Using non-.AL-Go AL project folder: ${nonAlGoFolders[0].name}`);
      return nonAlGoFolders[0];
    }

    // Fallback to first AL folder
    log(`Using first AL project folder: ${alFolders[0].name}`);
    return alFolders[0];
  }

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request: { params: { name: string; arguments?: Record<string, unknown>; [key: string]: unknown } }) => {
    const toolName = request.params.name;
    let toolArgs = request.params.arguments ?? {};
    // Some MCP clients send tool inputs as top-level params (e.g. { name, query }) instead of params.arguments
    if (Object.keys(toolArgs).length === 0 && request.params && typeof request.params === "object") {
      const { name: _n, arguments: _a, ...rest } = request.params;
      if (Object.keys(rest).length > 0) {
        toolArgs = rest;
        log("CallTool: using top-level params as arguments:", JSON.stringify(toolArgs));
      }
    }

    log("CallTool:", toolName, "args:", JSON.stringify(toolArgs));

    // For al_build tool, ensure we use the correct workspace context
    if (toolName === "al_build" || toolName.includes("build")) {
      log("=== AL Build Tool - Workspace Detection ===");
      const allFolders = vscode.workspace.workspaceFolders ?? [];
      log(`Total workspace folders: ${allFolders.length}`);
      allFolders.forEach((f, i) => {
        log(`  [${i}] ${f.name}: ${f.uri.fsPath}`);
      });

      const alFolder = getBestAlWorkspaceFolder();

      if (alFolder) {
        log(`✓ Selected AL project: ${alFolder.name} at ${alFolder.uri.fsPath}`);

        // If scope is not provided, default to 'current' for the detected AL project
        if (!toolArgs.scope && !toolArgs.workspaceFolder && !toolArgs.workspaceFolderUri) {
          toolArgs = { ...toolArgs, scope: "current" };
          log(`Setting scope='current' for AL project: ${alFolder.name}`);

          // Try to pass workspace folder URI if the tool supports it
          // Some tools may accept workspaceFolderUri or workspaceFolder parameter
          toolArgs = {
            ...toolArgs,
            workspaceFolderUri: alFolder.uri.toString(),
            workspaceFolder: alFolder.uri.fsPath
          };
          log(`Also setting workspaceFolderUri: ${alFolder.uri.toString()}`);
        } else {
          log(`Using provided scope/workspaceFolder: ${JSON.stringify({ scope: toolArgs.scope, workspaceFolder: toolArgs.workspaceFolder, workspaceFolderUri: toolArgs.workspaceFolderUri })}`);
        }

        // Note: VS Code's vscode.lm.invokeTool() uses the workspace context at invocation time.
        // The AL extension may still use the first workspace folder or active folder.
        // If the wrong folder is used, try:
        // 1. Ensure ManagedDataService_Admin is the first workspace folder in your .code-workspace file
        // 2. Or open a file from ManagedDataService_Admin before invoking the build
        // 3. The tool may accept workspaceFolderUri or workspaceFolder parameter (we're trying both)
        if (allFolders[0]?.name !== alFolder.name) {
          log(`⚠ Warning: First workspace folder (${allFolders[0]?.name}) differs from selected AL project (${alFolder.name})`);
          log(`  The AL extension might still use ${allFolders[0]?.name}. Consider reordering workspace folders.`);
        }
      } else {
        log("⚠ Warning: Could not determine AL project folder. Tool may use wrong workspace.");
        log("  Available folders:", allFolders.map(f => f.name).join(", "));
      }
      log("===========================================");
    }

    // IMPORTANT: VS Code shows a confirmation dialog for ALL Language Model Tools from extensions.
    // This is a security feature documented at: https://code.visualstudio.com/api/extension-guides/ai/tools
    // 
    // Per the official docs: "A generic confirmation dialog will always be shown for tools from extensions,
    // but the tool can customize the confirmation message." The dialog cannot be bypassed programmatically.
    //
    // When invoking tools via vscode.lm.invokeTool(), VS Code will:
    // 1. Call the tool's prepareInvocation() method (if implemented by the tool's extension)
    // 2. Show a confirmation dialog with the tool's custom message (or generic message)
    // 3. If user clicks "Always Allow", future invocations of this tool won't prompt
    // 4. Only after approval, call the tool's invoke() method
    //
    // Since we're invoking tools from OTHER extensions (e.g., al_build from ms-dynamics-smb.al),
    // we cannot customize their confirmation messages - only the tool's own extension can do that.

    try {
      const lm = (vscode as unknown as {
        lm?: {
          invokeTool: (
            name: string,
            options: { toolInvocationToken?: undefined; input: Record<string, unknown> }
          ) => Promise<unknown>;
        };
      }).lm;
      if (!lm?.invokeTool) {
        throw new Error("vscode.lm.invokeTool is not available. Ensure VS Code version 1.90.0 or later.");
      }

      // VS Code API: invokeTool(name, options) where options has { input, toolInvocationToken? }.
      // Passing raw args as second param was wrong - the tool receives options.input, so it got undefined.
      const options = { toolInvocationToken: undefined as undefined, input: toolArgs };
      log(`Invoking tool with args: ${JSON.stringify(toolArgs)} (VS Code will show confirmation dialog - click 'Always allow' to reduce future prompts)...`);
      const result = await lm.invokeTool(toolName, options);
      log("CallTool OK:", toolName);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }]
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log("CallTool ERROR:", toolName, message);

      // Provide helpful error message if user cancelled the confirmation
      if (message.includes("cancel") || message.includes("denied") || message.includes("rejected") || message.includes("dismissed")) {
        return {
          content: [{
            type: "text" as const,
            text: `Tool invocation cancelled: The confirmation dialog was dismissed. To avoid future prompts for this tool, click "Always allow" in the confirmation dialog when it appears. This is a VS Code security feature that cannot be disabled. See: https://code.visualstudio.com/api/extension-guides/ai/tools`
          }],
          isError: true
        };
      }

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
