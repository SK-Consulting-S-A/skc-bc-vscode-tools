---
name: bc-orchestration
description: Orchestrate Business Central AL development using phased subagents (researcher, architect, logic dev, UI dev, tester, reviewer, translator) powered by BC Knowledge MCP specialists. Use when implementing BC features, reviewing AL code, designing extensions, or any multi-step BC development task. Triggers on AL files, app.json, BC terminology, or explicit orchestration requests.
---

# BC Subagent Orchestration

Coordinate Business Central AL development through phased subagent delegation, each backed by BC Knowledge MCP specialists for deep domain expertise.

## Installation

Deploy subagents and the orchestrator rule to their required locations:

```powershell
# From this skill directory
.\scripts\setup.ps1

# To remove
.\scripts\uninstall.ps1
```

After running setup, restart Cursor to pick up the new agents and rule.

## How It Works

The orchestrator rule (`bc-orchestrator.mdc`) teaches the main agent to delegate BC tasks to 8 specialist subagents. Each subagent consults BC Knowledge MCP specialists for guidance, then converts legacy code, researches, implements, tests, reviews, or translates code.

### Orchestration Phases

**CAL-to-AL migration** (triggered by "convert", "migrate", "upgrade from NAV", "CAL to AL", or presence of `.txt`/`.DELTA` files):

0. **CAL-to-AL Conversion** -- `bc-cal-converter` subagent (foreground)
   - Parses C/AL text exports and `.DELTA` files
   - Applies smart detection: Object ID < 50000 → extensions, ID >= 50000 → new objects
   - Consults MCP: `logan-legacy` (migration patterns), `sam-coder` (modern AL)
   - Uses: `al_symbolsearch`, `find_bc_knowledge`, `workflow_start` (bc-version-upgrade)
   - Output: AL source files (tables, tableextensions, pages, pageextensions, codeunits) + conversion report

**Full feature implementation** (triggered by "implement", "build", "create", "add feature"):

1. **Research & Design** -- `bc-researcher` + `bc-architect` subagents (background, parallel)
   - Researcher uses: `find_bc_knowledge`, `get_bc_topic`, `WebSearch`, `WebFetch`, `ask_bc_expert`
   - Architect consults MCP: `alex-architect`, `jordan-bridge`
   - Output: research findings + object list, extension approach, upgrade plan

2. **Implement** -- `bc-al-logic` + `bc-al-ui` subagents (background, parallel)
   - Logic consults MCP: `sam-coder`, `eva-errors`, `jordan-bridge`
   - UI consults MCP: `uma-ux`, `sam-coder`
   - Output: AL source files (tables, codeunits, pages, reports)

3. **Test** -- `bc-tester` subagent (foreground)
   - Detects/creates test app, downloads symbols, creates tests, builds
   - Consults MCP: `quinn-tester`
   - Output: test codeunits in separate test app, coverage report

4. **Review** -- `bc-reviewer` subagent (foreground)
   - Consults MCP: `roger-reviewer`, `seth-security`, `morgan-market`
   - Uses: `al_build`, `al_getdiagnostics`
   - Output: critical / warning / suggestion findings, compilation status

5. **Translation** -- `bc-translator` subagent (if `supportedLocales` in app.json)
   - Uses: `al_build`, `createLanguageXlf`, `skc_translate_xlf`, `skc_list_translation_files`
   - Output: translated XLF files for each locale

### Individual Tasks

You can invoke any subagent directly:

- "Convert these CAL files to AL" -- triggers `bc-cal-converter` only
- "Research how X works in BC" -- triggers `bc-researcher` only
- "Design an extension for X" -- triggers `bc-architect` (+ `bc-researcher` in parallel if unfamiliar area)
- "Implement the logic for X" -- triggers `bc-al-logic` only
- "Build the pages for this design" -- triggers `bc-al-ui` only
- "Create a control addin for X" -- triggers `bc-control-addin` only
- "Build a BC agent extension", "implement IAgentFactory", "use the BC Agent SDK" -- triggers `bc-agent-sdk` only
- "Add tests for this table" -- triggers `bc-tester` only
- "Review this codeunit" -- triggers `bc-reviewer` only
- "Translate to French" -- triggers `bc-translator` only

### Direct Specialist Access

The MCP specialists remain accessible outside the orchestration:

- "Ask Dean about this performance issue" -- calls `dean-debug` directly
- "Talk to Sam about AL patterns" -- calls `sam-coder` directly

## Subagents

| Subagent | File | Key Tools / MCP Specialists |
|----------|------|-----------------------------|
| CAL Converter | `bc-cal-converter.agent.md` | al_symbolsearch, find_bc_knowledge, workflow_start, logan-legacy, sam-coder, alex-architect |
| Researcher | `bc-researcher.agent.md` | al_symbolsearch, find_bc_knowledge, get_bc_topic, WebSearch, search_code, ask_bc_expert |
| Architect | `bc-architect.agent.md` | al_symbolsearch, alex-architect, jordan-bridge |
| Logic Dev | `bc-al-logic.agent.md` | al_symbolsearch, sam-coder, eva-errors, jordan-bridge |
| UI Dev | `bc-al-ui.agent.md` | al_symbolsearch, search_code, uma-ux, sam-coder |
| Control Addin | `bc-control-addin.agent.md` | al_symbolsearch, al_build, HTML/CSS/JS ERP-style visuals |
| Agent SDK Dev | `bc-agent-sdk.md` | al_symbolsearch, al_build, al_getdiagnostics, sam-coder |
| Tester | `bc-tester.agent.md` | al_downloadsymbols, al_build, al_getdiagnostics, quinn-tester |
| Reviewer | `bc-reviewer.agent.md` | al_build, al_getdiagnostics, roger-reviewer, seth-security, morgan-market |
| Translator | `bc-translator.agent.md` | al_build, createLanguageXlf, skc_translate_xlf, skc_list_translation_files |

All code-producing subagents (CAL converter, researcher, architect, logic dev, UI dev) follow an **AL Research-First Approach** — they verify symbols, patterns, and best practices through `al_symbolsearch`, Microsoft Learn, and GitHub before writing or designing any code.

### Smart Detection for CAL-to-AL Conversion

The `bc-cal-converter` subagent uses object ID-based smart detection:

- **Object ID < 50000** (standard BC object): Creates **tableextension** or **pageextension** containing only custom fields (field IDs 50000..99999) and custom code
- **Object ID >= 50000** (fully custom object): Creates new AL **table**, **page**, **codeunit**, **report**, **xmlport**, or **query**
- Extension object IDs are allocated from the project's `app.json` `idRanges`, not from the original object IDs

## MCP Tools Used

### BC Knowledge MCP (`user-bc-intelligence`)
- `ask_bc_expert` -- direct specialist consultation
- `find_bc_knowledge` -- search BC topics, specialists, workflows
- `get_bc_topic` -- detailed topic content with code samples
- `workflow_start` -- begin structured multi-phase workflow (including bc-version-upgrade)
- `workflow_progress` -- report progress in active workflow
- `workflow_complete` -- complete workflow and generate final report
- `analyze_al_code` -- automated AL code analysis

### VS Code Tools
- `al_symbolsearch` -- search AL symbols (tables, fields, events) in project and dependencies
- `al_build` -- compile AL project
- `al_getdiagnostics` -- get compilation errors
- `al_downloadsymbols` -- download symbols for active project
- `github-pull-request_formSearchQuery` -- convert natural language to GitHub query
- `github-pull-request_doSearch` -- search GitHub code (bc-w1 for standard patterns, bctech for innovation)
- `createLanguageXlf` / `skc_translate_xlf` / `skc_list_translation_files` -- translation workflow

## Additional Resources

- For the full specialist roster and mapping, see [specialists-reference.md](specialists-reference.md)
