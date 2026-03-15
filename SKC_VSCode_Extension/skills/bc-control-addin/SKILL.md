# BC Control Addin — Professional ERP Visual Design Skill

## When This Skill Applies

Load this skill when:
- Creating or updating a Business Central `controladdin` AL object
- Implementing HTML/CSS/JS files for a BC control addin
- The user asks for charts, KPI tiles, dashboards, visual components, or interactive widgets in BC

---

## AL Control Addin Declaration Pattern

```al
controladdin "MyAddin<Suffix>"
{
    RequestedHeight = 300;
    MinimumHeight = 200;
    MaximumHeight = 600;
    RequestedWidth = 0;         // 0 = fill available width
    MinimumWidth = 400;
    VerticalStretch = true;
    HorizontalStretch = true;

    Scripts = [
        'Scripts/vendor/chart.umd.min.js',  // only if charting needed
        'Scripts/addin.js'
    ];
    StyleSheets = ['Stylesheets/addin.css'];
    StartupScript = 'Scripts/startup.js';

    // Lifecycle
    event ControlAddInReady();

    // Data in
    procedure SetData(JsonData: Text);
    procedure SetTheme(IsDarkMode: Boolean);

    // Events out (user interactions)
    event OnItemSelected(ItemId: Text);
    event OnActionClicked(ActionId: Text);
}
```

## AL Page Usage Pattern

```al
usercontrol(MyAddin; "MyAddin<Suffix>")
{
    ApplicationArea = All;

    trigger ControlAddInReady()
    begin
        CurrPage.MyAddin.SetData(GetJsonData());
    end;

    trigger OnItemSelected(ItemId: Text)
    begin
        // handle selection
    end;
}
```

---

## Design System: ERP Professional Style

### Core Principles
- **Data-dense but readable** — ERP users scan large amounts of information; every pixel matters
- **Fluent Design inspired** — align with Microsoft's design language used in BC itself
- **Subtle polish** — micro-animations, smooth transitions, refined shadows; never flashy
- **Theme-aware** — support BC light and dark themes via CSS custom properties
- **Accessible** — WCAG 2.1 AA minimum; keyboard navigable, sufficient contrast

### Color Tokens (CSS Custom Properties)

```css
:root {
    /* Inject these from AL via SetTheme() or detect from parent */
    --addin-primary:       #0078D4;   /* Fluent blue */
    --addin-primary-hover: #106EBE;
    --addin-success:       #107C10;
    --addin-warning:       #D83B01;
    --addin-error:         #A80000;
    --addin-info:          #0078D4;

    /* Neutrals */
    --addin-bg:            #FFFFFF;
    --addin-bg-secondary:  #F3F2F1;
    --addin-bg-tertiary:   #EDEBE9;
    --addin-border:        #E1DFDD;
    --addin-border-strong: #C8C6C4;

    /* Text */
    --addin-text-primary:   #201F1E;
    --addin-text-secondary: #605E5C;
    --addin-text-disabled:  #A19F9D;
    --addin-text-inverse:   #FFFFFF;

    /* Shadows */
    --addin-shadow-sm: 0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.06);
    --addin-shadow-md: 0 4px 6px rgba(0,0,0,.07), 0 2px 4px rgba(0,0,0,.05);
    --addin-shadow-lg: 0 10px 15px rgba(0,0,0,.06), 0 4px 6px rgba(0,0,0,.04);
}

[data-theme="dark"] {
    --addin-bg:            #1B1A19;
    --addin-bg-secondary:  #252423;
    --addin-bg-tertiary:   #323130;
    --addin-border:        #3B3A39;
    --addin-border-strong: #484644;
    --addin-text-primary:  #F3F2F1;
    --addin-text-secondary:#C8C6C4;
    --addin-text-disabled: #797775;
}
```

### Typography

```css
body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: var(--addin-text-primary);
    background: var(--addin-bg);
    margin: 0;
    padding: 0;
    -webkit-font-smoothing: antialiased;
}

.text-xs    { font-size: 11px; }
.text-sm    { font-size: 12px; }
.text-base  { font-size: 14px; }
.text-lg    { font-size: 16px; }
.text-xl    { font-size: 20px; }
.text-2xl   { font-size: 24px; font-weight: 600; }
.text-3xl   { font-size: 32px; font-weight: 700; }

.font-medium  { font-weight: 500; }
.font-semibold{ font-weight: 600; }
.font-bold    { font-weight: 700; }

.text-secondary { color: var(--addin-text-secondary); }
.text-muted     { color: var(--addin-text-disabled); }
```

---

## Component Library

### KPI Tile

```html
<div class="kpi-tile">
    <div class="kpi-label">Total Revenue</div>
    <div class="kpi-value">€ 142,830</div>
    <div class="kpi-delta positive">
        <svg class="delta-icon" viewBox="0 0 16 16"><path d="M8 3l5 5H3z"/></svg>
        +12.4% vs last month
    </div>
    <div class="kpi-sparkline">
        <svg class="sparkline" viewBox="0 0 100 30" preserveAspectRatio="none">
            <polyline points="" class="sparkline-line"/>
        </svg>
    </div>
</div>
```

```css
.kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    padding: 12px;
}

.kpi-tile {
    background: var(--addin-bg);
    border: 1px solid var(--addin-border);
    border-radius: 6px;
    padding: 16px;
    box-shadow: var(--addin-shadow-sm);
    transition: box-shadow .15s ease, transform .15s ease;
    cursor: default;
}
.kpi-tile:hover {
    box-shadow: var(--addin-shadow-md);
    transform: translateY(-1px);
}

.kpi-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .05em;
    color: var(--addin-text-secondary);
    margin-bottom: 6px;
}
.kpi-value {
    font-size: 26px;
    font-weight: 700;
    color: var(--addin-text-primary);
    line-height: 1.1;
    margin-bottom: 6px;
    font-variant-numeric: tabular-nums;
}
.kpi-delta {
    font-size: 12px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 3px;
}
.kpi-delta.positive { color: var(--addin-success); }
.kpi-delta.negative { color: var(--addin-error); }
.kpi-delta.neutral  { color: var(--addin-text-secondary); }

.delta-icon { width: 12px; height: 12px; fill: currentColor; }

.sparkline { width: 100%; height: 30px; margin-top: 8px; }
.sparkline-line {
    fill: none;
    stroke: var(--addin-primary);
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: .7;
    vector-effect: non-scaling-stroke;
}
```

---

### Status Badge

```html
<span class="badge badge--success">Approved</span>
<span class="badge badge--warning">Pending</span>
<span class="badge badge--error">Overdue</span>
<span class="badge badge--info">Draft</span>
<span class="badge badge--neutral">Closed</span>
```

```css
.badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .02em;
    line-height: 18px;
    white-space: nowrap;
}
.badge--success  { background: #DFF6DD; color: #107C10; }
.badge--warning  { background: #FFF4CE; color: #8A5700; }
.badge--error    { background: #FDE7E9; color: #A80000; }
.badge--info     { background: #DEECF9; color: #0078D4; }
.badge--neutral  { background: var(--addin-bg-secondary); color: var(--addin-text-secondary); }
```

---

### Data Table

```html
<div class="table-container">
    <table class="data-table">
        <thead>
            <tr>
                <th class="sortable" data-col="no">No. <span class="sort-icon">↕</span></th>
                <th>Description</th>
                <th class="text-right">Amount</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody id="tableBody"></tbody>
    </table>
</div>
```

```css
.table-container {
    overflow-x: auto;
    border: 1px solid var(--addin-border);
    border-radius: 6px;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}

.data-table thead th {
    background: var(--addin-bg-secondary);
    padding: 10px 14px;
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .04em;
    color: var(--addin-text-secondary);
    border-bottom: 1px solid var(--addin-border-strong);
    white-space: nowrap;
    user-select: none;
}

.data-table thead th.sortable { cursor: pointer; }
.data-table thead th.sortable:hover { color: var(--addin-text-primary); }

.data-table tbody tr {
    transition: background .1s ease;
    border-bottom: 1px solid var(--addin-border);
}
.data-table tbody tr:last-child { border-bottom: none; }
.data-table tbody tr:hover { background: var(--addin-bg-secondary); }
.data-table tbody tr.selected { background: #DEECF9; }

.data-table tbody td {
    padding: 9px 14px;
    color: var(--addin-text-primary);
    vertical-align: middle;
}

.text-right { text-align: right; font-variant-numeric: tabular-nums; }
.text-mono  { font-family: 'Cascadia Code', 'Consolas', monospace; font-size: 12px; }
```

---

### Progress / Donut Chart (pure CSS + SVG, no library)

```html
<div class="donut-chart" role="img" aria-label="Completion: 68%">
    <svg viewBox="0 0 42 42" class="donut">
        <circle class="donut-hole" cx="21" cy="21" r="15.91549430918954"/>
        <circle class="donut-ring" cx="21" cy="21" r="15.91549430918954"
                fill="transparent" stroke-width="4"/>
        <circle class="donut-segment" cx="21" cy="21" r="15.91549430918954"
                fill="transparent" stroke-width="4"
                stroke-dasharray="68 32"
                stroke-dashoffset="25"/>
    </svg>
    <div class="donut-label">
        <span class="donut-value">68%</span>
        <span class="donut-caption">Complete</span>
    </div>
</div>
```

```css
.donut-chart {
    position: relative;
    width: 120px;
    height: 120px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
.donut { width: 100%; height: 100%; transform: rotate(-90deg); }
.donut-hole   { fill: var(--addin-bg); }
.donut-ring   { stroke: var(--addin-bg-tertiary); }
.donut-segment{
    stroke: var(--addin-primary);
    transition: stroke-dasharray .6s cubic-bezier(.4,0,.2,1);
}
.donut-label {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.1;
}
.donut-value   { font-size: 20px; font-weight: 700; }
.donut-caption { font-size: 10px; color: var(--addin-text-secondary); margin-top: 2px; }
```

---

### Loading Skeleton

```html
<div class="skeleton-grid">
    <div class="skeleton skeleton--tile"></div>
    <div class="skeleton skeleton--tile"></div>
    <div class="skeleton skeleton--tile"></div>
</div>
```

```css
@keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
}
.skeleton {
    background: linear-gradient(90deg,
        var(--addin-bg-secondary) 25%,
        var(--addin-bg-tertiary) 50%,
        var(--addin-bg-secondary) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s ease-in-out infinite;
    border-radius: 4px;
}
.skeleton--tile  { height: 100px; border-radius: 6px; }
.skeleton--line  { height: 14px; margin-bottom: 8px; }
.skeleton--line.short { width: 60%; }
```

---

## JS Communication Patterns

### startup.js — Bootstrap

```javascript
(function () {
    'use strict';

    // Called by BC after the addin iframe is ready
    window.initializeAddin = function () {
        Microsoft.Dynamics.NAV.InvokeExtensibilityMethod('ControlAddInReady', []);
    };

    // Detect BC theme
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);
    function syncTheme() {
        const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    }
    syncTheme();

    document.addEventListener('DOMContentLoaded', window.initializeAddin);
})();
```

### addin.js — Data Binding

```javascript
(function () {
    'use strict';

    // Called from AL: CurrPage.MyAddin.SetData(jsonText)
    window.SetData = function (jsonText) {
        try {
            const data = JSON.parse(jsonText);
            render(data);
        } catch (e) {
            console.error('SetData parse error:', e);
        }
    };

    window.SetTheme = function (isDark) {
        document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    };

    function fireEvent(name, args) {
        Microsoft.Dynamics.NAV.InvokeExtensibilityMethod(name, args);
    }

    function render(data) {
        // Build DOM from data, attach fireEvent callbacks
        // Example: row click fires OnItemSelected
        document.querySelectorAll('[data-item-id]').forEach(el => {
            el.addEventListener('click', () => {
                fireEvent('OnItemSelected', [el.dataset.itemId]);
            });
        });
    }
})();
```

---

## Layout Templates

### Dashboard Layout (KPI row + chart + table)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="../Stylesheets/addin.css">
</head>
<body>
    <div class="addin-root">
        <!-- KPI Row -->
        <div class="kpi-grid" id="kpiGrid">
            <div class="skeleton skeleton--tile"></div>
            <div class="skeleton skeleton--tile"></div>
            <div class="skeleton skeleton--tile"></div>
        </div>

        <!-- Chart + Table split -->
        <div class="content-split">
            <div class="panel" id="chartPanel">
                <div class="panel-header">
                    <span class="panel-title">Trend</span>
                </div>
                <div class="panel-body" id="chartBody"></div>
            </div>
            <div class="panel" id="tablePanel">
                <div class="panel-header">
                    <span class="panel-title">Details</span>
                    <input class="search-input" type="search" placeholder="Filter…" id="tableSearch"/>
                </div>
                <div class="panel-body">
                    <div class="table-container">
                        <table class="data-table" id="dataTable">
                            <thead></thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <script src="../Scripts/startup.js"></script>
    <script src="../Scripts/addin.js"></script>
</body>
</html>
```

```css
/* Layout structure */
.addin-root {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    height: 100%;
    box-sizing: border-box;
    overflow: hidden;
}

.content-split {
    display: grid;
    grid-template-columns: 1fr 1.6fr;
    gap: 12px;
    flex: 1;
    min-height: 0;
}

.panel {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--addin-border);
    border-radius: 6px;
    overflow: hidden;
    background: var(--addin-bg);
    box-shadow: var(--addin-shadow-sm);
}

.panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid var(--addin-border);
    background: var(--addin-bg-secondary);
    flex-shrink: 0;
}

.panel-title {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .05em;
    color: var(--addin-text-secondary);
}

.panel-body {
    flex: 1;
    overflow: auto;
    padding: 0;
}

.search-input {
    border: 1px solid var(--addin-border-strong);
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 12px;
    background: var(--addin-bg);
    color: var(--addin-text-primary);
    outline: none;
    width: 160px;
    transition: border-color .15s;
}
.search-input:focus { border-color: var(--addin-primary); }
```

---

## AL File Structure Convention

```
MyAddin/
├── ControlAddin/
│   └── MyAddin.ControlAddin.al        # AL controladdin object
├── Page Extensions/
│   └── MyPage.PageExt.al              # page using the addin
└── Assets/
    └── MyAddin/
        ├── Index.html                 # main HTML
        ├── Scripts/
        │   ├── startup.js
        │   └── addin.js
        └── Stylesheets/
            └── addin.css
```

---

## Quality Checklist

Before finalising a control addin:

- [ ] CSS uses `var(--addin-*)` tokens — no hardcoded hex colors
- [ ] Dark theme tested by setting `document.documentElement.dataset.theme = 'dark'`
- [ ] Loading state (skeleton) shown before `SetData` arrives
- [ ] Empty state shown when data array is empty (not just an empty container)
- [ ] `SetData` validates JSON before rendering, logs errors to console
- [ ] All user-generated clicks fire through `InvokeExtensibilityMethod` (no direct DOM text passed to AL without sanitisation)
- [ ] `VerticalStretch`/`HorizontalStretch` set to `true` so the addin fills the factbox/page part
- [ ] No `alert()` or `document.write()` calls
- [ ] Fonts load from `Segoe UI` stack — no external CDN calls (BC sandboxes the iframe)
- [ ] Table columns with numbers use `tabular-nums` to prevent jitter when values update
