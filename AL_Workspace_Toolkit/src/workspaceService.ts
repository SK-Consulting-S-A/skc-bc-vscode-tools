import * as path from "path";
import * as vscode from "vscode";
import {
  AlObjectInfo,
  calculateDestinationPath,
  OrganizationMode,
  parseAlObject,
  PathOptions,
  renderObjectName
} from "./alModel";

export type FileAction = "Rename" | "Reorganize";

export interface InspectionResult {
  source: vscode.Uri;
  destination: vscode.Uri;
  object: AlObjectInfo;
  changed: boolean;
  desiredObjectName: string;
  objectNameChanged: boolean;
}

export interface ApplyResult extends InspectionResult {
  applied: boolean;
}

export class AlWorkspaceService {
  private readonly inProgress = new Set<string>();

  constructor(private readonly output: vscode.OutputChannel) { }

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

    const options = readPathOptions(document.uri);
    const desiredObjectName = options.rewriteObjectName
      ? renderObjectName(object.objectName, options)
      : object.objectName;
    const effectiveObject = { ...object, objectName: desiredObjectName };
    const destinationPath = calculateDestinationPath(
      document.uri.fsPath,
      folder.uri.fsPath,
      effectiveObject,
      options,
      reorganize
    );
    const destination = vscode.Uri.file(destinationPath);
    const objectNameChanged = object.objectName !== desiredObjectName;
    return {
      source: document.uri,
      destination,
      object,
      changed: objectNameChanged || normalizePath(document.uri.fsPath) !== normalizePath(destination.fsPath),
      desiredObjectName,
      objectNameChanged
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

      const pathChanged = normalizePath(inspection.source.fsPath) !== normalizePath(inspection.destination.fsPath);
      if (pathChanged && await uriExists(inspection.destination)) {
        throw new Error(`Destination already exists: ${inspection.destination.fsPath}`);
      }

      const rollbackObjectRename = inspection.objectNameChanged
        ? await applySemanticObjectRename(document, inspection.object, inspection.desiredObjectName)
        : undefined;

      if (pathChanged) {
        try {
          await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(inspection.destination.fsPath)));
          await vscode.workspace.fs.rename(inspection.source, inspection.destination, { overwrite: false });
        } catch (error) {
          if (rollbackObjectRename) {
            try {
              await rollbackObjectRename();
            } catch (rollbackError) {
              throw new Error(
                `File move failed (${formatError(error)}) and semantic rename rollback also failed (${formatError(rollbackError)}).`
              );
            }
          }
          throw error;
        }
        this.output.appendLine(`[${action}] ${inspection.source.fsPath} -> ${inspection.destination.fsPath}`);
      } else {
        this.output.appendLine(`[${action}] Renamed AL object to ${inspection.desiredObjectName}.`);
      }
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
    extensionFileNamePattern: configuration.get<string>("extensionFileNamePattern", ""),
    pageCustomizationFileNamePattern: configuration.get<string>("pageCustomizationFileNamePattern", ""),
    organizationMode: configuration.get<OrganizationMode>("organizationMode", "Namespace"),
    sourceRoot: configuration.get<string>("sourceRoot", "src"),
    testSourceRoot: configuration.get<string>("testSourceRoot", ""),
    namespacePrefixToIgnore: configuration.get<string>("namespacePrefixToIgnore", ""),
    affixesToRemove: configuration.get<string[]>("affixesToRemove", []),
    objectNamePrefix: configuration.get<string>("objectNamePrefix", ""),
    objectNameSuffix: configuration.get<string>("objectNameSuffix", ""),
    rewriteObjectName: configuration.get<boolean>("rewriteObjectName", false)
  };
}

async function applySemanticObjectRename(
  document: vscode.TextDocument,
  object: AlObjectInfo,
  desiredObjectName: string
): Promise<() => Promise<void>> {
  if (document.isDirty) {
    throw new Error("Save the AL file before rewriting its object name.");
  }

  const source = document.getText();
  const positionOffset = object.objectNameOffset + (source[object.objectNameOffset] === '"' ? 1 : 0);
  await applySemanticRenameAt(document, positionOffset, desiredObjectName);

  return async () => {
    const renamedDocument = await vscode.workspace.openTextDocument(document.uri);
    await applySemanticRenameAt(renamedDocument, positionOffset, object.objectName);
  };
}

async function applySemanticRenameAt(
  document: vscode.TextDocument,
  positionOffset: number,
  desiredObjectName: string
): Promise<void> {
  const workspaceEdit = await vscode.commands.executeCommand<vscode.WorkspaceEdit | undefined>(
    "vscode.executeDocumentRenameProvider",
    document.uri,
    document.positionAt(positionOffset),
    desiredObjectName
  );
  if (!workspaceEdit || workspaceEdit.entries().length === 0) {
    throw new Error("The AL language server could not prepare a semantic object rename.");
  }

  const affectedDocuments = await Promise.all(
    workspaceEdit.entries().map(([uri]) => vscode.workspace.openTextDocument(uri))
  );
  const dirtyDependency = affectedDocuments.find((candidate) => candidate.isDirty);
  if (dirtyDependency) {
    throw new Error(`Save ${dirtyDependency.uri.fsPath} before rewriting the object name.`);
  }

  if (!await vscode.workspace.applyEdit(workspaceEdit)) {
    throw new Error("VS Code could not apply the semantic object rename.");
  }
  for (const affectedDocument of affectedDocuments) {
    if (affectedDocument.isDirty && !await affectedDocument.save()) {
      throw new Error(`Could not save semantic rename changes in ${affectedDocument.uri.fsPath}.`);
    }
  }
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
