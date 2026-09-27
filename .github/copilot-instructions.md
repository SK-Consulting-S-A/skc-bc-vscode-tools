# SKC VSCode Extension Workspace

Public repo. SKC Workstation Tools is listed on the Visual Studio Marketplace (`SKConsultingSA.skc-vs-tools`); keep that listing Public.

- **SKC_VSCode_Extension** – VS Code extension (TypeScript/esbuild) that auto-configures a BC AL dev environment: installs preset extensions + MCP servers, deploys Copilot agents/skills, and provides an XLF translation sidebar with Azure-backed AI translation.

Business Central data access uses Microsoft's hosted MCP server (`https://mcp.businesscentral.dynamics.com`). The former `bc-mcp-proxy-npm` / `bc-mcp-proxy-fisqal` proxy is retired; do not reintroduce it.

## Architecture

```
VS Code Copilot / Cursor
  ├── SKC_VSCode_Extension
  │     ├── Preset installer (extensions, MCP servers, settings)
  │     ├── Agents/Skills deployer → ~/.copilot/agents|skills/
  │     ├── XLF Translation sidebar (TreeDataProvider + LM Tools)
  │     └── LM-Bridge: http://localhost:7878/sse
  └── MCP Servers (configured by extension)
        ├── businesscentral (Microsoft-hosted) → Business Central API
        ├── bc-intelligence (knowledge base)
        └── playwright, context7, MS Learn, GitHub, Pandoc
```

## Build and Test

### SKC_VSCode_Extension
```bash
npm run build      # esbuild: src/extension.ts → out/extension.js
npm run watch      # incremental rebuild on file change
npm run package    # creates .vsix install package (npx vsce package)
npm run publish    # bump + publish; requires .publish-token file or VSCE_PAT env var
npm run publish:patch|minor|major
```

**No automated tests exist.** Testing is done manually.

## Conventions

### SKC_VSCode_Extension (TypeScript)

- **Entry point**: `src/extension.ts` – registers commands and activates lazily using `setImmediate(() => Promise.all([...]))`. Keep activation instant; load heavy modules asynchronously.
- **esbuild config**: `scripts/build.js` – output is `out/extension.js`, `external: ['vscode']` (VS Code API excluded from bundle).
- **Presets from JSON files**: Extension behavior is driven by `presets/extensions.json`, `presets/mcp.json`, `presets/settings.json` — not hardcoded in TypeScript.
- **LM Tool pattern**: Tools implement `vscode.LanguageModelTool<T>` with two methods: `prepareInvocation()` (shows confirmation UI) and `invoke()` (executes). See `src/translationTools.ts`.
- **Versioned global state**: Use keys like `skc.presetsVersion` / `skc.newsShownForVersion` in `context.globalState` to trigger once-per-version logic.
- **Translation service**: Azure Function URL stored in `skc.azureFunctionUrl` setting; 10-minute timeout for large XLF files. See `src/translationService.ts`.

### Agents and Skills

- Agent files in `SKC_VSCode_Extension/agents/` are installed to `~/.copilot/agents/` (VS Code) or `~/.cursor/agents/` (Cursor) by the extension.
- Skills in `SKC_VSCode_Extension/skills/` are installed to `~/.copilot/skills/`.
- The `bc-orchestration` skill coordinates a phased multi-agent BC development workflow (researcher → architect → logic dev → UI dev → tester → reviewer → translator).

#### Content flows one way only: repo → home folder

The repo is the source of truth. Agents and skills are edited here, committed, reviewed,
and shipped. **Never add a build step that copies from `~/.copilot` (or `~/.cursor`) back
into the repo.**

A `scripts/sync-global-content.js` used to do exactly that. It ran on `compile` and
`vscode:prepublish`, did `rmSync` then copy, and so mirrored one maintainer's personal
Copilot folder into this public repo on every build — deleting repo-only assets and
publishing whatever happened to be in that folder. Internal material reached the public
default branch that way, and because publishing was also being done from a workstation,
it reached the Marketplace and every installed copy before anyone noticed. Cleaning up
took a history rewrite and a replacement release. The script is gone; do not reintroduce
it in any form, including a version with an allowlist.

Two guards now stand in the way, and both should be left in place:

- `npm run check:publishable` fails the build on an unlisted skill or agent, on a
  home-folder sync, and on hostile preset settings. See
  [PUBLISHING.md](../SKC_VSCode_Extension/PUBLISHING.md#the-publish-gate).
- `scripts/publish.js` refuses to publish outside CI, so a release cannot bypass review.

Consequences worth remembering before adding anything under `skills/` or `agents/`:

- `.vscodeignore` contains `!skills/**`, so anything under `skills/` **is packaged and
  published** to the Marketplace. A stray directory ships.
- This repo is public and the Marketplace listing is public. Assume every file here is
  world-readable, and that publishing is irreversible: a version cannot be un-shipped
  from machines that already updated.
- Anything naming a customer, a real engagement's app suffix, an internal hostname,
  tenant, Entra group, or an SKC operational process (billing, payroll, bank, HR,
  timesheets, support mailbox) does not belong here. Those live in a private repo.

Use `Contoso` / `Fabrikam` and placeholder suffixes in examples, the way the existing
skills do.

## Key Files

| File | Purpose |
|------|---------|
| `SKC_VSCode_Extension/src/extension.ts` | Extension activation, command registration |
| `SKC_VSCode_Extension/src/translationTools.ts` | LM Tools for AI-invokable XLF actions |
| `SKC_VSCode_Extension/src/translationService.ts` | Azure Function HTTP + XLF read/write logic |
| `SKC_VSCode_Extension/src/translationsView.ts` | TreeDataProvider for the XLF sidebar |
| `SKC_VSCode_Extension/presets/mcp.json` | MCP servers configured by the extension |
| `SKC_VSCode_Extension/agents/bc-orchestration.agent.md` | Master BC orchestrator agent |

## Publishing

- **VSCode extension**: Publisher ID `SKConsultingSA`. Public Marketplace listing: `SKConsultingSA.skc-vs-tools`. Keep visibility Public. PAT in `.publish-token` (gitignored) or `VSCE_PAT` env var.
- See `SKC_VSCode_Extension/PUBLISHING.md`.
