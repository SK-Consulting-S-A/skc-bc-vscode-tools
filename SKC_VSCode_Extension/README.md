# SKC Workstation Tools

Modern workstation tooling for SK Consulting employees and contractors, from [SK Consulting S.A.](https://www.skc.lu). It standardises one development machine across everything we actually build on: Dynamics 365 Business Central AL, Power Platform, Azure, and the Office documents that come out of both.

Install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=SKConsultingSA.skc-vs-tools) (`ext install SKConsultingSA.skc-vs-tools`). Source: [skc-bc-vscode-tools](https://github.com/SK-Consulting-S-A/skc-bc-vscode-tools).

## What you get

- **@bc in Copilot Chat** — type `@bc how do I post a sales invoice?` (or `/docs`, `/object`, `/how`).
- **Fork Copilot Chat** — focus any earlier request or response, then run **SKC: Fork Copilot Chat at Focused Message** to continue in a separate native chat session.
- **Copilot AI for AL** — BC subagents (research, architecture, logic, UI, review, tests, translation, CAL conversion, control add-ins) and skills (`bc-orchestration`, `bc-agent-sdk`, `bc-migration`, `bc-word-layout`, `bc-control-addin`, `mermaid-to-word`).
- **Isolated workstation profiles** — create `SKC AL`, `SKC Web/Python`, and `SKC Power Platform/BI` without loading every language server in every workspace.
- **Office and document work** — `docx`, `pptx` and `xlsx` skills plus `mermaid-to-word`, `applying-brand-guidelines` and `frontend-slides` for reports, decks and workbooks.
- **BCQuality reviews** — the official Microsoft BCQuality plugin snapshot is bundled offline and used additively by the reviewer/orchestrator. Live refresh is explicit or opt-in.
- **Workspace presets** — AL settings, CodeCop and UICop, and MCP servers applied explicitly with **SKC: Apply Presets**.
- **Four AL-tuned themes** — one family, four working situations, all structurally identical so switching never moves meaning:
  - **SKC Dark** — the daily driver, from the [skc.lu](https://www.skc.lu) dark design system (applied with presets).
  - **SKC Light** — daylight and bright-office work, from the skc.lu website palette.
  - **SKC Presentation** — high contrast for demos, workshops and screen sharing: loud cursor, bordered find matches and selections that survive a projector or video compression.
  - **SKC Beach** — warm and low blue light, for long or late sessions.

  Every variant colors what AL work actually touches: analyzer diagnostics (CodeCop, UICop, AppSourceCop) and Error Lens, diff **and merge-conflict** surfaces for delta and upgrade work, six-level bracket pairs for deep `begin`/`end` nesting, the parameter-name and return-type inlay hints the presets switch on, sticky scroll for long codeunits, and Test Explorer states for BC test codeunits.
- **XLF translation** — sidebar to preview and translate `.g.xlf` files with Azure AI.

## What's included

- `presets/settings.json` — user settings applied to User scope
- `presets/mcp.json` — MCP servers written to `mcp.servers` (secrets come from VS Code secret storage)
- `presets/profiles.json` — isolated extension lists for the three SKC workstation profiles
- `themes/*.json` — the four SKC color themes. These are **generated**: edit the palettes in `scripts/build-themes.js` and run `npm run build:themes`, then commit the result. Hand-editing a single theme file makes the variants drift apart.
- `skills/` — Copilot skill bundles (SKC BC skills plus the Anthropic curated set)
- `skills/bcquality/` — official BCQuality plugin snapshot, knowledge index, layers, bridge, and tools
- `agents/` — BC Copilot subagents
- **Translations** view — `.g.xlf` files and Azure AI translation

## How to use

### Ask Business Central questions (`@bc`)

1. Open Copilot Chat.
2. Type `@bc` and your question. You do not need to pick an Agent or know skill names.

Examples:

- `@bc how do I post a sales invoice?`
- `@bc /how warehouse shipment`
- `@bc /object Customer`
- `@bc /docs VAT posting groups`

`@bc` looks up Microsoft Learn for that question. `/object` can also use local AL symbols when a project is open.

### Fork a Copilot Chat

1. In Copilot Chat, click the request or response where the new branch should end.
2. Open the Command Palette and run **SKC: Fork Copilot Chat at Focused Message**.
3. Continue in the new chat. The original conversation remains unchanged.

This command uses VS Code's native session fork when the installed VS Code version provides it. Older versions show an update message instead of copying chat data through an unsupported storage API.

### Presets, extensions, and AI

1. Install **SKC Workstation Tools** from the Marketplace.
2. Run **SKC: Configure MCP Auth** to store your GitHub token and Context7 API key in VS Code secrets.
3. Run **SKC: Create or Update Workstation Profiles** once, then open a workspace with the matching profile.
4. In `SKC AL`, run **SKC: Apply Presets** when you want the AL settings and MCP configuration.
5. Copilot skills and agents install with presets. You can also run **SKC: Install Copilot Skills** and **SKC: Install Copilot Agents**.

Skills land in `~/.copilot/skills/`. Agents land in `~/.copilot/agents/`.

## Workstation profiles

| Profile | Included workload |
|---|---|
| `SKC AL` | Microsoft AL, AL Workspace Toolkit, variable helpers, XML |
| `SKC Web/Python` | TypeScript, ESLint, Prettier, Python, Pylance, Debugpy, Python Environments, Azure web tooling |
| `SKC Power Platform/BI` | Dataverse DevTools, PCF Builder, Copilot Studio, TMDL, Power BI Modeling MCP, Power BI Studio |

All profiles also include Error Lens, GitHub Pull Requests, PowerShell, VS Code Icons, and SKC Workstation Tools.

The Power Platform Tools extension pack is intentionally excluded because it installs CodeQL and SARIF. Install the Power Apps CLI (`pac`) separately only on workstations that manage solutions or Power Pages.

Code apps additionally need Node.js LTS and Git on the machine; the extension does not install those.

The preset registers a `dataverse` MCP server pointing at `https://<YOUR_DATAVERSE_ORG>.crm4.dynamics.com/api/mcp`. Replace the placeholder with your environment URL. The server must also be enabled per environment in the Power Platform admin center, with **Microsoft GitHub Copilot** allowed as an MCP client — otherwise the endpoint refuses the connection.

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
| `azureFunctionUrl` | empty | Azure Translation Function endpoint |

## Commands

| Command | Description |
|---|---|
| **SKC: Create or Update Workstation Profiles** | Create the three named profiles and install each isolated extension set |
| **SKC: Apply Presets** | Apply settings, optional custom extensions, and MCP servers to the current profile |
| **SKC: Install Copilot Skills** | Install bundled skills (`~/.copilot/skills/`) |
| **SKC: Install Copilot Agents** | Install BC subagents (`~/.copilot/agents/`) |
| **SKC: Update BCQuality Snapshot** | Refresh the bundled BCQuality snapshot offline or explicitly from official upstream |
| **SKC: Configure MCP Auth** | Store GitHub token and Context7 API key |
| **SKC: Fork Copilot Chat at Focused Message** | Branch the current native Copilot session after the focused request or response |
| **SKC: Configure Translation URL** | Set Azure Translation Function endpoint |
| **Translate File** | Translate the selected XLF file |
| **Refresh Translations** | Refresh the translations list |
| **Create Translation File** / **Add Language** | Create or extend XLF language files |

## Copilot and language-model tools

SKC Workstation Tools contributes the **@bc** chat participant, Copilot chat skills, and language-model tools (`#translateXlf`, `#listTranslations`). It can also expose VS Code tools such as `al_build` through an MCP SSE bridge. VS Code may show a confirmation dialog (`Run 'Build AL Project'`). That prompt is a VS Code security feature: use **Always allow** to reduce repeats. It cannot be turned off from this extension.

## Build and publish

```bash
npm install
npm run compile
npx vsce package
```

This is a **public** Marketplace listing. See [PUBLISHING.md](PUBLISHING.md).

BCQuality live downloads are disabled by default. Set `skc.bcQualityUpdateOnApply` to `true` only when an online refresh during preset application is desired; otherwise the bundled snapshot and validated offline fallback are used.
