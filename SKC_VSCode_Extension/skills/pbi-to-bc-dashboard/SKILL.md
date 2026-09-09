---
name: pbi-to-bc-dashboard
description: 'Replicate a Power BI report (.pbit/.pbix) as a native Business Central AL control-addin dashboard. Use when converting a PBI report into BC, building an in-page HTML/JS dashboard from BC data, mirroring PBI pages as tabs, replicating PBI slicers as filters, matching tableEx columns, or reproducing PBI card visuals as KPI tiles. Triggers on ".pbit", ".pbix", "Power BI report in BC", "replicate Power BI", "dashboard control addin", "VAT report dashboard", or any request to turn a PBI layout into an AL extension.'
---

# Power BI → Business Central Dashboard Replication

Convert a Power BI report into a native BC AL **control-addin dashboard** that reads BC data directly (no Power BI service dependency). The result is a self-contained HTML/CSS/JS widget hosted on a BC page, populated by an AL codeunit through a temporary buffer table and, when client-side Excel export is in scope, exported to styled Excel from `dashboard.js` using a local browser library.

## When This Skill Applies

Load this skill when the user wants to:
- Turn a `.pbit` / `.pbix` report into a BC extension dashboard
- Mirror PBI **report pages** as **tabs** in a single BC page
- Reproduce PBI **slicers** (date/value filters) as interactive filters inside the addin
- Match PBI **tableEx** visuals (column set + order) in an HTML table
- Reproduce PBI **card** visuals as KPI tiles
- Keep the look-and-feel (titles, grouping, color theme) of a PBI report in BC

## Core Architecture (6 core assets; add 1 optional local Excel library asset when client-side Excel export is required)

```
src/<Area>/Dashboards/
├── <Name>DashLine<Suffix>.table.al        # Temporary BUFFER table — one row per data line
├── <Name>Data<Suffix>.codeunit.al         # Reads BC tables → populates buffer → builds JSON
├── <Name>Dash<Suffix>.controladdin.al     # Declares JS/CSS + events (data in, interactions out)
├── <Name>Dash<Suffix>.page.al             # Hosts the addin; date state; if export is implemented in JS, omit any separate page-level Excel action
└── ControlAddins/<Name>Dash/
    ├── lib/exceljs.min.js                  # Optional local browser Excel library (include only if styled client-side .xlsx export is needed)
    ├── dashboard.js                        # Renders tabs, KPIs, table from JSON; client-side filtering
    └── dashboard.css                       # Theme, layout, responsive sizing, table toolbar/buttons
```

**Data flow:** BC tables → codeunit `PopulateBuffer()` → temp buffer table → `BuildJson()` → control addin `LoadData(json)` → `dashboard.js render()` → tabs + KPIs + table. Tab switching, slicer filtering, and optional Excel export happen **client-side in JS** against the already-loaded JSON buffer (no round-trip to BC for export).

## Workflow

### Phase 1 — Extract & analyze the PBI source
Run the bundled script to unzip the `.pbit`/`.pbix` and decode its layout:

```powershell
pwsh ./scripts/extract-pbit.ps1 -PbitPath "C:\path\Report.pbit" -OutDir ".\PowerBi_pbit\extracted"
```

If the file is a `.pbix` rather than `.pbit`, the `DataModelSchema` member may be compressed or absent (the model is embedded as a binary `.abf`). In that case, skip `DataModelSchema` extraction and rely on the `Report/Layout` member only for page/visual structure; collect measure definitions manually from the user.

The `.pbit` is a ZIP. The two important members:
- `DataModelSchema` — UTF-16LE JSON: tables, columns, **measures (DAX)**. Source of computed fields.
- `Report/Layout` — UTF-16LE JSON: `sections` (pages), each with `visualContainers` and `filters`.

If no `.pbit`/`.pbix` file is available, collect a manual inventory from the user before continuing:
1. Report page names.
2. Per-page filter column names and values.
3. Visual types per page (`tableEx` columns, KPI/card measures, slicers).
Use this manually gathered inventory in place of extracted JSON for Phase 2 mapping.

Decode per-page filters with:
```powershell
$layout = Get-Content ".\extracted\Report\Layout" -Encoding Unicode -Raw | ConvertFrom-Json
$layout.sections | ForEach-Object {
    Write-Host "PAGE: $($_.displayName)"
    Write-Host "FILTERS: $($_.filters)"   # JSON array of column filters + values
}
```

Build an inventory before writing any AL (see `references/pbi-mapping.md`):
1. **Pages** → list every `section.displayName` (these become tabs).
2. **Per-page filters** → the exact column + values each page filters on (these define each tab's filter predicate).
3. **Visuals per page** → `tableEx` (column list + order), `card`/`multiRowCard` (KPI measures), `slicer` (interactive filter).
4. **Measures** → DAX expressions for any computed column (currency conversion, ROE diff, etc.).

Hard stop rule: for `.pbit`, both `DataModelSchema` and `Report/Layout` must be successfully decoded and parsed before Phase 2 begins. If either fails, stop entirely — do not proceed with the successfully decoded member alone. Report exactly which member failed and why. For `.pbix`, `Report/Layout` must still decode successfully; if `DataModelSchema` is compressed or absent, do not invent it — collect the missing measure inventory manually before continuing. In all cases, do not proceed to Phase 2 until a complete inventory (pages, filters, visuals, measures) is confirmed. Ask the user to re-export the `.pbit` or provide the missing inventory items manually.

### Phase 2 — Map PBI → BC primitives

| Power BI concept | BC dashboard equivalent |
|------------------|-------------------------|
| Report page (`section`) | Tab button in JS `TABS[]` |
| Page-level filter | Tab's `{type, bus, prod}` predicate in `tabLines()` |
| `slicer` visual (date) | `renderDateFilter()` panel → `OnDateFilterChanged` event → BC re-query |
| `slicer` visual (value list / categorical) | Client-side filter control in JS; prefer dropdown or autocomplete; for per-column value filtering use `columnFilters` state + PBI-style checkbox panel (see Critical Patterns) |
| `pivotTable` / matrix visual | Hierarchical matrix in JS with grouped rows + drill state (`visibleLevel`, `scopePath`, `selectedPath`, `expandMode`, `pendingAction`, `expandedPaths`, `collapsedPaths`, `autoExpand`) |
| Matrix expand/collapse toolbar | Fixed-order drill buttons: `↑` drill up, `↓` drill-down mode, `⇩` go to next level, `⇊` expand-one-level mode, `Auto expand` toggle — all `pivot-nav-btn`, armed state via `is-active` |
| `tableEx` visual | `COL_DEFS[]` ordered column array → HTML table |
| Table action / export affordance | Right-aligned toolbar buttons inside `.detail-section` above the grid when client-side export is in scope |
| `card` / KPI visual | KPI tile in `buildKpiSection()` |
| DAX measure | AL computation in codeunit `PopulateBuffer()` |
| Report title / theme | Header HTML + CSS color vars |
| Export to Excel | Optional client-side workbook generation from `tabLines()` / `allLines` using a local browser library |

### Phase 3 — Build the dashboard assets
Use the patterns in `references/al-patterns.md` and `references/js-patterns.md`. Read project `app.json` first for **suffix**, **namespace**, and **ID range**. The 6 core assets are the table, codeunit, control addin, page, `dashboard.js`, and `dashboard.css`; add `lib/exceljs.min.js` only when client-side Excel export is in scope. If `app.json` is not available or is missing the suffix, namespace, or ID range, stop and ask the user to provide these three values explicitly before generating any AL file. Do not invent or default these values.

### Phase 4 — Validate
- `get_errors` on all `.al` files (zero errors before done).
- Confirm the **"All Entries"** default tab shows data — if it does but individual tabs are empty, the tab predicates don't match the real BC codes (see Pitfalls).
- Verify the addin fills width and the table's horizontal scrollbar is visible.
- If add-in Excel export is implemented, verify the toolbar buttons appear above the grid on the right, the **selected tab** export matches the visible rows/totals, and the **all tabs** export produces one worksheet per tab with workbook-equivalent styling.

## Critical Patterns (condensed)

### Always apply (all projects)

**Buffer table** — temporary, one field per JSON property you emit. Include fields even if not all are populated yet.

**Codeunit** — `GenerateDashboardJson(StartDate, EndDate, Filter)` orchestrates `PopulateBuffer()` then `BuildJson()`. Join lookup tables (posting setup, customer/vendor) during populate. Emit ISO dates: `Format(D, 0, '<Year4>-<Month,2>-<Day,2>')`.

**Control addin** — `HorizontalStretch = true; VerticalStretch = true;` and **NO** `RequestedWidth`/`MaximumWidth` (fixed widths stop it filling the frame). Events: `OnReady`, `OnDateFilterChanged(start, end)`; procedures: `LoadData(json)`, `PrintDashboard()`.

**Page** — keep `StartDate`/`EndDate` as internal vars driven by the addin's `OnDateFilterChanged` (the embedded slicer replaces visible BC filter fields). `ParseISODate()` converts `YYYY-MM-DD` back to AL `Date`.

**dashboard.js** — `TABS[]` with explicit filter predicates; `ALL_KEY` default tab so data is always visible; every tab button gets `data-key` attribute; `tabLines()` filters the buffer; `COL_DEFS[]` defines column order/labels/formatters; `renderDateFilter()` embeds the slicer. For tab captions/titles, prefer a helper like `tabCaption(t) => t.key + ' - ' + t.full` and use it consistently for both tab button text and active-tab title.

**Currency-aware totals** — when a table/export sheet contains a `Currency` column, group footer/export totals by currency for **document-currency** amount fields. For **LCY/base-currency** amount fields (field names commonly ending in `LCY`, such as `remainingAmtLCY`, `amountLCY`, bucket totals in LCY), group the value under the actual local currency code retrieved from the ERP setup metadata, not under each row's document currency. In JS, use separate helpers such as `getCurrencyKey(row)` for document-currency amounts and `getLocalCurrencyKey()` / `getCurrencyKeyForAmount(row, amountKey)` for LCY-aware totals. This prevents converted/base-currency totals from appearing under EUR/GBP/etc. when the value is actually in the local currency.

**Matrix / hierarchy dashboards** — when the PBI source uses `pivotTable` or a drillable matrix, model the hierarchy explicitly in JS and match the actual **Rows** well per visual/tab rather than assuming one hierarchy fits all tabs. Different pages in the same report may require different drill paths (for example one tab might be `Customer → Document`, while another is `Currency → Customer → Document → Posting Date → Due Date`). Track client-side drill state with values such as `visibleLevel`, `scopePath`, `selectedPath`, `expandMode`, `pendingAction`, `expandedPaths`, `collapsedPaths`, and `autoExpand`. Expose Power BI-like navigation actions for **drill up**, **drill down**, **go to next level**, and **expand down one level**.

Keep the pivot toolbar button **set, order, and styling identical across related dashboards** (for example a Customer and a Vendor aging dashboard). Canonical left-group order: `↑` drill up, `↓` select drill-down mode, `⇩` go to next level, `⇊` select expand-one-level mode, `Auto expand`. Use the `pivot-nav-btn` class on every navigation button and mark the armed state with `is-active` (not `active`). Do not add immediate-acting drill/expand variants to only one of two sibling dashboards — it breaks toolbar parity and shifts button positions. When you add or fix a behavior on one dashboard, apply the same change to its sibling so they do not drift apart.

When matching Power BI interaction, support both:
- direct click-to-drill on the hierarchy cell, and/or
- an action-first mode where the user arms a drill action from the toolbar and then clicks a row to apply it.

If you implement the action-first model, show a visible pending-action hint/banner so the user knows the next row click will perform drill or expand.

**Auto expand toggle** — an `Auto expand` button means **expanded by default**, not **locked fully expanded**. While it is on: expand all rows by default, but keep the per-row `+`/`−` toggle and all toolbar buttons enabled so the user can still collapse/re-expand individual rows. Track individual collapses in a per-tab `collapsedPaths` map (a row is expanded unless its path is in `collapsedPaths`), reset `collapsedPaths` whenever the toggle flips, and clear any armed pending action when turning it on.

**KPI filter context** — when a dashboard shows KPI cards together with slicers or client-side filters, the KPI totals should usually be recalculated from the **same filtered rows currently visible in the active filter context**. Do not keep KPI cards bound only to the original server payload (`currentData.kpi`) if the table/matrix is being narrowed client-side by slicers such as customer, posting group, year, quarter, or tab-specific row filters. Prefer a pattern where client-side filters produce `tabRows` / filtered rows first, then a recalculated KPI object is derived from those rows and passed to the KPI renderer.

**Selection-style slicers** — when a slicer is backed by a reasonably small distinct-value set already present in the loaded JSON (for example posting group, year, quarter, customer name), prefer dropdowns or autocomplete/datalist controls populated from that loaded dataset over free-text inputs. This reduces typo-driven empty results and more closely mirrors Power BI slicer behavior.

**dashboard.css** — use a single page padding token (e.g. `--page-pad: 16px`) and keep it equal on all sides (`body { padding: var(--page-pad) }`). Prefer a flex layout for stable viewport fit: `#dashboard-root` + `.dashboard-inner` fill height, and `.detail-section/.table-scroll` use `flex:1; min-height:0` with `.table-scroll { margin-bottom: var(--page-pad) }`.

**render() and floating overlays** — when `init()` sets `root = document.body`, never use `root.innerHTML = ''` inside `render()` — it destroys ALL body children including floating overlay panels. Instead, swap only the `#dashboard-root` element:
```js
var existingDashRoot = document.getElementById('dashboard-root');
if (existingDashRoot && existingDashRoot.parentNode === root) {
    root.replaceChild(dashRoot, existingDashRoot);
} else {
    root.innerHTML = '';
    root.appendChild(dashRoot);
}
```
In `setLoadingState`/`setErrorState` (which still need full body wipe), call `closeOverlay()` / `closeColFilterPanel()` **before** `root.innerHTML = ''`. All floating overlays (filter panels, context menus, tooltips) must be appended directly to `document.body` and declared with `position: fixed` — **never** `position: absolute` inside a BC control-addin iframe. Use `getBoundingClientRect()` for positioning (already viewport-relative for `fixed`; do not add `window.scrollY` / `window.scrollX`).

**Per-column value filters (PBI Basic Filtering)** — replicate Power BI's per-column header checkbox filter panel for all flat-table tabs:

*State model (persist with other prefs):*
```js
var columnFilters = {}; // { [tabKey]: { [colKey]: string[] | null } }
// null = all values shown; string[] = inclusion list of allowed values
```

*Applying filters:* call at the **end** of `filterRowsForTab`, after all other filters:
```js
var tabCf = columnFilters[tabKey];
if (tabCf) {
    Object.keys(tabCf).forEach(function (colKey) {
        var allowed = tabCf[colKey];
        if (!allowed || !allowed.length) return;
        var set = {}; allowed.forEach(function(v) { set[v] = true; });
        filtered = filtered.filter(function(r) { return !!set[getRowDisplayValue(colKey, r)]; });
    });
}
```

*`getRowDisplayValue(colKey, row)`:* use `fmtDate()` for date fields, `getCurrencyKey()` for currency fields, `String()` for everything else.

*`getUniqueColValues(colKey)`:* scan `allRows` (server-filtered, pre-column-filter), return `[{value, count}]` sorted alphabetically.

*Filter button in `<th>`:*
- Place on the **LEFT** of the column label: `th.insertBefore(cfBtn, th.firstChild)`
- Icon: outlined SVG funnel — `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 2h12L9 7v5l-4-2V7Z"/></svg>`
- Color: **never** `var(--muted)` on a dark `<th>` background — use `rgba(255,255,255,0.55)` at rest, `#fff` on hover and active
- Active state: `th` gets class `.col-filtered` (tinted background); button gets `.is-active`

*Panel structure* (`position: fixed`, appended to `document.body`):
1. Header row — column name + `×` close button (dark primary background)
2. Summary line — e.g. `"13 of 14 selected"` or `"is Afarak Group SE, Carbomax AB"`
3. "FILTER TYPE" label + `"Basic filtering"` chip (static, no interaction needed)
4. Search `<input>` — real-time substring filter on the value list
5. Select-all `<label><input type="checkbox">` — supports `indeterminate` state when partially selected
6. Scrollable `<div class="col-filter-list">` — one `<label>` row per unique value: `[checkbox][value text][count badge]`

*Outside-click cleanup:* store the listener as `panel._closeListener = fn` and always call `document.removeEventListener('click', panel._closeListener)` inside `closeColFilterPanel()` to prevent stale listeners after re-renders.

*KPI cards* — automatically reflect column filters because the KPI builder reads from the same `tabRows` produced by `filterRowsForTab`.

*Sibling sync* — when adding this feature to one dashboard (e.g. Customer aging), immediately apply the **identical** state model, UI, and CSS to all sibling dashboards (e.g. Vendor aging). The `columnFilters` namespace, prefs key, and panel structure must match exactly.

**Design/UI hardening**
- Keep **consistent page margins**: use one spacing token for top/right/bottom/left (default `16px`) and bind bottom spacing to the same token.
- Use **full tab captions with code/key** by default (not abbreviated labels): `"<Code> - <Full Label>"` (example: `901 - Purchases of Goods with 19% German VAT – Code 901`). Apply the same format to the active tab title.
- Use **filter-style tab group separators** for Sales/Purchase sections: style the tab container like a filter panel (border + radius) and render each group label as a full-width colored header strip (same visual language as `.date-filter-header`) for clearer grouping.
- For parameter panels (like ROE), render controls in a **responsive CSS grid** (`repeat(auto-fit, minmax(...))`) instead of long wrapped inline rows.
- Ensure wide tables always expose horizontal navigation:
    - `.table-scroll { overflow: auto; scrollbar-gutter: stable; }`
    - `.detail-table { width: max-content; min-width: 100%; }`
    - Avoid nested horizontal scroll containers (root should not also scroll horizontally), otherwise left/right scrollbar arrow zones can be clipped.
- Prefer **layout-driven sizing** over host-force resizing:
    - avoid aggressive `Microsoft.Dynamics.NAV.ResizeControl` calls from JS for normal rendering
    - use flex sections so table area adapts naturally on window resize.

### Apply only when client-side Excel export is in scope

**Control addin** — declare a local browser library with `Scripts = '.../lib/exceljs.min.js'` **before** `StartupScript`. Prefer a vendored local asset over CDN references.

**Page** — when the standard path is client-side export in `dashboard.js`, remove the old page-level `Export to Excel` action instead of duplicating export entry points in AL and JS. If export is instead handled by an AL codeunit action on the page, omit the JS toolbar entirely.

**dashboard.js** — add a `buildTableToolbar()` helper with **right-aligned** buttons above the grid (for example `Export selected tab`, `Export all tabs`) and generate the workbook from `tabLines()` / `allLines` so exported data matches the loaded dashboard state.

**dashboard.css** — when export buttons exist, style them as a non-printing table toolbar above the grid; do not use absolute positioning that can break the scroll/flex layout.

**Design/UI hardening**
- When the `.xlsx` export is implemented entirely in `dashboard.js` using `exceljs` (the standard path), place the actions in a right-aligned toolbar above the table (`.table-toolbar-right`) and hide that toolbar in `@media print`. If export is instead handled by an AL codeunit action on the page, omit the JS toolbar entirely.
- For styled Excel export, aim for **workbook-equivalent styling** rather than pixel-perfect HTML reproduction: dark header rows, bold white header text, banded rows, right-aligned numeric columns, red negatives, frozen header row, autofilter, and emphasized totals row.

## Common Pitfalls (learned the hard way)

1. **Empty individual tabs** — PBI pages filter on real BC codes (e.g. VAT Bus.+Prod. Posting Group like `DE-LOC`, `ITEM`), **not** the numeric page label (`928`). Extract the actual filter values from `Report/Layout` and use them as the tab predicate. Always provide an **All** tab as a diagnostic.
2. **Tab active-state broken** — toggle by `data-key` attribute, never by array index.
3. **Addin won't fill width** — remove `RequestedWidth`/`MaximumWidth`; rely on `HorizontalStretch`. Ensure every wrapper is `width:100%; min-width:0`.
4. **Scrollbar clipped or missing at bottom** — keep balanced page padding, enable `scrollbar-gutter`, and set table width strategy to `max-content + min-width:100%`.
5. **Missing column data** — some PBI columns (Quantity, Unit of Measure, Line No.) live on posted document lines, not the entry table. Either join those tables in `PopulateBuffer()` or omit the columns.
6. **Unpopulated buffer field** — a field can exist in the table + JSON but never be `:=` assigned (e.g. forgetting to read `VATPostingSetup.Description`). Audit every `COL_DEFS` key against an assignment in the codeunit.
7. **Date round-trip** — emit ISO `YYYY-MM-DD` from AL; parse the same format back in `ParseISODate()`; debounce the JS `change` handler (~600ms) before invoking the BC event.
8. **Large blank space / poor frame fit** — do not rely on hardcoded `calc(100vh - Npx)` table heights; use flex growth with `min-height:0` and equal bottom margin token.
9. **Ambiguous/short tab labels** — avoid label-only captions like `Purch. Goods 19%(1)` when a full business caption exists. Prefer `Code + Full Label` to preserve PBI parity and user clarity.
10. **Weak tab section separation** — if Sales/Purchase boundaries are visually unclear, apply filter-style section headers (full-width strip per group) rather than only subtle spacing or thin lines.
11. **Server-side export drift** — if the old AL `Excel Buffer` action remains while the add-in also exports, users can get two different datasets. Prefer **one export path**; if the add-in owns export, remove the old page action/codeunit export procedures.
12. **Export doesn’t match the visible tab** — do not re-query data server-side for a selected-tab export. Build the workbook from `tabLines()` / `allLines` so the downloaded rows match what the user sees.
13. **CDN dependency in BC web client** — do not depend on external script URLs for workbook generation. Vendor the browser bundle locally under the add-in assets and load it through the control add-in `Scripts` property.
14. **Toolbar breaks table scroll/flex** — avoid absolute/fixed positioning for export buttons. Keep the toolbar in normal flow above `.table-scroll` so the horizontal scrollbar remains reachable.
15. **Matrix drill UX feels wrong** — if a Power BI matrix is replicated only with toolbar drill buttons, users lose the expected direct-interaction flow. Make the hierarchy position/label clickable for drill-down and add breadcrumbs for fast scope navigation.
16. **Free-text slicers cause avoidable misses** — posting groups, quarters, and similar bounded dimensions should usually be rendered as dropdowns; customer name is often better as autocomplete than as plain text.
17. **AL identifier length can bite generated object names** — Business Central AL identifiers must stay within 30 characters. Long dashboard names often need shortened buffer object names even when the page/codeunit captions remain user-friendly.
18. **Reused hierarchy across tabs can be wrong** — if one tab is fixed to LCY/USD and another is multi-currency, do not force both to start at `Currency`. Match the Power BI row well per tab.
19. **Matrix totals don’t match PBI because zero rows remain** — if the Power BI visual has a filter like `Remaining Amount is not 0`, mirror that on the corresponding dashboard tabs (often only selected matrix views, not every tab globally).
20. **KPI cards don’t match the filtered grid** — if slicers are applied client-side but KPI cards still read from the original AL payload totals, the cards will not match what the user sees. Recompute KPI values from the currently filtered rows whenever Power BI would evaluate the cards in that same filter context.

21. **`root = document.body` destroys floating overlays on every render** — when `init()` sets `root = document.body`, any `root.innerHTML = ''` call wipes ALL body children including filter panels and context menus appended to `document.body`. Fix: in `render()` use `root.replaceChild(dashRoot, existingDashRoot)` to swap only the `#dashboard-root` element; call the overlay close function at the top of `setLoadingState`/`setErrorState` before they wipe the body. Floating overlays must use `position: fixed` (never `position: absolute`) — `getBoundingClientRect()` already returns viewport-relative coords for fixed, so never add `window.scrollY/scrollX` offsets.
22. **PBI-style column filter panel — panel never appears or disappears immediately** — two failure modes: (a) the panel is created but `root.innerHTML = ''` inside `render()` destroys it the moment a checkbox triggers `setColFilterAllowed()` → `render()` (fix: see pitfall 21 — use `replaceChild`); (b) the panel renders off-screen because `position: absolute` + `window.scrollY` math is wrong in a control-addin iframe where `scrollY` is always 0 (fix: use `position: fixed` and drop all `scrollY`/`scrollX` offsets). State model: `columnFilters = { [tabKey]: { [colKey]: string[] | null } }`. Store the outside-click listener as `panel._closeListener` so it is removed when the panel is explicitly closed. Apply to ALL sibling dashboards simultaneously.

23. **Filter / action icons invisible on dark header backgrounds** — table `<th>` elements typically have a dark background (`var(--primary)`). Setting `color: var(--muted)` on a button inside a `<th>` makes the icon invisible. Use explicit white values: `color: rgba(255,255,255,0.55)` at rest, `color: #fff` on hover and active. Use `rgba(255,255,255,…)` for hover/active borders and backgrounds — `var(--border)` and `var(--surface)` are calibrated for light backgrounds. Use `stroke="currentColor"` on inline SVG icons so the `color` CSS rule propagates to the stroke automatically. Recommended funnel SVG (14×14): `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 2h12L9 7v5l-4-2V7Z"/></svg>`
## References
- `references/pbi-mapping.md` — full PBI→BC mapping, extraction details, inventory checklist
- `references/al-patterns.md` — buffer table, codeunit, controladdin, page code templates
- `references/js-patterns.md` — TABS, tabLines, COL_DEFS, KPI, date-filter, CSS sizing templates
- `scripts/extract-pbit.ps1` — unzip + decode helper
