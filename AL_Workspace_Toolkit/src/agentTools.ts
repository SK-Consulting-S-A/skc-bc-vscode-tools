import * as vscode from "vscode";
import { AlWorkspaceService, FileAction, formatError } from "./workspaceService";

interface FileInput {
  filePath: string;
}

function textResult(value: string): vscode.LanguageModelToolResult {
  return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(value)]);
}

export function registerAgentTools(context: vscode.ExtensionContext, service: AlWorkspaceService): void {
  const languageModel = (vscode as unknown as {
    lm?: {
      registerTool(name: string, tool: vscode.LanguageModelTool<FileInput>): vscode.Disposable;
    };
  }).lm;
  if (!languageModel?.registerTool) {
    return;
  }

  context.subscriptions.push(
    languageModel.registerTool("skc_al_inspect_file", {
      async invoke(options) {
        try {
          const result = await service.inspectUri(toFileUri(options.input.filePath), true);
          return textResult([
            `Object: ${result.object.objectType} ${result.object.objectName}`,
            `Expected object name: ${result.desiredObjectName}`,
            `Current path: ${result.source.fsPath}`,
            `Expected path: ${result.destination.fsPath}`,
            `Change required: ${result.changed ? "yes" : "no"}`
          ].join("\n"));
        } catch (error) {
          return textResult(`Error: ${formatError(error)}`);
        }
      }
    }),
    languageModel.registerTool("skc_al_rename_file", createWriteTool(service, "Rename")),
    languageModel.registerTool("skc_al_reorganize_file", createWriteTool(service, "Reorganize"))
  );
}

function createWriteTool(
  service: AlWorkspaceService,
  action: FileAction
): vscode.LanguageModelTool<FileInput> {
  return {
    async prepareInvocation(options) {
      let rewriteWarning = "";
      try {
        const inspection = await service.inspectUri(
          toFileUri(options.input.filePath),
          action === "Reorganize"
        );
        if (inspection.objectNameChanged) {
          rewriteWarning = ` This will also semantically rename the AL object to **${escapeMarkdown(inspection.desiredObjectName)}** and update references.`;
        }
      } catch {
        // Invoke reports the detailed inspection error.
      }
      return {
        invocationMessage: `${action} AL file ${options.input.filePath}`,
        confirmationMessages: {
          title: `${action} AL file`,
          message: new vscode.MarkdownString(
            `${action} the AL file at **${escapeMarkdown(options.input.filePath)}** according to the workspace configuration?${rewriteWarning}`
          )
        }
      };
    },
    async invoke(options) {
      try {
        const result = await service.applyUri(toFileUri(options.input.filePath), action);
        return textResult(result.applied
          ? `${action}d: ${result.source.fsPath} -> ${result.destination.fsPath}`
          : `No change required: ${result.source.fsPath}`);
      } catch (error) {
        return textResult(`Error: ${formatError(error)}`);
      }
    }
  };
}

function toFileUri(filePath: string): vscode.Uri {
  if (!filePath || !filePath.trim()) {
    throw new Error("filePath is required.");
  }
  return vscode.Uri.file(filePath.trim());
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+\-.!]/g, "\\$&");
}
