import * as vscode from "vscode";
import {
    githubSourceLinks,
    listLocalSymbolPackages,
    searchLocalAlSymbols,
    workspaceHasAlProject
} from "./alWorkspace";
import { fetchLearnPage, searchLearnAlSamples, searchLearnDocs, type LearnDocHit } from "./learnMcp";

export const BC_CHAT_PARTICIPANT_ID = "skc.bc";

interface BcChatResult extends vscode.ChatResult {
    metadata?: { command?: string };
}

export function registerBcChatParticipant(
    context: vscode.ExtensionContext,
    channel: vscode.OutputChannel
): void {
    if (!vscode.chat?.createChatParticipant) {
        channel.appendLine("[SKC] Chat Participant API is not available in this VS Code version; @bc was not registered.");
        return;
    }

    const participant = vscode.chat.createChatParticipant(BC_CHAT_PARTICIPANT_ID, createHandler(channel));
    const icon = vscode.Uri.joinPath(context.extensionUri, "assets", "skc-icon.svg");
    participant.iconPath = icon;
    participant.followupProvider = { provideFollowups };

    context.subscriptions.push(participant);
    channel.appendLine("[SKC] Registered @bc chat participant (docs, object, how).");
}

function createHandler(channel: vscode.OutputChannel): vscode.ChatRequestHandler {
    return async (
        request: vscode.ChatRequest,
        chatContext: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<BcChatResult> => {
        const command = request.command || undefined;
        const prompt = request.prompt.trim();

        if (!prompt && !command) {
            stream.markdown(welcomeMarkdown());
            return { metadata: { command: "welcome" } };
        }

        const question = prompt || defaultQuestionFor(command);
        const hasAl = await workspaceHasAlProject();

        try {
            await answerQuestion(question, command, hasAl, request, chatContext, stream, token, channel);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            channel.appendLine(`[SKC] @bc failed: ${message}`);
            stream.markdown(
                `I could not finish that lookup (${message}).\n\n` +
                `Try [Microsoft Learn for Business Central](https://learn.microsoft.com/dynamics365/business-central/) ` +
                `or the public source on [BCApps](https://github.com/microsoft/BCApps).\n\n` +
                githubSourceLinks(question)
            );
        }

        return { metadata: { command: command ?? "ask" } };
    };
}

async function answerQuestion(
    question: string,
    command: string | undefined,
    hasAl: boolean,
    request: vscode.ChatRequest,
    chatContext: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
    channel: vscode.OutputChannel
): Promise<void> {
    const learnQuery = buildLearnQuery(question, command);
    const wantDocs = command !== "object";
    const wantObject = command === "object";

    let docs: LearnDocHit[] = [];
    let pageMarkdown = "";
    let alSamples = "";
    let symbols = "";
    let packages: string[] = [];

    if (wantDocs) {
        stream.progress("Looking up Microsoft Learn…");
        docs = preferBusinessCentralHits(await searchLearnDocs(learnQuery, token));
        const topUrl = docs[0]?.url;
        if (topUrl && command !== "docs") {
            stream.progress("Reading the official article…");
            try {
                pageMarkdown = await fetchLearnPage(topUrl, token);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                channel.appendLine(`[SKC] @bc Learn fetch skipped: ${message}`);
            }
        }
    }

    if (wantObject) {
        stream.progress("Looking up the object…");
        if (hasAl) {
            packages = await listLocalSymbolPackages();
            symbols = (await searchLocalAlSymbols(question, request, token)) ?? "";
        }
        if (!symbols) {
            docs = preferBusinessCentralHits(await searchLearnDocs(learnQuery, token));
            try {
                alSamples = await searchLearnAlSamples(question, token);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                channel.appendLine(`[SKC] @bc AL sample search skipped: ${message}`);
            }
        }
    }

    for (const hit of bcDocs.slice(0, 5)) {
        if (hit.url) {
            stream.reference(vscode.Uri.parse(hit.url));
        }
    }

    const contextBlock = buildContextBlock({
        question,
        command,
        hasAl,
        docs: bcDocs,
        pageMarkdown,
        alSamples,
        symbols,
        packages
    });

    const answered = await streamLanguageModel(request, chatContext, stream, token, contextBlock, channel);
    if (!answered) {
        stream.markdown(fallbackMarkdown(question, bcDocs));
    }

    stream.markdown(`\n\n### Source on GitHub\n${githubSourceLinks(question)}\n`);
}

function buildLearnQuery(question: string, command: string | undefined): string {
    const prefix = "Dynamics 365 Business Central";
    if (command === "object") {
        return `${prefix} ${question} table page codeunit`;
    }
    if (command === "docs") {
        return `${prefix} ${question}`;
    }
    return `${prefix} ${question}`;
}

function preferBusinessCentralHits(hits: LearnDocHit[]): LearnDocHit[] {
    const bc = hits.filter((hit) => /business-central/i.test(hit.url) || /business-central/i.test(hit.title));
    return bc.length > 0 ? bc : hits;
}

function buildContextBlock(input: {
    question: string;
    command: string | undefined;
    hasAl: boolean;
    docs: LearnDocHit[];
    pageMarkdown: string;
    alSamples: string;
    symbols: string;
    packages: string[];
}): string {
    const excerpts = input.docs
        .slice(0, 6)
        .map((hit, index) => {
            const url = hit.url ? `\nURL: ${hit.url}` : "";
            return `### ${index + 1}. ${hit.title}${url}\n${clip(hit.content, 1800)}`;
        })
        .join("\n\n");

    const parts = [
        `User question: ${input.question}`,
        `Slash command: ${input.command ?? "(none — treat as a how-to unless they named an AL object)"}`,
        `AL project open: ${input.hasAl ? "yes" : "no"}`,
        excerpts ? `Microsoft Learn excerpts:\n${excerpts}` : "No Microsoft Learn excerpts were returned.",
        input.pageMarkdown ? `Full article (trimmed):\n${clip(input.pageMarkdown, 6000)}` : "",
        input.symbols ? `Local AL symbols:\n${clip(input.symbols, 2500)}` : "",
        input.packages.length
            ? `Symbol packages on this machine (.alpackages):\n${input.packages.map((name) => `- ${name}`).join("\n")}`
            : input.hasAl
                ? "An AL project is open, but no .alpackages files were found."
                : "No AL project is open. Do not ask the user to download symbols or install tools.",
        input.alSamples ? `AL samples from Microsoft Learn:\n${clip(input.alSamples, 2500)}` : ""
    ];
    return parts.filter(Boolean).join("\n\n");
}

async function streamLanguageModel(
    request: vscode.ChatRequest,
    chatContext: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
    contextBlock: string,
    channel: vscode.OutputChannel
): Promise<boolean> {
    const model = await resolveChatModel(request);
    if (!model) {
        return false;
    }

    const messages = [
        vscode.LanguageModelChatMessage.User(systemPrompt()),
        ...historyMessages(chatContext),
        vscode.LanguageModelChatMessage.User(
            `${contextBlock}\n\nAnswer the user question now. Follow the instructions above.`
        )
    ];

    try {
        const response = await model.sendRequest(messages, {}, token);
        for await (const fragment of response.text) {
            stream.markdown(fragment);
        }
        return true;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        channel.appendLine(`[SKC] @bc language model fallback: ${message}`);
        return false;
    }
}

async function resolveChatModel(request: vscode.ChatRequest): Promise<vscode.LanguageModelChat | undefined> {
    const fromRequest = (request as vscode.ChatRequest & { model?: vscode.LanguageModelChat }).model;
    if (fromRequest) {
        return fromRequest;
    }
    if (!vscode.lm?.selectChatModels) {
        return undefined;
    }
    const models = await vscode.lm.selectChatModels({ vendor: "copilot" });
    return models[0];
}

function systemPrompt(): string {
    return [
        "You are the @bc assistant in Visual Studio Code for Microsoft Dynamics 365 Business Central.",
        "The reader may not be a programmer. Lead with plain-language steps they can do in the Business Central web client.",
        "Use Tell Me (Alt+Q) page names, buttons, and fields from the Microsoft Learn excerpts. Do not invent pages or fields.",
        "Always cite the Learn URLs you used as markdown links.",
        "If the question is about an AL object, first explain what it is for in business terms, then add a short For developers section.",
        "If Learn excerpts are thin, say so and point to GitHub BCApps. Do not pretend you inspected source you do not have.",
        "Do not tell the user to install extensions, apply presets, start MCP servers, or pick an Agent.",
        "Keep the answer focused. Use numbered steps for how-to questions."
    ].join(" ");
}

function historyMessages(chatContext: vscode.ChatContext): vscode.LanguageModelChatMessage[] {
    const turns = chatContext.history
        .filter((item): item is vscode.ChatRequestTurn => "prompt" in item)
        .slice(-3);
    return turns.map((turn) => vscode.LanguageModelChatMessage.User(turn.prompt));
}

function fallbackMarkdown(question: string, docs: LearnDocHit[]): string {
    if (docs.length === 0) {
        return (
            `I looked up **${question}** on Microsoft Learn but did not get a usable article.\n\n` +
            `Open [Business Central documentation](https://learn.microsoft.com/dynamics365/business-central/) and search there, ` +
            `or use the GitHub links below.`
        );
    }

    const list = docs
        .slice(0, 6)
        .map((hit) => {
            const link = hit.url ? `[${hit.title}](${hit.url})` : hit.title;
            const excerpt = hit.content ? `\n\n${clip(hit.content, 400)}` : "";
            return `### ${link}${excerpt}`;
        })
        .join("\n\n");
    return `Here is what Microsoft Learn says about **${question}**:\n\n${list}`;
}

function welcomeMarkdown(): string {
    return [
        "Ask me anything about **Business Central**. You do not need an AL project or an Agent.",
        "",
        "Examples:",
        "- `@bc how do I post a sales invoice?`",
        "- `@bc /how warehouse shipment`",
        "- `@bc /object Customer`",
        "- `@bc /docs VAT posting groups`",
        "",
        "I look up Microsoft Learn first. If you have an AL project open, `/object` can also use local symbols."
    ].join("\n");
}

function defaultQuestionFor(command: string | undefined): string {
    if (command === "docs") {
        return "Business Central documentation overview";
    }
    if (command === "object") {
        return "Customer";
    }
    return "How do I get started with sales invoices in Business Central?";
}

function provideFollowups(
    result: vscode.ChatResult,
    _context: vscode.ChatContext,
    _token: vscode.CancellationToken
): vscode.ChatFollowup[] {
    const command = (result as BcChatResult).metadata?.command;
    if (command === "object") {
        return [
            { prompt: "Customer", label: "Customer table", command: "object" },
            { prompt: "Sales-Post", label: "Sales-Post codeunit", command: "object" },
            { prompt: "how do I post a sales invoice?", label: "How to post a sales invoice" }
        ];
    }
    return [
        { prompt: "how do I post a sales invoice?", label: "How do I post a sales invoice?" },
        { prompt: "Customer", label: "Look up Customer", command: "object" },
        { prompt: "VAT posting groups", label: "Docs: VAT posting groups", command: "docs" }
    ];
}

function clip(text: string, max: number): string {
    const trimmed = text.trim();
    if (trimmed.length <= max) {
        return trimmed;
    }
    return `${trimmed.slice(0, max)}…`;
}
