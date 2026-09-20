# Quick Start Guide

This guide will get you up and running with the BC MCP Proxy in 5 minutes.

## Prerequisites

✅ Node.js 14+ installed  
✅ .NET SDK 8.0+ installed ([Download](https://dotnet.microsoft.com/download))  
✅ Business Central instance access  
✅ Azure AD App Registration (for BC Online)  

## Step 1: Install the Package

### Option A: Local Project Installation

```bash
cd C:\Apps\Fisqal-Lux-Localization\bc-mcp-proxy-npm
npm install
```

### Option B: Global Installation (from npm registry)

```bash
npm install -g bc-mcp-proxy-fisqal
```

### Option C: Use with npx (no installation)

```bash
npx bc-mcp-proxy-fisqal
```

## Step 2: Configure Business Central Connection

1. Copy the example configuration:
   ```bash
   cp appsettings.example.json appsettings.json
   ```

2. Edit `appsettings.json`:
   ```json
   {
     "BcMCPProxy": {
       "TenantId": "your-tenant-id-here",
       "ClientId": "your-client-id-here",
       "Url": "https://api.businesscentral.dynamics.com",
       "Environment": "Production",
       "Company": "Your Company Name",
       "ConfigurationName": "",
       "TokenScope": "https://api.businesscentral.dynamics.com/.default"
     }
   }
   ```

3. Replace:
   - `your-tenant-id-here` - Your Azure AD tenant ID (⚠️ **Important**: Must match the tenant where your user account exists)
   - `your-client-id-here` - Your Azure AD application (client) ID
   - `Production` - Your Business Central environment name (e.g., "Production", "Sandbox")
   - `Your Company Name` - Your BC company name (exact match, case-sensitive)

## Step 3: Test the Proxy

```bash
npm start
```

Or:

```bash
npx bc-mcp-proxy
```

You should see the proxy starting up and waiting for MCP connections.

## Step 4: Configure Your AI Assistant

### For Cursor

1. Open Cursor Settings
2. Go to Features > MCP
3. Add:
   ```json
   {
     "mcp": {
       "servers": {
         "bc-proxy": {
           "command": "npx",
           "args": [
             "-y",
             "bc-mcp-proxy-fisqal",
             "--TenantId", "YOUR-TENANT-ID",
             "--ClientId", "YOUR-CLIENT-ID",
             "--Environment", "Production",
             "--Company", "Your Company Name"
           ]
         }
       }
     }
   }
   ```
4. Restart Cursor

### For Claude Desktop

1. Open: `%APPDATA%\Claude\claude_desktop_config.json` (Windows)
2. Add:
   ```json
   {
     "mcpServers": {
       "bc-proxy": {
         "command": "npx",
         "args": ["bc-mcp-proxy-fisqal"],
         "cwd": "C:\\Apps\\Fisqal-Lux-Localization\\bc-mcp-proxy-npm"
       }
     }
   }
   ```
3. Restart Claude Desktop

## Step 5: Test It!

Try these prompts in your AI assistant:

- "List all customers from Business Central"
- "Get the top 10 items by inventory"
- "Show me today's sales orders"
- "Create a new customer in BC"

## Common Issues

### Issue: "dotnet not found"
**Solution**: Install .NET SDK from https://dotnet.microsoft.com/download

### Issue: "Authentication failed" or "Selected user account does not exist in tenant"
**Solution**: 
1. **Verify Tenant ID**: The `TenantId` in `appsettings.json` must match the tenant where your user account exists
  - If you see an error mentioning a tenant name (like `<tenant-name>`), check if that's the correct tenant
   - Your user account must exist in that tenant or be added as an external user
2. **Verify Client ID**: Ensure the `ClientId` matches your Azure AD app registration
3. **Check Permissions**: Ensure your Azure AD App has:
   - `Financials.ReadWrite.All` (Delegated)
   - `user_impersonation` (Delegated)
4. **Grant Admin Consent**: Ensure admin consent has been granted for the app permissions
5. **Use Correct Account**: When prompted, select the account that exists in the specified tenant

### Issue: "Company not found"
**Solution**: Check company name matches exactly (case-sensitive)

### Issue: "Proxy won't start"
**Solution**: 
1. Check if port is already in use
2. Verify `appsettings.json` syntax is valid JSON
3. Check logs for specific error messages

## Getting Azure AD Credentials

If you don't have an Azure AD App Registration yet:

1. Go to [Azure Portal](https://portal.azure.com)
2. Azure Active Directory > App registrations > New registration
3. Name: "BC MCP Proxy"
4. Redirect URI: http://localhost
5. After creation, note down:
   - **Tenant ID**: Overview > Directory (tenant) ID
   - **Client ID**: Overview > Application (client) ID
6. API Permissions > Add permission > Dynamics 365 Business Central
   - Add: `Financials.ReadWrite.All` and `user_impersonation`
   - Grant admin consent
7. Authentication > Allow public client flows: Yes

## Next Steps

- Read the full [USAGE.md](USAGE.md) for advanced configuration
- Check out the [README.md](README.md) for package details
- Visit [BC MCP Proxy Docs](https://github.com/microsoft/BCTech/tree/master/samples/BcMCPProxy) for more info

## Need Help?

- Check the logs in the console where the proxy is running
- Review Business Central API docs: https://docs.microsoft.com/dynamics365/business-central/dev-itpro/api-reference/v2.0/
- Verify your Azure AD setup is correct
- Make sure your Business Central user has API access permissions

## Success! 🎉

If everything is working, you should now be able to interact with Business Central through your AI assistant!

---

**Package Location**: `C:\Apps\Fisqal-Lux-Localization\bc-mcp-proxy-npm`  
**Version**: 1.0.0  
**Author**: Fisqal

