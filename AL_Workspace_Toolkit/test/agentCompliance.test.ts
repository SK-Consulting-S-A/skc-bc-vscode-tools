import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(__dirname, "..");
const manifestText = fs.readFileSync(path.join(projectRoot, "package.json"), "utf8");
const manifest = JSON.parse(manifestText) as {
  extensionDependencies?: string[];
  extensionPack?: string[];
  contributes: { languageModelTools: Array<{ name: string }> };
};
const extensionSource = fs.readFileSync(path.join(projectRoot, "src", "extension.ts"), "utf8");
const serviceSource = fs.readFileSync(path.join(projectRoot, "src", "workspaceService.ts"), "utf8");
const toolSource = fs.readFileSync(path.join(projectRoot, "src", "agentTools.ts"), "utf8");

describe("agent compliance", () => {
  it("handles the document supplied by the save event", () => {
    expect(extensionSource).toContain("onDidSaveTextDocument(async (document)");
    expect(extensionSource).toContain("service.handleSavedDocument(document)");
    expect(serviceSource).not.toContain("activeTextEditor.document.uri");
  });

  it("uses semantic rename for optional object-name rewriting", () => {
    expect(serviceSource).toContain("vscode.executeDocumentRenameProvider");
    expect(serviceSource).toContain("vscode.workspace.applyEdit(workspaceEdit)");
    expect(serviceSource).toContain("vscode.workspace.openTextDocument(uri)");
    expect(serviceSource).toContain("rollbackObjectRename");
    expect(serviceSource).not.toMatch(/replace\([^\n]*objectName/i);
  });

  it("declares explicit path-based agent tools", () => {
    expect(manifest.contributes.languageModelTools.map((tool) => tool.name)).toEqual([
      "skc_al_inspect_file",
      "skc_al_rename_file",
      "skc_al_reorganize_file"
    ]);
    expect(toolSource).toContain("confirmationMessages");
    expect(toolSource).toContain("options.input.filePath");
  });

  it("ships without extension dependencies or comparison metadata", () => {
    expect(manifest.extensionDependencies).toBeUndefined();
    expect(manifest.extensionPack).toBeUndefined();
    expect(manifestText.toLowerCase()).not.toMatch(/waldo|crs-al/);
  });
});
