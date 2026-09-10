import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import * as crypto from "crypto";
import { getTranslationStatsFromContent } from "./xlfStatus";

export interface TranslationResult {
    translatedContent: string;
    translatedCount: number;
    syncInfo?: {
        added: number;
        removed: number;
        sourceChanged?: number;
    };
    sourceHash?: string;
}

export interface TrackedTranslationJob {
    jobId: string;
    statusUrl: string;
    sourceHash: string;
    targetLanguage: string;
    targetFilePath: string;
    status: string;
    updatedAt: number;
    progress?: {
        completed?: number;
        total?: number;
        remaining?: number;
        percentage?: number;
    };
    result?: TranslationResult;
}

export interface TranslateFileHeadlessResult {
    success: boolean;
    message: string;
    translatedCount?: number;
    syncInfo?: { added: number; removed: number };
}

// Async jobs run across many short Consumption-plan timer invocations.
// The server remains the source of truth; this is only the client polling window.
const DEFAULT_POLL_TIMEOUT_MINUTES = 60;
const INITIAL_REQUEST_TIMEOUT_MS = 120000;
const TRACKED_JOBS_STATE_KEY = "skc.translationTrackedJobs";

// Tracked in-memory/workspace jobs registry
const trackedJobs = new Map<string, TrackedTranslationJob>();
let trackedJobsState: vscode.Memento | undefined;

class RestartTranslationError extends Error {
    constructor() {
        super("The previous translation job was discarded; starting a fresh job.");
        this.name = "RestartTranslationError";
    }
}

/**
 * Compute a SHA-256 hash of the source XLF content
 */
export function computeSourceHash(content: string): string {
    return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

export function getTrackedJobs(): TrackedTranslationJob[] {
    return Array.from(trackedJobs.values()).map((job) => ({ ...job }));
}

/** Load tracked jobs from VS Code workspace state so polling can resume after reload. */
export async function configureTranslationState(state: vscode.Memento): Promise<void> {
    trackedJobsState = state;
    const savedJobs = state.get<TrackedTranslationJob[]>(TRACKED_JOBS_STATE_KEY, []);
    for (const job of savedJobs) {
        if (job?.jobId && job.statusUrl && job.targetFilePath && job.targetLanguage) {
            trackedJobs.set(getJobKey(job.targetFilePath, job.targetLanguage), job);
        }
    }
}

function persistTrackedJobs(): void {
    if (trackedJobsState) {
        void trackedJobsState.update(TRACKED_JOBS_STATE_KEY, Array.from(trackedJobs.values()));
    }
}

function getJobKey(targetFilePath: string, targetLanguage: string): string {
    return `${path.normalize(targetFilePath).toLowerCase()}|${targetLanguage.toLowerCase()}`;
}

export function getTrackedJob(targetFilePath: string, targetLanguage: string): TrackedTranslationJob | undefined {
    return trackedJobs.get(getJobKey(targetFilePath, targetLanguage));
}

export function setTrackedJob(job: TrackedTranslationJob): void {
    trackedJobs.set(getJobKey(job.targetFilePath, job.targetLanguage), job);
    persistTrackedJobs();
}

export function removeTrackedJob(targetFilePath: string, targetLanguage: string): void {
    trackedJobs.delete(getJobKey(targetFilePath, targetLanguage));
    persistTrackedJobs();
}

export async function refreshTrackedJobStatuses(channel?: vscode.OutputChannel): Promise<TrackedTranslationJob[]> {
    const jobs = getTrackedJobs();
    await Promise.all(jobs.map(async (job) => {
        try {
            const response = await httpGet(job.statusUrl) as Record<string, unknown>;
            job.status = String(response.status ?? job.status);
            const progress = response.progress as TrackedTranslationJob["progress"] | undefined;
            if (progress) job.progress = progress;
            job.updatedAt = Date.now();
            setTrackedJob(job);
        } catch (error) {
            channel?.appendLine(`[SKC] Could not refresh job ${job.jobId}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }));
    return getTrackedJobs();
}

export async function cancelTrackedJob(job: TrackedTranslationJob, channel: vscode.OutputChannel): Promise<boolean> {
    const cancelled = await cancelAzureJob(job.statusUrl, channel);
    if (cancelled) removeTrackedJob(job.targetFilePath, job.targetLanguage);
    return cancelled;
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
        // Read the source XLF file content (*.g.xlf)
        const sourceContent = await fs.readFile(filePath, "utf8");
        channel.appendLine(`[SKC] Read source file: ${sourceContent.length} characters`);

        // Count trans-units for logging
        const transUnitCount = (sourceContent.match(/<trans-unit/g) || []).length;
        channel.appendLine(`[SKC] Source file has ${transUnitCount} trans-units`);

        // Determine output filename and path
        const outputFileName = fileName.replace(".g.xlf", `.${targetLanguage}.xlf`);
        const outputPath = path.join(path.dirname(filePath), outputFileName);

        const currentSourceHash = computeSourceHash(sourceContent);

        // Check for existing active or previous tracked job for this target file
        const existingJob = getTrackedJob(outputPath, targetLanguage);
        if (existingJob) {
            if (existingJob.sourceHash !== currentSourceHash) {
                channel.appendLine(`[SKC] Source snapshot change detected for existing job (current: ${currentSourceHash.substring(0, 8)}, job: ${existingJob.sourceHash.substring(0, 8)})`);

                const DISCARD_OPTION = "Discard old job and start fresh";
                const CONTINUE_OPTION = "Continue old job";
                const CANCEL_OPTION = "Cancel";

                const choice = await vscode.window.showWarningMessage(
                    `The source file (${fileName}) has changed since the previous translation job was started for ${targetLanguage}. Continuing the old job may produce inconsistent translations.`,
                    { modal: true },
                    DISCARD_OPTION,
                    CONTINUE_OPTION,
                    CANCEL_OPTION
                );

                if (choice === DISCARD_OPTION) {
                    channel.appendLine(`[SKC] User chose to discard old job (${existingJob.jobId}). Cleaning up...`);
                    const cleaned = await deleteAzureJob(existingJob.statusUrl, channel);
                    if (!cleaned) {
                        const forceProceed = await vscode.window.showWarningMessage(
                            `Failed to verify cleanup of the old job on the server. Do you still want to proceed with a fresh translation?`,
                            "Proceed",
                            "Cancel"
                        );
                        if (forceProceed !== "Proceed") {
                            channel.appendLine(`[SKC] Aborted starting new job due to unverified old job cleanup.`);
                            return false;
                        }
                    }
                    removeTrackedJob(outputPath, targetLanguage);
                } else if (choice === CONTINUE_OPTION) {
                    channel.appendLine(`[SKC] User chose to continue old job (${existingJob.jobId}) for previous source snapshot.`);
                    return await vscode.window.withProgress(
                        {
                            location: vscode.ProgressLocation.Notification,
                            title: `Resuming translation of ${fileName} to ${targetLanguage}...`,
                            cancellable: false
                        },
                        async (progress) => {
                            progress.report({ increment: 20, message: "Resuming polling of previous job..." });
                            const resumedResult = await pollJobUntilComplete(existingJob.statusUrl, channel, outputPath, targetLanguage);

                            progress.report({ increment: 60, message: "Saving translated file..." });
                            await fs.writeFile(outputPath, resumedResult.translatedContent, "utf8");
                            progress.report({ increment: 20, message: "Done!" });

                            const syncInfo = resumedResult.syncInfo || { added: 0, removed: 0, sourceChanged: 0 };
                            let summary = `Translated: ${resumedResult.translatedCount}`;
                            const syncParts = [];
                            if (syncInfo.added > 0) syncParts.push(`+${syncInfo.added} added`);
                            if (syncInfo.removed > 0) syncParts.push(`-${syncInfo.removed} removed`);
                            if (syncInfo.sourceChanged && syncInfo.sourceChanged > 0) syncParts.push(`${syncInfo.sourceChanged} source-changed`);
                            if (syncParts.length > 0) summary += ` | Synced: ${syncParts.join(', ')}`;

                            channel.appendLine(`[SKC] ✅ ${summary}`);
                            channel.appendLine(`[SKC] Saved to: ${outputPath}`);
                            void vscode.window.showInformationMessage(`Translation complete! ${summary}. Saved to ${outputFileName}`);
                            return true;
                        }
                    );
                } else {
                    // Cancel or dismissed
                    channel.appendLine(`[SKC] Translation cancelled by user.`);
                    return false;
                }
            }
        }

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

        channel.appendLine(`[SKC] Sending to Azure Function with sync enabled`);
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

                // Send source + target to Azure Function for full sync
                // Azure Function will: add missing units, remove obsolete units, translate
                const result = await callAzureFunctionWithSync(
                    azureFunctionUrl,
                    sourceContent,
                    targetContent!,
                    targetLanguage!,
                    channel,
                    currentSourceHash,
                    outputFileName,
                    outputPath
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
    return getTranslationStatsFromContent(content);
}

/**
 * Headless translate: no UI prompts. Requires Azure URL configured and valid file path + target language.
 * Returns a result object suitable for LLM tool response.
 */
export async function translateFileHeadless(
    fileUri: vscode.Uri,
    targetLanguage: string,
    channel: vscode.OutputChannel,
    cancellationToken?: vscode.CancellationToken
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
        const currentSourceHash = computeSourceHash(sourceContent);

        // Headless mode: discard obsolete job if source changed
        const existingJob = getTrackedJob(outputPath, targetLanguage);
        if (existingJob && existingJob.sourceHash !== currentSourceHash) {
            channel.appendLine(`[SKC] Headless translation: source snapshot changed. Discarding old job ${existingJob.jobId}...`);
            await deleteAzureJob(existingJob.statusUrl, channel);
            removeTrackedJob(outputPath, targetLanguage);
        }

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
            channel,
            currentSourceHash,
            outputFileName,
            outputPath,
            cancellationToken
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
 * Perform a simple HTTP GET and return the parsed JSON body.
 */
function httpGet(url: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const isHttps = url.startsWith("https");
        const httpModule = isHttps ? https : http;
        const req = httpModule.get(url, { timeout: 30000 }, (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    reject(new Error(`Failed to parse response: ${data.substring(0, 200)}`));
                }
            });
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("Poll request timed out")); });
    });
}

/**
 * Delete / clean up a job on the Azure Function server.
 */
export async function deleteAzureJob(statusUrl: string, channel: vscode.OutputChannel): Promise<boolean> {
    try {
        const urlObj = new URL(statusUrl);
        urlObj.searchParams.set("cleanup", "true");
        const deleteUrl = urlObj.toString();
        channel.appendLine(`[SKC] Requesting server cleanup for old job...`);

        const isHttps = deleteUrl.startsWith("https");
        const httpModule = isHttps ? https : http;

        const res = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
            const req = httpModule.request(deleteUrl, { method: "POST", timeout: 15000 }, (res) => {
                let data = "";
                res.on("data", (chunk) => { data += chunk; });
                res.on("end", () => resolve({ statusCode: res.statusCode ?? 0, body: data }));
            });
            req.on("error", reject);
            req.on("timeout", () => { req.destroy(); reject(new Error("Cleanup request timed out")); });
            req.end();
        });

        if (res.statusCode === 200 || res.statusCode === 404) {
            channel.appendLine(`[SKC] Job cleanup succeeded (status ${res.statusCode})`);
            return true;
        } else {
            channel.appendLine(`[SKC] WARNING: Job cleanup returned status ${res.statusCode}: ${res.body}`);
            return false;
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        channel.appendLine(`[SKC] WARNING: Failed to delete job on server: ${msg}`);
        return false;
    }
}

/** Request graceful cancellation of an active Azure job. */
export async function cancelAzureJob(statusUrl: string, channel: vscode.OutputChannel): Promise<boolean> {
    try {
        const urlObj = new URL(statusUrl);
        urlObj.searchParams.set("cancel", "true");
        const cancelUrl = urlObj.toString();
        channel.appendLine(`[SKC] Requesting graceful Azure job cancellation...`);
        const isHttps = cancelUrl.startsWith("https");
        const httpModule = isHttps ? https : http;
        const response = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
            const req = httpModule.request(cancelUrl, { method: "POST", timeout: 15000 }, (res) => {
                let data = "";
                res.on("data", (chunk) => { data += chunk; });
                res.on("end", () => resolve({ statusCode: res.statusCode ?? 0, body: data }));
            });
            req.on("error", reject);
            req.on("timeout", () => { req.destroy(); reject(new Error("Cancellation request timed out")); });
            req.end();
        });
        if (response.statusCode === 200 || response.statusCode === 404) {
            channel.appendLine(`[SKC] Azure job cancellation requested (status ${response.statusCode})`);
            return true;
        }
        channel.appendLine(`[SKC] WARNING: Azure job cancellation returned status ${response.statusCode}: ${response.body}`);
        return false;
    } catch (error) {
        channel.appendLine(`[SKC] WARNING: Failed to cancel Azure job: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

/**
 * Poll a job status URL until the job completes or fails.
 * Returns the final job result with translatedContent, translatedCount, syncInfo.
 */
async function pollJobUntilComplete(
    statusUrl: string,
    channel: vscode.OutputChannel,
    targetFilePath?: string,
    targetLanguage?: string,
    cancellationToken?: vscode.CancellationToken
): Promise<TranslationResult> {
    const POLL_INTERVAL_MS = 3000;
    const configuredMinutes = vscode.workspace
        .getConfiguration("skc")
        .get<number>("translationPollingTimeoutMinutes", DEFAULT_POLL_TIMEOUT_MINUTES);
    const timeoutMinutes = Number.isFinite(configuredMinutes) && configuredMinutes > 0
        ? configuredMinutes
        : DEFAULT_POLL_TIMEOUT_MINUTES;
    const MAX_WAIT_MS = timeoutMinutes * 60 * 1000;
    const started = Date.now();

    channel.appendLine(`[SKC] Async job created — polling for result...`);

    while (Date.now() - started < MAX_WAIT_MS) {
        if (cancellationToken?.isCancellationRequested) {
            if (targetFilePath && targetLanguage) {
                await cancelAzureJob(statusUrl, channel);
                removeTrackedJob(targetFilePath, targetLanguage);
            }
            throw new Error("Translation cancelled; the Azure job cleanup was requested.");
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

        const statusResponse = await httpGet(statusUrl) as Record<string, unknown>;
        const status = statusResponse.status as string;
        const progress = statusResponse.progress as Record<string, unknown> | undefined;

        if (targetFilePath && targetLanguage) {
            const currentJob = getTrackedJob(targetFilePath, targetLanguage);
            if (currentJob) {
                currentJob.status = status;
                currentJob.progress = progress as TrackedTranslationJob["progress"] | undefined;
                currentJob.updatedAt = Date.now();
                setTrackedJob(currentJob);
            }
        }

        const progressDetails = progress?.completed !== undefined && progress?.remaining !== undefined
            ? ` (${progress.completed} translated, ${progress.remaining} remaining)`
            : "";
        channel.appendLine(`[SKC] Job status: ${status}${progress?.message ? ` — ${progress.message}` : ""}${progressDetails}`);

        if (status === "completed") {
            // Fetch result and clean up job in one request
            const resultUrl = `${statusUrl}&result=true&delete=true`;
            const resultResponse = await httpGet(resultUrl) as Record<string, unknown>;
            const result = resultResponse.result as Record<string, unknown> | undefined;

            if (!result?.translatedContent) {
                throw new Error("Job completed but no translated content in result");
            }

            if (targetFilePath && targetLanguage) {
                removeTrackedJob(targetFilePath, targetLanguage);
            }

            return {
                translatedContent: result.translatedContent as string,
                translatedCount: (result.translatedCount as number) ?? 0,
                syncInfo: result.syncInfo as TranslationResult["syncInfo"],
                sourceHash: statusResponse.sourceHash as string | undefined
            };
        }

        if (status === "failed") {
            if (targetFilePath && targetLanguage) {
                removeTrackedJob(targetFilePath, targetLanguage);
            }
            throw new Error(`Translation job failed: ${(statusResponse.error as string) ?? "unknown error"}`);
        }

        if (status === "expired") {
            if (targetFilePath && targetLanguage) {
                removeTrackedJob(targetFilePath, targetLanguage);
            }
            throw new Error("Translation job expired before completing");
        }
    }

    if (targetFilePath && targetLanguage) {
        const resumeChoice = await vscode.window.showWarningMessage(
            `The translation job is still running after ${timeoutMinutes} minutes. What would you like to do?`,
            { modal: true },
            "Resume existing job",
            "Discard old job and start fresh",
            "Cancel"
        );

        if (resumeChoice === "Resume existing job") {
            channel.appendLine(`[SKC] Resuming polling for existing job instead of creating a duplicate.`);
            return pollJobUntilComplete(statusUrl, channel, targetFilePath, targetLanguage, cancellationToken);
        }

        if (resumeChoice === "Discard old job and start fresh") {
            const cleaned = await deleteAzureJob(statusUrl, channel);
            if (!cleaned) {
                throw new Error("Could not safely discard the old translation job. No new job was submitted.");
            }
            removeTrackedJob(targetFilePath, targetLanguage);
            throw new RestartTranslationError();
        }

        throw new Error("Translation polling cancelled. The existing server job was left untouched.");
    }

    throw new Error(`Translation job polling timed out after ${timeoutMinutes} minutes; the server may still be processing it. Re-run the translation or inspect the job status.`);
}

/**
 * Call the Azure Translation Function with sync support
 * Sends both source content (for schema) and target content (to update)
 * Azure Function will: add missing units, remove obsolete units, translate
 * Handles both synchronous (200) and asynchronous (202) responses.
 */
async function callAzureFunctionWithSync(
    url: string,
    sourceContent: string,
    targetContent: string,
    targetLanguage: string,
    channel: vscode.OutputChannel,
    sourceHash?: string,
    targetIdentity?: string,
    targetFilePath?: string,
    cancellationToken?: vscode.CancellationToken
): Promise<TranslationResult | null> {
    if (cancellationToken?.isCancellationRequested) {
        throw new Error("Translation cancelled before submission.");
    }
    // Ensure URL has mode=direct parameter
    const urlObj = new URL(url);
    if (!urlObj.searchParams.has("mode")) {
        urlObj.searchParams.set("mode", "direct");
    }

    const finalUrl = urlObj.toString();
    channel.appendLine(`[SKC] Calling Azure Function: ${urlObj.hostname}`);

    const payload = JSON.stringify({
        content: targetContent,       // Target file to update
        sourceContent: sourceContent, // Source file for sync schema
        targetLanguage,
        sourceHash: sourceHash || computeSourceHash(sourceContent),
        targetIdentity: targetIdentity || (targetFilePath ? path.basename(targetFilePath) : undefined)
    });

    channel.appendLine(`[SKC] Payload size: ${(Buffer.byteLength(payload) / 1024).toFixed(1)} KB`);

    const isHttps = finalUrl.startsWith("https");
    const httpModule = isHttps ? https : http;

    const { statusCode, body } = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
        const options: https.RequestOptions = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
                "x-translation-mode": "direct"
            },
            timeout: INITIAL_REQUEST_TIMEOUT_MS
        };

        const req = httpModule.request(finalUrl, options, (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => resolve({ statusCode: res.statusCode ?? 0, body: data }));
        });

        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("Request timed out")); });
        req.write(payload);
        req.end();
    });

    const currentHash = sourceHash || computeSourceHash(sourceContent);

    // Synchronous success
    if (statusCode === 200) {
        try {
            const parsed = JSON.parse(body) as TranslationResult;
            if (targetFilePath) {
                // Clear any tracked async job since sync completed immediately
                removeTrackedJob(targetFilePath, targetLanguage);
            }
            return {
                ...parsed,
                sourceHash: currentHash
            };
        } catch {
            throw new Error("Failed to parse Azure Function response");
        }
    }

    // Async job accepted — poll for result
    if (statusCode === 202) {
        let jobInfo: Record<string, unknown>;
        try {
            jobInfo = JSON.parse(body) as Record<string, unknown>;
        } catch {
            throw new Error("Failed to parse async job response");
        }

        let statusUrl = jobInfo.statusUrl as string;
        if (!statusUrl) {
            throw new Error("Async response missing statusUrl");
        }

        // The Azure Function strips auth params when building statusUrl — re-attach the code key
        const originalCode = urlObj.searchParams.get("code");
        if (originalCode && !statusUrl.includes("code=")) {
            const sep = statusUrl.includes("?") ? "&" : "?";
            statusUrl = `${statusUrl}${sep}code=${encodeURIComponent(originalCode)}`;
        }

        const jobId = String(jobInfo.jobId || "");
        if (targetFilePath && jobId) {
            setTrackedJob({
                jobId,
                statusUrl,
                sourceHash: currentHash,
                targetLanguage,
                targetFilePath,
                status: "pending",
                updatedAt: Date.now(),
                progress: { completed: 0, total: 0, remaining: 0, percentage: 0 }
            });
        }

        channel.appendLine(`[SKC] Large file detected — processing asynchronously (job: ${jobInfo.jobId})`);
        let result: TranslationResult;
        try {
            result = await pollJobUntilComplete(statusUrl, channel, targetFilePath, targetLanguage, cancellationToken);
        } catch (error) {
            if (error instanceof RestartTranslationError) {
                channel.appendLine(`[SKC] Old job discarded. Submitting a fresh job from the current source snapshot.`);
                return callAzureFunctionWithSync(
                    url,
                    sourceContent,
                    targetContent,
                    targetLanguage,
                    channel,
                    sourceHash,
                    targetIdentity,
                    targetFilePath
                );
            }
            throw error;
        }
        return {
            ...result,
            sourceHash: currentHash
        };
    }

    throw new Error(`Azure Function returned status ${statusCode}: ${body.substring(0, 200)}`);
}

