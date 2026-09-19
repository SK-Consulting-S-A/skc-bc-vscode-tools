import * as path from "path";
import * as vscode from "vscode";
import {
  AlObjectInfo,
  calculateDestinationPath,
  OrganizationMode,
  parseAlObject,
  PathOptions
} from "./alModel";

export type FileAction = "Rename" | "Reorganize";

export interface InspectionResult {
  source: vscode.Uri;
  destination: vscode.Uri;
  object: AlObjectInfo;
  changed: boolean;
}

export interface ApplyResult extends InspectionResult {
  applied: boolean;
}

export class AlWorkspaceService {
  private readonly inProgress = new Set<string>();

  constructor(private readonly output: vscode.OutputChannel) {}

  async handleSavedDocument(document: vscode.TextDocument): Promise<void> {
    if (!isAlDocument(document)) {
      return;
    }

    const action = vscode.workspace.getConfiguration("alWorkspace", document.uri)
      .get<string>("onSaveAction", "Nothing");
    if (action !== "Rename" && action !== "Reorganize") {
      return;
    }

    try {
      await this.applyDocument(document, action);
    } catch (error) {
      this.output.appendLine(`[save] ${formatError(error)}`);
    }
  }

  async inspectUri(uri: vscode.Uri, reorganize = true): Promise<InspectionResult> {
    const document = await vscode.workspace.openTextDocument(uri);
    return this.inspectDocument(document, reorganize);
  }

  async applyUri(uri: vscode.Uri, action: FileAction): Promise<ApplyResult> {
    const document = await vscode.workspace.openTextDocument(uri);
    return this.applyDocument(document, action);
  }

  async organizeWorkspace(folder?: vscode.WorkspaceFolder): Promise<{ processed: number; moved: number; errors: string[] }> {
    const pattern = folder ? new vscode.RelativePattern(folder, "**/*.al") : "**/*.al";
    const uris = await vscode.workspace.findFiles(pattern, "**/{.alpackages,node_modules,.git}/**");
    let moved = 0;
    const errors: string[] = [];

    for (const uri of uris) {
      try {
        const result = await this.applyUri(uri, "Reorganize");
        if (result.applied) {
          moved += 1;
        }
      } catch (error) {
        errors.push(`${uri.fsPath}: ${formatError(error)}`);
      }
    }

    return { processed: uris.length, moved, errors };
  }

  private inspectDocument(document: vscode.TextDocument, reorganize: boolean): InspectionResult {
    if (!isAlDocument(document)) {
      throw new Error("The selected file is not an AL document.");
    }

    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!folder) {
      throw new Error("The AL file must belong to an open workspace folder.");
    }

    const object = parseAlObject(document.getText());
    if (!object) {
      throw new Error("No supported AL object declaration was found.");
    }

    const destinationPath = calculateDestinationPath(
      document.uri.fsPath,
      folder.uri.fsPath,
      object,
      readPathOptions(document.uri),
      reorganize
    );
    const destination = vscode.Uri.file(destinationPath);
    return {
      source: document.uri,
      destination,
      object,
      changed: normalizePath(document.uri.fsPath) !== normalizePath(destination.fsPath)
    };
  }

  private async applyDocument(document: vscode.TextDocument, action: FileAction): Promise<ApplyResult> {
    const key = normalizePath(document.uri.fsPath);
    if (this.inProgress.has(key)) {
      const inspection = this.inspectDocument(document, action === "Reorganize");
      return { ...inspection, applied: false };
    }

    this.inProgress.add(key);
    try {
      const inspection = this.inspectDocument(document, action === "Reorganize");
      if (!inspection.changed) {
        return { ...inspection, applied: false };
      }

      if (await uriExists(inspection.destination)) {
        throw new Error(`Destination already exists: ${inspection.destination.fsPath}`);
      }

      await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(inspection.destination.fsPath)));
      await vscode.workspace.fs.rename(inspection.source, inspection.destination, { overwrite: false });
      this.output.appendLine(`[${action}] ${inspection.source.fsPath} -> ${inspection.destination.fsPath}`);
      return { ...inspection, applied: true };
    } finally {
      this.inProgress.delete(key);
    }
  }
}

function readPathOptions(uri: vscode.Uri): PathOptions {
  const configuration = vscode.workspace.getConfiguration("alWorkspace", uri);
  return {
    fileNamePattern: configuration.get<string>("fileNamePattern", "<ObjectNameShort>.<ObjectTypeShortPascalCase>.al"),
    organizationMode: configuration.get<OrganizationMode>("organizationMode", "Namespace"),
    sourceRoot: configuration.get<string>("sourceRoot", "src"),
    namespacePrefixToIgnore: configuration.get<string>("namespacePrefixToIgnore", ""),
    affixesToRemove: configuration.get<string[]>("affixesToRemove", [])
  };
}

function isAlDocument(document: vscode.TextDocument): boolean {
  return document.uri.scheme === "file" &&
    (document.languageId === "al" || document.uri.fsPath.toLowerCase().endsWith(".al"));
}

async function uriExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch (error) {
    if (error instanceof vscode.FileSystemError && error.code === "FileNotFound") {
      return false;
    }
    throw error;
  }
}

function normalizePath(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
