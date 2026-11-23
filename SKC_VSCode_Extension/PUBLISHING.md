# Publishing SKC Workstation Tools to the Marketplace

SKC Workstation Tools is a **public** product:

- Source: [SK-Consulting-S-A/skc-bc-vscode-tools](https://github.com/SK-Consulting-S-A/skc-bc-vscode-tools) (public)
- Marketplace: [SKConsultingSA.skc-vs-tools](https://marketplace.visualstudio.com/items?itemName=SKConsultingSA.skc-vs-tools) (public, searchable)
- Install: VS Code Extensions view, or `ext install SKConsultingSA.skc-vs-tools`

Publisher **ID** is `SKConsultingSA` (do not change; it is the extension identity). Display name on Marketplace can be **SK Consulting S.A.**

Keep visibility **Public** after each publish. A first-time `vsce publish` of a *new* extension ID defaults to private; this listing is already public and must stay that way.

## How to publish

**CI is the only publish path.** Actions → **Publish SKC VS Code Extension** → *Run workflow*
(see [.github/workflows/publish-extension.yml](.github/workflows/publish-extension.yml)). The
workflow takes an optional version bump and a pre-release flag, and authenticates with the
repository secret **`VSCE_PAT`**.

`node scripts/publish.js` refuses to run outside CI and no longer reads a `.publish-token` file.
That is deliberate. Publishing from a workstation skips the pull request, the review, and the
publish gate, and it leaves no trace in the repo — so the Marketplace can move ahead of `main`
without anyone noticing, and unreviewed files reach every installed copy. It has happened.

To build a `.vsix` locally for inspection, without publishing: `npm run package`.

BCQuality is bundled and validated offline; live upstream refresh is opt-in through
`skc.bcQualityUpdateOnApply` or the explicit update command.

PAT: [Azure DevOps → User settings → Personal access tokens](https://dev.azure.com) — scope **Marketplace (Manage)**.

### Icon quota: Marketplace updates blocked until about August 2027

Since October 2026 the Marketplace ([microsoft/vsmarketplace#2216](https://github.com/microsoft/vsmarketplace/discussions/2216))
rejects icons over 1 MB or 1024 × 1024, and allows only 3 icon changes per rolling year.
Re-uploading the same icon does not count as a change.

- The icon live on 3.3.1 is 1254 × 1254 and 1.6 MB. It can't be re-uploaded, so any
  compliant icon counts as a change.
- Three changes were already used in August and September 2026, so the quota is full until
  the oldest one expires, around 27 August 2027. Marketplace support declined an exception.
- `assets/Small_Logo.png` on `main` is the compliant 256 × 256 PNG. Don't change it again:
  every new file uses up the quota.

Until then, releases ship as a `.vsix` attached to a GitHub release (for example
[v3.4.0](https://github.com/SK-Consulting-S-A/skc-bc-vscode-tools/releases/tag/v3.4.0)).
Build it the way CI does (a `git archive` of HEAD with `vscode:prepublish` removed), so the
package matches `main` exactly. Publishing a GitHub release also starts the publish workflow;
cancel that run, because it can only fail on the icon quota.

### The publish gate

`npm run check:publishable` runs in CI, on every pull request, and from `vscode:prepublish` and
`npm run package`. It fails the build when:

- a directory under `skills/` or a file under `agents/` is not on the allowlist in
  [scripts/check-publishable.js](scripts/check-publishable.js);
- a script looks like a home-folder content sync, or a `package.json` script reads `~/.copilot`
  or `~/.cursor`;
- `presets/settings.json` sets a workstation preference that Apply Presets would write globally
  on the user's machine (disabling Copilot, weakening the workspace trust prompt, and the like);
- a file matches a pattern from the optional `PUBLISH_DENY_PATTERNS` repository secret. Those
  patterns are supplied by the environment rather than committed, so the strings being screened
  for are not themselves published here. Failures report the file only, never the match.

Adding a name to an allowlist is the moment someone confirms the bundle holds nothing internal.
Everything under `skills/` is force-included by `.vscodeignore` (`!skills/**`), so a stray
directory ships to the Marketplace.

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
