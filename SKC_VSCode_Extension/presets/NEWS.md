# 📰 SKC VS Tools - What's New

## Version 2.3.0 - Latest Release

### ⏱ Billable Effort Summary in Orchestration

The `bc-orchestration` agent now produces a **Billable Effort Summary** at the end of every session — regardless of whether it was a full pipeline or a single-phase task.

#### What it does
- Estimates the equivalent hours a human BC developer would have spent on each phase completed (Research, Architecture, Logic, UI, Tests, Review, CAL Migration, Translation)
- Compares **Junior Dev** vs **Senior Dev** benchmarks side by side
- Outputs a ready-to-use billing reference table at the end of every orchestration run

#### Why it matters
When using AI-assisted development, the actual elapsed time is a fraction of the equivalent manual effort. This feature gives consultants a **defensible billing reference** based on standard BC development benchmarks — not the AI's wall-clock time.

---

### 🎛️ New: BC Control Addin Agent & Skill

A dedicated **`bc-control-addin`** subagent and skill have been added for building HTML/CSS/JS control addins with ERP-style visuals.

#### What's included
- **`bc-control-addin.agent.md`** — new specialist subagent for building AL control addins (HTML, CSS, JS) with ERP-style visual components
- **`skills/bc-control-addin/SKILL.md`** — skill with patterns, best practices, and templates for control addin development
- **`skills/bc-orchestration/SKILL.md`** — updated to include the control addin agent in the orchestration skill reference
- All other agents updated with clarified requirements and improved context for control addin-related tasks
- `bc-orchestration` now routes "create a control addin" / "build a visual component" requests to `bc-control-addin` automatically, with `bc-al-logic` handling the AL wrapper

---

## Version 2.1.0

### 🎯 VS Code-Only Focus — Cursor Support Removed

This release removes all Cursor IDE support. SKC Tools now targets **VS Code / GitHub Copilot exclusively**, simplifying the codebase and configuration.

#### What Changed
- **Skills** now always install to `~/.copilot/skills/`
- **Agents** now always install to `~/.copilot/agents/` (`.agent.md` format kept as-is)
- **mcp.servers** preset is always written in VS Code object format
- Removed `skc.writeCursorMcpFile` setting — only `skc.writeVSCodeMcpFile` remains
- Removed `cursor-global` special path value from `skc.mcpFilePath`
- Command palette entries renamed: **SKC: Install Copilot Skills / Agents**
- Preset `settings.json` no longer applies Cursor-specific settings (`cursor.privacy.mode`, `cursor.telemetry`, `cursor.aiProxy`)

#### News Page Auto-Open
- The What's New page now **always opens automatically** as a Markdown preview on each new version
- A notification button is also shown alongside the preview

---

## Version 2.0.0

### 🚀 NEW: BC CAL-to-AL Converter & Upgrade Automation

#### Complete NAV 2017 to BC 2027 Upgrade Pipeline

This major release adds the **bc-cal-converter** subagent and complete PowerShell automation for upgrading from NAV 2017 to BC 2027.

#### bc-cal-converter Subagent (NEW)
- **Intelligent CAL-to-AL conversion** with dual-mode strategy
- **Smart Detection** – Automatically creates table/page extensions for standard BC objects (ID < 50000) with custom fields
- **Bulk Conversion** – Fast conversion of fully custom objects (ID >= 50000) using Microsoft Txt2Al.exe
- **BC Knowledge Integration** – Consults logan-legacy, sam-coder, and alex-architect specialists for upgrade guidance
- **50% Time Savings** – Dual-mode approach cuts conversion time in half while maintaining quality

#### Dual-Mode Conversion Strategy
- **Mode 1 (Smart Detection)** – For standard BC objects with customizations
  - Parses DELTA files from NAV Model Tools comparison
  - Extracts ONLY custom fields (50000..99999) and custom code
  - Creates proper tableextension/pageextension objects
  - Consults BC Knowledge specialists for upgrade patterns
  - Quality: ⭐⭐⭐⭐⭐ | Time: ~2 min per object

- **Mode 2 (Bulk Conversion)** – For fully custom objects
  - Uses Microsoft Txt2Al.exe for fast bulk conversion
  - Converts 50 objects in ~5 seconds
  - Then reviewed by bc-reviewer subagent
  - Quality: ⭐⭐⭐ → ⭐⭐⭐⭐ (after review) | Time: ~5 sec + review

#### PowerShell Automation Scripts
- **upgrade-nav2017-to-bc2027.ps1** – Master orchestrator for complete pipeline
- **phase1-nav-export-delta.ps1** – NAV 2017 export and delta generation
- **phase2-cal-to-al-conversion.ps1** – Dual-mode CAL to AL conversion
- **phase3-compile-review.ps1** – Compilation and quality review
- **check-upgrade-status.ps1** – Real-time progress tracking
- **Complete Documentation** – README-UPGRADE-SCRIPTS.md with full usage guide

#### BC Knowledge Specialists Integration
- **logan-legacy** – Migration patterns and NAV to BC upgrade guidance
- **sam-coder** – Modern AL patterns and code modernization
- **alex-architect** – Extension design and restructuring
- **eva-errors** – Error handling patterns
- **roger-reviewer** – Code quality review
- **seth-security** – Security validation
- **morgan-market** – AppSource compliance

#### Key Features
- **50% Faster** – Dual-mode approach cuts conversion time in half
- **High Quality** – BC specialist consultation ensures best practices
- **Automatic Mode Selection** – Intelligently routes objects based on ID range
- **Manual Review Flags** – Identifies .NET interop, SQL, BLOB, and other patterns requiring attention
- **Comprehensive Reports** – Detailed conversion reports with statistics and next steps
- **Integration with GitHub** – References [taher-el-mehdi/cal-to-al](https://github.com/taher-el-mehdi/cal-to-al) for Txt2Al.exe

#### Updated BC Orchestration Skill
- **8 Subagents** – Added bc-cal-converter to existing 7 subagents
- **Phase 0: Migration** – New phase before Research & Design for CAL-to-AL conversion
- **Orchestrator Rule** – Automatically activates on .txt, .DELTA, .al, and app.json files
- **Specialists Reference** – Complete mapping of subagents to BC Knowledge specialists
- **Setup Scripts** – Automated deployment and uninstall scripts

#### Usage Example
```powershell
# 1. Configure upgrade settings
.\upgrade-nav2017-to-bc2027.ps1  # Creates config template

# 2. Run complete pipeline
.\upgrade-nav2017-to-bc2027.ps1 -ConfigFile "upgrade-config.json"

# 3. In Cursor, trigger bc-cal-converter
"Convert the CAL files in Mode1_StandardObjects to AL extensions"

# 4. Check progress
.\check-upgrade-status.ps1
```

#### Performance Example
**50 objects (15 standard + 35 custom)**
- Traditional approach: ~50 minutes
- Dual-mode approach: ~25 minutes
- **Time savings: 50% faster with same quality**

---

## Version 1.8.0

### 🤖 BC Orchestration Skill - Subagents

This version introduced the BC orchestration framework with 7 specialist subagents (bc-cal-converter was added in v2.0.0).

#### 7 BC Subagents
- **bc-researcher** – Gathers documentation, APIs, events from Microsoft Learn, GitHub, BC Knowledge
- **bc-architect** – Designs AL extension structure, object lists, events, APIs
- **bc-al-logic** – Implements tables, codeunits, enums, interfaces, integration code
- **bc-al-ui** – Implements pages, reports, role centers, layouts
- **bc-tester** – Creates test codeunits and validates implementations
- **bc-reviewer** – Reviews quality, security, best practices, AppSource readiness
- **bc-translator** – Manages multilanguage translation workflow

#### BC Knowledge MCP Integration
- Access to 15+ BC specialists (alex-architect, sam-coder, logan-legacy, etc.)
- Workflow tools for structured multi-phase development
- AL code analysis and validation

---

## Version 1.7.0

### 🤖 NEW: Translation LLM Tools
- **#translateXlf** – Let the AI translate an XLF file to a target language. Provide the source file path and locale (e.g. `fr-FR`); the model can invoke the tool and get a summary (translated count, sync info).
- **#listTranslations** – Let the AI list all XLF files and translation progress (units translated per language). Use in chat when you ask about translation status.
- Requires **skc.azureFunctionUrl** for translate; list works without it. Available when the editor supports the Language Model Tools API (VS Code 1.108+ / Cursor).

### 🧠 Cursor Skills Auto-Install
- **All Anthropic Curated Skills + SKC BC Word Layout** are bundled with the extension
- **Auto-install on update** when presets are applied (default on)
- **Manual install**: `SKC: Install Cursor Skills` · **Setting**: `skc.installSkillsOnApplyPresets`
- Skills install to `~/.cursor/skills/` (Cursor) or `~/.copilot/skills/` (VS Code)
- Agents (subagents) install to `~/.cursor/agents/` (Cursor) or `~/.copilot/agents/` (VS Code); in VS Code, `chat.agentFilesLocations` is configured automatically

---

## Version 1.5.0

Welcome to **SKC VS Tools**! Your all-in-one extension for streamlined Business Central AL development.

---

## ✨ What's New in This Version

### 🔄 NEW: Full XLF Sync (Same as GitHub Flow!)
- **Automatic Sync** - Adding new units and removing obsolete ones now works exactly like the GitHub webhook
- **Schema Sync** - When you translate, the extension compares source `.g.xlf` with your target file
- **Add Missing Units** - New trans-units from source are automatically added to target
- **Remove Obsolete Units** - Trans-units deleted from source are removed from target
- **Sync Summary** - See exactly what changed: `Translated: 15 | Synced: +3 added, -1 removed`

### 🌍 XLF Translation Tools
- **Translations Sidebar** - SKC Tools panel in the activity bar to manage your `.g.xlf` files
- **Translation Statistics** - See progress at a glance: `MyFile.g.xlf (45/120)` with color-coded status
- **Azure AI Translation** - Translate files using Azure OpenAI with one click
- **app.json Integration** - Target languages are automatically read from your `app.json` file
- **Quick Setup** - Run "SKC: Configure Translation URL" to connect to your Azure Translation Function

### 🚀 Core Features
- **Automatic Preset Application** - All settings, extensions, and MCP servers are automatically configured on startup
- **Smart News System** - Stay informed with automatic news notifications on every VS Code launch
- **MCP Server Integration** - Seamless integration with GitHub and Context7 MCP servers for enhanced development capabilities
- **Secure Credential Management** - GitHub tokens and API keys are stored securely using VS Code's secret storage

### 🎯 Developer Experience
- **Zero Configuration Required** - Works out of the box with sensible defaults
- **Settings Verification** - Automatic verification ensures all settings are applied correctly

### 📦 Extension Pack
Includes essential AL development extensions:
- Microsoft AL Language
- Waldo's AL Extension Pack
- Error Lens
- GitHub Pull Requests
- AL Toolbox
- And many more...

---

## 🔧 Configuration

### Commands
- **SKC: Apply Presets** - Manually apply all presets
- **SKC: Configure MCP Auth** - Set up GitHub and Context7 credentials
- **SKC: Configure Translation URL** - Set up Azure Translation Function endpoint
- **SKC: Install Cursor Skills** - Install BC orchestration and other skills
- **Translate File** - Translate selected XLF file (from sidebar)
- **Refresh Translations** - Refresh the translations list

### BC Orchestration Commands (in Cursor)
- **"Convert CAL to AL"** - Triggers bc-cal-converter subagent
- **"Migrate from NAV"** - Starts migration orchestration
- **"Run bc-reviewer"** - Quality and security review
- **"Run bc-tester"** - Create test coverage
- **"Ask logan-legacy about..."** - Consult upgrade specialist

### 🔐 Setting Up MCP Authentication

#### GitHub MCP Token
1. **Generate a GitHub Token**:
   - Visit [GitHub Personal Access Tokens](https://github.com/settings/tokens)
   - Click "Generate new token" → "Generate new token (classic)"
   - Give it a descriptive name (e.g., "SKC VS Tools MCP")
   - Select required scopes:
     - `repo` (Full control of private repositories)
     - `read:org` (Read org and team membership)
     - `user` (Read user profile data)
   - Click "Generate token" and **copy the token immediately**

2. **Configure in SKC VS Tools**:
   - Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
   - Run: `SKC: Configure MCP Auth`
   - Paste your GitHub token when prompted
   - Token is stored securely in VS Code's secret storage

#### Context7 API Key
1. **Get Your Context7 API Key**:
   - Visit [Context7 Dashboard](https://context7.com/dashboard)
   - Sign in to your account
   - Navigate to API Settings or API Keys section
   - Copy your API key

2. **Configure in SKC VS Tools**:
   - Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
   - Run: `SKC: Configure MCP Auth`
   - Enter your Context7 API key when prompted
   - Key is stored securely in VS Code's secret storage

> 💡 **Note**: You only need to configure these once. The extension will automatically inject them into your MCP server configurations on startup.

---

## 🆘 Support & Resources

- **Website**: [skc.lu](https://www.skc.lu)
- **GitHub**: [SK-Consulting-S-A/SKC_Tools](https://github.com/SK-Consulting-S-A/SKC_Tools)
- **Issues**: Report bugs or request features on GitHub

---

**Thank you for using SKC VS Tools!** 🎉  
*Making Business Central development easier, one preset at a time.*
