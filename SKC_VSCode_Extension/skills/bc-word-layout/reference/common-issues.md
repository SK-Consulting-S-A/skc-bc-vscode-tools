# Common Issues & Troubleshooting

Solutions for common problems with BC Word layouts.

## Issue: Fields Show Placeholder Text

**Symptom:** Content control displays `{{FieldName}}` or placeholder instead of data.

**Causes & Solutions:**

1. **Tag mismatch**
   ```bash
   # Check available fields
   python scripts/list_fields.py report.al | grep -i fieldname
   ```
   Ensure the Word Tag exactly matches the AL column name.

2. **No data binding**
   - Delete the content control
   - Re-insert and set the Tag property
   
3. **Column not in dataset**
   - Add the column to the AL report
   - Recompile and republish

## Issue: Repeating Section Shows Only One Row

**Symptom:** Child dataitem should show multiple rows but only one appears.

**Causes & Solutions:**

1. **Missing repeating section control**
   - Wrap line items in a Repeating Section Content Control
   - Set Tag to the child dataitem name (e.g., `Line`)

2. **Incorrect DataItemLink**
   ```al
   dataitem(Line; "Sales Line")
   {
       DataItemLink = "Document No." = field("No.");  // Must link correctly
   }
   ```

3. **Filter excludes records**
   - Check DataItemTableView filters
   - Check trigger code that may skip records

## Issue: Case Sensitivity Problems

**Symptom:** Fields work in development but fail after deployment.

**Solution:**
```bash
# Find case mismatches
python scripts/validate.py report.al layout.docx
```

Always use exact case matching. BC is case-insensitive but Word binding can be case-sensitive.

## Issue: Images Not Displaying

**Symptom:** Picture content control shows empty or broken image.

**Causes & Solutions:**

1. **Wrong control type**
   - Use Picture Content Control, not Text

2. **Blob field empty**
   - Verify the source field contains data
   - Check media import/export code

3. **Image format**
   - Ensure image is in supported format (JPEG, PNG, GIF)

## Issue: Validation Errors After AL Changes

**Symptom:** Layout worked before but now shows errors.

**Solution:**
1. Run validation:
   ```bash
   python scripts/validate.py report.al layout.docx
   ```
   
2. Check for:
   - Renamed columns (update Word tags)
   - Removed columns (remove or update controls)
   - Changed dataitem names (update repeating sections)

## Issue: Performance - Slow Report Generation

**Causes & Solutions:**

1. **Too many content controls**
   - Reduce number of controls
   - Use tables instead of individual controls for tabular data

2. **Large images**
   - Compress images before storing
   - Use appropriate resolution for print/screen

3. **Complex repeating sections**
   - Simplify nested repeating sections
   - Reduce fields per row

## Issue: Layout Corrupt After Editing

**Symptom:** Word can't open the layout or BC gives import error.

**Solutions:**

1. **Restore from backup**
   - Always keep backups before editing

2. **Repair in Word**
   - Open and repair option in Word
   - Copy content to new document

3. **Extract and fix XML**
   - Rename .docx to .zip
   - Extract and examine XML
   - Look for XML syntax errors

## Issue: Merge Fields Not Working

**Symptom:** Using mail merge fields instead of content controls.

**Solution:**
BC Word layouts use **Content Controls**, not mail merge fields. Convert mail merge fields to content controls:

1. Delete mail merge field
2. Insert Plain Text Content Control
3. Set Tag to column name

## Validation Quick Reference

```bash
# Full validation
python scripts/validate.py report.al layout.docx

# Strict mode (warnings = errors)
python scripts/validate.py report.al layout.docx --strict

# See all available fields
python scripts/list_fields.py report.al

# Quick field check
python scripts/list_fields.py report.al --flat | grep -i "search term"
```

## Debugging Checklist

When a layout isn't working:

- [ ] Run `validate.py` - check for errors/warnings
- [ ] Run `list_fields.py` - verify field exists in report
- [ ] Check Tag property in Word - exact match?
- [ ] Check data exists - run report to data preview
- [ ] Check DataItemLink - child linked to parent?
- [ ] Test with simple layout - isolate the problem
- [ ] Check BC version - some features version-specific
