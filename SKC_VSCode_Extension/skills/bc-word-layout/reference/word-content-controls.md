# Word Content Controls Reference

This document explains how Business Central Word layouts use content controls.

## Overview

Word content controls are placeholders in a document that bind to data from the AL report. When the report runs, BC replaces each content control with actual data.

## Content Control Types

### Plain Text Control
Most common type for displaying field values.

**Properties:**
- **Tag**: The column name from the AL report (e.g., `CustomerName`)
- **Title/Alias**: Optional display name in Word

### Rich Text Control
For formatted text (bold, italic, etc.).

**Usage:** When the data source contains HTML or formatted text.

### Picture Control
For displaying images from Blob fields.

**Usage:** Company logos, product images, signatures.

### Repeating Section
Contains other controls that repeat for each child dataitem row.

**Usage:** Line items in invoices, order details.

## Setting Up Content Controls

### In Word (Developer Tab)

1. Enable Developer tab (File > Options > Customize Ribbon)
2. Position cursor where control should appear
3. Insert > Controls > Plain Text Content Control
4. Click Properties button
5. Set **Tag** to match the AL report column name exactly
6. Optionally set **Title** for display in Word

### Tag Property (Critical)

The Tag must match the column name in the AL report **exactly** (case-sensitive in some versions).

```
Report column:    column(CustomerName; "Bill-to Name")
Word Tag:         CustomerName
```

## Repeating Sections

For child dataitems that produce multiple rows:

1. Insert Repeating Section Content Control
2. Set Tag to match the child dataitem name
3. Inside the section, add controls for child columns

```
[Repeating Section: Line]
  ├── [LineNo]
  ├── [Description]
  ├── [Quantity]
  └── [Amount]
[End Repeating Section]
```

## XML Structure (Internal)

Content controls in the OOXML use `<w:sdt>` (Structured Document Tag):

```xml
<w:sdt>
  <w:sdtPr>
    <w:tag w:val="CustomerName"/>
    <w:alias w:val="Customer Name"/>
    <w:text/>
  </w:sdtPr>
  <w:sdtContent>
    <w:r>
      <w:t>{{CustomerName}}</w:t>
    </w:r>
  </w:sdtContent>
</w:sdt>
```

## Data Binding

BC uses Custom XML Parts to define the data schema:

1. `customXml/item1.xml` - Data schema definition
2. Content controls bind to XPath expressions
3. At runtime, BC populates the XML and Word updates controls

### Binding XPath Example

```xml
<w:dataBinding 
  w:xpath="/Root/Header/CustomerName"
  w:storeItemID="{...guid...}"/>
```

## Troubleshooting

### Control Not Showing Data

1. **Check Tag spelling** - Must match AL column exactly
2. **Check case** - Some versions are case-sensitive
3. **Verify column exists** - Use `list_fields.py` to see available columns
4. **Check dataitem** - Field must be in correct dataitem scope

### Repeating Section Issues

1. **Section not repeating** - Check Tag matches child dataitem name
2. **Wrong data** - Verify DataItemLink in AL report
3. **Missing rows** - Check filters on the dataitem

### Common Mistakes

| Issue | Cause | Fix |
|-------|-------|-----|
| Empty field | Tag typo | Match tag exactly to column name |
| Shows placeholder | No data binding | Re-insert control, set tag |
| Wrong format | Data type mismatch | Check AL column expression |
| Section empty | Wrong dataitem tag | Match tag to child dataitem name |

## Best Practices

1. **Name controls clearly** - Use Title property for Word editing
2. **Test incrementally** - Add a few controls, test, repeat
3. **Use validation** - Run `validate.py` after changes
4. **Backup layouts** - Before major edits
5. **Document customizations** - Track what was changed
