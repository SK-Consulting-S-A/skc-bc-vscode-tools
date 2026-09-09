# JS & CSS Patterns Reference

The JS only **displays and filters** the buffer that AL already computed. It never computes business values.

## Module skeleton (dashboard.js)

```js
(function () {
    'use strict';

    var allLines = [];
    var activeTabKey = 'ALL';

    // ── TAB DEFINITIONS (one per PBI page) ──────────────────────────────
    // Each tab carries the EXACT BC codes the matching PBI page filtered on.
    var ALL_KEY = 'ALL';
    var TABS = [
        { key: '928', label: '928 · Sales 19%', full: 'Sales of goods to Germany 19%',
          group: 'Sales',    type: 'Sale',     bus: ['DE-LOC'], prod: ['ITEM', 'ITEM CHARGES'] },
        { key: '911', label: '911 · Purch. Svc 19%', full: 'Purchase of Services from Germany 19%',
          group: 'Purchase', type: 'Purchase', bus: ['DE-LOC'], prod: ['S-INTER', 'S-NOR'] },
        // ... one entry per page; prod: [] means "no product-group filter"
    ];

    // ── CLIENT-SIDE TAB FILTER ──────────────────────────────────────────
    function tabLines() {
        if (activeTabKey === ALL_KEY) return allLines;
        var t = TABS.find(function (tb) { return tb.key === activeTabKey; });
        if (!t) return [];
        return allLines.filter(function (l) {
            if (l.documentKind !== t.type) return false;
            if (t.bus.length && t.bus.indexOf(l.vatBusPostingGroup) === -1) return false;
            if (t.prod.length && t.prod.indexOf(l.vatProdPostingGroup) === -1) return false;
            return true;
        });
    }

    // ── COLUMN DEFINITIONS (match PBI tableEx order left→right) ──────────
        var COL_DEFS = [
                { key: 'vatIdentifier',      label: 'VAT Identifier',              fn: function (d) { return esc(d.vatIdentifier); } },
                { key: 'vatPercent',         label: 'VAT %',                       fn: function (d) { return fmtPct(d.vatPercent); } },
                { key: 'partnerName',        label: 'Customer / Supplier',         fn: function (d) { return esc(d.partnerName); } },
                { key: 'documentNo',         label: 'Document No.',                fn: function (d) { return esc(d.documentNo); } },
                { key: 'lineNo',             label: 'Line_No',                     fn: function (d) { return d.lineNo != null ? fmtNum(d.lineNo, 0) : ''; } },
                { key: 'link',               label: 'Link',                        fn: function () { return ''; } },
                { key: 'postingDate',        label: 'Posting Date',                fn: function (d) { return fmtDate(d.postingDate); } },
                { key: 'documentDate',       label: 'Document Date',               fn: function (d) { return fmtDate(d.documentDate); } },
                { key: 'quantity',           label: 'Quantity',                    fn: function (d) { return d.quantity != null ? fmtNum(d.quantity, 4) : ''; } },
                { key: 'unitOfMeasureCode',  label: 'Unit',                        fn: function (d) { return esc(d.unitOfMeasureCode); } },
                { key: 'currencyCode',       label: 'Tax Currency',                fn: function (d) { return esc(d.currencyCode || 'EUR'); } },
                { key: 'currencyFactor',     label: 'German Monthly ROE',          fn: function (d) { return d.currencyFactor ? fmtNum(d.currencyFactor, 4) : ''; } },
                { key: 'vatBaseAmountEUR',   label: 'VAT Base Amount EUR', num: true,
                    fn: function (d) { return '<span class="' + negClass(d.vatBaseAmountEUR) + '">' + fmtNum(d.vatBaseAmountEUR) + '</span>'; } },
                { key: 'vatAmountEUR',       label: 'Vat Amount EUR',      num: true,
                    fn: function (d) { return '<span class="' + negClass(d.vatAmountEUR) + '">' + fmtNum(d.vatAmountEUR) + '</span>'; } },
                { key: 'roeDiffBaseEUR',     label: 'ROE DIFF EUR - Base Amount',  num: true,
                    fn: function (d) { return '<span class="' + negClass(d.roeDiffBaseEUR) + '">' + fmtNum(d.roeDiffBaseEUR) + '</span>'; } },
                { key: 'roeDiffVATEUR',      label: 'ROE DIFF EUR - Vat Amount',   num: true,
                    fn: function (d) { return '<span class="' + negClass(d.roeDiffVATEUR) + '">' + fmtNum(d.roeDiffVATEUR) + '</span>'; } },
                { key: 'vatBaseAmount',      label: 'VAT Base Amount - FC',        num: true,
                    fn: function (d) { return '<span class="' + negClass(d.vatBaseAmount) + '">' + fmtNum(d.vatBaseAmount) + '</span>'; } },
                { key: 'vatAmount',          label: 'Vat Amount - FC',             num: true,
                    fn: function (d) { return '<span class="' + negClass(d.vatAmount) + '">' + fmtNum(d.vatAmount) + '</span>'; } },
                { key: 'vatBaseAmountUSD',   label: 'Vat Base Amount USD',         num: true,
                    fn: function (d) { return '<span class="' + negClass(d.vatBaseAmountUSD) + '">' + fmtNum(d.vatBaseAmountUSD) + '</span>'; } },
                { key: 'vatAmountUSD',       label: 'Vat Amount USD',              num: true,
                    fn: function (d) { return '<span class="' + negClass(d.vatAmountUSD) + '">' + fmtNum(d.vatAmountUSD) + '</span>'; } },
                { key: 'vatPostingDescription', label: 'VAT Posting Desc.',        fn: function (d) { return esc(d.vatPostingDescription); } }
        ];

    // ── EMBEDDED DATE SLICER (replaces PBI date slicer) ─────────────────
    function renderDateFilter(data) {
        var section = el('div', 'date-filter-section');
        section.appendChild(el('div', 'date-filter-header', 'Date Filter'));
        var body = el('div', 'date-filter-body');
        var from = mkDate(data.startDate), to = mkDate(data.endDate);
        var debounce;
        function fire() {
            clearTimeout(debounce);
            debounce = setTimeout(function () {
                if (from.value && to.value)
                    Microsoft.Dynamics.NAV.InvokeExtensibilityMethod('OnDateFilterChanged', [from.value, to.value]);
            }, 600);  // debounce so we don't re-query on every keystroke
        }
        from.addEventListener('change', fire);
        to.addEventListener('change', fire);
        body.appendChild(el('label', 'date-filter-label', 'From')); body.appendChild(from);
        body.appendChild(el('label', 'date-filter-label', 'To'));   body.appendChild(to);
        section.appendChild(body);
        return section;
    }

    // ── TAB BAR (data-key drives active state, NOT array index) ─────────
    function buildTabBar() {
        var wrap = el('div', 'tab-bar');
        var btnAll = mkBtn('All Entries', ALL_KEY);
        wrap.appendChild(btnAll);
        TABS.forEach(function (t) { wrap.appendChild(mkBtn(t.label, t.key, t.full, t.group)); });
        return wrap;
    }
    function mkBtn(text, key, title, group) {
        var b = document.createElement('button');
        b.className = 'tab-btn' + (key === activeTabKey ? ' active' : '');
        b.setAttribute('data-key', key);        // ← critical for refresh
        if (title) b.title = title;
        b.textContent = text;
        b.addEventListener('click', function () { activeTabKey = key; refreshTabs(); });
        return b;
    }
    function refreshTabs() {
        document.querySelectorAll('.tab-btn').forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-key') === activeTabKey);
        });
        renderBody();
    }

    // ── ENTRY POINTS ────────────────────────────────────────────────────
    function render(data) {
        allLines = data.lines || [];
        activeTabKey = ALL_KEY;                  // default to All so data is always visible
        var root = document.getElementById('dashboard-root') || makeRoot();
        root.innerHTML = '';
        var inner = el('div', 'dashboard-inner');
        inner.appendChild(renderHeader(data));
        inner.appendChild(renderDateFilter(data));
        inner.appendChild(buildTabBar());
        inner.appendChild(el('div', 'dash-body'));  // KPIs + table go here
        root.appendChild(inner);
        renderBody();
    }

    // BC calls these:
    window.LoadData = function (json) { render(JSON.parse(json)); };
    window.PrintDashboard = function () { window.print(); };

    // signal ready
    if (typeof Microsoft !== 'undefined')
        Microsoft.Dynamics.NAV.InvokeExtensibilityMethod('OnReady', []);

    // ── helpers: el(), esc(), fmtNum(n,frac), fmtPct(), fmtDate(), negClass(), mkDate() ──
})();
```

## CSS sizing rules (dashboard.css)

The full-width chain and scrollbar visibility are the two things that break most often:

```css
:root {
    --bg: #f0f4f8; --card-bg: #fff; --border: #d0dce8;
    --text: #1a2332; --muted: #5a6a7a; --primary: #1e3a5f; --accent: #2e86de;
}

html { width: 100%; min-width: 0; box-sizing: border-box; }

body {
    font-family: system-ui, 'Segoe UI', sans-serif;
    background: var(--bg); color: var(--text);
    margin: 0;
    padding: 16px 16px 32px 16px;   /* extra bottom so the scrollbar is visible */
    box-sizing: border-box;
    width: 100%; min-width: 0;
}

#dashboard-root { width: 100%; min-width: 0; overflow-x: auto; }
.dashboard-inner { width: 100%; min-width: 0; }

.table-scroll {
    overflow-x: auto;
    overflow-y: auto;
    max-height: 640px;
    border: 1px solid var(--border);
    border-radius: 6px;
    margin-bottom: 24px;             /* reserve space so horizontal scrollbar isn't clipped */
}

/* Embedded date slicer — teal header to mirror PBI */
.date-filter-section { display: inline-flex; flex-direction: column; margin-bottom: 20px;
    border: 1.5px solid var(--border); border-radius: 6px; overflow: hidden; min-width: 280px; }
.date-filter-header { background: #1a9a8a; color: #fff; font-weight: 600;
    padding: 6px 14px; text-transform: uppercase; font-size: 13px; }
.date-filter-body { display: flex; align-items: center; gap: 10px; padding: 10px 14px;
    background: var(--card-bg); flex-wrap: wrap; }
.date-filter-input { font: inherit; border: 1px solid var(--border); border-radius: 4px;
    padding: 4px 8px; background: var(--bg); }

/* Tabs */
.tab-btn { border: 1px solid var(--border); background: var(--card-bg); cursor: pointer;
    padding: 6px 12px; border-radius: 6px; margin: 0 4px 6px 0; }
.tab-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }
```

## KPI tiles (mirror PBI cards)

```js
function buildKpiSection(lines) {
    var totals = lines.reduce(function (a, l) {
        a.baseEUR += l.vatBaseAmountEUR || 0;
        a.vatEUR  += l.vatAmountEUR || 0;
        a.count   += 1;
        return a;
    }, { baseEUR: 0, vatEUR: 0, count: 0 });

    var row = el('div', 'kpi-row');
    row.appendChild(kpiCard('Base EUR', fmtNum(totals.baseEUR), 'kpi-base-eur'));
    row.appendChild(kpiCard('VAT EUR',  fmtNum(totals.vatEUR),  'kpi-vat-eur'));
    row.appendChild(kpiCard('Lines',    String(totals.count),   'kpi-count'));
    return row;
}
```
