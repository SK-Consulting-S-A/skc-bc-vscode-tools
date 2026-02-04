# Publishing SKC VS Tools to the Marketplace

## How to publish

- **Local:** Put your Azure DevOps PAT in `.publish-token`, then run:
  - `node scripts/publish.js` — publish current version
  - `node scripts/publish.js minor` — bump minor version and publish
  - `node scripts/publish.js patch --pre-release` — bump patch and publish as pre-release
- **CI:** Use the **Publish Extension** GitHub Action (see [.github/workflows/publish-extension.yml](.github/workflows/publish-extension.yml)). Add repository secret **`VSCE_PAT`** (your Azure DevOps PAT with Marketplace → Manage). Run the workflow manually or on release.

PAT: [Azure DevOps → User settings → Personal access tokens](https://dev.azure.com) — scope **Marketplace (Manage)**.

---

## Making the extension **private** on the Visual Studio Marketplace

Extensions are **private by default** when first published. Only your publisher account can see and install them until you change visibility.

### 1. After publish (automatic attempt)

The publish script tries to set the extension to **Private** via the Marketplace API after each publish. If that succeeds, you’ll see: `✅ Extension is already set to private.` or `✅ Successfully set extension to private via API.` If the API call fails, use the web UI below.

### 2. Via the web UI (reliable)

1. Open the **Marketplace publisher management** page:  
   [https://marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage)
2. Sign in with the same Microsoft account used for publishing.
3. Select your **publisher** (e.g. SKConsultingSA).
4. Click the extension (e.g. **skc-vs-tools**).
5. Open the **Details** (or **Hub**) tab for that extension.
6. Find the **Visibility** or **Availability** setting.
7. Set it to **Private** (only you/your org can see and install it). Save.

Direct link (replace publisher and extension if needed):  
[https://marketplace.visualstudio.com/manage/publishers/SKConsultingSA/extensions/skc-vs-tools/hub](https://marketplace.visualstudio.com/manage/publishers/SKConsultingSA/extensions/skc-vs-tools/hub)

### 3. Private vs public

- **Private:** Not listed in marketplace search; only people with the direct link or install ID can install (e.g. `ext install SKConsultingSA.skc-vs-tools` if you share it).
- **Public:** Listed and searchable for everyone.

If you previously set the extension to Public, use the same **Details** / **Hub** page and switch it back to **Private**.
