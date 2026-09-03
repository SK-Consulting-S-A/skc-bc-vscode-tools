import type { CancellationToken } from "vscode";

const LEARN_MCP_URL = "https://learn.microsoft.com/api/mcp";
const REQUEST_TIMEOUT_MS = 20_000;

export interface LearnDocHit {
    title: string;
    url: string;
    content: string;
}

interface McpSession {
    sessionId: string;
}

/**
 * Calls Microsoft Learn MCP over HTTP only when @bc needs it.
 * Does not register or start VS Code MCP servers.
 */
export async function searchLearnDocs(query: string, token: CancellationToken): Promise<LearnDocHit[]> {
    const session = await openLearnSession(token);
    const raw = await callLearnTool(session, "microsoft_docs_search", { query }, token);
    return parseSearchHits(raw);
}

export async function fetchLearnPage(url: string, token: CancellationToken): Promise<string> {
    const session = await openLearnSession(token);
    const raw = await callLearnTool(session, "microsoft_docs_fetch", { url }, token);
    return extractToolText(raw).trim();
}

export async function searchLearnAlSamples(query: string, token: CancellationToken): Promise<string> {
    const session = await openLearnSession(token);
    const raw = await callLearnTool(
        session,
        "microsoft_code_sample_search",
        { query, language: "al" },
        token
    );
    return extractToolText(raw).trim();
}

async function openLearnSession(token: CancellationToken): Promise<McpSession> {
    const response = await mcpPost(
        {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: { name: "skc-al-tools-bc-chat", version: "1.0.0" }
            }
        },
        undefined,
        token
    );

    const sessionId = response.headers.get("mcp-session-id") ?? response.headers.get("Mcp-Session-Id");
    if (!sessionId) {
        throw new Error("Microsoft Learn MCP did not return a session id.");
    }
    return { sessionId };
}

async function callLearnTool(
    session: McpSession,
    name: string,
    args: Record<string, unknown>,
    token: CancellationToken
): Promise<unknown> {
    const response = await mcpPost(
        {
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: { name, arguments: args }
        },
        session.sessionId,
        token
    );
    const body = await response.text();
    return parseSseJson(body);
}

async function mcpPost(
    payload: unknown,
    sessionId: string | undefined,
    token: CancellationToken
): Promise<Response> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream"
    };
    if (sessionId) {
        headers["Mcp-Session-Id"] = sessionId;
    }

    const response = await fetch(LEARN_MCP_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: createAbortSignal(token, REQUEST_TIMEOUT_MS)
    });
    if (!response.ok) {
        throw new Error(`Microsoft Learn MCP returned HTTP ${response.status}.`);
    }
    return response;
}

function parseSseJson(body: string): unknown {
    for (const line of body.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) {
            continue;
        }
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") {
            continue;
        }
        return JSON.parse(data);
    }
    try {
        return JSON.parse(body);
    } catch {
        throw new Error("Could not parse Microsoft Learn MCP response.");
    }
}

function extractToolText(rpc: unknown): string {
    const result = isRecord(rpc) ? rpc.result : undefined;
    const content = isRecord(result) && Array.isArray(result.content) ? result.content : [];
    return content
        .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
        .filter(Boolean)
        .join("\n\n");
}

function parseSearchHits(rpc: unknown): LearnDocHit[] {
    const text = extractToolText(rpc);
    if (!text) {
        return [];
    }

    try {
        const parsed = JSON.parse(text) as unknown;
        const rows = isRecord(parsed) && Array.isArray(parsed.results)
            ? parsed.results
            : Array.isArray(parsed)
                ? parsed
                : [];
        return rows
            .map((row) => {
                if (!isRecord(row)) {
                    return undefined;
                }
                const title = typeof row.title === "string" ? row.title : "Microsoft Learn";
                const url = typeof row.contentUrl === "string"
                    ? row.contentUrl
                    : typeof row.url === "string"
                        ? row.url
                        : "";
                const content = typeof row.content === "string"
                    ? row.content
                    : typeof row.description === "string"
                        ? row.description
                        : "";
                if (!url && !content) {
                    return undefined;
                }
                return { title, url, content };
            })
            .filter((hit): hit is LearnDocHit => Boolean(hit));
    } catch {
        return [{ title: "Microsoft Learn", url: "", content: text }];
    }
}

function createAbortSignal(token: CancellationToken, timeoutMs: number): AbortSignal {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    token.onCancellationRequested(() => controller.abort());
    controller.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
    return controller.signal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
