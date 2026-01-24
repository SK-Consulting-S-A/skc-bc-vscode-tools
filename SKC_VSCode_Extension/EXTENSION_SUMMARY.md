# SKC VS Tools - Extension Summary

**Marketplace:** [https://marketplace.visualstudio.com/items?itemName=SKConsultingSA.skc-vs-tools](https://marketplace.visualstudio.com/items?itemName=SKConsultingSA.skc-vs-tools)  
**Repository:** [https://github.com/SK-Consulting-S-A/SKC_Tools](https://github.com/SK-Consulting-S-A/SKC_Tools)  
**Issues:** [https://github.com/SK-Consulting-S-A/SKC_Tools/issues](https://github.com/SK-Consulting-S-A/SKC_Tools/issues)  
**Homepage:** [https://www.skc.lu](https://www.skc.lu)

## Overview

**SKC VS Tools** is a VS Code extension pack that automatically configures a complete development environment for **Business Central AL development**. It installs essential AL extensions, configures MCP (Model Context Protocol) servers, and applies optimized settings for AL code development.

## What It Does

### 0. **Bundles Cursor AI Skills**

Ships with the full Anthropic curated skills set plus the SKC `bc-word-layout` skill. Skills are installed to `~/.cursor/skills/` on extension updates (via Apply Presets), and can be installed manually via command.

### 1. **XLF Translation Tools**

The extension provides a dedicated **Translations** sidebar for managing and translating Business Central XLF files:

#### Features:
- **Translations View**: Shows all `.g.xlf` files in your `Translations` folder
- **Translation Statistics**: Displays progress for each file (e.g., `45/120` units translated)
- **Visual Status**: Color-coded icons (green = complete, yellow = partial, gray = not started)
- **Azure AI Translation**: Translate files using Azure OpenAI via your Translation Function
- **app.json Integration**: Reads target languages from `supportedLocales` or `features[].languages`

#### How to Use:
1. Click the **SKC Tools** icon in the activity bar
2. Run "SKC: Configure Translation URL" to set your Azure Function endpoint
3. Click the play button next to any `.g.xlf` file to translate it
4. Select the target language and the translated file is saved automatically

### 2. **Installs AL Development Extensions** (18 extensions)

The extension automatically installs a comprehensive set of VS Code extensions required for Business Central AL development:

#### Core AL Extensions:
- **ms-dynamics-smb.al** - Official Microsoft AL Language extension
- **waldo.al-extension-pack** - AL Extension Pack by Waldo
- **nabsolutions.nab-al-tools** - NAB AL Tools for enhanced AL development
- **365businessdevelopment.365businessdev-alget** - AL development utilities

#### AL Productivity Tools:
- **rasmus.al-var-helper** - AL variable helper
- **BartPermentier.al-toolbox** - AL toolbox utilities
- **andrzejzwierzchowski.al-code-outline** - Code outline for AL files
- **wbrakowski.al-navigator** - AL code navigator

#### Supporting Extensions:
- **usernamehw.errorlens** - Inline error highlighting
- **GitHub.vscode-pull-request-github** - GitHub PR integration
- **vstirbu.vscode-mermaid-preview** - Mermaid diagram preview
- **ms-azuretools.vscode-azurefunctions** - Azure Functions support
- **ms-azuretools.vscode-azureappservice** - Azure App Service support
- **ms-vscode.azure-account** - Azure account management
- **ms-vscode.vscode-typescript-next** - TypeScript support
- **redhat.vscode-xml** - XML language support
- **ms-vscode.PowerShell** - PowerShell support
- **idered.npm** - npm integration

### 2. **Configures MCP Servers** (6 servers)

Sets up Model Context Protocol (MCP) servers for AI-powered development assistance:

1. **Playwright MCP** - Browser automation and testing
2. **Context7 MCP** - Code documentation and library references (requires API key)
3. **MS Learn Docs MCP** - Microsoft Learn documentation access
4. **GitHub MCP** - GitHub integration and repository management (requires GitHub token)
5. **BC Intelligence MCP** - Business Central-specific AI assistance
6. **MCP Pandoc** - Document conversion utilities

### 3. **Applies AL-Optimized Settings**

Configures VS Code with production-ready settings specifically optimized for AL development:

#### AL-Specific Settings:
- **Code Analysis**: Enables CodeCop, UICop, and BusinessCentral.LinterCop analyzers
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
- **One-click installation** - Installs all required extensions and applies settings automatically
- **Auto-run on activation** - Configures environment on first use (configurable)
- **Version tracking** - Re-applies presets when extension updates

### MCP Authentication
- **Secure credential storage** - Uses VS Code secret storage for API keys and tokens
- **Easy configuration** - "SKC: Configure MCP Auth" command to set up GitHub token and Context7 API key

### Customization
- **Configurable paths** - Override default preset file locations
- **Skip installed extensions** - Option to skip already-installed extensions
- **Workspace-aware** - Presets can be customized per workspace

### Commands
- **SKC: Apply Presets** - Manually apply all presets
- **SKC: Install Cursor Skills** - Install bundled Cursor skills to `~/.cursor/skills/`
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
3. **Apply Presets** - Run "SKC: Apply Presets" (or wait for auto-run)
4. **Configure Translations** (optional) - Run "SKC: Configure Translation URL" to enable XLF translation
5. **Start developing** - Your AL development environment is ready!

## Technical Details

- **Activation**: Activates on AL language files or manual commands
- **Settings Scope**: User-level settings (applies globally)
- **Extension Pack**: Installs as an extension pack (all extensions install together)
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
**Version:** 1.0.0  
**License:** [End-User License Agreement (EULA)](https://skc.lu/eula/)

