import * as vscode from "vscode";
import { registerAgentTools } from "./agentTools";
import { AlWorkspaceService, FileAction, formatError } from "./workspaceService";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("AL Workspace Toolkit");
  const service = new AlWorkspaceService(output);
  context.subscriptions.push(output);

  context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(async (document) => {
    await service.handleSavedDocument(document);
  }));

  context.subscriptions.push(
    vscode.commands.registerCommand("alWorkspace.inspectCurrentFile", async () => {
      const uri = requireActiveAlFile();
      if (!uri) {
        return;
      }
      try {
        const result = await service.inspectUri(uri, true);
        void vscode.window.showInformationMessage(result.changed
          ? `Expected path: ${result.destination.fsPath}`
          : "The AL file name and location already match the workspace configuration.");
      } catch (error) {
        showError(error);
      }
    }),
    vscode.commands.registerCommand("alWorkspace.renameCurrentFile", async () => {
      await applyCurrentFile(service, "Rename");
    }),
    vscode.commands.registerCommand("alWorkspace.reorganizeCurrentFile", async () => {
      await applyCurrentFile(service, "Reorganize");
    }),
    vscode.commands.registerCommand("alWorkspace.organizeWorkspace", async () => {
      const folder = await selectWorkspaceFolder();
      if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 1 && !folder) {
        return;
      }
      const answer = await vscode.window.showWarningMessage(
        `Rename and reorganize every AL file${folder ? ` in ${folder.name}` : " in the workspace"}? If object-name rewriting is enabled, references are updated semantically too.`,
        { modal: true },
        "Organize Files"
      );
      if (answer !== "Organize Files") {
        return;
      }
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Organizing AL workspace",
          cancellable: false
        },
        () => service.organizeWorkspace(folder)
      );
      output.show(true);
      void vscode.window.showInformationMessage(
        `Processed ${result.processed} AL files; moved ${result.moved}; errors ${result.errors.length}.`
      );
      for (const error of result.errors) {
        output.appendLine(`[error] ${error}`);
      }
    })
  );

  registerAgentTools(context, service);
  output.appendLine("AL Workspace Toolkit activated.");
}

export function deactivate(): void {}

async function applyCurrentFile(service: AlWorkspaceService, action: FileAction): Promise<void> {
  const uri = requireActiveAlFile();
  if (!uri) {
    return;
  }
  try {
    const result = await service.applyUri(uri, action);
    void vscode.window.showInformationMessage(result.applied
      ? `${action}d AL file to ${result.destination.fsPath}`
      : "No file change was required.");
  } catch (error) {
    showError(error);
  }
}

function requireActiveAlFile(): vscode.Uri | undefined {
  const document = vscode.window.activeTextEditor?.document;
  if (!document || document.uri.scheme !== "file" ||
    (document.languageId !== "al" && !document.uri.fsPath.toLowerCase().endsWith(".al"))) {
    void vscode.window.showWarningMessage("Open an AL file before running this command.");
    return undefined;
  }
  return document.uri;
}

async function selectWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length <= 1) {
    return folders[0];
  }
  const selected = await vscode.window.showQuickPick(
    folders.map((folder) => ({ label: folder.name, folder })),
    { placeHolder: "Select the AL workspace folder to organize" }
  );
  return selected?.folder;
}

function showError(error: unknown): void {
  void vscode.window.showErrorMessage(`AL Workspace Toolkit: ${formatError(error)}`);
}
