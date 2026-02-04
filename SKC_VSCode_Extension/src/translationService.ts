import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";
import * as https from "https";
import * as http from "http";

export interface TranslationResult {
    translatedContent: string;
    translatedCount: number;
    syncInfo?: {
        added: number;
        removed: number;
        sourceChanged?: number;
    };
}

export interface TranslateFileHeadlessResult {
    success: boolean;
    message: string;
    translatedCount?: number;
    syncInfo?: { added: number; removed: number };
}

// Request timeout - Azure Function handles batching internally, may take time for large files
const REQUEST_TIMEOUT_MS = 600000; // 10 minutes timeout for large files

interface AppJson {
    supportedLocales?: string[];
    features?: Array<{ id: string; languages?: string[] }>;
}

/**
 * Get target languages from app.json in the workspace
 */
async function getTargetLanguagesFromAppJson(workspaceFolder: vscode.Uri): Promise<string[]> {
    const appJsonPath = path.join(workspaceFolder.fsPath, "app.json");

    try {
        const content = await fs.readFile(appJsonPath, "utf8");
        const appJson: AppJson = JSON.parse(content);

        // Check for supportedLocales (common format)
        if (appJson.supportedLocales && Array.isArray(appJson.supportedLocales)) {
            return appJson.supportedLocales;
        }

        // Check for features with TranslationFile
        if (appJson.features && Array.isArray(appJson.features)) {
            const translationFeature = appJson.features.find((f) => f.id === "TranslationFile");
            if (translationFeature?.languages) {
                return translationFeature.languages;
            }
        }

        return [];
    } catch {
        return [];
    }
}

/**
 * Translate an XLF file using the Azure Translation Function
 * @param fileUri - Source file URI (*.g.xlf)
 * @param channel - Output channel for logging
 * @param workspaceFolder - Optional workspace folder (will be determined if not provided)
 * @param targetLanguage - Optional target language (will prompt if not provided)
 */
export async function translateFile(
    fileUri: vscode.Uri,
    channel: vscode.OutputChannel,
    workspaceFolder?: vscode.Uri,
    targetLanguage?: string
): Promise<boolean> {
    const cfg = vscode.workspace.getConfiguration("skc");
    const azureFunctionUrl = cfg.get<string>("azureFunctionUrl", "").trim();

    if (!azureFunctionUrl) {
        const action = await vscode.window.showErrorMessage(
            "Azure Function URL not configured. Please set 'skc.azureFunctionUrl' in settings.",
            "Open Settings"
        );
        if (action === "Open Settings") {
            await vscode.commands.executeCommand("workbench.action.openSettings", "skc.azureFunctionUrl");
        }
        return false;
    }

    // Get workspace folder for this file if not provided
    if (!workspaceFolder) {
        const wsFolder = vscode.workspace.getWorkspaceFolder(fileUri);
        if (!wsFolder) {
            void vscode.window.showErrorMessage("Could not determine workspace folder for this file.");
            return false;
        }
        workspaceFolder = wsFolder.uri;
    }

    // Get target language if not provided
    if (!targetLanguage) {
        const targetLanguages = await getTargetLanguagesFromAppJson(workspaceFolder);

        if (targetLanguages.length === 0) {
            void vscode.window.showErrorMessage(
                "No target languages found in app.json. Please add 'supportedLocales' or 'features' with TranslationFile."
            );
            return false;
        }

        if (targetLanguages.length === 1) {
            targetLanguage = targetLanguages[0];
        } else {
            targetLanguage = await vscode.window.showQuickPick(targetLanguages, {
                placeHolder: "Select target language for translation",
                title: "Target Language"
            });
        }

        if (!targetLanguage) {
            return false; // User cancelled
        }
    }

    const filePath = fileUri.fsPath;
    const fileName = path.basename(filePath);

    channel.appendLine(`[SKC] Starting translation of ${fileName} to ${targetLanguage}...`);
    channel.show(true);

    try {
        // Read the source XLF file content (*.g.xlf)
        const sourceContent = await fs.readFile(filePath, "utf8");
        channel.appendLine(`[SKC] Read source file: ${sourceContent.length} characters`);

        // Count trans-units for logging
        const transUnitCount = (sourceContent.match(/<trans-unit/g) || []).length;
        channel.appendLine(`[SKC] Source file has ${transUnitCount} trans-units`);

        // Determine output filename and path
        const outputFileName = fileName.replace(".g.xlf", `.${targetLanguage}.xlf`);
        const outputPath = path.join(path.dirname(filePath), outputFileName);

        // Read existing target file if it exists (for sync)
        let targetContent: string | undefined;
        try {
            targetContent = await fs.readFile(outputPath, "utf8");
            channel.appendLine(`[SKC] Found existing target file: ${targetContent.length} characters`);
            channel.appendLine(`[SKC] Will perform full sync (add/remove units) + translate`);
        } catch {
            channel.appendLine(`[SKC] No existing target file - will create new file from source`);
            // Use source as base for new target file
            targetContent = sourceContent;
        }

        channel.appendLine(`[SKC] Sending to Azure Function with sync enabled (same as GitHub flow)`);
        channel.appendLine(`[SKC] Azure Function URL: (configured)`);
        channel.appendLine(`[SKC] Output file: ${outputPath}`);

        // Show progress
        return await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Translating ${fileName} to ${targetLanguage}...`,
                cancellable: false
            },
            async (progress) => {
                progress.report({ increment: 10, message: "Sending to Azure Function..." });

                // Send source + target to Azure Function for full sync (same as GitHub webhook)
                // Azure Function will: add missing units, remove obsolete units, translate
                const result = await callAzureFunctionWithSync(
                    azureFunctionUrl,
                    sourceContent,
                    targetContent!,
                    targetLanguage!,
                    channel
                );

                if (!result || !result.translatedContent) {
                    channel.appendLine(`[SKC] ERROR: No translated content received from Azure Function`);
                    void vscode.window.showErrorMessage("Translation failed: No content received from Azure Function.");
                    return false;
                }

                progress.report({ increment: 60, message: "Saving translated file..." });

                // Save the translated file
                await fs.writeFile(outputPath, result.translatedContent, "utf8");

                progress.report({ increment: 25, message: "Done!" });

                // Build summary message
                const syncInfo = result.syncInfo || { added: 0, removed: 0, sourceChanged: 0 };
                let summary = `Translated: ${result.translatedCount}`;
                const syncParts = [];
                if (syncInfo.added > 0) syncParts.push(`+${syncInfo.added} added`);
                if (syncInfo.removed > 0) syncParts.push(`-${syncInfo.removed} removed`);
                if (syncInfo.sourceChanged && syncInfo.sourceChanged > 0) syncParts.push(`${syncInfo.sourceChanged} source-changed`);
                if (syncParts.length > 0) {
                    summary += ` | Synced: ${syncParts.join(', ')}`;
                }

                channel.appendLine(`[SKC] ✅ ${summary}`);
                channel.appendLine(`[SKC] Saved to: ${outputPath}`);

                void vscode.window.showInformationMessage(
                    `Translation complete! ${summary}. Saved to ${outputFileName}`
                );

                return true;
            }
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        channel.appendLine(`[SKC] ERROR: ${message}`);
        void vscode.window.showErrorMessage(`Translation failed: ${message}`);
        return false;
    }
}

/**
 * Create a new translation file from a source file
 * @param sourceFileUri - Source file URI (*.g.xlf)
 * @param targetLanguage - Target language code (e.g., "fr-FR")
 * @param channel - Output channel for logging
 */
export async function createTranslationFile(
    sourceFileUri: vscode.Uri,
    targetLanguage: string,
    channel: vscode.OutputChannel
): Promise<boolean> {
    const filePath = sourceFileUri.fsPath;
    const fileName = path.basename(filePath);

    channel.appendLine(`[SKC] Creating translation file for ${targetLanguage} from ${fileName}...`);
    channel.show(true);

    try {
        // Read the source XLF file
        const content = await fs.readFile(filePath, "utf8");

        // Update the target-language attribute
        let newContent = content.replace(
            /target-language="[^"]*"/g,
            `target-language="${targetLanguage}"`
        );

        // Reset all target states to needs-translation and clear target content
        // This regex matches <target ...>content</target> and resets it
        newContent = newContent.replace(
            /<target[^>]*state\s*=\s*["']translated["'][^>]*>[^<]*<\/target>/g,
            `<target state="needs-translation"></target>`
        );

        // Also handle self-closing targets or targets without state
        newContent = newContent.replace(
            /<target[^>]*\/>/g,
            `<target state="needs-translation"></target>`
        );

        // Determine output filename
        const outputFileName = fileName.replace(".g.xlf", `.${targetLanguage}.xlf`);
        const outputPath = path.join(path.dirname(filePath), outputFileName);

        // Write the new file
        await fs.writeFile(outputPath, newContent, "utf8");

        channel.appendLine(`[SKC] Created: ${outputPath}`);
        void vscode.window.showInformationMessage(`Created translation file: ${outputFileName}`);

        return true;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        channel.appendLine(`[SKC] ERROR: ${message}`);
        void vscode.window.showErrorMessage(`Failed to create translation file: ${message}`);
        return false;
    }
}

/**
 * Get translation stats for an XLF file (total units, translated count).
 */
export async function getTranslationStats(filePath: string): Promise<{ total: number; translated: number }> {
    const content = await fs.readFile(filePath, "utf8");
    const transUnitMatches = content.match(/<trans-unit/g);
    const total = transUnitMatches ? transUnitMatches.length : 0;
    const translatedMatches = content.match(/<target[^>]*\sstate\s*=\s*["']translated["'][^>]*>/g);
    const translated = translatedMatches ? translatedMatches.length : 0;
    return { total, translated };
}

/**
 * Headless translate: no UI prompts. Requires Azure URL configured and valid file path + target language.
 * Returns a result object suitable for LLM tool response.
 */
export async function translateFileHeadless(
    fileUri: vscode.Uri,
    targetLanguage: string,
    channel: vscode.OutputChannel
): Promise<TranslateFileHeadlessResult> {
    const cfg = vscode.workspace.getConfiguration("skc");
    const azureFunctionUrl = cfg.get<string>("azureFunctionUrl", "").trim();

    if (!azureFunctionUrl) {
        return { success: false, message: "Azure Function URL not configured. Set skc.azureFunctionUrl in settings." };
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
    if (!workspaceFolder) {
        return { success: false, message: "Could not determine workspace folder for this file." };
    }

    const filePath = fileUri.fsPath;
    const fileName = path.basename(filePath);
    if (!fileName.endsWith(".g.xlf")) {
        return { success: false, message: "File must be a source XLF file (*.g.xlf)." };
    }

    try {
        const sourceContent = await fs.readFile(filePath, "utf8");
        const outputFileName = fileName.replace(".g.xlf", `.${targetLanguage}.xlf`);
        const outputPath = path.join(path.dirname(filePath), outputFileName);

        let targetContent: string;
        try {
            targetContent = await fs.readFile(outputPath, "utf8");
        } catch {
            targetContent = sourceContent;
        }

        const result = await callAzureFunctionWithSync(
            azureFunctionUrl,
            sourceContent,
            targetContent,
            targetLanguage,
            channel
        );

        if (!result || !result.translatedContent) {
            return { success: false, message: "No translated content received from Azure Function." };
        }

        await fs.writeFile(outputPath, result.translatedContent, "utf8");

        const syncInfo = result.syncInfo || { added: 0, removed: 0 };
        let summary = `Translated: ${result.translatedCount}`;
        const parts: string[] = [];
        if (syncInfo.added > 0) parts.push(`+${syncInfo.added} added`);
        if (syncInfo.removed > 0) parts.push(`-${syncInfo.removed} removed`);
        if (parts.length > 0) summary += ` | Synced: ${parts.join(", ")}`;
        summary += `. Saved to ${outputFileName}`;

        return {
            success: true,
            message: summary,
            translatedCount: result.translatedCount,
            syncInfo: { added: syncInfo.added, removed: syncInfo.removed }
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, message: `Translation failed: ${message}` };
    }
}

/**
 * Build a text summary of translation files and status in the workspace (for LLM tools).
 */
export async function getTranslationStatusSummary(workspaceFolderUri?: vscode.Uri): Promise<string> {
    const folders = workspaceFolderUri
        ? [workspaceFolderUri]
        : (vscode.workspace.workspaceFolders?.map((f) => f.uri) ?? []);

    if (folders.length === 0) {
        return "No workspace folder open.";
    }

    const lines: string[] = [];

    for (const folder of folders) {
        const translationsPath = path.join(folder.fsPath, "Translations");
        try {
            await fs.access(translationsPath);
        } catch {
            lines.push(`Folder ${folder.fsPath}: No Translations folder.`);
            continue;
        }

        const files = await fs.readdir(translationsPath);
        const sourceXlfFiles = files.filter((f) => f.endsWith(".g.xlf"));
        if (sourceXlfFiles.length === 0) {
            lines.push(`Folder ${folder.fsPath}: Translations folder has no .g.xlf files.`);
            continue;
        }

        lines.push(`Workspace: ${folder.fsPath}`);
        for (const file of sourceXlfFiles) {
            const sourcePath = path.join(translationsPath, file);
            const sourceBaseName = file.replace(".g.xlf", "");
            let sourceStats: { total: number; translated: number };
            try {
                sourceStats = await getTranslationStats(sourcePath);
            } catch {
                sourceStats = { total: 0, translated: 0 };
            }
            lines.push(`- ${file}: ${sourceStats.total} units`);

            const targetPattern = new RegExp(`^${sourceBaseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.([a-z]{2}-[A-Z]{2})\\.xlf$`, "i");
            for (const f of files) {
                const match = f.match(targetPattern);
                if (match) {
                    const lang = match[1];
                    const targetPath = path.join(translationsPath, f);
                    try {
                        const stats = await getTranslationStats(targetPath);
                        const pct = stats.total > 0 ? Math.floor((stats.translated / stats.total) * 100) : 0;
                        lines.push(`  - ${lang}: ${stats.translated}/${stats.total} (${pct}%)`);
                    } catch {
                        lines.push(`  - ${lang}: (error reading)`);
                    }
                }
            }
        }
    }

    return lines.length > 0 ? lines.join("\n") : "No translation files found.";
}

/**
 * Call the Azure Translation Function with sync support
 * Sends both source content (for schema) and target content (to update)
 * Azure Function will: add missing units, remove obsolete units, translate
 */
async function callAzureFunctionWithSync(
    url: string,
    sourceContent: string,
    targetContent: string,
    targetLanguage: string,
    channel: vscode.OutputChannel
): Promise<TranslationResult | null> {
    return new Promise((resolve, reject) => {
        // Ensure URL has mode=direct parameter
        const urlObj = new URL(url);
        if (!urlObj.searchParams.has("mode")) {
            urlObj.searchParams.set("mode", "direct");
        }

        const finalUrl = urlObj.toString();
        channel.appendLine(`[SKC] Calling Azure Function: ${urlObj.hostname}`);

        // Send both source (for sync schema) and target (to update)
        const payload = JSON.stringify({
            content: targetContent,       // Target file to update
            sourceContent: sourceContent, // Source file for sync schema
            targetLanguage
        });

        channel.appendLine(`[SKC] Payload size: ${(Buffer.byteLength(payload) / 1024).toFixed(1)} KB`);

        const isHttps = finalUrl.startsWith("https");
        const httpModule = isHttps ? https : http;

        const options: https.RequestOptions = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
                "x-translation-mode": "direct"
            },
            timeout: REQUEST_TIMEOUT_MS
        };

        const req = httpModule.request(finalUrl, options, (res) => {
            let data = "";

            res.on("data", (chunk) => {
                data += chunk;
            });

            res.on("end", () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Azure Function returned status ${res.statusCode}: ${data.substring(0, 200)}`));
                    return;
                }

                try {
                    const result = JSON.parse(data) as TranslationResult;
                    resolve(result);
                } catch {
                    reject(new Error("Failed to parse Azure Function response"));
                }
            });
        });

        req.on("error", (error) => {
            reject(error);
        });

        req.on("timeout", () => {
            req.destroy();
            reject(new Error("Request timed out"));
        });

        req.write(payload);
        req.end();
    });
}

