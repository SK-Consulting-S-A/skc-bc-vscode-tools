# AL Workspace Toolkit

Safe AL file naming and workspace organization for developers and coding agents.

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
  "alWorkspace.organizationMode": "Namespace",
  "alWorkspace.sourceRoot": "src",
  "alWorkspace.namespacePrefixToIgnore": "Contoso",
  "alWorkspace.affixesToRemove": ["CTO"]
}
```

`onSaveAction` is disabled by default. Choose `Rename` or `Reorganize` per workspace when automatic behavior is wanted.

Supported file-name tokens:

- `<ObjectName>`
- `<ObjectNameShort>`
- `<ObjectType>`
- `<ObjectTypeShort>`
- `<ObjectTypeShortPascalCase>`
- `<ObjectId>`
- `<Namespace>`

## Safety

File moves are restricted to the owning workspace folder. Existing destination files are never overwritten. Bulk operations require confirmation and report individual failures in the **AL Workspace Toolkit** output channel.
