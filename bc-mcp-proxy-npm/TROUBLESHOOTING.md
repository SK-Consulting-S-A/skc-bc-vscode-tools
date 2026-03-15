# Troubleshooting Guide

## Authentication Errors

### Error: "Invalid redirect uri"

**Error Message:**
```
Invalid redirect uri - ensure you have configured the following url in the application registration in Azure Portal: 
ms-appx-web://microsoft.aad.brokerplugin/YOUR-CLIENT-ID
```

**Cause:**
The proxy uses the Windows authentication broker, which requires a specific Redirect URI format.

**Solution:**
1. Copy the Redirect URI from the error message (e.g., `ms-appx-web://microsoft.aad.brokerplugin/<your-client-id>`)
2. Go to [Azure Portal](https://portal.azure.com) > **App registrations** > Your App
3. Select **Authentication**
4. Click **Add a platform** > **Mobile and desktop applications**
5. Paste the URI into the **Custom redirect URIs** field
6. Click **Configure**
7. Ensure **Allow public client flows** is set to **Yes** (at the bottom of the page)
8. Click **Save**

### Error: "Selected user account does not exist in tenant"

**Error Message:**
```
Selected user account does not exist in tenant 'projectmaven-test' and cannot access 
the application '3acde393-18cc-4b12-803c-4c85fa111c21' in that tenant. The account 
needs to be added as an external user in the tenant first. Please use a different account.
```

**Root Cause:**
The `TenantId` in your `appsettings.json` doesn't match the tenant where your user account exists, or your account hasn't been added to that tenant.

**Solutions:**

#### Solution 1: Use the Correct Tenant ID

1. **Identify Your Tenant:**
   - Check which tenant your user account belongs to
   - The error message shows the tenant name (e.g., "projectmaven-test")
   - You may need to use a different tenant ID

2. **Find Your Tenant ID:**
   - Go to [Azure Portal](https://portal.azure.com)
   - Navigate to **Microsoft Entra ID** > **Overview**
   - Copy the **Tenant ID** (this is the GUID, not the tenant name)

3. **Update appsettings.json:**
   ```json
   {
     "BcMCPProxy": {
       "TenantId": "correct-tenant-id-here",
       "ClientId": "your-client-id",
       ...
     }
   }
   ```

#### Solution 2: Use the Correct User Account

1. **Check Available Accounts:**
   - When the authentication dialog appears, look at the available accounts
   - The error shows which accounts are available (e.g., "user@contoso.com")

2. **Select the Correct Account:**
   - Choose the account that exists in the tenant specified in `TenantId`
   - If no account exists, you may need to:
     - Add your account as an external user to that tenant, OR
     - Use a different tenant ID that matches your account

#### Solution 3: Add User to Tenant (If You Have Admin Access)

If you have admin access to the tenant:

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Microsoft Entra ID** > **Users**
3. Click **New guest user** or **New user**
4. Add the user account to the tenant
5. Assign appropriate roles/permissions

#### Solution 4: Create App Registration in Correct Tenant

If you need to use a different tenant:

1. **Switch to the Correct Tenant:**
   - In Azure Portal, switch to the tenant where your account exists
   - Or create a new app registration in that tenant

2. **Create New App Registration:**
   - Follow the setup instructions in the README
   - Use the Tenant ID and Client ID from the correct tenant

3. **Update Configuration:**
   ```json
   {
     "BcMCPProxy": {
       "TenantId": "new-tenant-id",
       "ClientId": "new-client-id",
       ...
     }
   }
   ```

### Error: "Invalid client" or "Application not found"

**Cause:** The `ClientId` in `appsettings.json` doesn't exist or is incorrect.

**Solution:**
1. Verify the Client ID in Azure Portal:
   - Go to **App registrations**
   - Find your app
   - Copy the **Application (client) ID**
2. Update `appsettings.json` with the correct Client ID

### Error: "Insufficient privileges" or "Access denied"

**Cause:** The Azure AD app doesn't have the required permissions.

**Solution:**
1. Go to Azure Portal > **App registrations** > Your app
2. Navigate to **API permissions**
3. Ensure these permissions are added:
   - **Dynamics 365 Business Central**
     - `Financials.ReadWrite.All` (Delegated)
     - `user_impersonation` (Delegated)
4. Click **Grant admin consent** (if you have admin rights)
5. Wait a few minutes for permissions to propagate

### Error: "Company not found"

**Cause:** The company name doesn't match exactly (case-sensitive).

**Solution:**
1. **List Available Companies:**
   ```bash
   # Use curl or Postman to call:
   GET https://api.businesscentral.dynamics.com/v2.0/{tenant-id}/{environment}/api/v2.0/companies
   ```

2. **Copy Exact Company Name:**
   - Note the exact spelling and capitalization
   - Update `appsettings.json` with the exact name

3. **Common Issues:**
   - Extra spaces
   - Different capitalization
   - Special characters encoded differently

## Configuration Issues

### Error: "appsettings.json not found"

**Solution:**
1. Copy the example file:
   ```bash
   cp appsettings.example.json appsettings.json
   ```
2. Edit `appsettings.json` with your credentials
3. Ensure the file is in the package root directory

### Error: "Invalid JSON" or "Parse error"

**Solution:**
1. Validate your JSON syntax using an online JSON validator
2. Check for:
   - Missing commas
   - Unclosed brackets
   - Trailing commas (not allowed in JSON)
   - Incorrect quotes (use double quotes)

### Configuration Not Being Read

**Solution:**
1. **Check File Location:**
   - `appsettings.json` must be in the package root directory
   - Not in `src/` or `bin/` directories

2. **Use Command-Line Arguments:**
   ```bash
   bc-mcp-proxy --TenantId <id> --ClientId <id> --Environment <env> --Company <name>
   ```

3. **Check File Permissions:**
   - Ensure the file is readable
   - On Windows, check if file is not locked by another process

## Runtime Issues

### Error: "dotnet not found"

**Solution:**
1. Install .NET SDK 8.0+ from: https://dotnet.microsoft.com/download
2. Restart your terminal/command prompt
3. Verify installation:
   ```bash
   dotnet --version
   ```
4. Rebuild the project:
   ```bash
   npm run build
   ```

### Error: "Executable not found"

**Solution:**
1. Rebuild the project:
   ```bash
   npm run build
   ```
2. Or reinstall:
   ```bash
   npm install
   ```
3. Check if build succeeded:
   ```bash
   ls src/BcMCPProxy/bin/Release/net8.0/
   ```

### Error: "Port already in use"

**Solution:**
1. The proxy uses stdio (standard input/output), not a port
2. If you see port errors, it might be from another application
3. Check what's using the port and stop it

## MCP Client Issues

### Cursor Not Detecting MCP Server

**Solution:**
1. **Check Configuration:**
   ```json
   {
     "mcp": {
       "servers": {
         "bc-proxy": {
           "command": "npx",
           "args": ["bc-mcp-proxy-fisqal"],
           "cwd": "C:\\Apps\\Fisqal-Lux-Localization\\bc-mcp-proxy-npm"
         }
       }
     }
   }
   ```

2. **Verify Path:**
   - Ensure `cwd` points to the correct directory
   - Use absolute paths, not relative

3. **Check Executable:**
   - Verify `bc-mcp-proxy` can run manually:
     ```bash
     npm start
     ```

4. **Restart Cursor:**
   - Close and reopen Cursor completely
   - Check Cursor logs for errors

### Claude Desktop Not Detecting MCP Server

**Solution:**
1. **Check Configuration File Location:**
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

2. **Verify JSON Syntax:**
   - Use a JSON validator
   - Ensure proper escaping of paths

3. **Use Full Paths:**
   ```json
   {
     "mcpServers": {
       "bc-proxy": {
         "command": "C:\\Apps\\Fisqal-Lux-Localization\\bc-mcp-proxy-npm\\bin\\bc-mcp-proxy.js",
         "args": []
       }
     }
   }
   ```

4. **Restart Claude Desktop:**
   - Completely quit and restart
   - Check logs for errors

## Network Issues

### Error: "Cannot connect to Business Central"

**Solution:**
1. **Verify URL:**
   - Check `Url` in `appsettings.json`
   - Should be: `https://api.businesscentral.dynamics.com`
   - For on-premises: Use your server URL

2. **Check Network:**
   - Verify internet connectivity
   - Check firewall settings
   - Ensure VPN is connected (if required)

3. **Verify Environment:**
   - Check `Environment` matches your BC environment name
   - Common values: "Production", "Sandbox"

### Error: "Timeout" or "Request timeout"

**Solution:**
1. Check Business Central service status
2. Verify your network connection
3. Try again after a few minutes (might be temporary)

## Getting Help

### Debug Mode

Enable debug logging:

```json
{
  "BcMCPProxy": {
    "Debug": true,
    "EnableHttpLogging": true,
    "EnableMsalLogging": true,
    ...
  }
}
```

### Check Logs

1. **Console Output:**
   - Check the terminal where you run `npm start`
   - Look for error messages

2. **Cursor Logs:**
   - Help > Toggle Developer Tools
   - Check Console for MCP errors

3. **Claude Desktop Logs:**
   - Check the console output when starting Claude Desktop

### Common Configuration Mistakes

1. ❌ Using tenant name instead of tenant ID
2. ❌ Wrong company name (case-sensitive)
3. ❌ Missing required fields
4. ❌ Incorrect JSON syntax
5. ❌ Using old configuration format (Servers array)

### Verification Checklist

Before reporting issues, verify:

- [ ] .NET SDK 8.0+ is installed
- [ ] `appsettings.json` exists and is valid JSON
- [ ] Tenant ID matches your Azure AD tenant
- [ ] Client ID matches your app registration
- [ ] Company name matches exactly (case-sensitive)
- [ ] Environment name is correct
- [ ] Azure AD app has required permissions
- [ ] Admin consent has been granted
- [ ] User account exists in the specified tenant
- [ ] Network connectivity to Business Central

## Still Having Issues?

1. **Check the Source README:**
   - See `src/BcMCPProxy/README.md` for original documentation

2. **Microsoft BCTech Repository:**
   - https://github.com/microsoft/BCTech/issues

3. **Business Central Documentation:**
   - https://docs.microsoft.com/dynamics365/business-central

4. **MCP Protocol:**
   - https://modelcontextprotocol.io

