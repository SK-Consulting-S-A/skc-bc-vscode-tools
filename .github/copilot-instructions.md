# SKC VSCode Extension Workspace

Two companion packages for Business Central AL development tooling:

- **SKC_VSCode_Extension** – VS Code extension (TypeScript/esbuild) that auto-configures a BC AL dev environment: installs preset extensions + MCP servers, deploys Copilot agents/skills, and provides an XLF translation sidebar with Azure-backed AI translation.
- **bc-mcp-proxy-npm** – npm wrapper around a C# .NET 8 application that proxies MCP protocol requests to a Business Central instance using MSAL authentication.

## Architecture

```
VS Code Copilot / Cursor
  ├── SKC_VSCode_Extension
  │     ├── Preset installer (extensions, MCP servers, settings)
  │     ├── Agents/Skills deployer → ~/.copilot/agents|skills/
  │     ├── XLF Translation sidebar (TreeDataProvider + LM Tools)
  │     └── LM-Bridge: http://localhost:7878/sse
  └── MCP Servers (configured by extension)
        ├── bc-mcp-proxy-npm → Business Central API
        ├── bc-intelligence (knowledge base)
        └── playwright, context7, MS Learn, GitHub, Pandoc
```

The extension and proxy are **independently published** packages. They share no source code but cooperate at runtime via the MCP server registry.

## Build and Test

### SKC_VSCode_Extension
```bash
npm run build      # esbuild: src/extension.ts → out/extension.js
npm run watch      # incremental rebuild on file change
npm run package    # creates .vsix install package (npx vsce package)
npm run publish    # bump + publish; requires .publish-token file or VSCE_PAT env var
npm run publish:patch|minor|major
```

### bc-mcp-proxy-npm
```bash
# From bc-mcp-proxy-npm/
npm run build            # node scripts/build.js → dotnet build/publish
dotnet build src/BcMCPProxy/BcMCPProxy.sln
dotnet publish src/BcMCPProxy/BcMCPProxy.sln
npm start                # spawns .NET binary via cross-spawn, reads appsettings.json
```

**No automated tests exist** in either project. Testing is done manually.

## Conventions

### SKC_VSCode_Extension (TypeScript)

- **Entry point**: `src/extension.ts` – registers commands and activates lazily using `setImmediate(() => Promise.all([...]))`. Keep activation instant; load heavy modules asynchronously.
- **esbuild config**: `scripts/build.js` – output is `out/extension.js`, `external: ['vscode']` (VS Code API excluded from bundle).
- **Presets from JSON files**: Extension behavior is driven by `presets/extensions.json`, `presets/mcp.json`, `presets/settings.json` — not hardcoded in TypeScript.
- **LM Tool pattern**: Tools implement `vscode.LanguageModelTool<T>` with two methods: `prepareInvocation()` (shows confirmation UI) and `invoke()` (executes). See `src/translationTools.ts`.
- **Versioned global state**: Use keys like `skc.presetsVersion` / `skc.newsShownForVersion` in `context.globalState` to trigger once-per-version logic.
- **Translation service**: Azure Function URL stored in `skc.azureFunctionUrl` setting; 10-minute timeout for large XLF files. See `src/translationService.ts`.

### bc-mcp-proxy-npm (C# .NET 8)

- **Config priority**: `appsettings.json` → CLI args override. See `Models/ConfigOptions.cs` for all options (`TenantId`, `ClientId`, `Environment`, `Company`, `Debug`).
- **DI factory pattern**: Auth services use `IAuthenticationServiceFactory` for testability. Follow this pattern for new service dependencies.
- **MCP proxy core**: `Runtime/MCPServerProxy.cs` creates SSL transport to BC API and injects `Company` header + bearer token. BC API URL is a constant in this file.
- **Cross-platform spawning**: Node wrapper uses `cross-spawn` to handle Windows/Linux/macOS differences when launching the .NET binary.

### Agents and Skills

- Agent files in `SKC_VSCode_Extension/agents/` are installed to `~/.copilot/agents/` (VS Code) or `~/.cursor/agents/` (Cursor) by the extension.
- Skills in `SKC_VSCode_Extension/skills/` are installed to `~/.copilot/skills/`.
- The `bc-orchestration` skill coordinates a phased multi-agent BC development workflow (researcher → architect → logic dev → UI dev → tester → reviewer → translator).

## Key Files

| File | Purpose |
|------|---------|
| `SKC_VSCode_Extension/src/extension.ts` | Extension activation, command registration |
| `SKC_VSCode_Extension/src/translationTools.ts` | LM Tools for AI-invokable XLF actions |
| `SKC_VSCode_Extension/src/translationService.ts` | Azure Function HTTP + XLF read/write logic |
| `SKC_VSCode_Extension/src/translationsView.ts` | TreeDataProvider for the XLF sidebar |
| `SKC_VSCode_Extension/presets/mcp.json` | MCP servers configured by the extension |
| `SKC_VSCode_Extension/agents/bc-orchestration.agent.md` | Master BC orchestrator agent |
| `bc-mcp-proxy-npm/src/BcMCPProxy/Runtime/MCPServerProxy.cs` | MCP ↔ BC API proxy implementation |
| `bc-mcp-proxy-npm/appsettings.json` | Local BC connection config (not committed) |

## Publishing

- **VSCode extension**: Publisher ID `SKConsultingSA`. Marketplace page: `ms-vscode.vscode-marketplace`. PAT in `.publish-token` (gitignored) or `VSCE_PAT` env var.
- **npm proxy package**: Publisher `Fisqal`. Uses `npm publish` with `NPM_TOKEN`.
- Both packages version independently. See `PUBLISHING.md` in each folder.
