import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";
import * as https from "https";
import * as http from "http";

export interface TranslationResult {
    translatedContent: string;
    translatedCount: number;
}

// Chunk configuration - balance between request size and number of requests
const TRANS_UNITS_PER_CHUNK = 500; // Number of trans-units per chunk (optimized for Azure gateway)
const CHUNK_TIMEOUT_MS = 300000;   // 5 minutes per chunk (Azure gateway limit ~230s)

/**
 * Format seconds into human-readable time (e.g., "2h 15m 30s" or "5m 20s" or "45s")
 */
function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.round(seconds % 60);

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(" ");
}

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
        // Read the XLF file content
        const content = await fs.readFile(filePath, "utf8");
        channel.appendLine(`[SKC] Read file: ${content.length} characters`);

        // Count trans-units to determine if chunking is needed
        const transUnitCount = (content.match(/<trans-unit/g) || []).length;
        const useChunking = transUnitCount > TRANS_UNITS_PER_CHUNK;

        channel.appendLine(`[SKC] Found ${transUnitCount} trans-units`);

        if (useChunking) {
            const totalChunks = Math.ceil(transUnitCount / TRANS_UNITS_PER_CHUNK);
            channel.appendLine(`[SKC] Large file detected. Using chunked processing (${totalChunks} chunks)`);
        }

        // Determine output filename and path upfront
        const outputFileName = fileName.replace(".g.xlf", `.${targetLanguage}.xlf`);
        const outputPath = path.join(path.dirname(filePath), outputFileName);

        channel.appendLine(`[SKC] Starting translation process...`);
        channel.appendLine(`[SKC] Azure Function URL: ${azureFunctionUrl}`);
        channel.appendLine(`[SKC] Output file: ${outputPath}`);

        // Show progress
        return await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Translating ${fileName} to ${targetLanguage}...`,
                cancellable: false
            },
            async (progress) => {
                let result: TranslationResult | null;

                if (useChunking) {
                    // Use chunked processing for large files (saves after each chunk)
                    channel.appendLine(`[SKC] Entering chunked translation mode...`);
                    progress.report({ increment: 5, message: "Starting chunked translation..." });
                    result = await translateInChunks(azureFunctionUrl, content, targetLanguage!, outputPath, channel, progress);
                } else {
                    // Direct translation for smaller files
                    progress.report({ increment: 10, message: "Sending to Azure..." });
                    result = await callAzureFunctionSingle(azureFunctionUrl, content, targetLanguage!, channel);
                }

                if (!result || !result.translatedContent) {
                    channel.appendLine(`[SKC] ERROR: No translated content received from Azure Function`);
                    void vscode.window.showErrorMessage("Translation failed: No content received from Azure Function.");
                    return false;
                }

                progress.report({ increment: useChunking ? 20 : 60, message: "Saving translated file..." });

                // For non-chunked mode, write the file (chunked mode already saves incrementally)
                if (!useChunking) {
                    await fs.writeFile(outputPath, result.translatedContent, "utf8");
                }

                progress.report({ increment: 5, message: "Done!" });

                channel.appendLine(`[SKC] Successfully translated ${result.translatedCount} units`);
                channel.appendLine(`[SKC] Saved to: ${outputPath}`);

                void vscode.window.showInformationMessage(
                    `Translation complete! ${result.translatedCount} units translated. Saved to ${outputFileName}`
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
 * Extract trans-unit elements from XLF content
 */
function extractTransUnits(content: string): { units: string[]; header: string; footer: string } {
    // Match all trans-unit elements (including nested content)
    const transUnitRegex = /<trans-unit[\s\S]*?<\/trans-unit>/g;
    const units: string[] = [];
    let match;

    while ((match = transUnitRegex.exec(content)) !== null) {
        units.push(match[0]);
    }

    // Extract header (everything before first trans-unit)
    const firstUnitIndex = content.indexOf("<trans-unit");
    const header = firstUnitIndex > 0 ? content.substring(0, firstUnitIndex) : "";

    // Extract footer (everything after last trans-unit)
    const lastUnitEnd = content.lastIndexOf("</trans-unit>") + "</trans-unit>".length;
    const footer = lastUnitEnd > 0 ? content.substring(lastUnitEnd) : "";

    return { units, header, footer };
}

/**
 * Build a minimal XLF wrapper for a chunk of trans-units
 */
function buildChunkXlf(
    units: string[],
    originalContent: string,
    targetLanguage: string
): string {
    // Extract the xliff and file element attributes from original
    const xliffMatch = originalContent.match(/<xliff[^>]*>/);
    const fileMatch = originalContent.match(/<file[^>]*>/);

    const xliffOpen = xliffMatch ? xliffMatch[0] : '<?xml version="1.0" encoding="utf-8"?><xliff version="1.2">';
    let fileOpen = fileMatch ? fileMatch[0] : '<file datatype="xml" source-language="en-US">';

    // Update target-language in file element
    fileOpen = fileOpen.replace(/target-language="[^"]*"/, `target-language="${targetLanguage}"`);
    if (!fileOpen.includes("target-language=")) {
        fileOpen = fileOpen.replace(/>$/, ` target-language="${targetLanguage}">`);
    }

    return `<?xml version="1.0" encoding="utf-8"?>
${xliffOpen}
  ${fileOpen}
    <body>
      <group id="body">
        ${units.join("\n        ")}
      </group>
    </body>
  </file>
</xliff>`;
}

/**
 * Extract translated trans-units from response content
 */
function extractTranslatedUnits(responseContent: string): Map<string, string> {
    const unitMap = new Map<string, string>();
    const transUnitRegex = /<trans-unit\s+id="([^"]+)"[\s\S]*?<\/trans-unit>/g;
    let match;

    while ((match = transUnitRegex.exec(responseContent)) !== null) {
        const id = match[1];
        const fullUnit = match[0];
        unitMap.set(id, fullUnit);
    }

    return unitMap;
}

/**
 * Translate large files in chunks with incremental saving
 */
async function translateInChunks(
    url: string,
    content: string,
    targetLanguage: string,
    outputPath: string,
    channel: vscode.OutputChannel,
    progress: vscode.Progress<{ increment?: number; message?: string }>
): Promise<TranslationResult | null> {
    channel.appendLine(`[SKC] translateInChunks() called`);
    channel.appendLine(`[SKC] URL: ${url}`);
    channel.appendLine(`[SKC] Content length: ${content.length} chars`);
    channel.appendLine(`[SKC] Target language: ${targetLanguage}`);
    channel.appendLine(`[SKC] Output file: ${outputPath}`);

    channel.appendLine(`[SKC] Extracting trans-units from content...`);
    const { units } = extractTransUnits(content);

    if (units.length === 0) {
        channel.appendLine("[SKC] No trans-units found in file");
        return { translatedContent: content, translatedCount: 0 };
    }

    channel.appendLine(`[SKC] Extracted ${units.length} trans-units, processing in chunks of ${TRANS_UNITS_PER_CHUNK}`);

    const totalChunks = Math.ceil(units.length / TRANS_UNITS_PER_CHUNK);
    const translatedUnits = new Map<string, string>();
    let totalTranslated = 0;
    const progressIncrement = 70 / totalChunks; // Reserve 70% progress for chunked translation

    // Initialize working content with target language updated
    let workingContent = content.replace(
        /target-language="[^"]*"/,
        `target-language="${targetLanguage}"`
    );
    // If no target-language attribute exists, try to add it
    if (!workingContent.includes(`target-language="${targetLanguage}"`)) {
        workingContent = workingContent.replace(
            /<file([^>]*)>/,
            `<file$1 target-language="${targetLanguage}">`
        );
    }

    const startTime = Date.now();
    channel.appendLine(`[SKC] ════════════════════════════════════════════════════════════════`);
    channel.appendLine(`[SKC] Starting chunked translation: ${units.length} units in ${totalChunks} chunks`);
    channel.appendLine(`[SKC] Target language: ${targetLanguage}`);
    channel.appendLine(`[SKC] 💾 Progress will be saved after each chunk`);
    channel.appendLine(`[SKC] ════════════════════════════════════════════════════════════════`);

    for (let i = 0; i < units.length; i += TRANS_UNITS_PER_CHUNK) {
        const chunkIndex = Math.floor(i / TRANS_UNITS_PER_CHUNK) + 1;
        const chunkUnits = units.slice(i, i + TRANS_UNITS_PER_CHUNK);
        const percentComplete = Math.round((chunkIndex / totalChunks) * 100);
        const elapsedTime = (Date.now() - startTime) / 1000;

        channel.appendLine(`[SKC] ────────────────────────────────────────────────────────────────`);
        channel.appendLine(`[SKC] 📦 CHUNK ${chunkIndex}/${totalChunks} (${percentComplete}% complete)`);
        channel.appendLine(`[SKC]    Units in this chunk: ${chunkUnits.length}`);
        channel.appendLine(`[SKC]    Running total translated: ${totalTranslated}`);
        channel.appendLine(`[SKC]    Elapsed time: ${formatDuration(elapsedTime)}`);

        progress.report({
            increment: progressIncrement,
            message: `Chunk ${chunkIndex}/${totalChunks} (${percentComplete}%)`
        });

        // Build chunk XLF
        const chunkXlf = buildChunkXlf(chunkUnits, content, targetLanguage);
        const chunkStartTime = Date.now();

        try {
            // Send chunk to Azure Function
            const result = await callAzureFunctionSingle(url, chunkXlf, targetLanguage, channel);
            const chunkDuration = (Date.now() - chunkStartTime) / 1000;

            if (result?.translatedContent) {
                // Extract translated units from response
                const responseUnits = extractTranslatedUnits(result.translatedContent);

                // Apply translations to working content immediately
                responseUnits.forEach((translatedUnit, id) => {
                    translatedUnits.set(id, translatedUnit);

                    // Update working content with this translation
                    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                    const originalUnitRegex = new RegExp(
                        `<trans-unit\\s+id="${escapedId}"[\\s\\S]*?<\\/trans-unit>`,
                        "g"
                    );
                    workingContent = workingContent.replace(originalUnitRegex, translatedUnit);
                });

                totalTranslated += result.translatedCount;
                channel.appendLine(`[SKC] ✅ Chunk ${chunkIndex} complete: ${result.translatedCount} units translated in ${formatDuration(chunkDuration)}`);

                // Save progress to file after each chunk
                await fs.writeFile(outputPath, workingContent, "utf8");
                channel.appendLine(`[SKC] 💾 Progress saved to file (${totalTranslated} units so far)`);

                // Estimate remaining time
                const avgTimePerChunk = (Date.now() - startTime) / chunkIndex / 1000;
                const remainingChunks = totalChunks - chunkIndex;
                const estimatedRemaining = avgTimePerChunk * remainingChunks;
                if (remainingChunks > 0) {
                    channel.appendLine(`[SKC]    ⏱️ Estimated time remaining: ~${formatDuration(estimatedRemaining)} (${remainingChunks} chunks left)`);
                }
            } else {
                channel.appendLine(`[SKC] ⚠️ WARNING: Chunk ${chunkIndex} returned no translated content (${formatDuration(chunkDuration)})`);
            }
        } catch (error) {
            const chunkDuration = (Date.now() - chunkStartTime) / 1000;
            const message = error instanceof Error ? error.message : String(error);
            channel.appendLine(`[SKC] ❌ ERROR in chunk ${chunkIndex} after ${formatDuration(chunkDuration)}: ${message}`);

            // Save current progress before asking about continuing
            if (translatedUnits.size > 0) {
                await fs.writeFile(outputPath, workingContent, "utf8");
                channel.appendLine(`[SKC] 💾 Progress saved (${totalTranslated} units preserved)`);
            }

            // Ask user if they want to continue or abort
            const action = await vscode.window.showWarningMessage(
                `Chunk ${chunkIndex}/${totalChunks} failed: ${message}. Progress saved (${totalTranslated} units). Continue with remaining chunks?`,
                "Continue",
                "Abort"
            );

            if (action === "Abort") {
                channel.appendLine(`[SKC] Translation aborted. ${totalTranslated} units were saved.`);
                return {
                    translatedContent: workingContent,
                    translatedCount: totalTranslated
                };
            }
            channel.appendLine(`[SKC]    User chose to continue...`);
        }
    }

    const totalDuration = (Date.now() - startTime) / 1000;
    channel.appendLine(`[SKC] ════════════════════════════════════════════════════════════════`);
    channel.appendLine(`[SKC] ✅ CHUNKED TRANSLATION COMPLETE`);
    channel.appendLine(`[SKC]    Total units translated: ${totalTranslated}`);
    channel.appendLine(`[SKC]    Total time: ${formatDuration(totalDuration)}`);
    channel.appendLine(`[SKC]    Average per chunk: ${formatDuration(totalDuration / totalChunks)}`);
    channel.appendLine(`[SKC] ════════════════════════════════════════════════════════════════`);

    return {
        translatedContent: workingContent,
        translatedCount: totalTranslated
    };
}

/**
 * Call the Azure Translation Function (single request)
 */
async function callAzureFunctionSingle(
    url: string,
    content: string,
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

        const payload = JSON.stringify({
            content,
            targetLanguage
        });

        const isHttps = finalUrl.startsWith("https");
        const httpModule = isHttps ? https : http;

        const options: https.RequestOptions = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
                "x-translation-mode": "direct"
            },
            timeout: CHUNK_TIMEOUT_MS
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

