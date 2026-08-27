# Publishing SKC AL Tools to the Marketplace

SKC AL Tools is a **public** product:

- Source: [SK-Consulting-S-A/skc-bc-internal-tools](https://github.com/SK-Consulting-S-A/skc-bc-internal-tools) (public)
- Marketplace: [SKConsultingSA.skc-vs-tools](https://marketplace.visualstudio.com/items?itemName=SKConsultingSA.skc-vs-tools) (public, searchable)
- Install: VS Code Extensions view, or `ext install SKConsultingSA.skc-vs-tools`

Publisher **ID** is `SKConsultingSA` (do not change; it is the extension identity). Display name on Marketplace can be **SK Consulting S.A.**

Keep visibility **Public** after each publish. A first-time `vsce publish` of a *new* extension ID defaults to private; this listing is already public and must stay that way.

## How to publish

- **Local:** Put your Azure DevOps PAT in `.publish-token`, then run:
  - `node scripts/publish.js` — publish current version
  - `node scripts/publish.js minor` — bump minor version and publish
  - `node scripts/publish.js patch --pre-release` — bump patch and publish as pre-release
- **CI:** Use the **Publish Extension** GitHub Action (see [.github/workflows/publish-extension.yml](.github/workflows/publish-extension.yml)). Add repository secret **`VSCE_PAT`** (your Azure DevOps PAT with Marketplace → Manage). Run the workflow manually or on GitHub release.

PAT: [Azure DevOps → User settings → Personal access tokens](https://dev.azure.com) — scope **Marketplace (Manage)**.

Hub: [publisher management](https://marketplace.visualstudio.com/manage/publishers/SKConsultingSA/extensions/skc-vs-tools/hub)

---

## Installation analytics and countries

The **Visual Studio Marketplace** does **not** expose installation breakdown by country or region in its publisher reports. The [publisher management page](https://marketplace.visualstudio.com/manage) gives:

- **Acquisition trend** over time  
- **Total acquisition** count  
- **Ratings & reviews**  

To see them: open your publisher → extension → **More Actions → Reports**. There is no built-in geography/country view.

### Option: track installation countries yourself

If you need country (or region) data, you have to collect it in your own extension and backend:

1. **Opt-in only** – Respect privacy: ask for consent (e.g. a setting like “Send anonymous usage to help improve the extension”) and only send data when the user agrees.
2. **Minimal data** – Send only what you need, e.g. a one-time or rare “install/active” event with:
   - **Country or region** (e.g. from a server-side geo-by-IP or from the client using a timezone → rough region; avoid sending raw IP).
   - **Extension version** (optional).
   - No user IDs, no PII.
3. **Backend** – A small service (e.g. Azure Function, or your own API) that:
   - Receives the ping (e.g. POST with `{ "country": "LU", "version": "1.7.0" }`).
   - Derives country server-side from the request IP if you don’t send it from the client (then don’t store the IP).
   - Stores aggregated counts by country (and optionally by version) in a DB or storage.
4. **Docs** – Mention this in your privacy policy / README (what you collect, that it’s optional, and how it’s aggregated).

Implementing this would mean: a new setting (e.g. `skc.allowAnonymousUsageStats`), a one-time or low-frequency ping on activation when the setting is true, and your backend + storage to view installation countries.
