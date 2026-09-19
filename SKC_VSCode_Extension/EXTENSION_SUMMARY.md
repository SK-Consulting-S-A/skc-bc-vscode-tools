# SKC Workstation Tools - Extension Summary

**Marketplace (public):** [https://marketplace.visualstudio.com/items?itemName=SKConsultingSA.skc-vs-tools](https://marketplace.visualstudio.com/items?itemName=SKConsultingSA.skc-vs-tools)
**Repository (public):** [https://github.com/SK-Consulting-S-A/skc-bc-vscode-tools](https://github.com/SK-Consulting-S-A/skc-bc-vscode-tools)
**Issues:** [https://github.com/SK-Consulting-S-A/skc-bc-vscode-tools/issues](https://github.com/SK-Consulting-S-A/skc-bc-vscode-tools/issues)
**Homepage:** [https://www.skc.lu](https://www.skc.lu)

## Overview

**SKC Workstation Tools** configures isolated VS Code profiles for SK Consulting employees and contractors: Business Central AL, Web/Python, and Power Platform/BI, with Copilot AI agents and skills, workspace presets, and XLF translation.

## What It Does

### 0. **Bundles Skills and Subagents**

Ships with the full Anthropic curated skills set plus SKC BC skills (`bc-word-layout`, `bc-orchestration` with CAL-to-AL converter). Skills and BC subagents install on extension updates (via Apply Presets): Cursor → `~/.cursor/skills/` & `~/.cursor/agents/`, VS Code → `~/.copilot/skills/` & `~/.copilot/agents/`. In VS Code, `chat.agentFilesLocations` is updated so Copilot discovers the installed agents. Can be installed manually via commands.

#### BC Orchestration Skill (NEW in v1.8.0)
- **8 BC Subagents**: bc-cal-converter, bc-researcher, bc-architect, bc-al-logic, bc-al-ui, bc-tester, bc-reviewer, bc-translator
- **CAL-to-AL Converter**: Intelligent NAV 2017 to BC 2027 upgrade with dual-mode strategy
- **Smart Detection**: Auto-creates table/page extensions for standard BC objects (ID < 50000)
- **Bulk Conversion**: Fast conversion of custom objects (ID >= 50000) using Txt2Al.exe
- **BC Knowledge Integration**: Consults logan-legacy, sam-coder, and alex-architect specialists
- **PowerShell Automation**: Complete upgrade pipeline scripts included
- **50% Time Savings**: Dual-mode approach cuts conversion time in half while maintaining quality

### 1. **XLF Translation Tools**

The extension provides a dedicated **Translations** sidebar for managing and translating Business Central XLF files:

#### Features:
- **Translations View**: Shows all `.g.xlf` files in your `Translations` folder
- **Translation Statistics**: Displays progress for each file (e.g., `45/120` units translated)
- **Visual Status**: Color-coded icons (green = complete, yellow = partial, gray = not started)
- **Azure Translation Function**: Translate files using the configured Azure Translation Function
- **app.json Integration**: Reads target languages from `supportedLocales` or `features[].languages`

#### How to Use:
1. Click the **SKC Workstation Tools** icon in the activity bar
2. Run "SKC: Configure Translation URL" to set your Azure Function endpoint
3. Click the play button next to any `.g.xlf` file to translate it
4. Select the target language and the translated file is saved automatically

### 2. **Creates Isolated Development Profiles**

`presets/profiles.json` is the single source of truth for `SKC AL`, `SKC Web/Python`, and `SKC Power Platform/BI`. The extension has no manifest extension pack and does not install tools automatically on activation.

#### Core AL Extensions:
- **ms-dynamics-smb.al** - Official Microsoft AL Language extension
- **SKConsultingSA.skc-al-workspace** - Agent-ready AL file naming and workspace organization
- **rasmus.al-var-helper** - AL variable helper

#### Power Platform Extensions:
- **danish-naglekar.dataverse-devtools** - Dataverse connections and TypeScript definitions
- **danish-naglekar.pcf-builder** - PCF code component init, build and test
- **ms-copilotstudio.vscode-copilotstudio** - Copilot Studio agent editing
- **analysis-services.tmdl** - TMDL language support for Power BI semantic models
- **analysis-services.powerbi-modeling-mcp** - Power BI Modeling MCP Server
- **GerhardBrueckl.powerbi-vscode** - Power BI Studio

#### Productivity Tools:
- **ms-vscode.vscode-typescript-next** - TypeScript support
- **redhat.vscode-xml** - XML language support
- **dbaeumer.vscode-eslint** - ESLint, used by Power Apps code apps
- **esbenp.prettier-vscode** - Prettier, used by Power Apps code apps

#### Supporting Extensions:
- **usernamehw.errorlens** - Inline error highlighting
- **GitHub.vscode-pull-request-github** - GitHub PR integration
- **ms-azuretools.vscode-azurefunctions** - Azure Functions support
- **ms-azuretools.vscode-azureappservice** - Azure App Service support
- **ms-vscode.PowerShell** - PowerShell support
- **ms-azuretools.vscode-azureresourcegroups** - Azure resource group support
- **vscode-icons-team.vscode-icons** - File icons
- **ms-python.python** - Python support
- **ms-python.debugpy** - Python debugging

### 2. **Configures MCP Servers**

Sets up Model Context Protocol (MCP) servers for AI-powered development assistance:

1. **Playwright MCP** - Browser automation and testing
2. **Context7 MCP** - Code documentation and library references (requires API key)
3. **MS Learn Docs MCP** - Microsoft Learn documentation access
4. **Dataverse MCP** - Dataverse tables and records (requires the environment URL, and an admin must allow Microsoft GitHub Copilot as an MCP client)
5. **BC Intelligence MCP** - Business Central-specific AI assistance
6. **BC MCP Proxy** - Business Central API access (requires tenant and app registration details)
7. **MCP Pandoc** and **markitdown** - Document conversion utilities

### 3. **Applies AL-Optimized Settings**

Configures VS Code with production-ready settings specifically optimized for AL development:

#### AL-Specific Settings:
- **Code Analysis**: Enables Microsoft CodeCop and UICop analyzers
- **Code Actions**: Auto-sorting of variables, procedures, properties, and permissions
- **Code Cleanup**: Automatic formatting, data classification, and code quality improvements
- **Incremental Build**: Faster compilation with parallel processing
- **File Naming**: Standardized AL file naming patterns
- **Format on Save**: Automatic code formatting
- **Inlay Hints**: Parameter names and return types displayed inline

#### Development Workflow:
- Git auto-fetch and smart commit enabled
- Editor GPU acceleration for better performance
- Optimized AL language-specific editor settings
- Workspace trust configuration

## Key Features

### Automatic Setup
- **One-click profile creation** - Creates or updates three isolated profiles
- **Explicit presets** - Settings and MCP changes happen only when Apply Presets is run
- **No cross-workload language servers** - Pylance stays in Web/Python; AL and Power BI stay in their profiles

### MCP Authentication
- **Secure credential storage** - Uses VS Code secret storage for API keys and tokens
- **Easy configuration** - "SKC: Configure MCP Auth" command to set up GitHub token and Context7 API key

### Customization
- **Configurable paths** - Override default preset file locations
- **Skip installed extensions** - Option to skip already-installed extensions
- **Workspace-aware** - Presets can be customized per workspace

### Commands
- **SKC: Create or Update Workstation Profiles** - Create the three isolated extension profiles
- **SKC: Apply Presets** - Manually apply all presets
- **SKC: Install Cursor Skills** - Install bundled skills (Cursor: `~/.cursor/skills/`, VS Code: `~/.copilot/skills/`)
- **SKC: Install Cursor Agents** - Install BC subagents (Cursor: `~/.cursor/agents/`, VS Code: `~/.copilot/agents/`)
- **SKC: Configure MCP Auth** - Set up MCP server authentication
- **SKC: Configure Translation URL** - Set Azure Translation Function endpoint
- **Translate File** - Translate selected XLF file (from sidebar)
- **Refresh Translations** - Refresh the translations list

## Use Cases

Perfect for:
- **New AL developers** - Get a fully configured environment instantly
- **Team onboarding** - Standardize development environments across teams
- **CI/CD pipelines** - Consistent development setup in automated environments
- **AL development teams** - Shared configuration and best practices

## Installation

```bash
# Via VS Code Marketplace
ext install SKConsultingSA.skc-vs-tools

# Or install VSIX directly
code --install-extension skc-vs-tools-1.0.0.vsix
```

## Quick Start

1. **Install the extension** from the VS Code Marketplace
2. **Configure MCP Auth** - Run "SKC: Configure MCP Auth" command to set up:
   - GitHub Personal Access Token (for GitHub MCP)
   - Context7 API Key (for Context7 MCP)
3. **Create Profiles** - Run "SKC: Create or Update Workstation Profiles"
4. **Apply AL Presets** - In the SKC AL profile, run "SKC: Apply Presets"
5. **Configure Translations** (optional) - Run "SKC: Configure Translation URL" to enable XLF translation

## Technical Details

- **Activation**: Activates on AL language files or manual commands
- **Settings Scope**: User-level settings (applies globally)
- **Profiles**: Installs extension sets into three named VS Code profiles
- **Dependencies**: Requires VS Code 1.90.0 or higher

## Configuration Options

All settings are prefixed with `skc.*`:

- `skc.skipInstalledExtensions` - Skip already installed extensions (default: true)
- `skc.presetFilePath` - Custom settings preset path
- `skc.mcpFilePath` - Custom MCP servers configuration path
- `skc.extensionsFilePath` - Custom extensions list path
- `skc.installSkillsOnApplyPresets` - Auto-install bundled Cursor skills on Apply Presets (default: true)
- `skc.azureFunctionUrl` - Azure Translation Function endpoint URL
- `skc.showNewsOnStartup` - Show news notification on startup (default: true)
- `skc.autoOpenNewsPage` - Auto-open news page instead of notification (default: false)
- `skc.newsFilePath` - Path to news markdown file

---

**Publisher:** SK Consulting SA  
**Version:** 2.5.1
**License:** [End-User License Agreement (EULA)](https://skc.lu/eula/)

