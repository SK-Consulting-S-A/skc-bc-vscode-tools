# SKC Workstation Tools

SKC workstation setup for Business Central AL, Web/Python, and Power Platform, from [SK Consulting S.A.](https://www.skc.lu). It adds Copilot agents, native chat forking, MCP presets, XLF translation, document skills, and four productivity themes.

Install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=SKConsultingSA.skc-vs-tools) (`ext install SKConsultingSA.skc-vs-tools`). Source: [skc-bc-vscode-tools](https://github.com/SK-Consulting-S-A/skc-bc-vscode-tools).

## What you get

- **@harold in Copilot Chat** — type `@harold how do I post a sales invoice?` (or `/docs`, `/object`, `/how`).
- **Fork Copilot Chat** — focus any earlier request or response, then run **SKC: Fork Copilot Chat at Focused Message** to continue in a separate native chat session.
- **Copilot AI for AL** — BC subagents (research, architecture, logic, UI, review, tests, translation, CAL conversion, control add-ins) and skills (`bc-orchestration`, `bc-agent-sdk`, `bc-migration`, `bc-word-layout`, `bc-control-addin`, `mermaid-to-word`).
- **One workstation profile** — AL, Web/Python, and Power Platform/BI tooling, settings, MCP servers, skills, and agents all apply together to your default profile.
- **Office and document work** — `docx`, `pptx` and `xlsx` skills plus `mermaid-to-word`, `applying-brand-guidelines` and `frontend-slides` for reports, decks and workbooks.
- **BCQuality reviews** — the official Microsoft BCQuality plugin snapshot is bundled offline and used additively by the reviewer/orchestrator. Live refresh is explicit or opt-in.
- **Workspace presets** — AL settings, CodeCop and UICop, and MCP servers applied explicitly with **SKC: Apply Presets**.
- **GitHub Copilot CLI** — the same MCP presets, agents, skills, and safety instructions available in terminal sessions.
- **Four AL-tuned themes** — one family, four working situations, all structurally identical so switching never moves meaning:
  - **SKC Dark** — the daily driver, from the [skc.lu](https://www.skc.lu) dark design system (applied with presets).
  - **SKC Light** — daylight and bright-office work, from the skc.lu website palette.
  - **SKC Presentation** — high contrast for demos, workshops and screen sharing: loud cursor, bordered find matches and selections that survive a projector or video compression.
  - **SKC Beach** — warm and low blue light, for long or late sessions.

  Every variant colors what AL work actually touches: analyzer diagnostics (CodeCop, UICop, AppSourceCop) and Error Lens, diff **and merge-conflict** surfaces for delta and upgrade work, six-level bracket pairs for deep `begin`/`end` nesting, the parameter-name and return-type inlay hints the presets switch on, sticky scroll for long codeunits, and Test Explorer states for BC test codeunits.
- **XLF translation** — sidebar to preview and translate `.g.xlf` files with Azure AI.

## What's included

- `presets/settings.json` — user settings applied to User scope, plus the `extensions` list installed by **SKC: Apply Presets** (AL, Web/Python, and Power Platform/BI tooling combined)
- `presets/mcp.json` — MCP servers written to `mcp.servers` (secrets come from VS Code secret storage)
- `themes/*.json` — the four SKC color themes. These are **generated**: edit the palettes in `scripts/build-themes.js` and run `npm run build:themes`, then commit the result. Hand-editing a single theme file makes the variants drift apart.
- `skills/` — Copilot skill bundles (SKC BC skills plus the Anthropic curated set)
- `skills/bcquality/` — official BCQuality plugin snapshot, knowledge index, layers, bridge, and tools
- `agents/` — BC Copilot subagents
- `instructions/` — user-level Copilot instruction files applied to every chat
- **Translations** view — `.g.xlf` files and Azure AI translation

## How to use

### Ask Business Central questions (`@harold`)

1. Open Copilot Chat.
2. Type `@harold` and your question. You do not need to pick an Agent or know skill names.

Examples:

- `@harold how do I post a sales invoice?`
- `@harold /how warehouse shipment`
- `@harold /object Customer`
- `@harold /docs VAT posting groups`

`@harold` looks up Microsoft Learn for that question. `/object` can also use local AL symbols when a project is open.

### Fork a Copilot Chat

1. In Copilot Chat, click the request or response where the new branch should end.
2. Open the Command Palette and run **SKC: Fork Copilot Chat at Focused Message**.
3. Continue in the new chat. The original conversation remains unchanged.

This command uses VS Code's native session fork when the installed VS Code version provides it. Older versions show an update message instead of copying chat data through an unsupported storage API.

### Presets, extensions, and AI

1. Install **SKC Workstation Tools** from the Marketplace.
2. Run **SKC: Apply Presets** to install the combined AL, Web/Python, and Power Platform/BI extensions, AL settings, and MCP configuration into your current (default) profile.
3. Copilot skills and agents install with presets. You can also run **SKC: Install Copilot Skills** and **SKC: Install Copilot Agents**.

Skills land in `~/.copilot/skills/`. Agents land in `~/.copilot/agents/`. Instruction files land in the active profile's `prompts/` folder, where VS Code picks them up for every chat.

`skc-context-hygiene.instructions.md` tells agents to treat image files as opaque binaries and to open one only when you pointed at that specific image. Attaching a folder or an application root otherwise pulls images buried in the tree into the model's context as though you had shared them. VS Code has no setting that filters images out of context, so this has to be a rule the agent follows.

### GitHub Copilot CLI

1. [Install GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli) separately and sign in with `copilot login`. This is the `copilot` command, not the retired `gh copilot` extension.
2. Run **SKC: Configure GitHub Copilot CLI** in VS Code to install the existing MCP preset, agents, skills, and safety instructions without installing Marketplace extensions or changing editor presets. **SKC: Apply Presets** also configures CLI support by default (`skc.writeCopilotCliMcpFile`).
3. Restart existing CLI sessions, run `copilot` from your project folder, and use `/mcp` to check the servers. Use `/agent` to select an installed agent and `/skills` to inspect skills.

CLI configuration is written to `~/.copilot/mcp-config.json` with a `mcpServers` object, independent of VS Code's `mcp.json`. Agents, skills, and instructions use `agents/`, `skills/`, and `instructions/` under the same directory. If you set `COPILOT_HOME`, start VS Code with that environment variable too so setup targets your CLI directory.

The preset remains the source of truth: Playwright, Microsoft Learn Docs, BC intelligence, Microsoft's hosted Business Central server, Pandoc, and MarkItDown use the same versions and endpoints. Accessible private MCP overlay entries are included locally, never copied into the repository. Existing CLI servers, tool restrictions, and other configuration fields are preserved; delete an entry before running setup again if you want to restore its preset definition. Invalid existing JSON is left untouched. New config files are owner-readable/writable on Unix. Configuration does not grant tool permissions: keep CLI approval prompts enabled.

VS Code `${input:name}` and `${env:NAME}` references become CLI `${name}` and `${NAME}` environment-variable references. Values are never read from VS Code secret storage or embedded by setup. For Business Central, set the following in the terminal **before** starting `copilot` (PowerShell example):

```powershell
$env:bcTenantId = "<your-tenant-guid>"
$env:bcEnvironmentName = "<your-sandbox-name>"
$env:bcCompany = "Contoso"
copilot
```

Business Central still uses Microsoft Entra OAuth; environment variables supply routing headers, not authentication. Approve the server's sign-in when prompted. `ConfigurationName` stays empty for the preset's read-only default. Non-ASCII company names still require the encoding described in the MCP preset. Other custom input references need their corresponding environment variables. Unsupported editor variables such as `${workspaceFolder}` or `${command:...}` cause that server to be skipped with a message in **Output → SKC Workstation Tools**; add a CLI-specific entry yourself.

| Available in standalone Copilot CLI | Requires VS Code |
|---|---|
| MCP server tools, bundled agents and skills, safety instructions | Marketplace extensions, themes, translation sidebar, `@harold`, chat forking, and VS Code language-model tools (`skc_*`, AL Workspace Toolkit tools) |

The CLI does not load VS Code extensions or their language-model tools. Connecting with `/ide` shares editor context and diagnostics, not those extension tools. No unauthenticated localhost bridge is started by this setup.

## Workstation setup

This extension does not declare an `extensionPack` or `extensionDependencies` in its manifest, so the Marketplace page does not auto-list installs. Instead, **SKC: Apply Presets** installs the following Marketplace extensions into your current (default) profile, from the `extensions` list in [`presets/settings.json`](presets/settings.json):

| Area | Extensions installed (Marketplace IDs) |
|---|---|
| Shared | `usernamehw.errorlens`, `GitHub.vscode-pull-request-github`, `ms-vscode.PowerShell`, `vscode-icons-team.vscode-icons` |
| AL | `ms-dynamics-smb.al` (Microsoft AL), `SKConsultingSA.skc-al-workspace` (AL Workspace Toolkit, replaces `waldo.crs-al-language-extension`), `rasmus.al-var-helper`, `redhat.vscode-xml` |
| Web/Python | `ms-vscode.vscode-typescript-next`, `dbaeumer.vscode-eslint`, `esbenp.prettier-vscode`, `ms-python.python`, `ms-python.vscode-pylance`, `ms-python.debugpy`, `ms-python.vscode-python-envs`, `ms-azuretools.vscode-azurefunctions`, `ms-azuretools.vscode-azureappservice`, `ms-azuretools.vscode-azureresourcegroups` |
| Power Platform/BI | `ms-copilotstudio.vscode-copilotstudio`, `danish-naglekar.dataverse-devtools`, `danish-naglekar.pcf-builder`, `analysis-services.tmdl`, `analysis-services.powerbi-modeling-mcp`, `GerhardBrueckl.powerbi-vscode` |

All of the above install together in one run of **SKC: Apply Presets**, along with the AL settings, MCP servers (including the Microsoft Learn Docs MCP server), Copilot skills, and Copilot agents — all applied to whichever profile is active, normally your default profile.

The Power Platform Tools extension pack is intentionally excluded because it installs CodeQL and SARIF. Install the Power Apps CLI (`pac`) separately only on workstations that manage solutions or Power Pages.

Code apps additionally need Node.js LTS and Git on the machine; the extension does not install those.

The preset does not register a Dataverse MCP server. To add one, put an entry in your own `mcp.json` with the real environment URL — `https://yourorg.crm4.dynamics.com/api/mcp`. Never leave a `<PLACEHOLDER>` in a `url`: VS Code validates every URL before it answers an MCP discovery request, so a single unparseable URL fails the whole list and hangs chat in that profile. The server must also be enabled per environment in the Power Platform admin center, with **Microsoft GitHub Copilot** allowed as an MCP client — otherwise the endpoint refuses the connection.

### Translations

1. Click the **SKC Workstation Tools** icon in the activity bar.
2. Run **SKC: Configure Translation URL** and set your Azure Translation Function endpoint.
3. The Translations view lists `.g.xlf` files in a `Translations` folder:
   - `MyFile.g.xlf (45/120)` — 45 of 120 units translated
   - Green = 100% complete, yellow = partial, gray = not started
4. Click play next to a file to translate it.
5. Pick a target language from `app.json` (`supportedLocales` or `features[].languages`).
6. The result is saved as `MyFile.<lang>.xlf` (for example `MyFile.fr-FR.xlf`).

## Settings (`skc.*`)

| Setting | Default | Purpose |
|---|---|---|
| `skipInstalledExtensions` | `true` | Skip extensions that are already installed |
| `presetFilePath` / `mcpFilePath` / `extensionsFilePath` | bundled presets | Override preset files (workspace or extension folder) |
| `installSkillsOnApplyPresets` | `true` | Install Copilot skills when presets apply |
| `writeCopilotCliMcpFile` | `true` | Also configure CLI MCP servers and, when skill installation is enabled, CLI safety instructions |
| `azureFunctionUrl` | empty | Azure Translation Function endpoint |

## Commands

| Command | Description |
|---|---|
| **SKC: Apply Presets** | Apply settings, the combined AL/Web/Python/Power Platform extension set, and MCP servers to the current profile |
| **SKC: Configure GitHub Copilot CLI** | Install MCP presets, agents, skills, and safety instructions for terminal sessions |
| **SKC: Install Copilot Skills** | Install bundled skills (`~/.copilot/skills/`) |
| **SKC: Install Copilot Agents** | Install BC subagents (`~/.copilot/agents/`) |
| **SKC: Update BCQuality Snapshot** | Refresh the bundled BCQuality snapshot offline or explicitly from official upstream |
| **SKC: Fork Copilot Chat at Focused Message** | Branch the current native Copilot session after the focused request or response |
| **SKC: Configure Translation URL** | Set Azure Translation Function endpoint |
| **Translate File** | Translate the selected XLF file |
| **Refresh Translations** | Refresh the translations list |
| **Create Translation File** / **Add Language** | Create or extend XLF language files |

## Copilot and language-model tools

SKC Workstation Tools contributes the **@harold** chat participant, Copilot chat skills, and language-model tools (`#translateXlf`, `#listTranslations`). These extension features run in VS Code; standalone Copilot CLI uses the shared MCP servers, agents, and skills described above. VS Code may show a confirmation dialog (`Run 'Build AL Project'`). That prompt is a VS Code security feature: use **Always allow** to reduce repeats. It cannot be turned off from this extension.

## Build and publish

```bash
npm install
npm run compile
npx vsce package
```

This is a **public** Marketplace listing. See [PUBLISHING.md](PUBLISHING.md).

BCQuality live downloads are disabled by default. Set `skc.bcQualityUpdateOnApply` to `true` only when an online refresh during preset application is desired; otherwise the bundled snapshot and validated offline fallback are used.
