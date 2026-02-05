# 📰 SKC VS Tools - What's New

## Version 1.7.0 - Latest Release

### 🤖 NEW: Translation LLM Tools
- **#translateXlf** – Let the AI translate an XLF file to a target language. Provide the source file path and locale (e.g. `fr-FR`); the model can invoke the tool and get a summary (translated count, sync info).
- **#listTranslations** – Let the AI list all XLF files and translation progress (units translated per language). Use in chat when you ask about translation status.
- **LM Bridge** – In Cursor, these tools are also exposed via the LM-Bridge MCP server so Cursor AI can call them during conversations.
- Requires **skc.azureFunctionUrl** for translate; list works without it. Available when the editor supports the Language Model Tools API (VS Code 1.108+ / Cursor).

### 🌉 LM Bridge – VS Code tools in Cursor
- **Expose VS Code Language Model tools to Cursor** via an MCP SSE server
- **LM-Bridge** runs locally (default: `http://localhost:7878/sse`) and forwards tool calls from Cursor to VS Code’s built-in LM tools (e.g. from the AL extension)
- **Included in MCP preset** – Apply Presets adds the LM-Bridge server so Cursor can connect automatically
- **Config**: `skc.enableLmBridge` (default: true), `skc.lmBridgePort` (default: 7878)
- Check the **SKC Presets** output channel for the bridge URL when it’s running

### 🧠 Cursor Skills Auto-Install
- **All Anthropic Curated Skills + SKC BC Word Layout** are bundled with the extension
- **Auto-install on update** when presets are applied (default on)
- **Manual install**: `SKC: Install Cursor Skills` · **Setting**: `skc.installSkillsOnApplyPresets`
- Skills install to `~/.cursor/skills/`

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
- **Translate File** - Translate selected XLF file (from sidebar)
- **Refresh Translations** - Refresh the translations list

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
