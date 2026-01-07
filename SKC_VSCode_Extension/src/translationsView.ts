import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";

export interface TranslationStats {
    total: number;
    translated: number;
}

// Maximum units to show in tree view (for performance)
const MAX_UNITS_IN_TREE = 100;

// Base tree item class
export type TranslationTreeItem = SourceFileItem | TargetLanguageItem | AddLanguageItem | TransUnitItem | MoreUnitsItem;

/**
 * Source file item (*.g.xlf) - shows total units
 */
export class SourceFileItem extends vscode.TreeItem {
    constructor(
        public readonly resourceUri: vscode.Uri,
        public readonly totalUnits: number,
        public readonly workspaceFolder: vscode.Uri
    ) {
        super(path.basename(resourceUri.fsPath), vscode.TreeItemCollapsibleState.Expanded);

        this.description = `${totalUnits} units`;
        this.tooltip = `Source: ${path.basename(resourceUri.fsPath)}\nTotal translation units: ${totalUnits}`;
        this.contextValue = "sourceFile";
        this.iconPath = new vscode.ThemeIcon("file-code");

        this.command = {
            command: "vscode.open",
            title: "Open File",
            arguments: [resourceUri]
        };
    }
}

/**
 * Target language item (*.lang.xlf) - shows translated percentage
 * Now collapsible to show individual trans-units
 */
export class TargetLanguageItem extends vscode.TreeItem {
    constructor(
        public readonly resourceUri: vscode.Uri,
        public readonly language: string,
        public readonly stats: TranslationStats,
        public readonly sourceFile: SourceFileItem
    ) {
        // Make collapsible if there are units to show
        super(language, stats.total > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);

        // Only show 100% when truly complete, otherwise use floor to avoid false 100%
        const isComplete = stats.translated === stats.total;
        const percentage = stats.total > 0
            ? (isComplete ? 100 : Math.floor((stats.translated / stats.total) * 100))
            : 0;

        this.description = `${stats.translated}/${stats.total} (${percentage}%)`;
        const pending = stats.total - stats.translated;
        this.tooltip = `${language}\nTranslated: ${stats.translated} of ${stats.total} units (${percentage}%)\nPending: ${pending} units\nClick ▶ to view untranslated units`;
        this.contextValue = "xlfFile";

        // Set icon based on actual completion status (not rounded percentage)
        if (isComplete) {
            this.iconPath = new vscode.ThemeIcon("check", new vscode.ThemeColor("charts.green"));
        } else if (stats.translated > 0) {
            this.iconPath = new vscode.ThemeIcon("circle-outline", new vscode.ThemeColor("charts.yellow"));
        } else {
            this.iconPath = new vscode.ThemeIcon("circle-outline", new vscode.ThemeColor("charts.red"));
        }
    }
}

/**
 * Individual translation unit item
 */
export class TransUnitItem extends vscode.TreeItem {
    constructor(
        public readonly unitId: string,
        public readonly source: string,
        public readonly target: string,
        public readonly state: string,
        public readonly parentFile: TargetLanguageItem
    ) {
        // Truncate source for label if too long
        const displaySource = source.length > 50 ? source.substring(0, 47) + "..." : source;
        super(displaySource, vscode.TreeItemCollapsibleState.None);

        const isTranslated = state === "translated";
        const displayTarget = target || "(empty)";
        const truncatedTarget = displayTarget.length > 50 ? displayTarget.substring(0, 47) + "..." : displayTarget;

        this.description = isTranslated ? truncatedTarget : `⚠️ ${truncatedTarget}`;
        this.tooltip = `ID: ${unitId}\n\nSource:\n${source}\n\nTarget:\n${target || "(not translated)"}\n\nState: ${state || "unknown"}\n\nClick to open and navigate to this unit`;
        this.contextValue = isTranslated ? "transUnitTranslated" : "transUnitPending";

        // Icon based on translation state
        if (isTranslated) {
            this.iconPath = new vscode.ThemeIcon("check", new vscode.ThemeColor("charts.green"));
        } else if (target) {
            this.iconPath = new vscode.ThemeIcon("warning", new vscode.ThemeColor("charts.yellow"));
        } else {
            this.iconPath = new vscode.ThemeIcon("circle-slash", new vscode.ThemeColor("charts.red"));
        }

        // Add command to open file and navigate to this trans-unit
        this.command = {
            command: "skc.openTransUnit",
            title: "Open Translation Unit",
            arguments: [parentFile.resourceUri, unitId]
        };
    }
}

/**
 * "More units..." item when there are too many to display
 */
export class MoreUnitsItem extends vscode.TreeItem {
    constructor(
        public readonly remainingCount: number,
        public readonly parentFile: TargetLanguageItem
    ) {
        super(`... and ${remainingCount} more untranslated`, vscode.TreeItemCollapsibleState.None);

        this.description = "Open file to see all";
        this.tooltip = `${remainingCount} more untranslated units not shown.\nOpen the file to see all units.`;
        this.contextValue = "moreUnits";
        this.iconPath = new vscode.ThemeIcon("ellipsis");

        this.command = {
            command: "vscode.open",
            title: "Open File",
            arguments: [parentFile.resourceUri]
        };
    }
}

/**
 * Add language item - for missing locales from app.json
 */
export class AddLanguageItem extends vscode.TreeItem {
    constructor(
        public readonly language: string,
        public readonly sourceFile: SourceFileItem
    ) {
        super(`+ Add ${language}`, vscode.TreeItemCollapsibleState.None);

        this.description = "Click to create";
        this.tooltip = `Create translation file for ${language}`;
        this.contextValue = "addLanguage";
        this.iconPath = new vscode.ThemeIcon("add", new vscode.ThemeColor("charts.blue"));

        this.command = {
            command: "skc.createTranslationFile",
            title: "Create Translation File",
            arguments: [sourceFile, language]
        };
    }
}

interface AppJson {
    supportedLocales?: string[];
    features?: Array<{ id: string; languages?: string[] }>;
}

export class TranslationsProvider implements vscode.TreeDataProvider<TranslationTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TranslationTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private sourceFiles: Map<string, SourceFileItem> = new Map();

    constructor() {
        this.setupFileWatcher();
    }

    private setupFileWatcher(): void {
        this.fileWatcher = vscode.workspace.createFileSystemWatcher("**/Translations/*.xlf");

        this.fileWatcher.onDidCreate(() => this.refresh());
        this.fileWatcher.onDidChange(() => this.refresh());
        this.fileWatcher.onDidDelete(() => this.refresh());
    }

    refresh(): void {
        this.sourceFiles.clear();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TranslationTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TranslationTreeItem): Promise<TranslationTreeItem[]> {
        // If element is a source file, return its target languages
        if (element instanceof SourceFileItem) {
            return this.getTargetLanguages(element);
        }

        // If element is a target language file, return its trans-units
        if (element instanceof TargetLanguageItem) {
            return this.getTransUnits(element);
        }

        // Root level - return source files
        if (!element) {
            return this.getSourceFiles();
        }

        return [];
    }

    private async getSourceFiles(): Promise<SourceFileItem[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            console.log("[SKC Translations] No workspace folders found");
            return [];
        }

        const items: SourceFileItem[] = [];

        for (const folder of workspaceFolders) {
            const translationsPath = path.join(folder.uri.fsPath, "Translations");
            console.log(`[SKC Translations] Checking: ${translationsPath}`);

            try {
                const exists = await this.pathExists(translationsPath);
                if (!exists) {
                    console.log(`[SKC Translations] Folder does not exist: ${translationsPath}`);
                    continue;
                }

                const files = await fs.readdir(translationsPath);
                // Only get source files (*.g.xlf)
                const sourceXlfFiles = files.filter((f) => f.endsWith(".g.xlf"));
                console.log(`[SKC Translations] Source files: ${sourceXlfFiles.join(", ")}`);

                for (const file of sourceXlfFiles) {
                    const filePath = path.join(translationsPath, file);
                    const fileUri = vscode.Uri.file(filePath);

                    try {
                        const stats = await this.getTranslationStats(filePath);
                        const sourceItem = new SourceFileItem(fileUri, stats.total, folder.uri);
                        items.push(sourceItem);
                        this.sourceFiles.set(filePath, sourceItem);
                    } catch (err) {
                        console.log(`[SKC Translations] Error reading ${file}: ${err}`);
                        const sourceItem = new SourceFileItem(fileUri, 0, folder.uri);
                        items.push(sourceItem);
                        this.sourceFiles.set(filePath, sourceItem);
                    }
                }
            } catch (err) {
                console.log(`[SKC Translations] Error reading folder: ${err}`);
                continue;
            }
        }

        console.log(`[SKC Translations] Total source files found: ${items.length}`);
        return items;
    }

    private async getTargetLanguages(sourceFile: SourceFileItem): Promise<TranslationTreeItem[]> {
        const items: TranslationTreeItem[] = [];
        const translationsDir = path.dirname(sourceFile.resourceUri.fsPath);
        const sourceBaseName = path.basename(sourceFile.resourceUri.fsPath, ".g.xlf");

        // Get locales from app.json
        const appJsonLocales = await this.getLocalesFromAppJson(sourceFile.workspaceFolder);
        console.log(`[SKC Translations] Locales from app.json: ${appJsonLocales.join(", ")}`);

        // Find existing target files
        const existingTargets = new Set<string>();

        try {
            const files = await fs.readdir(translationsDir);

            for (const file of files) {
                // Match pattern: basename.lang.xlf (e.g., TestApp.fr-FR.xlf)
                const match = file.match(new RegExp(`^${this.escapeRegex(sourceBaseName)}\\.([a-z]{2}-[A-Z]{2})\\.xlf$`, "i"));
                if (match) {
                    const lang = match[1];
                    existingTargets.add(lang);

                    const filePath = path.join(translationsDir, file);
                    const fileUri = vscode.Uri.file(filePath);

                    try {
                        const stats = await this.getTranslationStats(filePath);
                        items.push(new TargetLanguageItem(fileUri, lang, stats, sourceFile));
                    } catch {
                        items.push(new TargetLanguageItem(fileUri, lang, { total: 0, translated: 0 }, sourceFile));
                    }
                }
            }
        } catch (err) {
            console.log(`[SKC Translations] Error reading target files: ${err}`);
        }

        // Add missing locales from app.json
        for (const locale of appJsonLocales) {
            if (!existingTargets.has(locale)) {
                items.push(new AddLanguageItem(locale, sourceFile));
            }
        }

        // Sort: existing files first, then add items
        items.sort((a, b) => {
            if (a instanceof AddLanguageItem && !(b instanceof AddLanguageItem)) return 1;
            if (!(a instanceof AddLanguageItem) && b instanceof AddLanguageItem) return -1;
            return 0;
        });

        return items;
    }

    private async getLocalesFromAppJson(workspaceFolder: vscode.Uri): Promise<string[]> {
        const appJsonPath = path.join(workspaceFolder.fsPath, "app.json");

        try {
            const content = await fs.readFile(appJsonPath, "utf8");
            const appJson: AppJson = JSON.parse(content);

            // Check for supportedLocales
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

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    private async pathExists(targetPath: string): Promise<boolean> {
        try {
            await fs.access(targetPath);
            return true;
        } catch {
            return false;
        }
    }

    private async getTranslationStats(filePath: string): Promise<TranslationStats> {
        const content = await fs.readFile(filePath, "utf8");

        // Count total trans-units
        const transUnitMatches = content.match(/<trans-unit/g);
        const total = transUnitMatches ? transUnitMatches.length : 0;

        // Count translated units (target with state="translated")
        const translatedMatches = content.match(/<target[^>]*\sstate\s*=\s*["']translated["'][^>]*>/g);
        const translated = translatedMatches ? translatedMatches.length : 0;

        return { total, translated };
    }

    /**
     * Parse trans-units from a target XLF file and return as tree items
     * Only shows units that need attention (not translated or source != target)
     */
    private async getTransUnits(targetFile: TargetLanguageItem): Promise<TranslationTreeItem[]> {
        const items: TranslationTreeItem[] = [];

        try {
            const content = await fs.readFile(targetFile.resourceUri.fsPath, "utf8");

            // Parse trans-units - capture the whole trans-unit block first
            const transUnitRegex = /<trans-unit\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/trans-unit>/g;

            let match;
            let count = 0;
            let skippedCount = 0;
            const totalUnits = targetFile.stats.total;

            while ((match = transUnitRegex.exec(content)) !== null) {
                const unitId = match[1] || "";
                const unitContent = match[2] || "";

                // Extract source content
                const sourceMatch = unitContent.match(/<source>([\s\S]*?)<\/source>/);
                const source = sourceMatch ? sourceMatch[1].trim() : "";

                // Extract target content and state - handle both self-closing and regular tags
                let target = "";
                let state = "";
                
                // First try to match a regular target tag with content
                const targetMatch = unitContent.match(/<target([^>]*)>([\s\S]*?)<\/target>/);
                if (targetMatch) {
                    const targetAttrs = targetMatch[1] || "";
                    target = targetMatch[2].trim();
                    
                    // Extract state from attributes
                    const stateMatch = targetAttrs.match(/state\s*=\s*["']([^"']+)["']/);
                    state = stateMatch ? stateMatch[1] : "";
                } else {
                    // Check for empty/self-closing target
                    const emptyTargetMatch = unitContent.match(/<target([^>]*)\/>/);
                    if (emptyTargetMatch) {
                        const targetAttrs = emptyTargetMatch[1] || "";
                        const stateMatch = targetAttrs.match(/state\s*=\s*["']([^"']+)["']/);
                        state = stateMatch ? stateMatch[1] : "";
                    }
                }

                // Only show units that need translation:
                // - state is NOT "translated"
                // - OR target is empty
                const isTranslated = state === "translated" && target !== "";
                
                if (isTranslated) {
                    skippedCount++;
                    continue;
                }

                // Only add up to MAX_UNITS_IN_TREE
                if (count < MAX_UNITS_IN_TREE) {
                    items.push(new TransUnitItem(unitId, source, target, state, targetFile));
                    count++;
                }
            }

            // Calculate remaining units that weren't shown
            const remainingUnits = (totalUnits - skippedCount) - count;
            if (remainingUnits > 0) {
                items.push(new MoreUnitsItem(remainingUnits, targetFile));
            }

        } catch (err) {
            console.log(`[SKC Translations] Error parsing trans-units: ${err}`);
        }

        return items;
    }

    dispose(): void {
        this.fileWatcher?.dispose();
    }
}
