import { randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { createServer, type ServerResponse } from "http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema, type Tool, type RequestId } from "@modelcontextprotocol/sdk/types.js";

export interface CopilotCliBridgeAdapter {
  listTools(): Tool[];
  invokeTool(name: string, input: Record<string, unknown>, signal: AbortSignal): Promise<string[]>;
}

interface BridgeSession {
  server: Server;
  transport: StreamableHTTPServerTransport;
  lastActivity: number;
  activeCalls: number;
  streams: number;
  pending: Map<RequestId, { response: ServerResponse; abort: AbortController }>;
}

export async function startCopilotCliBridge(adapter: CopilotCliBridgeAdapter) {
  const token = randomBytes(32).toString("hex");
  const authorization = Buffer.from(["Bearer", token].join(" "));
  const active = new Set<Server>();
  const sessions = new Map<string, BridgeSession>();
  const shutdown = new AbortController();
  let host = "";
  const httpServer = createServer(async (request, response) => {
    // Reject browser origins and unexpected Host headers even when a caller has a credential.
    if (request.headers.host !== host || request.headers.origin !== undefined) {
      response.writeHead(403).end();
      return;
    }
    const supplied = Buffer.from(request.headers.authorization ?? "");
    if (supplied.length !== authorization.length || !timingSafeEqual(supplied, authorization)) {
      response.writeHead(401).end();
      return;
    }
    if (request.url !== "/mcp") {
      response.writeHead(404).end();
      return;
    }
    const sessionId = request.headers["mcp-session-id"];
    const session = typeof sessionId === "string" ? sessions.get(sessionId) : undefined;
    if (sessionId && !session) {
      response.writeHead(404).end();
      return;
    }
    if (request.method !== "POST" && !session) {
      response.writeHead(405, { Allow: "POST" }).end();
      return;
    }
    if (Number(request.headers["content-length"]) > 64 * 1024) {
      response.writeHead(413).end();
      return;
    }
    if (!session && active.size >= 16) {
      const idle = [...sessions.values()].filter(item => !item.activeCalls && !item.streams)
        .sort((a, b) => a.lastActivity - b.lastActivity)[0];
      if (idle) await idle.server.close();
      if (active.size >= 16) {
        response.writeHead(429).end();
        return;
      }
    }
    const server = session?.server ?? new Server({ name: "skc-vscode-tools", version: "1.0.0" }, { capabilities: { tools: {} } });
    const transport: StreamableHTTPServerTransport = session?.transport ?? new StreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
      enableJsonResponse: true,
      onsessioninitialized: id => { sessions.set(id, state); }
    });
    const state: BridgeSession = session ?? { server, transport, lastActivity: Date.now(), activeCalls: 0, streams: 0, pending: new Map() };
    state.lastActivity = Date.now();
    if (request.method === "GET") {
      state.streams++;
      response.once("close", () => { state.streams--; state.lastActivity = Date.now(); });
    }
    if (!session) {
      active.add(server);
      server.onclose = () => {
        for (const pending of state.pending.values()) {
          pending.abort.abort();
          pending.response.end();
        }
        active.delete(server);
        if (transport.sessionId) sessions.delete(transport.sessionId);
      };
      server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: adapter.listTools() }));
      server.setRequestHandler(CallToolRequestSchema, async (call, extra) => {
        if (!adapter.listTools().some(tool => tool.name === call.params.name)) {
          return { isError: true, content: [{ type: "text", text: "Tool is not available in this VS Code workspace." }] };
        }
        const pending = state.pending.get(extra.requestId);
        const cancelled = () => {
          if (pending && !pending.response.writableEnded) pending.response.writeHead(204).end();
        };
        extra.signal.addEventListener("abort", cancelled, { once: true });
        state.activeCalls++;
        try {
          const texts = await adapter.invokeTool(call.params.name, call.params.arguments ?? {}, AbortSignal.any([
            shutdown.signal, extra.signal, ...(pending ? [pending.abort.signal] : [])
          ]));
          return { content: texts.map(text => ({ type: "text", text })) };
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "VS Code tool invocation failed.";
          return { isError: true, content: [{ type: "text", text: message }] };
        } finally {
          extra.signal.removeEventListener("abort", cancelled);
          state.activeCalls--;
          state.lastActivity = Date.now();
        }
      });
    }
    try {
      let body: unknown;
      if (request.method === "POST") {
        const chunks: Buffer[] = [];
        let length = 0;
        for await (const chunk of request) {
          length += chunk.length;
          if (length > 64 * 1024) {
            response.writeHead(413).end();
            return;
          }
          chunks.push(chunk);
        }
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (body && typeof body === "object" && !Array.isArray(body)) {
          const call = body as Record<string, unknown>;
          if (call.method === "tools/call" && (typeof call.id === "string" || typeof call.id === "number")) {
            const id = call.id;
            const abort = new AbortController();
            state.pending.set(id, { response, abort });
            response.once("close", () => { abort.abort(); state.pending.delete(id); });
          }
        }
      }
      if (!session) await server.connect(transport);
      await transport.handleRequest(request, response, body);
    } catch {
      if (!response.headersSent) response.writeHead(400).end();
    } finally {
      if (!transport.sessionId) {
        active.delete(server);
        await server.close();
      }
    }
  });
  httpServer.requestTimeout = 30_000;
  httpServer.headersTimeout = 10_000;
  httpServer.maxConnections = 16;
  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(0, "127.0.0.1", () => {
      httpServer.removeListener("error", reject);
      resolve();
    });
  });
  const address = httpServer.address();
  if (!address || typeof address === "string") throw new Error("Could not determine the CLI bridge address.");
  host = `127.0.0.1:${address.port}`;
  const cleanup = setInterval(() => {
    for (const session of sessions.values()) {
      if (!session.activeCalls && !session.streams && Date.now() - session.lastActivity > 60_000) {
        void session.server.close();
      }
    }
  }, 30_000);
  cleanup.unref();
  return {
    url: `http://${host}/mcp`,
    token,
    async dispose(): Promise<void> {
      if (shutdown.signal.aborted) return;
      clearInterval(cleanup);
      shutdown.abort();
      for (const server of active) await server.close();
      httpServer.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        httpServer.close(error => error ? reject(error) : resolve());
      });
    }
  };
}
