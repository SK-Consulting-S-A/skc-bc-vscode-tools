# AL Workspace Toolkit

Safe Business Central AL file naming and workspace organization with multi-root support, confirmed bulk actions, and explicit Copilot tools for coding agents.

## Features

- Renames the exact AL document emitted by the VS Code save event.
- Organizes AL files by namespace or object type in multi-root workspaces.
- Prevents writes outside the owning workspace folder and refuses to overwrite existing files.
- Supports explicit commands for the current file and confirmed bulk organization.
- Exposes Copilot tools that receive absolute file paths and require confirmation before writes.
- Runs no background language server and has no extension dependencies.

## Commands

- **AL Workspace: Inspect Current File**
- **AL Workspace: Rename Current File**
- **AL Workspace: Reorganize Current File**
- **AL Workspace: Organize All AL Files**

## Agent tools

- `skc_al_inspect_file` reports the parsed object and expected destination without writing.
- `skc_al_rename_file` renames one explicit AL file after confirmation.
- `skc_al_reorganize_file` renames and moves one explicit AL file after confirmation.

Agent tools operate on the supplied `filePath`; they never infer a target from the active editor.

## Configuration

```json
{
  "alWorkspace.onSaveAction": "Nothing",
  "alWorkspace.fileNamePattern": "<ObjectNameShort>.<ObjectTypeShortPascalCase>.al",
  "alWorkspace.extensionFileNamePattern": "<BaseNameShort>.<ObjectTypeShortPascalCase>.al",
  "alWorkspace.pageCustomizationFileNamePattern": "<BaseNameShort>.<ObjectTypeShortPascalCase>.al",
  "alWorkspace.organizationMode": "Namespace",
  "alWorkspace.sourceRoot": "src",
  "alWorkspace.testSourceRoot": "test",
  "alWorkspace.namespacePrefixToIgnore": "Contoso",
  "alWorkspace.affixesToRemove": ["CTO"],
  "alWorkspace.objectNamePrefix": "CTO ",
  "alWorkspace.objectNameSuffix": " SKC",
  "alWorkspace.rewriteObjectName": false
}
```

`onSaveAction` is disabled by default. Choose `Rename` or `Reorganize` per workspace when automatic behavior is wanted.

`rewriteObjectName` is also disabled by default. When enabled, the Toolkit asks the AL language server for a semantic rename so references are updated before the file is moved. Save affected AL files first; the operation stops if semantic rename is unavailable.

Specialized filename patterns are optional. Empty values inherit `fileNamePattern`. `testSourceRoot` is optional; when set, codeunits with `Subtype = Test` or `Subtype = TestRunner` are routed through that root.

Supported file-name tokens:

- `<ObjectName>`
- `<ObjectNameShort>`
- `<ObjectType>`
- `<ObjectTypeShort>`
- `<ObjectTypeShortPascalCase>`
- `<ObjectTypeShortUpper>`
- `<ObjectId>`
- `<Namespace>`
- `<Prefix>`
- `<Suffix>`
- `<BaseName>`
- `<BaseNameShort>`
- `<BaseId>`

## Safety

File moves are restricted to the owning workspace folder. Existing destination files are never overwritten. Bulk operations require confirmation and report individual failures in the **AL Workspace Toolkit** output channel. Semantic renames require saved documents, save every affected document, and roll back the object name if the subsequent file move fails.
