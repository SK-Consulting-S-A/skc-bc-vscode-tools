# AL Report Structure Reference

This document explains the structure of AL report files for Business Central Word layouts.

## Report Definition

```al
report 50100 "My Custom Report"
{
    Caption = 'My Custom Report';
    WordLayout = 'src/ReportLayout/MyReport.docx';
    WordMergeDataItem = Header;
    DefaultLayout = Word;

    dataset
    {
        dataitem(Header; "Sales Header")
        {
            column(DocumentNo; "No.") { }
            column(CustomerName; "Bill-to Name") { }
            
            dataitem(Line; "Sales Line")
            {
                DataItemLink = "Document No." = field("No.");
                column(LineNo; "Line No.") { }
                column(Description; Description) { }
                column(Quantity; Quantity) { }
            }
        }
    }
}
```

## Key Properties

### Report-Level Properties

| Property | Description |
|----------|-------------|
| `WordLayout` | Path to the Word layout file (.docx) |
| `WordMergeDataItem` | The dataitem used for mail merge (one document per row) |
| `DefaultLayout` | Default layout type: `Word`, `RDLC`, or `Excel` |
| `Caption` | Display name of the report |

### DataItem Properties

| Property | Description |
|----------|-------------|
| `DataItemLink` | Links child dataitem to parent fields |
| `DataItemTableView` | Filters and sorting for the dataitem |
| `UseTemporary` | If true, uses a temporary table |
| `PrintOnlyIfDetail` | Only print if child has records |

### Column Properties

```al
column(ColumnName; SourceExpression)
{
    IncludeCaption = true;  // Include field caption as label
}
```

## DataItem Hierarchy

DataItems form a parent-child hierarchy:

```
Header (1 record per document)
├── Line (many records per Header)
│   └── LineComments (many per Line)
├── VATAmountLine (many per Header)
└── Totals (aggregated values)
```

Each level produces:
- **Parent**: One set of values per document
- **Child**: Multiple rows, repeating for each parent

## Column Naming Conventions

### Data Columns
- Direct field reference: `column(Amount; Amount)`
- Calculated: `column(TotalAmount; Amount + "VAT Amount")`
- With prefix: `column(Line_Description; Description)` (in child dataitem)

### Label Columns
- Convention: `column(Amount_Lbl; AmountLbl)` or `column(AmountLbl; FieldCaption(Amount))`
- Labels provide translated captions for Word templates

## Common Patterns

### Adding a Column

```al
column(NewField; "Table Field")
{
    // No additional properties needed for basic field
}
```

### Calculated Column

```al
column(DiscountPercent; "Line Discount %" / 100)
{
    // Result is a decimal
}
```

### Label Column

```al
column(Quantity_Lbl; QuantityLbl)
{
    // QuantityLbl is a Label variable
}
```

### Conditional Column

```al
column(ShowDiscount; "Line Discount %" > 0)
{
    // Boolean - true/false
}
```

## Data Types

| AL Type | Word Behavior |
|---------|---------------|
| Text, Code | Plain text |
| Decimal, Integer | Formatted number |
| Date, DateTime | Formatted date |
| Boolean | true/false |
| Option | Option value name |
| Blob (Picture) | Image in Word |

## Best Practices

1. **Consistent naming**: Use `Field_Lbl` suffix for labels
2. **Meaningful names**: `CustomerName` not `Field1`
3. **Group related fields**: Keep fields from same source together
4. **Document calculations**: Comment complex expressions
5. **Consider layout needs**: Only expose fields the layout needs
