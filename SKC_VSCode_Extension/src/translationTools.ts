import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";
import type { OutputChannel } from "vscode";
import { translateFileHeadless, getTranslationStatusSummary, createTranslationFile } from "./translationService";

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

export interface CreateXlfLanguageInput {
    sourceFilePath: string;
    targetLanguage: string;
}

export function createCreateXlfLanguageTool(channel: OutputChannel): vscode.LanguageModelTool<CreateXlfLanguageInput> {
    return {
        async prepareInvocation(options, _token) {
            return {
                invocationMessage: `Create ${options.input.targetLanguage} translation file from ${options.input.sourceFilePath}`,
                confirmationMessages: {
                    title: "Create XLF language file",
                    message: new vscode.MarkdownString(
                        `Create **${options.input.targetLanguage}** translation file from **${options.input.sourceFilePath}**?`
                    )
                }
            };
        },
        async invoke(options, _token) {
            const { sourceFilePath, targetLanguage } = options.input;
            const srcUri = vscode.Uri.file(sourceFilePath);
            const srcPath = srcUri.fsPath;
            const outName = path.basename(srcPath).replace(".g.xlf", `.${targetLanguage}.xlf`);
            const outPath = path.join(path.dirname(srcPath), outName);
            try {
                await fs.access(outPath);
                return textResult(`Error: Translation file already exists: ${outName}`);
            } catch {
                // file does not exist — proceed
            }
            const ok = await createTranslationFile(srcUri, targetLanguage, channel);
            return textResult(ok ? `Created: ${outPath}` : `Error: Failed to create translation file for ${targetLanguage}.`);
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
    const createLangTool = lm.registerTool("skc_create_xlf_language", createCreateXlfLanguageTool(channel));
    context.subscriptions.push(translateTool, listTool, createLangTool);
    channel.appendLine("[SKC] Registered language model tools: skc_translate_xlf, skc_list_translation_files, skc_create_xlf_language");
}
