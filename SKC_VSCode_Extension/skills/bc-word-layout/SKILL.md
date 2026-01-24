---
name: bc-word-layout
description: "Analyze, validate, and work with Business Central Word report layouts. Use when working with BC report .docx layouts, AL report files, content controls, XML data bindings, or when validating report layouts against AL definitions."
---

# BC Word Layout Skill

Work with Business Central Word report layouts that use XML content controls to bind data from AL report definitions.

## Quick Start

```bash
# Set PYTHONPATH to skill root
$env:PYTHONPATH = "$HOME\.cursor\skills\bc-word-layout"

# Analyze an AL report file
python scripts/analyze.py path/to/report.al

# Analyze a Word layout
python scripts/analyze.py path/to/layout.docx

# Validate layout against report
python scripts/validate.py path/to/report.al path/to/layout.docx

# List all available fields from AL report
python scripts/list_fields.py path/to/report.al
```

## Workflow Decision Tree

### What do you want to do?

**Understand a report's data structure**
→ Run `analyze.py` on the `.al` file

**See what fields are in a Word layout**
→ Run `analyze.py` on the `.docx` file

**Check if layout matches report definition**
→ Run `validate.py` with both files

**Add new fields to an existing layout**
→ Run `list_fields.py` to see available fields, then edit in Word

**Debug missing/broken fields**
→ Run `validate.py` to identify issues

## Understanding BC Word Layouts

### How it works

1. **AL Report** defines the data structure:
   - `dataitem` blocks define data sources (tables)
   - `column` definitions expose fields to the layout
   - Nested dataitems create parent-child relationships

2. **Word Layout** binds to the data:
   - Content Controls (`<w:sdt>`) display field values
   - Repeating sections loop over child dataitems
   - Custom XML parts define the data schema

### Key Concepts

| Concept | AL Report | Word Layout |
|---------|-----------|-------------|
| Data source | `dataitem(Name; "Table")` | Repeating section |
| Field | `column(FieldName; Expression)` | Content control with tag |
| Hierarchy | Nested dataitems | Nested repeating sections |
| Labels | `column(Field_Lbl; Label)` | Static text or content control |

## Script Reference

### analyze.py
Analyze AL reports or Word layouts to understand their structure.

```bash
python scripts/analyze.py report.al          # Analyze AL report
python scripts/analyze.py layout.docx        # Analyze Word layout
python scripts/analyze.py report.al --json   # Output as JSON
```

### validate.py
Cross-reference a Word layout against its AL report definition.

```bash
python scripts/validate.py report.al layout.docx
python scripts/validate.py report.al layout.docx --strict  # Treat warnings as errors
```

**Validation checks:**
- Fields in layout exist in report
- Required fields are present
- Data types are compatible
- Repeating sections match dataitems

### list_fields.py
List all available fields from an AL report, grouped by dataitem.

```bash
python scripts/list_fields.py report.al              # Table format
python scripts/list_fields.py report.al --flat       # Flat list
python scripts/list_fields.py report.al --dataitem Line  # Filter by dataitem
```

## Common Tasks

### Adding a new field to layout

1. Check if field exists in AL report:
   ```bash
   python scripts/list_fields.py report.al | grep -i "fieldname"
   ```

2. Open layout in Word
3. Insert Content Control (Developer tab)
4. Set the Tag property to match the column name
5. Validate:
   ```bash
   python scripts/validate.py report.al layout.docx
   ```

### Debugging layout issues

1. Run validation to identify problems:
   ```bash
   python scripts/validate.py report.al layout.docx
   ```

2. Check for common issues:
   - Field name typos (case-sensitive)
   - Missing dataitem prefix (e.g., `Line_` for Line dataitem fields)
   - Orphaned content controls

### Understanding data hierarchy

The AL report defines a hierarchy of dataitems. Each child dataitem produces multiple rows for each parent row.

```
Header (1 row per document)
├── Line (many rows per Header)
├── VATAmountLine (many rows per Header)
└── Totals (1 row per Header)
```

In Word, this maps to:
- Header fields → Document level
- Line fields → Inside a repeating section
- VATAmountLine → Inside another repeating section

## Additional Resources

- [AL Report Structure Reference](reference/al-report-structure.md)
- [Word Content Controls Reference](reference/word-content-controls.md)
- [Common Issues & Troubleshooting](reference/common-issues.md)

## Dependencies

Required:
- Python 3.9+
- defusedxml (`pip install defusedxml`)

Optional (for colored output):
- rich (`pip install rich`)
