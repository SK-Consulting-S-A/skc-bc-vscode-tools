# SKC AL Tools

AL tools for Business Central from [SK Consulting S.A.](https://www.skc.lu): Copilot AI agents, workspace presets, recommended extensions, and XLF translation.

Install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=SKConsultingSA.skc-vs-tools) (`ext install SKConsultingSA.skc-vs-tools`). Source: [skc-bc-internal-tools](https://github.com/SK-Consulting-S-A/skc-bc-internal-tools).

## What you get

- **Copilot AI for AL** — BC subagents (research, architecture, logic, UI, review, tests, translation, CAL conversion, control add-ins) and skills (`bc-orchestration`, `bc-agent-sdk`, `bc-word-layout`, `bc-control-addin`, `mermaid-to-word`).
- **Workspace presets** — AL settings, CodeCop and UICop, recommended extensions, and MCP servers applied with **SKC: Apply Presets**.
- **XLF translation** — sidebar to preview and translate `.g.xlf` files with Azure AI.

## What's included

- `presets/settings.json` — user settings applied to User scope
- `presets/mcp.json` — MCP servers written to `mcp.servers` (secrets come from VS Code secret storage)
- `presets/extensions.json` — extension pack to install
- `skills/` — Copilot skill bundles (SKC BC skills plus the Anthropic curated set)
- `agents/` — BC Copilot subagents
- **Translations** view — `.g.xlf` files and Azure AI translation

## How to use

### Presets, extensions, and AI

1. Install **SKC AL Tools** from the Marketplace.
2. Run **SKC: Configure MCP Auth** to store your GitHub token and Context7 API key in VS Code secrets.
3. Run **SKC: Apply Presets** (or rely on auto-run on first activation) to install extensions, apply settings, and register MCP servers.
4. Copilot skills and agents install with presets. You can also run **SKC: Install Copilot Skills** and **SKC: Install Copilot Agents**.

Skills land in `~/.copilot/skills/`. Agents land in `~/.copilot/agents/`.

### Translations

1. Click the **SKC AL Tools** icon in the activity bar.
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
| **SKC: Apply Presets** | Install extensions and apply settings and MCP servers |
| **SKC: Install Copilot Skills** | Install bundled skills (`~/.copilot/skills/`) |
| **SKC: Install Copilot Agents** | Install BC subagents (`~/.copilot/agents/`) |
| **SKC: Configure MCP Auth** | Store GitHub token and Context7 API key |
| **SKC: Configure Translation URL** | Set Azure Translation Function endpoint |
| **Translate File** | Translate the selected XLF file |
| **Refresh Translations** | Refresh the translations list |
| **Create Translation File** / **Add Language** | Create or extend XLF language files |

## Copilot and language-model tools

SKC AL Tools contributes Copilot chat skills and language-model tools (`#translateXlf`, `#listTranslations`). It can also expose VS Code tools such as `al_build` through an MCP SSE bridge. VS Code may show a confirmation dialog (`Run 'Build AL Project'`). That prompt is a VS Code security feature: use **Always allow** to reduce repeats. It cannot be turned off from this extension.

## Build and publish

```bash
npm install
npm run compile
npx vsce package
```

This is a **public** Marketplace listing. See [PUBLISHING.md](PUBLISHING.md).
