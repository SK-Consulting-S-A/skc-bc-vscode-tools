# SKC VS Tools

Applies a preset VS Code setup for SKC: user settings, MCP servers, required extensions, and XLF translation tools.

## What's included
- `presets/settings.json`: user settings applied to User scope.
- `presets/mcp.json`: MCP servers written to `mcp.servers` (if non-empty); secrets are injected from VS Code secret storage.
- `presets/extensions.json`: extension IDs to install.
- `skills/`: bundled Cursor AI skills (Anthropic curated set + SKC `bc-word-layout`).
- `agents/`: BC subagents (bc-researcher, bc-architect, bc-al-logic, bc-al-ui, bc-tester, bc-reviewer, bc-translator) for Cursor and VS Code Copilot.
- **Translations Sidebar**: View and translate `.g.xlf` files using Azure AI.

## How to use

### Presets & MCP
1) Install the VSIX (or load in dev).
2) Run "SKC: Configure MCP Auth" to store your GitHub token and Context7 API key in VS Code secrets.
3) Run "SKC: Apply Presets" (or rely on auto-run at first activation) to install extensions and apply settings/MCP servers.
4) Skills and agents (subagents) install automatically when presets are applied; you can also run "SKC: Install Cursor Skills" and "SKC: Install Cursor Agents" manually.

### Translations
1) Click the **SKC Tools** icon in the activity bar (sidebar).
2) Run "SKC: Configure Translation URL" to set your Azure Translation Function endpoint.
3) The **Translations** view shows all `.g.xlf` files in your `Translations` folder with statistics:
   - `MyFile.g.xlf (45/120)` - 45 of 120 units translated
   - Green icon = 100% complete, Yellow = partial, Gray = not started
4) Click the **play** button next to a file to translate it.
5) Select a target language from `app.json` (reads `supportedLocales` or `features[].languages`).
6) The translated file is saved as `MyFile.<lang>.xlf` (e.g., `MyFile.fr-FR.xlf`).

## Config knobs (Settings → skc.*)
- `skipInstalledExtensions` (default true): skip already installed extensions.
- `presetFilePath` (default `presets/settings.json`), `mcpFilePath` (default `presets/mcp.json`), `extensionsFilePath` (default `presets/extensions.json`); paths resolve from workspace or the bundled extension folder.
- `installSkillsOnApplyPresets` (default true): auto-install Cursor skills when presets apply.
- `azureFunctionUrl`: URL of the Azure Translation Function endpoint.

## Use Cursor global MCP config (single source of truth)
If you already manage MCP servers in Cursor's global file (`%USERPROFILE%\.cursor\mcp.json`), you can reuse it in VS Code:
1) Set `skc.mcpFilePath` to `cursor-global`.
2) Run "SKC: Apply Presets" (or reload VS Code) to apply the servers to `mcp.servers`.

## Commands
| Command | Description |
|---------|-------------|
| `SKC: Apply Presets` | Install extensions and apply settings/MCP servers |
| `SKC: Install Cursor Skills` | Install bundled skills (Cursor: `~/.cursor/skills/`, VS Code: `~/.copilot/skills/`) |
| `SKC: Install Cursor Agents` | Install BC subagents (Cursor: `~/.cursor/agents/`, VS Code: `~/.copilot/agents/`) |
| `SKC: Configure MCP Auth` | Store GitHub token and Context7 API key |
| `SKC: Configure Translation URL` | Set Azure Translation Function endpoint |
| `Translate File` | Translate selected XLF file (from sidebar) |
| `Refresh Translations` | Refresh the translations list |

## LM Bridge - Language Model Tools via MCP

The extension exposes VS Code Language Model Tools (e.g., `al_build` from the AL extension) to Cursor AI via an MCP SSE server. When Cursor invokes these tools, VS Code shows a confirmation dialog ("Run 'Build AL Project'") as a security measure.

**Note:** This confirmation dialog cannot be disabled - it's a VS Code security feature. However:
- The dialog should include an "Always allow" option - use it to reduce future prompts
- This affects all tools exposed through the LM Bridge, not just AL build
- The dialog appears once per tool per VS Code session (or until you click "Always allow")

This is a limitation of VS Code's Language Model Tools API (`vscode.lm.invokeTool`) and cannot be bypassed programmatically.

## Build & package
- Install deps: `npm install`
- Build: `npm run compile`
- Package VSIX: `npx vsce package`
- Publish and extension visibility (private/public): see [PUBLISHING.md](PUBLISHING.md)

