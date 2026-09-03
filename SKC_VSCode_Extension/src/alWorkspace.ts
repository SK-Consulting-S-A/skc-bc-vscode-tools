import * as path from "path";
import * as vscode from "vscode";

export async function workspaceHasAlProject(): Promise<boolean> {
    if (!vscode.workspace.workspaceFolders?.length) {
        return false;
    }
    const found = await vscode.workspace.findFiles(
        "**/app.json",
        "**/{node_modules,.git,.alpackages}/**",
        1
    );
    return found.length > 0;
}

export async function listLocalSymbolPackages(): Promise<string[]> {
    const files = await vscode.workspace.findFiles("**/.alpackages/*.app", null, 50);
    return files.map((file) => path.basename(file.fsPath)).sort();
}

export async function searchLocalAlSymbols(
    query: string,
    request: vscode.ChatRequest,
    token: vscode.CancellationToken
): Promise<string | undefined> {
    const lm = vscode.lm as unknown as {
        invokeTool?(
            name: string,
            options: { input: Record<string, unknown>; toolInvocationToken?: unknown },
            cancellationToken: vscode.CancellationToken
        ): Promise<{ content?: Array<{ value?: string }> }>;
    };
    if (!lm.invokeTool) {
        return undefined;
    }

    const toolToken = (request as vscode.ChatRequest & { toolInvocationToken?: unknown }).toolInvocationToken;
    try {
        const result = await lm.invokeTool(
            "al_symbolsearch",
            {
                toolInvocationToken: toolToken,
                input: {
                    query,
                    filters: {
                        kinds: ["Table", "Page", "Codeunit", "Report", "Enum", "Interface"],
                        scope: "all",
                        limit: 15
                    }
                }
            },
            token
        );
        const text = (result.content ?? [])
            .map((part) => part.value)
            .filter((value): value is string => Boolean(value))
            .join("\n");
        return text.trim() || undefined;
    } catch {
        return undefined;
    }
}

export function githubSourceLinks(query: string): string {
    const encoded = encodeURIComponent(query);
    return [
        "- [Base Application (W1)](https://github.com/microsoft/BCApps/tree/main/src/Layers/W1/BaseApp)",
        "- [First-party apps (W1)](https://github.com/microsoft/BCApps/tree/main/src/Apps/W1)",
        "- [System Application](https://github.com/microsoft/BCApps/tree/main/src/System%20Application)",
        "- [Business Foundation](https://github.com/microsoft/BCApps/tree/main/src/Business%20Foundation)",
        `- [Search BCApps for "${query}"](https://github.com/search?q=repo%3Amicrosoft%2FBCApps+${encoded}&type=code)`
    ].join("\n");
}
