# PBI → BC Mapping Reference

## .pbit / .pbix internals

Both are ZIP archives. Rename to `.zip` (or `Expand-Archive`) to inspect. Key members:

| Member | Encoding | Contains |
|--------|----------|----------|
| `Report/Layout` | UTF-16LE JSON | `sections` (pages) → `visualContainers` + page `filters` |
| `DataModelSchema` | UTF-16LE JSON | `model.tables` → `columns`, `measures` (DAX) |
| `DiagramLayout` | UTF-16LE JSON | model diagram (usually not needed) |
| `Settings`, `Metadata` | binary/JSON | report metadata |

> Always read with `-Encoding Unicode` and strip anything before the first `{`.

### Layout structure
```
sections[]                      # one per report PAGE
  ├── displayName               # the page title → becomes a TAB label
  ├── filters                   # JSON array; page-level filter predicates
  └── visualContainers[]
        └── config (JSON string)
              └── singleVisual
                    ├── visualType        # 'tableEx' | 'card' | 'slicer' | 'multiRowCard' ...
                    ├── projections       # which columns/measures are shown
                    └── objects           # formatting
```

### Filter predicate shape (page `filters`)
Each filter references a `{table, column}` and a set of values:
```json
{
  "name": "Filter1",
  "expression": { "Column": { "Expression": { "SourceRef": { "Entity": "VAT Entry" } }, "Property": "VAT Bus. Posting Group" } },
  "filter": { "Where": [ { "Condition": { "In": { "Values": [ [ {"Literal": {"Value": "'DE-LOC'"}} ] ] } } } ] }
}
```
Extract the **Entity**, **Property**, and the **Values** — those are the exact BC field + codes the tab must filter on.

## Concept mapping table

| Power BI | BC Dashboard | Where it lives |
|----------|--------------|----------------|
| Report page | Tab | `TABS[]` in dashboard.js |
| Page filter (column + values) | Tab predicate | `tabLines()` in dashboard.js |
| `tableEx` visual | Data table | `COL_DEFS[]` + `renderTable()` |
| `card` / `multiRowCard` | KPI tile | `buildKpiSection()` |
| `slicer` (date) | Embedded date filter | `renderDateFilter()` + `OnDateFilterChanged` |
| `slicer` (list/value) | Client filter | custom JS control |
| DAX measure | AL computed field | codeunit `PopulateBuffer()` |
| Theme JSON / colors | CSS variables | `:root {}` in dashboard.css |
| Report title | Header banner | `renderHeader()` |

## Inventory checklist (fill before coding)

1. **Pages**: list every `section.displayName`.
2. **Tab predicates**: for each page, the `{Entity, Property, Values}` from its filters. Multiple columns = AND.
3. **Columns**: for the main `tableEx`, the ordered list of projected fields (order matters — match PBI left→right).
4. **KPIs**: the `card` measures shown (and their DAX, so you can reproduce the math in AL).
5. **Computed fields**: every DAX measure used as a column/KPI → translate to AL.
6. **Source tables**: the BC tables behind the model (e.g. `VAT Entry`, `Cust. Ledger Entry`). Note any joins (posting setup, partner name).
7. **Date slicer**: the date column + default range.

## Translating DAX → AL

| DAX pattern | AL equivalent |
|-------------|---------------|
| `SUM(Table[Amount])` | `Rec.CalcSums(Amount)` or accumulate in loop |
| `Amount * ExchangeRate` | compute during `PopulateBuffer()` with currency factor |
| `DIVIDE(a, b)` | guarded division (`if b <> 0 then a / b else 0`) |
| `RELATED(Other[Field])` | `if Other.Get(key) then x := Other.Field` |
| `CALCULATE(.., filter)` | apply `SetRange`/`SetFilter` before aggregating |
| currency conversion to EUR/USD | local proc using `Currency Exchange Rate` |

> Do the math **in AL during populate** and store the result in a buffer field. Keep the JS dumb — it only displays and filters, never computes business values.
