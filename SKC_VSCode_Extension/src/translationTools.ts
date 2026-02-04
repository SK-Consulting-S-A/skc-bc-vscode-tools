import * as vscode from "vscode";
import type { OutputChannel } from "vscode";
import { translateFileHeadless, getTranslationStatusSummary } from "./translationService";

export interface TranslateXlfInput {
    sourceFilePath: string;
    targetLanguage: string;
}

export interface ListTranslationFilesInput {
    workspacePath?: string;
}

function textResult(text: string): vscode.LanguageModelToolResult {
    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);
}

export function createTranslateXlfTool(channel: OutputChannel): vscode.LanguageModelTool<TranslateXlfInput> {
    return {
        async prepareInvocation(options, _token) {
            return {
                invocationMessage: `Translate ${options.input.sourceFilePath} to ${options.input.targetLanguage}`,
                confirmationMessages: {
                    title: "Translate XLF file",
                    message: new vscode.MarkdownString(
                        `Translate **${options.input.sourceFilePath}** to **${options.input.targetLanguage}** using the Azure Translation Function?`
                    )
                }
            };
        },
        async invoke(options, _token) {
            const { sourceFilePath, targetLanguage } = options.input;
            const fileUri = vscode.Uri.file(sourceFilePath);
            const result = await translateFileHeadless(fileUri, targetLanguage, channel);
            return textResult(result.success ? result.message : `Error: ${result.message}`);
        }
    };
}

export function createListTranslationFilesTool(
    _channel: OutputChannel
): vscode.LanguageModelTool<ListTranslationFilesInput> {
    return {
        async invoke(options, _token) {
            const workspacePath = options.input.workspacePath?.trim();
            const workspaceFolderUri = workspacePath
                ? vscode.Uri.file(workspacePath)
                : undefined;
            const summary = await getTranslationStatusSummary(workspaceFolderUri);
            return textResult(summary);
        }
    };
}

export function registerTranslationTools(
    context: vscode.ExtensionContext,
    channel: OutputChannel
): void {
    const lm = (vscode as unknown as { lm?: { registerTool(name: string, tool: vscode.LanguageModelTool<unknown>): vscode.Disposable } }).lm;
    if (!lm?.registerTool) {
        channel.appendLine("[SKC] Language Model tools API (vscode.lm) not available; translation tools not registered.");
        return;
    }

    const translateTool = lm.registerTool("skc_translate_xlf", createTranslateXlfTool(channel));
    const listTool = lm.registerTool("skc_list_translation_files", createListTranslationFilesTool(channel));
    context.subscriptions.push(translateTool, listTool);
    channel.appendLine("[SKC] Registered language model tools: skc_translate_xlf, skc_list_translation_files");
}
