# Patterns Reference — C/AL to AL Migration

## Unresolved Name Resolution — "Does Not Exist in Current Context"

After txt2al conversion, many field and table references break with errors like:
- `The name 'FieldName' does not exist in the current context`
- `Table 'TableName' is missing`
- `'Record X' does not contain a definition for 'FieldName'`

This happens because the **referencing code** still uses the original C/AL name, but the **target object/field** was renamed during the AL conversion (suffix added, encoding fixed, diacritics stripped, name truncated).

### Resolution Strategy — Try These in Order

When a name fails to resolve, search the project for the actual AL name using these transformations:

| Step | Transformation | Example |
|---|---|---|
| 1. **Add project suffix** | Append your project suffix to the name | `PROFESSIONNEL` → `PROFESSIONNEL<Suffix>` |
| 2. **Fix encoding + suffix** | Fix corrupted txt2al characters AND add suffix | `"Département"` → `"Departement<Suffix>"` (é→e) |
| 3. **Strip diacritics + suffix** | Remove all accented characters AND add suffix | `"Aff.Département"` → `"Aff.Departement<Suffix>"` |
| 4. **Remove spaces + truncate + suffix** | txt2al sometimes strips spaces and truncates long names | `"Champs obligatoires Setup"` → compressed form with suffix |
| 5. **Search by table ID** | If the name is completely unrecognizable, search for the table/field ID | `table 50095` to find whatever it was renamed to |

### Diacritics Stripping Map

Some developers removed French diacritics entirely from object and field names during conversion:

| Original | Stripped | Notes |
|---|---|---|
| `é` | `e` | Most common in French |
| `è` | `e` | |
| `ê` | `e` | |
| `ë` | `e` | |
| `à` | `a` | |
| `â` | `a` | |
| `ô` | `o` | |
| `ù` | `u` | |
| `û` | `u` | |
| `ü` | `u` | German names |
| `ç` | `c` | |
| `ï` | `i` | |
| `î` | `i` | |

**Important:** Within a single project, different developers may have used different strategies:
- Developer A kept proper French UTF-8: `"Département"`
- Developer B stripped diacritics: `"Departement"`
- Developer C used the corrupted txt2al form: `"D"ëpartement"`

You must check **all three forms** when resolving a broken reference.

### Critical Trap: "English-Looking" Custom Table Names

When resolving missing names, **never assume a table is standard BC just because it has an English name.** Custom tables can have English names (e.g., `"Other Expenses"`, `"Customer Statement"`, `"Alert Entry"`), and these are just as likely to need the project suffix as French-named tables.

**The mistake:** Filtering name resolution by language or appearance — only checking French/accented names for missing suffixes while skipping English-looking names. This causes systematic misses.

**The rule:** Check **every** `Record`, `TableRelation`, `CalcFormula`, `SourceTable`, and `Database::` reference against the actual custom table inventory, regardless of whether the name looks like it could be a standard BC table. The only reliable test is: does a table with this exact name exist in the BC symbols? If not, search for a suffixed variant.

### Batch Strategy for Name Resolution

1. **Build a complete inventory** of all custom table names (with suffixes) in the project — do NOT skip tables with English names
2. Compile the project and collect all "does not exist" / "is missing" errors
3. Group errors by the missing name
4. For each missing name, **first check** if a suffixed variant exists in the inventory (Step 1 of the resolution strategy)
5. If not, apply encoding/diacritics transformations (Steps 2–5)
6. Apply the fix once you find the correct AL name
7. Re-compile and repeat — fixing one reference often reveals more downstream

### Table Name vs Field Name vs Object Name Resolution

The suffix problem applies to **ALL custom object types**, not just tables:

- **Table names** appear in `Record "..."` declarations, `TableRelation`, `CalcFormula`, `Database::` references, and `dataitem` definitions
- **Field names** appear in `SetRange`, `SetFilter`, `Validate`, direct field access (`.FieldName`), `WHERE` clauses, and `FIELD()` references
- **Codeunit names** appear in `Codeunit "..."` variable declarations, `Codeunit.Run(...)` calls, and event subscriber `ObjectType::Codeunit` attributes
- **Page names** appear in `Page "..."` declarations, `RunObject = page "..."`, `Page.RunModal(...)`, and `LookupPageID` / `DrillDownPageID` properties
- **Report names** appear in `Report "..."` declarations, `RunObject = report "..."`, and `Report.RunModal(...)` calls
- **XMLport names** appear in `Xmlport "..."` declarations and `Xmlport.Run(...)` calls

A single object rename can cause **dozens of errors across the entire project**. A renamed codeunit like `"Custom Invoice Mgt"` → `"Custom Invoice Mgt<Suffix>"` can break 40+ references across pages, reports, and other codeunits. **Always do a project-wide search for the old name after any rename.**

### Batch Codeunit Suffix Renaming — Three-Phase Cascade

When adding the project suffix to ALL custom codeunits at once (e.g., 90+ objects), use this three-phase workflow:

**Phase 1 — Rename declarations:** Update line 1 of each `.al` file:
```al
// Before
codeunit 50052 "Alert Management"
// After
codeunit 50052 "Alert Management<Suffix>"
```
For unquoted single-word names, add quotes when suffixing: `codeunit 50060 LotManagement` → `codeunit 50060 "LotManagement<Suffix>"`.

**Phase 2 — Update ALL references project-wide:** Search the **entire** `src/` tree for every old name and replace. Reference patterns:
- `Codeunit "Old Name"` (variable declarations, parameters)
- `Codeunit::"Old Name"` (enum-style references)
- `RunObject = Codeunit "Old Name"` (page actions)

**Phase 3 — Rename `.al` files:** Use `git mv` to preserve history:
```
git mv AlertManagement.Codeunit.al "AlertManagement<Suffix>.Codeunit.al"
```

**Substring name conflicts:** When one codeunit name is a prefix of another (e.g., `"FTPS Management"` vs `"FTPS Management Dyna"` vs `"FTPS Management Dyna vol"`), StrReplace exact matching handles this safely because the closing `"` prevents partial matches. The string `"FTPS Management"` will NOT match `"FTPS Management Dyna"`. Process longer names first if using regex.

**Pre-existing broken references:** Check for references that were ALREADY broken before the batch rename. Example: if codeunit `"Legacy Journal Mgt"` was previously renamed to `"LegacyJournalMgt<Suffix>"` but 40 page files still reference the old name, those need fixing too. Always do a final project-wide search for old names after the batch.

### Table Extension Field Name Transformation

When custom fields are defined in **table extensions**, the field name often undergoes TWO transformations simultaneously:

1. **Spaces removed** — C/AL field `"Applied Doc number Firstly"` becomes PascalCase `AppliedDocNumberFirstly`
2. **Suffix added** — `AppliedDocNumberFirstly` → `AppliedDocNumberFirstly<Suffix>`

This means code referencing the old name like `GLSetup."Applied Doc number Firstly"` must become `GLSetup.AppliedDocNumberFirstly<Suffix>`.

**Where this bites you:**
- `Record.FieldName` access in codeunits and table triggers
- `WHERE(FieldName = CONST(...))` in CalcFormulas and TableRelations
- `SetRange("Old Field Name", ...)` / `SetFilter` calls
- Page extension source expressions: `field("Old Name"; "Old Name")`

**Resolution:** When a field reference fails with `'Record X' does not contain a definition for 'Y'`:
1. Search the project for the table extension targeting Record X
2. Find the custom field by looking for a PascalCase + suffix variant of the old name
3. If the old name had spaces, the new name will have them removed
4. Replace all references to the old name with the new field name

### Page Extension Field Control Resolution

Page extensions generated by txt2al use the **old C/AL field name** in both the control name and the source expression:

```al
// txt2al output — BROKEN (field was renamed in the table extension)
field("Applied Doc number Firstly"; "Applied Doc number Firstly")
{
    ApplicationArea = All;
}
```

Both parts must be updated to the **actual field name** as defined in the table extension:

```al
// Fixed — matches the actual field name in the table extension
field(AppliedDocNumberFirstlyPROJ; AppliedDocNumberFirstlyPROJ)
{
    ApplicationArea = All;
}
```

**The two parts of `field(ControlName; SourceExpression)`:**
- **ControlName** (first argument): the identifier for this control on the page — must be unique on the page
- **SourceExpression** (second argument): the field name on the source table — must match the actual field definition

**Both** must be updated when the underlying field was renamed. If only the source expression is updated, the control name becomes a misleading orphan. If only the control name is updated, the page won't compile.

**Systematic fix for page extensions:**
1. Collect all linter errors of the form `The name 'X' does not exist in the current context`
2. For each error, find the matching field in the target table's table extension
3. The field name will typically be: spaces removed + PascalCase + project suffix
4. Replace **both** the control name and source expression

This applies equally to `TableRelation`, `CalcFormula`, and other references used inside page extension field properties.

---

## Character Encoding Fixes

txt2al exports from BC14 produce corrupted French characters. Common mappings:

| Corrupted | Correct | Example |
|-----------|---------|---------|
| `"á` | `à` | `"á jour` → `à jour` |
| `"¬` | `ê` | `"¬tre` → `être` |
| `"ë` | `é` | `"ëcritures` → `écritures` |
| `"è` | `ê` | `"ètes` → `êtes` |
| `"º` | `ç` | `tra"ºabilit"` → `traçabilité` |
| `"` (at end) | `é` | `modifi"` → `modifié` |
| `'á` | `?` | `continuer'á?` → `continuer ?` |
| `"„` | `ô` | `entrep"„t` → `entrepôt` |
| `"¿` | `è` | `derni"¿re` → `dernière` |
| `"ñ` | `ï` | `na"ñf` → `naïf` |
| `"ú` | `û` | `co"út` → `coût` |
| `"ù` | `ù` | Context-dependent |
| `"Å` | `ä` | Rare in French, common in German |
| `"Ç` | `ü` | `"Çber` → `über` (German) |
| `'` (U+2019) | `°` (degree sign) | `N'` → `N°` (French "Numéro") — smart quote variant |
| `'Š` | `°` | `N'Š` → `N°` — combined smart quote + Š corruption |

### Smart Quote Variants (U+201C / U+2019)

In addition to the ASCII `"` (U+0022) corruption, txt2al sometimes produces **Unicode smart quote** variants from a different encoding path (Windows-1252 / Rich Text contamination). These are visually similar but have different codepoints and require separate replacement:

| Corrupted char | Unicode | Name | Same role as |
|---|---|---|---|
| `"` | U+201C | LEFT DOUBLE QUOTATION MARK | ASCII `"` as escape prefix |
| `'` | U+2019 | RIGHT SINGLE QUOTATION MARK | Degree sign `°` |

**Pattern 1: U+201C as escape prefix** — behaves identically to the ASCII `"` corruption but uses a smart quote:

| Corrupted (U+201C variant) | Correct | Same as ASCII variant |
|---|---|---|
| `\u201Cá` | `à` | `"á` → `à` |
| `\u201C¿` | `è` | `"¿` → `è` |
| `\u201C¬` | `ê` | `"¬` → `ê` |

These smart-quote variants occur in **~100 files** in a typical BC14 migration and must be fixed with Unicode-aware tools (standard Find & Replace with regex won't match U+201C as `"`).

**Pattern 2: U+2019 replacing `°` (degree sign)** — the French `N°` (Numéro) abbreviation gets corrupted:

```al
// Corrupted (U+2019 = right single quotation mark)
Caption = 'N' salarié';    // Looks like string ending prematurely
Caption = 'N' table';
Caption = 'N' séquence';

// Fixed (U+00B0 = degree sign)
Caption = 'N° salarié';
Caption = 'N° table';
Caption = 'N° séquence';
```

This pattern is found wherever `N°` appears in captions — typically in invoicing, banking, HR, and administrative tables. The `'` is visually indistinguishable from `'` in many editors, making it hard to spot without hex inspection.

**Detection:** Search for `\u2019` and `\u201C` in your AL files. Any occurrence in a Caption, Label, or comment is almost certainly a corruption.

**Fix with PowerShell (byte-level replacement):**
```powershell
# Fix N° corruption (U+2019 → U+00B0)
$rightQuote = [char]0x2019
$degree = [char]0x00B0
$content = $content.Replace("N${rightQuote}", "N${degree}")

# Fix smart-quote escape prefix (U+201C + diacritical → correct char)
$leftDblQuote = [char]0x201C
$content = $content.Replace("${leftDblQuote}$([char]0x00E1)", [string][char]0x00E0)  # à
$content = $content.Replace("${leftDblQuote}$([char]0x00BF)", [string][char]0x00E8)  # è
$content = $content.Replace("${leftDblQuote}$([char]0x00AC)", [string][char]0x00EA)  # ê
```

### Extended Encoding Context Rules

The encoding corruption follows a pattern: the double-quote (`"` or `"`) acts as an escape prefix,
and the following character determines the actual diacritical mark. When fixing:

1. Look at the WORD context, not just the character pair
2. French words follow predictable patterns — `être`, `traçabilité`, `modifié`, `entrepôt`
3. When ambiguous, check the original C/AL source file
4. **Check for BOTH ASCII `"` (U+0022) AND smart quote `\u201C` (U+201C) variants** — the same file may contain both

### For Field Names — Replace with Clean ASCII

Corrupted French in field names should be replaced with clean ASCII equivalents (no diacritics):
- `"Dur"e d'amortissement"` → `"DepreciationDuration<Suffix>"`
- `"Code Tra"ºabilit""` → `"TraceabilityCode<Suffix>"`
- `"Exon"ration Diplomatique"` → `"DiplomaticExemption<Suffix>"`
- `"Texte Liber""` → `"FreeText<Suffix>"`

### For Label Values — Use Proper French UTF-8

```al
ExistingItemTrackingErr: Label 'Encodage impossible, traçabilité existante !';
MissingDocLbl: Label 'Le document n''a pas été trouvé.';
WarehouseLbl: Label 'Entrepôt';
ModifiedLbl: Label 'Modifié le %1 par %2', Comment = '%1 = Date, %2 = User';
```

### For Captions — Use Proper French UTF-8

```al
field(50001; "FreeTextPROJ"; Text[250])
{
    Caption = 'Free Text';
}
```

### Batch Regex for Encoding Fixes

These regex patterns can be used in VS Code Find & Replace (with regex enabled)
to fix common encoding corruption across multiple files:

| Find (regex) | Replace | Context |
|---|---|---|
| `"á` | `à` | General |
| `"ë` | `é` | General |
| `"¬` | `ê` | General |
| `"è` | `ê` | General |
| `"¿` | `è` | General |
| `"º` | `ç` | General |
| `"„` | `ô` | General |
| `"ú` | `û` | General |

**Warning:** These are context-sensitive. Always review changes after batch replacement.
A `"á` in the middle of an English comment means something different than in French.

**Smart quote variants** (require Unicode-aware tools — standard regex won't match):

| Find (Unicode) | Replace | Context |
|---|---|---|
| U+2019 after `N` | `°` (U+00B0) | `N°` (Numéro) — French abbreviation |
| U+201C + `á` (U+00E1) | `à` | Same as `"á` but smart quote |
| U+201C + `¿` (U+00BF) | `è` | Same as `"¿` but smart quote |
| U+201C + `¬` (U+00AC) | `ê` | Same as `"¬` but smart quote |

Use PowerShell for batch fixing these — see Smart Quote Variants section above.

---

## Phased Batch Cleanup — Recommended Order

When migrating hundreds of AL files, batch operations must be ordered to minimize risk, reduce diff noise, and ensure later operations work on cleaner inputs. This sequence reflects real-world experience across 1700+ files.

| Phase | Operation | Risk | Automation rate | Notes |
|-------|-----------|------|-----------------|-------|
| 1 | `[Scope('Internal')]` removal | Zero | 100% | Simple line deletion. Deprecated attribute with no runtime effect. |
| 2 | `Find('-')` → `FindSet()`, `Find('+')` → `FindLast()` | Near-zero | 100% | Simple text replacement. Cosmetic but standard-conforming. |
| 3 | Empty trigger removal | Zero | 100% | Remove `trigger OnRun() begin end;` and similar empty blocks. |
| 4 | Caption-only modify block removal | Zero | 100% | Remove `modify("Field") { Caption = '...'; }` with no trigger changes. |
| 5 | Redundant quote removal from field names | Zero | 100% | Unquote `"SimpleName"` → `SimpleName` where no spaces/special chars. Exclude AL reserved words. |
| 6 | `WITH` statement removal | Medium | ~85% | Complex — see WITH Statement Removal section. Produces ~15% residual compiler errors. |
| 7 | TODO comment annotation | Zero | 100% | Add `TODO(WITH-cleanup)` to files with detected residual issues from phase 6. |

**Why this order matters:**

- **Phases 1–5 before WITH removal:** Removing noise (`[Scope('Internal')]` lines, empty triggers, redundant quotes) means the WITH removal script operates on cleaner code. Diffs are smaller and easier to review when earlier phases are already done.
- **WITH removal last among batch ops:** It's the most complex transformation with known residual issues. Doing it last ensures all simpler cleanups are complete and won't interfere.
- **TODO annotation after WITH removal:** Annotate only after the script runs, so you know exactly which files have residual issues.

**Scale thresholds for automation:** At 100+ occurrences, batch scripting is the only practical approach. Manual review per instance becomes viable only for the ~15% residual from WITH removal, where the compiler points directly to each issue.

---

## AL Syntax Modernization

### Removing Unnecessary Quotes from Field Names

In AL, field names only require quotes when they contain spaces, special characters, or reserved words. txt2al tends to quote everything. During cleanup, remove unnecessary quotes for cleaner code:

```al
// Before (txt2al output — unnecessary quotes)
field(50000; "BuyFromVendorNoPROJ"; Code[20]) { }
field(50001; "OrderNoPROJ"; Code[20]) { }
field(50002; "ExonerationDiplomatiquePROJ"; Boolean) { }

// After (clean — no quotes needed)
field(50000; BuyFromVendorNoPROJ; Code[20]) { }
field(50001; OrderNoPROJ; Code[20]) { }
field(50002; ExonerationDiplomatiquePROJ; Boolean) { }
```

**When to keep quotes:**
- Field name contains spaces: `"Buy-from Vendor No.PROJ"` — quotes required
- Field name contains special characters (`.`, `-`, `/`): `"Leistung inKW/PSPROJ"` — quotes required
- Field name is a reserved word: `"Order"`, `"Type"` — quotes required

**When to remove quotes:**
- Single-word PascalCase identifiers: `BuyFromVendorNoPROJ`
- Concatenated words with no spaces or special chars: `FahrzeugkategoriePROJ`

This also applies to key names, variable references, and `TableRelation` targets:
```al
// Before
TableRelation = "NamedBudgetPROJ";
// After (no spaces, no special chars)
TableRelation = NamedBudgetPROJ;
```

### Key Renaming in Table Extensions

txt2al generates generic key names (`Key1`, `Key2`) that can conflict with standard table keys. Rename to project-prefixed key names:

```al
// Before (txt2al output — conflicts with standard keys)
keys
{
    key(Key1; "Approver ID", Status, "Due Date") { }
    key(Key2; "Table ID", "Document Type", Status) { }
}

// After (project-prefixed)
keys
{
    key(Key50000; "Approver ID", Status, "Due Date") { }
    key(Key50001; "Table ID", "Document Type", Status) { }
}
```

Use your project's ID range prefix (e.g., `Key50000`, `Key50001`) to ensure uniqueness. This is especially important for table extensions where the standard table may already define keys with the same names.

### Method Calls — Add Parentheses

```al
// Before (C/AL style)
ReservationEntry.Reset;
ReservationEntry.FindLast;
ReservationEntry.FindSet(true);
ReservationEntry.Insert;
ReservationEntry.Modify;
ReservationEntry.Next;
ReservationEntry.Delete;
Commit;

// After (AL style)
ReservationEntry.Reset();
ReservationEntry.FindLast();
ReservationEntry.FindSet(true);
ReservationEntry.Insert();
ReservationEntry.Modify();
ReservationEntry.Next();
ReservationEntry.Delete();
Commit();
```

### Batch Regex for Parentheses

Find methods missing parentheses. Use with caution — only for parameterless calls:

| Find (regex) | Replace | Notes |
|---|---|---|
| `\.Reset;` | `.Reset();` | Safe — Reset never has params |
| `\.Insert;` | `.Insert();` | Safe — Insert without params = Insert(false) |
| `\.Modify;` | `.Modify();` | Safe |
| `\.Delete;` | `.Delete();` | Safe |
| `\.FindFirst;` | `.FindFirst();` | Safe |
| `\.FindLast;` | `.FindLast();` | Safe |
| `\.FindSet;` | `.FindSet();` | Safe — no-param version |
| `\.Next;` | `.Next();` | Safe |
| `\.CalcFields;` | `.CalcFields();` | ⚠️ CalcFields usually has params — verify |
| `Commit;` | `Commit();` | Safe — standalone statement |

### Built-in Functions

```al
// Before
WorkDate
UserId
Count
CompanyName
CurrentDateTime
Today
Time

// After
WorkDate()
UserId()
Count()
CompanyName()
CurrentDateTime()
Today()
Time()
```

### Boolean Literals

```al
// Before (C/AL)
Found := TRUE;
IF NOT Found THEN
    EXIT(FALSE);

// After (AL)
Found := true;
if not Found then
    exit(false);
```

### Keywords — Lowercase

```al
// Before (C/AL — mixed case)
IF Rec.FIND('-') THEN
    REPEAT
        Counter += 1;
    UNTIL Rec.NEXT = 0;

// After (AL — lowercase keywords)
if Rec.Find('-') then
    repeat
        Counter += 1;
    until Rec.Next() = 0;
```

### UserId Length Safety

`UserId()` returns up to 132 chars. When assigning to shorter fields:
```al
// Before (may truncate silently or error)
ReservationEntry."Created By" := UserId;

// After
ReservationEntry."Created By" := CopyStr(UserId(), 1, MaxStrLen(ReservationEntry."Created By"));
```

### String Quoting

```al
// C/AL uses single or double quotes inconsistently
// AL uses single quotes for strings
Message("Hello"); // Wrong in AL
Message('Hello'); // Correct in AL
```

### DATABASE:: Constants

```al
// Still valid in AL
"Source Type" = DATABASE::"Transfer Line"

// Also valid — using the Database keyword
"Source Type" = Database::"Transfer Line"
```

---

## WITH Statement Removal

The `WITH` statement was deprecated in recent AL versions. All `WITH` blocks must be unwound.

### Simple Case

```al
// Before
WITH SalesLine DO BEGIN
    RESET;
    SETRANGE("Document Type", DocumentType);
    SETRANGE("Document No.", DocumentNo);
    IF FINDSET THEN
        REPEAT
            Total += "Line Amount";
        UNTIL NEXT = 0;
END;

// After
SalesLine.Reset();
SalesLine.SetRange("Document Type", DocumentType);
SalesLine.SetRange("Document No.", DocumentNo);
if SalesLine.FindSet() then
    repeat
        Total += SalesLine."Line Amount";
    until SalesLine.Next() = 0;
```

### Nested WITH

```al
// Before
WITH SalesHeader DO BEGIN
    WITH SalesLine DO BEGIN
        // Which record is "No."?
        Message("No.");
    END;
END;

// After — unambiguous
Message(SalesLine."No.");
```

### WITH in Triggers

Common in page extension triggers from C/AL:
```al
// Before (txt2al output)
trigger OnAfterGetRecord()
begin
    WITH Rec DO BEGIN
        CalcFields("Outstanding Amount");
    END;
end;

// After
trigger OnAfterGetRecord()
begin
    Rec.CalcFields("Outstanding Amount");
end;
```

### CRITICAL: Incomplete WITH Removal Is Worse Than No Removal

**Incomplete WITH removal** — deleting the `WITH RecVar DO BEGIN` / `END` wrapper but leaving field references unqualified — produces code that **compiles in no AL version**. The bare fields like `"Field Name" := Value` resolve to nothing once the WITH scope is gone.

This is a real bug pattern observed in production migrations. Example:

```al
// BEFORE (valid C/AL with WITH):
WITH recAlertEntry DO
    case AlertValueType of
        AlertValueType::Date:
            WriteEntry := not (("Date Field Value" = DT2Date(DateTimeValue)) and
              ("Alert Date Formula" = AlertDateFormula));
    end;

// BROKEN (WITH removed, fields left bare):
case AlertValueType of
    AlertValueType::Date:
        WriteEntry := not (("Date Field Value" = DT2Date(DateTimeValue)) and
          ("Alert Date Formula" = AlertDateFormula));
end;

// CORRECT (WITH removed, fields qualified):
case AlertValueType of
    AlertValueType::Date:
        WriteEntry := not ((recAlertEntry."Date Field Value" = DT2Date(DateTimeValue)) and
          (recAlertEntry."Alert Date Formula" = AlertDateFormula));
end;
```

**Rule: If you can't fully qualify all field references inside a WITH block, leave the WITH in place.** A deprecated `WITH` that compiles is infinitely better than orphaned field references that don't.

### Detection After WITH Removal

After removing any WITH, search the modified procedure for bare field references — lines where a quoted field name appears without a `RecordVar.` prefix:

```
Regex: ^\s+(\(?"[A-Z][^"]{3,}"\s*(=|<>|:=|\.\w))
```

Any match that isn't prefixed by a record variable is a broken reference from incomplete WITH removal.

### Batch Strategy for WITH Removal

**Automation achieves ~85% accuracy.** The remaining ~15% produces clear compiler errors that are straightforward to fix manually. This is the expected outcome — not a failure. Plan for it.

#### What the script can reliably automate

1. **Quoted field references** (`"Field Name"`) — prefix with `RecVar."Field Name"`
2. **Known record methods** (`SetRange`, `FindSet`, `Reset`, `Insert`, `Modify`, `Delete`, `SetFilter`, `CalcFields`, `TestField`, `Validate`, `FieldCaption`, `FieldError`, `Init`, `Get`, `Next`, `Count`, `IsEmpty`, `SetCurrentKey`, `Ascending`, `LockTable`, `CalcSums`, `Find`, `FindFirst`, `FindLast`, `DeleteAll`, `ModifyAll`, `Copy`, `CopyFilters`, `TransferFields`, `Mark`, `MarkedOnly`, `HasFilter`, `GetFilters`, `GetFilter`, `SetRecFilter`, `GetRangeMin`, `GetRangeMax`, `GetPosition`, `SetPosition`) — prefix with `RecVar.Method()`
3. **WITH wrapper removal** — remove `with ... do begin` / `end;` and de-indent
4. **First-param fix on the WITH variable's own methods** — e.g., `RecVar.SetRange(RecVar."Field", Value)` → fix first param to unqualified `"Field"`

#### What the script CANNOT reliably automate (~15% residual)

**Issue 1: Overcorrected first params on OTHER records**

Inside a `WITH Cust DO` block, code like `CustLedgEntry.SetRange("No.", "Customer No.")` has two different meanings for the two quoted fields:
- `"No."` is a field on `CustLedgEntry` (the first param = field ref on the caller)
- `"Customer No."` might be `Cust."Customer No."` (the value from the WITH variable)

The script prefixes BOTH with `Cust.`, producing `CustLedgEntry.SetRange(Cust."No.", Cust."Customer No.")`. The first param is wrong — it must reference a field on the caller record, not the WITH variable.

**Detection regex for overcorrected first params:**
```
(\w+)\.(SetRange|SetFilter|TestField|Validate|FieldCaption|FieldError)\(\s*(\w+)\.
```
Match where group 1 ≠ group 3 → the first param references a different record than the method caller. This is almost always an overcorrection.

**Fix:** Remove the wrong prefix from the first parameter. The first param must be a field on the caller record:
```al
// OVERCORRECTED (wrong):
CustLedgEntry.SetRange(Cust."Customer No.", Cust."No.");

// CORRECT:
CustLedgEntry.SetRange("Customer No.", Cust."No.");
```

**Issue 2: Unquoted field names**

Common BC field names like `Amount`, `Address`, `City`, `Name`, `County`, `Description`, `Status`, `Quantity`, `Balance`, `Type`, `Blocked` appear without quotes in C/AL and are valid record fields. The script cannot distinguish them from local variables or enum values without table schema knowledge.

After WITH removal, these remain unqualified and produce `'X' does not exist in the current context` compiler errors.

**Fix:** Add the record variable prefix based on the compiler error's context.

#### Recommended batch procedure

1. Search for `WITH ` (with trailing space) across all AL files
2. For each occurrence, identify the record variable and the scope (`begin...end` block or single statement)
3. **Prefix all quoted field references** inside the WITH block with `RecVar.`
4. **Prefix all known record methods** inside the WITH block with `RecVar.`
5. **Apply first-param fix** on the WITH variable's OWN calls — remove redundant `RecVar.` from the first param of `RecVar.SetRange(RecVar."Field", ...)` → `RecVar.SetRange("Field", ...)`
6. Remove the `WITH ... DO BEGIN` / `END` wrapper and de-indent
7. **Run the overcorrection detection regex** (above) across all modified files
8. **Add `TODO(WITH-cleanup)` comments** to files with detected overcorrections — this guides colleagues doing manual fixes
9. Compile — the compiler flags both overcorrected first params and unquoted field names with clear error messages pointing to the exact line

#### TODO comment pattern for post-automation cleanup

Add this comment inside each file with known residual issues (after the opening `{`):

```al
// TODO(WITH-cleanup): Automated WITH removal — manual review needed for compiler errors:
//   1. Overcorrected first param: RecA.SetRange(RecB."Field"...) — remove RecB. prefix,
//      the first param must be a field on RecA, not on the former WITH variable.
//   2. Unquoted field names (Amount, Address, City, Name, etc.) from the former WITH block
//      may need qualifying with the record variable (e.g. Rec.Amount or RecVar.Name).
//   Both issues produce clear compiler errors pointing to the exact line and identifier.
```

This comment should be **removed** after all compiler errors in the file are resolved.

---

## TextConst → Label Migration

### Single Language (base)

```al
// C/AL
Text001@1000 : TextConst 'ENU=Do you want to post?;FRB=Voulez-vous valider ?';

// AL
PostConfirmQst: Label 'Do you want to post?';
```

The French translation `Voulez-vous valider ?` goes into the XLIFF file, not the AL code.

### With Parameters

```al
// C/AL
Text002@1001 : TextConst 'ENU=Customer %1 has balance %2.;FRB=Le client %1 a un solde de %2.';

// AL
CustomerBalanceLbl: Label 'Customer %1 has balance %2.', Comment = '%1 = Customer No., %2 = Balance amount';
```

### Locked Labels (non-translatable)

```al
// For URLs, API endpoints, technical constants
ApiUrlLbl: Label 'https://api.example.com/v1', Locked = true;
JsonContentTypeLbl: Label 'application/json', Locked = true;
```

### Naming Convention for Labels

| Type | Suffix | Example |
|---|---|---|
| Error message | `Err` | `CustomerBlockedErr` |
| Confirmation question | `Qst` | `PostConfirmQst` |
| Informational message | `Msg` | `PostingSuccessMsg` |
| Caption/Label text | `Lbl` | `TotalAmountLbl` |
| Tooltip text | `Tok` | `AmountTooltipTok` |
| Filter text | `FilterTxt` | `DateFilterTxt` |

---

## Event Subscriber Patterns

### RunTrigger Guard

When subscribing to generic record events (`OnBeforeInsertEvent`, `OnAfterInsertEvent`,
`OnBeforeModifyEvent`, `OnAfterModifyEvent`, `OnBeforeDeleteEvent`, `OnAfterDeleteEvent`),
always check the `RunTrigger` parameter. This prevents custom logic from running when
records are inserted/modified/deleted programmatically with `RunTrigger = false`:

```al
[EventSubscriber(ObjectType::Table, Database::"Purchase Header", 'OnBeforeInsertEvent', '', false, false)]
local procedure PurchHeader_OnBeforeInsert(var Rec: Record "Purchase Header"; RunTrigger: Boolean)
begin
    if not RunTrigger then
        exit;
    // Custom logic here — only runs when triggers are intentionally fired
end;
```

**When to use:** Always for `OnBefore/AfterInsertEvent`, `OnBefore/AfterModifyEvent`,
`OnBefore/AfterDeleteEvent`. These are the only generic events that carry a `RunTrigger` parameter.

**When NOT needed:** Named integration events (`OnAfterCopyFromTransferHeader`,
`OnBeforeSalesInvHeaderInsert`, etc.) do not have a `RunTrigger` parameter — they fire
unconditionally when the standard code reaches that point.

### Timing Equivalence — OnRun Injection → OnBeforeXxx Subscriber

A common C/AL pattern injects custom code at the **very start of `OnRun`** — before the codeunit's main `Code()` procedure is called. In BC25, no event fires at the OnRun entry point, but there is typically an `OnBeforeXxx` event early inside `Code()`.

**Example — COD232 "Gen. Jnl.-Post+Print":**

C/AL DELTA injects `CustomPrePostCheck(Rec)` at the start of OnRun (before `Code()`). In BC25, the `OnBeforePostJournalBatch` event fires at line 58 inside `Code()` — after `GenJnlTemplate.Get` and the Force Posting Report check, but before the confirmation dialog and any posting.

**Is this timing difference acceptable?**

Yes, in virtually all cases. The custom code injected at OnRun start is typically a **validation or precondition check** (domiciliation status, budget envelope, permission check). These checks need to run **before posting happens**, but whether they run before or after `GenJnlTemplate.Get` doesn't matter functionally — the template is just setup data, not a business state change.

**When timing matters (rare):**
- If the C/AL code modifies `Rec` fields before `Code()` processes them — the subscriber fires after some setup, so the field values may differ
- If the C/AL code calls `exit` to skip the entire codeunit — an `OnBefore` subscriber with `IsHandled := true` may not prevent all the setup code from running

**General rule:** For precondition checks and validations injected at OnRun start, subscribing to the nearest `OnBeforeXxx` event inside `Code()` is functionally equivalent. Document the timing difference in a comment if it's non-obvious.

### GlobalScope Parameter

The `EventSubscriber` attribute has two boolean parameters at the end: `IncludeSender` and `GlobalVarAccess`.

```al
[EventSubscriber(ObjectType::Table, Database::Customer, 'OnBeforeValidateEvent', 'VAT Registration No.', false, false)]
//                                                                                               IncludeSender ^    ^ GlobalVarAccess
```

**Default recommendation:** Use `false, false` unless you specifically need:
- `IncludeSender = true`: to access the publisher codeunit instance (rare)
- `GlobalVarAccess = true`: to access global variables of the publisher (rare, avoid when possible)

Some existing codeunits use `true, true` (e.g., `CustomerBankAccEventsPROJ`, `RequisitionLineEventsPROJ`).
This is not harmful but is unnecessary unless the subscriber reads global variables from the publisher.
New subscribers should use `false, false`.

### AccessByPermission on FlowFields

When a table extension has FlowFields that reference sensitive tables, add `AccessByPermission`
to restrict visibility to users who have read access to the underlying data:

```al
field(50051; "InvoiceAmountsMPPROJ"; Decimal)
{
    CalcFormula = Sum("Vendor Ledger Entry"."Purchase (LCY)" WHERE("Vendor No." = FIELD("No.")));
    Caption = 'Invoice Amounts';
    FieldClass = FlowField;
    AccessByPermission = TableData "Vendor Ledger Entry" = R;
}
```

This prevents FlowFields from appearing on pages for users who lack permission to the
underlying table, which avoids confusing "permission denied" errors on CalcFields.

### Consolidating Multiple Standard Codeunit Modifications into One Subscriber

When several standard codeunits are part of the same functional chain (e.g., posting, printing, confirmation), their C/AL modifications often serve the same business purpose. The default remains **one subscriber codeunit per standard object**, but it is often reasonable to **consolidate related modifications into a single subscriber** when they stay cohesive and easy to review.

**Common consolidation groups:**

| Group | Standard CUs | Single subscriber |
|---|---|---|
| General journal posting | CU 231 "Gen. Jnl.-Post", CU 232 "Gen. Jnl.-Post+Print", CU 13 "Gen. Jnl.-Post Batch" | `GenJnlPostEvent<Suffix>` |
| Sales posting | CU 80 "Sales-Post", CU 81 "Sales-Post (Yes/No)" | `SalesPostEvent<Suffix>` |
| Purchase posting | CU 90 "Purch.-Post", CU 91 "Purch.-Post (Yes/No)" | `PurchPostEvent<Suffix>` |
| Release documents | CU 414 "Release Purchase Document", CU 415 "Release Sales Document" | Per-area or combined |

**Example — `GenJnlPostEvent<Suffix>` consolidating CU 231 + CU 232:**

```al
// Replaces standard Codeunit 231 "Gen. Jnl.-Post"
codeunit 50101 "GenJnlPostEvent<Suffix>"
{
    // Budget envelope check for recurring journals
    //   Subscribes to CU 233 "Gen. Jnl.-Post Batch" events.
    // Example pre-post validation before Post+Print
    //   Subscribes to CU 232 "Gen. Jnl.-Post+Print" events.

    [EventSubscriber(ObjectType::Codeunit, Codeunit::"Gen. Jnl.-Post", 'OnBeforeCode', '', false, false)]
    local procedure BudgetEnvelopeCheck(...)
    begin
        // From CU 231 DELTA
    end;

    [EventSubscriber(ObjectType::Codeunit, Codeunit::"Gen. Jnl.-Post+Print", 'OnBeforePostJournalBatch', '', false, false)]
    local procedure CustomPrePostCheck(...)
    begin
        // From CU 232 DELTA
    end;
}
```

**Benefits:**
- Fewer AL files to maintain
- Related business logic lives together
- Easier to reason about the feature as a whole
- The traceability comment on line 1 names the primary codeunit; internal comments document the others

**When NOT to consolidate:**
- When the modifications serve completely unrelated business purposes
- When different teams/developers own different modifications
- When the subscriber would exceed ~200 lines (split by feature at that point)

### Common Bugs Found During Event Extraction

These bugs have been found in the migrated codebase. Watch for them when extracting C/AL logic:

| Bug pattern | Example | Fix |
|---|---|---|
| Always-false condition | `Customer."VAT Registration No." <> Customer."VAT Registration No."` | Should compare against `xRec` or a different variable |
| Uninitialized record | `Item.Get(ItemVend."Item No.")` where `ItemVend` is never loaded | Use `Rec."No."` or ensure the record variable is loaded first |
| Wrong casing on variables | `ishandled` instead of `IsHandled` | Use PascalCase: `IsHandled` |
| Encoding corruption in string literals | `"Param"¿tres g"ën"ëraux"` | Fix to `"Paramètres généraux"` — apply encoding map from patterns.md |
| Magic numbers in filters | `"Processing Status" <> 1` | Define a constant or use an Enum value with a comment |
| Copy-paste field reference errors | Subscriber copies field from wrong source record | Verify every field assignment maps Source → Target correctly |

**Prevention:** After extracting each subscriber, do a line-by-line review of every variable
reference and condition. The extraction process is error-prone because field names change
(C/AL → AL with suffix), record variable names change, and context shifts from `WITH` blocks
to explicit record references.

---

## Page Extension Patterns

### Empty / No-Op Object Deletion

txt2al and C/AL migrations produce objects that contain **zero executable code** — empty bodies with no fields, no triggers, no procedures, no variables. These are dead weight and must be deleted.

**Before deleting, verify:**

1. **Read the full file** — confirm the body is truly empty (not just the first few lines)
2. **Search for references** — grep for the object name AND the object ID across the entire project. Ensure nothing calls, runs, or subscribes to this object
3. **If both checks pass → delete the file.** An empty object with no references serves no purpose and can cause ID conflicts

**Common causes of empty objects:**

| Cause | Example |
|---|---|
| txt2al produced an empty shell for an object that was only a container for TextConst strings (now handled by XLIFF) | `codeunit 50001 "UD Item" { }` |
| Developer cleaned out all logic during a past migration but forgot to delete the file | Empty `begin...end` in every trigger |
| One-shot codeunit whose body was already commented out and then stripped during cleanup | Only the object declaration remains |
| Table extension where all custom fields were moved to a different extension | Empty `fields { }` block |

**What counts as empty:**
- Object declaration + `{ }` with nothing inside (the absolute minimum)
- Object with only comment lines (no executable code)
- Page/table extension with empty `layout { }` and/or `actions { }` blocks and no triggers/variables

**What does NOT count as empty (do NOT delete):**
- An object with a single field, a single trigger, or a single variable — even minimal content is content
- An object referenced by other code even if it looks empty (it may be an interface placeholder)

### Cleanup of Empty Page Extensions

txt2al sometimes generates page extensions that contain only caption modifications:
```al
pageextension 50XXX pageextension50XXX extends "Some Page"
{
    // Nothing meaningful
}
```

These should be deleted.

### Adding Custom Fields to Existing Groups

```al
pageextension 50043 VendorItemCatalogPROJ extends "Vendor Item Catalog"
{
    layout
    {
        addafter("Lead Time Calculation")
        {
            field("DesignationPROJ"; Rec."DesignationPROJ")
            {
                ApplicationArea = All;
                ToolTip = 'Specifies the item designation from the vendor catalog.';
            }
        }
    }
}
```

**Common issues:**
- Anchor field (`"Lead Time Calculation"`) may have been renamed or removed in BC25
- `ToolTip` is required on all page fields in BC25 (UICop rule)
- `ApplicationArea` is required

### Promoted Actions — Modern Syntax

```al
// Legacy promoted syntax — still valid during migration
action(MyAction)
{
    Promoted = true;
    PromotedCategory = Process;
    PromotedIsBig = true;
}

// Optional modernization using actionref
actions
{
    area(Processing)
    {
        action(MyAction)
        {
            Caption = 'My Action';
            Image = Process;
            ToolTip = 'Run the custom process.';
            trigger OnAction()
            begin
                // Implementation
            end;
        }
    }
    area(Promoted)
    {
        group(Category_Process)
        {
            Caption = 'Process';
            actionref(MyAction_Promoted; MyAction) { }
        }
    }
}
```

### Page Control Anchoring Issues

When BC25 renames or removes a control, `addafter` / `addbefore` breaks:

```al
// If "Source No." was renamed to "Source Document No." in BC25:
// This will fail:
addafter("Source No.")

// Fix: update to the BC25 control name:
addafter("Source Document No.")
```

Always verify anchor control names against BC25 page definitions.

### Removing Dead Page Logic

C/AL pages often had `OnOpenPage` code that set filters or visibility. If the logic
referenced removed features:

```al
// Before — references a removed setup field
trigger OnOpenPage()
begin
    if SetupRec."Use Old Feature" then
        CurrPage."New Section".Visible := false;
end;

// After — verify if the feature toggle still exists; if not, simplify
trigger OnOpenPage()
begin
    // "Use Old Feature" was removed in BC20; section is now always visible
end;
```

---

## Report Extension Patterns

### Full Copy vs Extension

txt2al generates **full copies** of modified standard reports. In BC25, you should:

1. **If only the RDLC layout was modified**: Create a custom layout, not a report extension
2. **If only request page options were added**: Use report extension with `requestpage` section
3. **If dataset was extended with custom columns**: Use report extension with `dataset` section
4. **If core logic was heavily modified**: May need to remain as full custom report (different ID)

### Report Extension Structure

```al
reportextension 50XXX PurchaseReceiptPROJ extends "Purchase - Receipt"
{
    dataset
    {
        add("Purch. Rcpt. Header")
        {
            column("FreeTextPROJ"; "FreeTextPROJ")
            {
            }
        }
    }

    requestpage
    {
        layout
        {
            addlast(Options)
            {
                field("ShowCustomField"; ShowCustomField)
                {
                    ApplicationArea = All;
                    Caption = 'Show Custom Field';
                }
            }
        }
    }

    var
        ShowCustomField: Boolean;
}
```

### RDLC Layout Migration

Custom RDLC layouts from BC14 may reference columns that don't exist in BC25's dataset.
Steps:
1. Compare the BC14 dataset columns with BC25 standard dataset
2. Custom columns → add via report extension `dataset` section
3. Standard columns that were removed → find BC25 replacements
4. Rebuild RDLC bindings after dataset changes

---

## Variable Naming

Replace opaque C/AL-era variable names with descriptive ones:

| Before | After | Context |
|--------|-------|---------|
| `R5606` | `FAPostingGroup` | Record "FA Posting Group" |
| `R5606E` | `ExistingFAPostingGroup` | Record "FA Posting Group" (existence check) |
| `lEntryNo` | `NextEntryNo` | Integer for entry numbering |
| `lCustomer` | `Customer` | Record Customer |
| `lGeneralLedgerSetup` | `GeneralLedgerSetup` | Record "General Ledger Setup" |
| `lSalesSetup` | `SalesSetup` | Record "Sales & Receivables Setup" |
| `recXXX` | Descriptive name based on table | Type prefix (Hungarian notation) → PascalCase |
| `codXXX` | Descriptive name based on purpose | Type prefix (Hungarian notation) → PascalCase |
| `intXXX` | Descriptive name | Type prefix (Hungarian notation) → PascalCase |
| `txtXXX` | Descriptive name | Type prefix (Hungarian notation) → PascalCase |

### Variable Declaration Order

Follow this strict order in `var` sections:

```
Record, Report, Codeunit, XmlPort, Page, Query, Interface, Enum,
Notification, BigText, DateFormula, RecordId, RecordRef, FieldRef,
FilterPageBuilder, JsonObject, JsonArray, JsonToken, JsonValue,
HttpClient, HttpContent, HttpHeaders, HttpRequestMessage, HttpResponseMessage,
SecretText, ErrorInfo, Dictionary, List,
Dialog, Text, Code, Integer, Decimal, Boolean, Date, Time, DateTime, Guid
```

---

## Option to Enum Migration

BC25 best practice: convert Option fields to Enum types.

```al
// Before (Option)
field(50002; "ShipmentStatusPROJ"; Option)
{
    OptionCaption = 'Not Shippable,Partially Shippable,Completely Shippable,Delivered';
    OptionMembers = "Not Shippable","Partially Shippable","Completely Shippable","Delivered";
}

// After (Enum) — create separate enum object
enum 50002 ShipmentStatusPROJ
{
    Extensible = true;
    value(0; "Not Shippable") { Caption = 'Not Shippable'; }
    value(1; "Partially Shippable") { Caption = 'Partially Shippable'; }
    value(2; "Completely Shippable") { Caption = 'Completely Shippable'; }
    value(3; "Delivered") { Caption = 'Delivered - Transfer To Be Received'; }
}

field(50002; "ShipmentStatusPROJ"; Enum ShipmentStatusPROJ)
{
    Caption = 'Shipment Status';
    DataClassification = CustomerContent;
}
```

**When safe to convert:**
- New custom tables (no existing data)
- During a major version bump with upgrade codeunit
- When the Option field is only used in a single extension
- **When a `TableRelation WHERE` clause compares the Option field against a standard Enum field** (AL0603 warning) — if the `OptionMembers` match the standard enum's ordinal values exactly, convert to that standard enum. This is common for fields mirroring `"Purchase Document Type"`, `"Sales Document Type"`, etc.

```al
// BEFORE — AL0603 warning: implicit Option-to-Enum conversion
field(50004; "Purchase Document Type"; Option)
{
    OptionCaption = 'Quote,Order,Invoice,Credit Memo,Blanket Order,Return Order';
    OptionMembers = Quote,"Order",Invoice,"Credit Memo","Blanket Order","Return Order";
}
field(50005; "Purchase Document No."; Code[20])
{
    TableRelation = IF (...) "Purchase Header"."No."
        WHERE("Document Type" = FIELD("Purchase Document Type"));  // Option vs Enum mismatch
}

// AFTER — clean, no warning
field(50004; "Purchase Document Type"; Enum "Purchase Document Type")
{
    Caption = 'Document Type';
    Editable = false;
}
```

**When NOT safe to convert:**
- Existing table extension fields with production data (ordinal mismatch risk)
- Fields referenced by external integrations (API contract change)
- Mid-migration — do enum conversion in a separate phase
- **When the OptionMembers do NOT match the standard enum ordinals** — verify ordinal-by-ordinal before converting

### Option Encoding Issues

Option fields exported from C/AL with French characters often have corrupted `OptionMembers`:
```al
// Corrupted
OptionMembers = "Accept"ë","Refus"ë","En attente";

// Fixed
OptionMembers = "Accepté","Refusé","En attente";
```

When referencing corrupted option values in subscriber code, use integer values:
```al
GenJnlLine.SetRange("Processing Status", 1); // 1 = Accepted
```

---

## Empty Triggers with Orphaned Variables

After txt2al conversion and `Unsupported feature` comment cleanup, you may find triggers that have **variable declarations but a completely empty `begin...end` body**:

```al
trigger OnLookup()
var
    Assignments: Record AssignmentsPROJ;
    LocationList: Record "Location List";
    ServiceAssignment: Record "Service AssignmentPROJ";
begin
end;
```

**What happened:** The original C/AL trigger had business logic, but txt2al could not convert it (e.g., `FORM.RUNMODAL` calls, complex WITH blocks, DotNet interop). It was flagged as an `Unsupported feature` comment. When the comment was removed during cleanup, the variables were left behind but the logic was never re-implemented — leaving a dead trigger.

**Action: Delete the entire trigger** (including the `var` block). An empty trigger with no code does nothing at runtime; the orphaned variables just generate linter warnings and clutter.

**Exception:** In **table extensions**, an empty `modify` trigger on a standard field may have been intentionally left to prevent the standard trigger from firing. This is rare but check before deleting in table extensions. In **custom tables** (which is where this pattern most commonly appears), there is no such concern — delete freely.

**How to detect project-wide:** Search for triggers where `begin` is immediately followed by `end;` with only whitespace between them, but the trigger has a `var` section.

---

## Phantom FieldN References in Fieldgroups

txt2al sometimes generates `FieldN` placeholders (e.g., `Field3`, `Field7`) in `fieldgroup` definitions when the original C/AL table referenced a field that was later deleted but was still listed in the fieldgroup metadata.

```al
// BROKEN — Field3 doesn't exist in the table (fields go 1, 2, 6, ...)
fieldgroup(DropDown; "Employee No.", Field3)
{
}

// FIXED — remove the phantom reference
fieldgroup(DropDown; "Employee No.")
{
}
```

**Why this happens:** In C/AL, fieldgroups stored field references by ID. If field 3 was deleted from the table but the fieldgroup wasn't updated, the stale reference persisted in the export. txt2al converts this to a literal `FieldN` identifier that cannot resolve.

**Action:** Remove the phantom `FieldN` reference from the fieldgroup. If removing it leaves only one field or an empty fieldgroup, that's fine — a single-field DropDown is still useful.

**How to detect project-wide:** Search for `Field\d+` in fieldgroup definitions across all `.al` files.

---

## Commented-Out Code and Historic Comments Cleanup

### The Custom Table vs Table Extension Distinction

**Custom tables** (fully custom objects in your ID range) contain only your own code. Commented-out code in custom tables is safe to remove — it is always custom code that a developer intentionally disabled. Git history preserves the original if ever needed.

**Table extensions** (extending standard BC objects) are a different story. Commented-out code in table extensions may be **standard BC code** that was commented out during C/AL modification. Removing it means losing the only record of what the standard code looked like at that point. **Never bulk-remove comments from table extensions** without first verifying each block is custom code, not standard.

The same principle applies to **copied standard codeunits**: commented-out code there may be standard code, C/AL merge artifacts, or custom code — each requires individual analysis (see [delta-methodology.md](delta-methodology.md)).

### Comment Categories and Actions

| Category | How to recognize | Custom tables | Table extensions / Copied CUs |
|---|---|---|---|
| **Historic change-tracking tags** | `//-->20210830-DEV01`, `//<--20210830-DEV01`, `//Begin IT-12345 - 2024/02/14 - DEV`, `//End IT-12345`, `//120305:dev:Description` | **Remove** — git replaces C/AL-era change tracking | **Remove** — these are always custom markers, never standard code |
| **Commented-out code blocks** | `//IF Description = '' THEN`, `//Rec.Validate(Field);`, entire procedures commented out | **Remove** — all custom code, developer disabled it | **Dangerous** — may be standard code; analyze individually |
| **txt2al unsupported property comments** | `//This property is currently not supported`, `//TestTableRelation = false;` | **Review then remove** — the property issue should be addressed or documented | Same |
| **Functional comments explaining active code** | `// Lines with global info and details`, `// If partially applied, then first undo` | **Keep** — these explain current logic | **Keep** |
| **Header change-log blocks** | Multi-line blocks at the top listing dates, developers, and changes | **Remove** — git log replaces this | **Remove** — these are always custom metadata |

### Recognizing Change-Tracking Tag Patterns

C/AL developers used many formats for tracking changes. Common patterns to search for:

```
//-->YYYYMMDD-TAG          Start of change block (arrow-date-tag)
//<--YYYYMMDD-TAG          End of change block
//YYMMDD:initials:text     Date-colon-initials-colon-description
//Begin IT-NNNNN - date    Ticket-based start marker
//End IT-NNNNN - date      Ticket-based end marker
// BEGIN (TAG-date - RTA)  Parenthesized start
// END (TAG-date - RTA)    Parenthesized end
//FEATURE-TAG              Standalone feature identifier
```

These tags served the same purpose as git commit messages. In AL with source control, they are noise.

### Batch Cleanup Strategy for Custom Tables

1. Remove all header change-log comment blocks (top of file)
2. Remove all change-tracking tag lines (`//-->`, `//<--`, `//Begin`, `//End`, `//YYMMDD:dev:`)
3. Remove all commented-out code lines (lines that are syntactically C/AL or AL code with `//` prefix)
4. Remove txt2al unsupported property comments (after addressing the underlying issue)
5. **Keep** all functional comments that explain active code logic
6. Review the result — if removing comments leaves an empty trigger body (with or without orphaned variables), **delete the entire trigger**. In custom tables this is always safe. In table extensions, check if the empty trigger was intentional (see "Empty Triggers with Orphaned Variables" section above)

### What NOT to Remove

- Comments that explain **why** active code works a certain way
- Comments documenting business rules (`// Luxembourg VAT requires...`)
- Comments with `TODO` or `FIXME` that flag unfinished migration work
- Comments inside string literals (these are data, not comments)

---

## Modify(false) for Programmatic Data Updates

When updating BLOB fields, internal flags, or other data that doesn't require trigger execution, use `Modify(false)` instead of `Modify()`:

```al
// BC14 (always fired triggers)
TempBlob.WriteAsText(NewText, TEXTENCODING::Windows);
"Request Filters" := TempBlob.Blob;
Modify();

// BC25 (skip triggers for internal data updates)
"Request Filters".CreateOutStream(OutStr, TEXTENCODING::Windows);
OutStr.WriteText(NewText);
Modify(false);
```

**When to use `Modify(false)`:**
- Writing BLOB/stream data (e.g., email templates, filter blobs, notification text)
- Updating computed/internal fields that don't need business rule validation
- Performance-critical batch operations where trigger overhead is unnecessary

**When to use `Modify()` (or `Modify(true)`):**
- User-facing field changes that should trigger validation
- Fields that cascade updates to other tables (e.g., `Validate` calls in `OnModify`)
- Any change that should be audited by standard change tracking

---

## Redundant Modify Block Identification

A `modify` block is redundant and should be deleted if it ONLY does one of:
- Restates the standard Caption with the same value
- Has no trigger, no TableRelation change, no OptionCaption change

A `modify` block should be KEPT if it:
- Adds an `OnAfterValidate` trigger
- Changes `TableRelation` (e.g., adding filters like `Blocked = CONST(false)`)
- Changes `OptionCaption` (localization override)
- Changes any functional property
- Contains a `Description` that references a feature (investigate first, don't auto-delete)

### Batch Detection

Search for modify blocks that are candidates for deletion:
```
Pattern: modify("..") { Caption = '...'; }
```
If the block contains ONLY a Caption property and nothing else, it's safe to delete.

---

## FlowField and DataClassification

FlowFields do not store data — `DataClassification` is not needed and the compiler may warn:
```al
// FlowField — no DataClassification
field(50000; "VendorNamePROJ"; Text[50])
{
    CalcFormula = Lookup("Purchase Header"."Pay-to Name" WHERE("No." = FIELD("Source No.")));
    Caption = 'Vendor Name';
    FieldClass = FlowField;
}
```

For all NON-FlowField custom fields, `DataClassification` is mandatory:
```al
field(50001; "FreeTextPROJ"; Text[250])
{
    Caption = 'Free Text';
    DataClassification = CustomerContent;
}
```

### Common DataClassification Values

| Value | When to use |
|---|---|
| `CustomerContent` | Business data entered by users (default for most fields) |
| `EndUserIdentifiableInformation` | Names, emails, phone numbers |
| `AccountData` | Account credentials, API keys |
| `SystemMetadata` | System-generated, non-personal data |
| `ToBeClassified` | Temporary — must be classified before release |

---

## Cross-Extension Field Dependencies

When a FlowField or TableRelation references a custom field from another extension, verify that extension exists:
```al
// This references custom field "Single Delivery" on Purchase Header
// Verify PurchaseHeaderPROJ extension has this field
CalcFormula = Lookup("Purchase Header"."Single Delivery" WHERE("No." = FIELD("Source No.")));
```

Document such dependencies with a comment if they cross ownership areas.

---

## Obsolete Standard Tables

Tables removed or deprecated in BC25 that may appear in migrations:
- **Product Group** (Table 5723) — removed since BC 2021 Wave 2. Data should be migrated to Item Category.
- **Machine Center**, **Work Center**, **Routing** — manufacturing tables not present in all licenses
- Various system tables (`NAVApp*`, `Permission`, `User`, etc.) — platform-managed, never extend

If a table extension targets an obsolete table, the extension must be deleted and data migrated via upgrade codeunit.

### The Product Group Trap

Microsoft removed the Product Group table (5723) and promoted its records into the Item Category
table (5722) as level-2 entries using the `"Parent Category"` hierarchy. The extension targeting
the removed table **will not compile** — it must be deleted.

#### Before deleting: field-by-field comparison

Compare every custom field on the old table extension against the replacement table extension:

1. **Same field ID on both tables, old one marked `OBSOLETE`** → Field was already mirrored by
   the developers before migration. The live data is on the replacement table. Safe to drop the
   old extension. (Example: custom fields 50000–50014 were mirrored between Product Group and Item Category.)

2. **Field only on old table, marked `OBSOLETE`** → Already deprecated, no data to preserve.
   (Example: budget control fields were OBSOLETE and not carried to Item Category.)

3. **Field only on old table, NOT marked `OBSOLETE`** → **Needs a business decision.** Either:
   - Add it to the replacement table extension
   - Represent it differently (e.g., a key field like "Sub Code" may map to a deeper hierarchy level)
   - Confirm with the customer that it's no longer used
   (Example: a hierarchy key field was part of the primary key but not on Item Category.)

4. **Standard field re-added on replacement** → Microsoft removed some standard fields during
   restructuring. If the customer uses them, re-add as custom extension fields on the replacement
   table. (Example: fields like "Def. Gen. Prod. Posting Group" may need to be re-added on Item Category.)

#### Key structure changes

The old Product Group had a composite key `("Item Category Code", "Code")` and possibly custom key fields.
In BC25, this hierarchy is handled by the Item Category `"Parent Category"` field — each level
is a separate Item Category record. Custom key fields that encoded hierarchy levels may become
redundant or need re-mapping.

#### Other extensions referencing the obsolete table

Search the entire codebase for `"Product Group"` references:
- FlowFields with `CalcFormula = Lookup("Product Group"...` → remove or redesign
- TableRelation pointing to `"Product Group"` → remove or redirect to Item Category
- Code references reading Product Group records → rewrite to read Item Category

#### Upgrade codeunit (only if field data was NOT pre-mirrored)

If custom fields were NOT already mirrored (no matching field IDs on the replacement table),
create an upgrade codeunit to move data:

```al
codeunit 50XXX UpgradeProductGroupData
{
    Subtype = Upgrade;

    trigger OnUpgradePerCompany()
    begin
        // Product Group custom field data → Item Category custom fields
        // Only needed if upgrading from BC14 with existing data
        // where fields were not pre-mirrored
    end;
}
```

---

## Copied Standard Codeunit Migration

Full copies of standard codeunits (`txt2al` generates these when the C/AL source had direct modifications) **cannot exist in BC25**. They compile under the wrong ID range and duplicate standard behavior.

### Triage Steps

1. **Diff against standard**: Identify every custom line. Use legacy comment tags (e.g., `TAG01`, `CUSTOM-01`, `XX-VAT`, etc.) and search for custom record/codeunit references.
2. **Classify each custom block**:
   - Active code → extract to event subscriber
   - Commented-out code → dead code, delete
   - Helper procedures only called from within the copy → absorb into subscriber codeunit
   - Public procedures called from OTHER copies → move to subscriber, update all callers to use the subscriber
3. **Map to BC25 events**: For each custom block, find the closest integration event on the standard codeunit. See [event-mapping.md](event-mapping.md) for the comprehensive reference.
4. **Create subscriber codeunits**: One per standard codeunit that had modifications, or group logically.
5. **Delete all copied standard codeunits**: After extraction is verified.

### Field Name Mapping Across Extensions

Copied codeunits reference fields by their original C/AL names. In BC25 extensions, fields may have been renamed with the project suffix. Always check the actual field names in the extension files:

```
C/AL name                    → AL extension field name
VATEntry."EU Goods"          → "EUGoodsPROJ" (team A extension)
VATPostingSetup."EU Goods"   → "EU Goods" (team B extension, no suffix)
SEPADirectDebitMandate."Seq. Type" → "SeqTypePROJ"
GenJournalBatch."Direct Debit Processing" → "DirectDebitProcessingPROJ"
```

### Cross-Extension Event Parameters

When subscribing to standard events, the subscriber may need to read fields from table extensions owned by other developers/teams. This works if all extensions are in the same app. If fields are defined in different apps, add a dependency in `app.json`.

### C/AL Merge Tool Artifacts — "Merged But Contained Errors"

When a BC cumulative update was applied to a modified C/AL database, the merge tool sometimes
could not auto-reconcile the custom code with the updated standard. In that case it produced:

```
//The code has been merged but contained errors that could prevent import
//and the code has been put in comments. Use Shift+Ctrl+O to Uncomment
//IF ((NewDocType = NewDocType::Payment) AND
//    ...entire procedure body commented out...
//EXIT(FALSE);
```

**This is NOT dead code. This is NOT a developer decision to disable the feature.**

It means:
1. The merge tool commented out the entire modified block to prevent C/AL import errors
2. The developer was supposed to uncomment (`Shift+Ctrl+O`) and manually re-merge
3. That manual re-merge may or may not have happened before the C/AL export

**How to handle:**
1. Strip all `//` prefixes from the `ModifiedCode` block
2. Diff the uncommented result against the `OriginalCode`
3. The diff reveals the actual business logic change — often tiny (e.g., `>` changed to `>=`)
4. The uncommented code may contain multiple overlapping versions from successive merge attempts — look for the intent, not the exact syntax
5. Extract the real change to an event subscriber

**Warning:** The uncommented code frequently has syntax errors (missing parentheses, duplicated conditions) because multiple merge passes stacked partial edits. Don't try to use it as-is — understand the intent and rewrite cleanly.

### Dead Code Detection in Copied Codeunits

Look for these signs of genuinely dead custom code (as opposed to merge artifacts above):
- Commented-out blocks with legacy tags (e.g., `//-->TAG01 ... //<--TAG01`) where the developer explicitly disabled the feature
- `SetPreview()` / `SetXxx()` procedures whose calls are commented out elsewhere
- Procedures prefixed with `"--- SECTION ---"()` (C/AL section separators) — delete these

### Event Signature Versioning

Event signatures evolve across BC versions. Subscribers based on BC14 event signatures may need additional parameters in BC25. The compiler will flag mismatches. Strategy:
1. Write subscribers with known BC14 signatures
2. Compile against BC25 symbols
3. Add any additional parameters BC25 requires (typically appended at the end)
4. Add a `NOTE:` comment documenting the BC14 origin for future reference

---

## GuiAllowed Checks

Code that shows dialogs or messages must guard against non-UI contexts (web services, job queue):

```al
// Before (C/AL — often missing guard)
Dialog.Open('Processing #1##########');

// After (AL — always guard)
if GuiAllowed then
    Dialog.Open('Processing #1##########');
```

Common places where this matters:
- `Message()` calls in posting routines
- `Dialog.Open()` in batch processing
- `Confirm()` calls — must have a non-interactive fallback
- `Page.RunModal()` — cannot run from web service context

---

## Temporary Table Patterns

C/AL code using temporary variables needs careful migration:

```al
// C/AL
VAR
    TempEntry@1000 : TEMPORARY Record "Item Ledger Entry";

// AL
var
    TempEntry: Record "Item Ledger Entry" temporary;
```

The `temporary` keyword moves from the declaration to after the record type.

---

## BLOB Field Handling

BLOB fields have changed handling in modern BC:

```al
// C/AL — direct BLOB access
BlobField.CreateInStream(InStr);

// BC25 AL — use Media/MediaSet for images, TempBlob for general binary
// For general BLOB processing:
TempBlob.CreateInStream(InStr);
TempBlob.CreateOutStream(OutStr);
```

For image storage, prefer `Media` and `MediaSet` field types over raw BLOB.

---

## RecordRef / FieldRef Patterns

RecordRef/FieldRef code generally migrates cleanly, but watch for:

```al
// C/AL
RecRef.GETTABLE(SalesHeader);
FieldRef := RecRef.FIELD(1);

// AL
RecRef.GetTable(SalesHeader);
FieldRef := RecRef.Field(1);
```

The main change is casing and parentheses.

---

## Error Handling Modernization

### Try Functions

```al
// C/AL
IF NOT CODEUNIT.RUN(CODEUNIT::"Sales-Post", SalesHeader) THEN
    ERROR(GETLASTERRORTEXT);

// BC25 AL — use TryFunction
[TryFunction]
local procedure TryPostSales(var SalesHeader: Record "Sales Header")
begin
    SalesPost.Run(SalesHeader);
end;

// Usage:
if not TryPostSales(SalesHeader) then
    Error(GetLastErrorText());
```

### Collectible Errors (BC25)

For batch operations that should report all errors, not just the first:

```al
[ErrorBehavior(ErrorBehavior::Collect)]
procedure ValidateAllLines()
begin
    // Multiple errors are collected
    ValidateLine(1);
    ValidateLine(2);
    // Present all at once
    if HasCollectedErrors() then
        Error(GetLastErrorText());
end;
```

---

## FORM → PAGE References

Any remaining `FORM` references must be updated:

```al
// C/AL
FORM.RUNMODAL(FORM::"Customer Card", Customer);

// AL
Page.RunModal(Page::"Customer Card", Customer);
```

Search for: `FORM.`, `FORM::`, `RunFormOnRec`, `RunFormLink`

---

## Procedure Signature Changes

### Return Values

```al
// C/AL (implicit return through OUT parameter)
PROCEDURE GetAmount@1(VAR Amount@1000 : Decimal);
BEGIN
    Amount := 100;
END;

// AL (explicit return value preferred)
procedure GetAmount(): Decimal
begin
    exit(100);
end;
```

### Parameters and Return Type Not Exported

When txt2al shows `Parameters and return type have not been exported`:
1. This means the procedure signature couldn't be converted
2. Search BC25 symbols for the actual procedure signature
3. Manually write the correct signature
4. **Never guess** — wrong signatures cause runtime errors, not compile errors

---

## Internal Procedure Modifications (No Event Available)

Some C/AL modifications target internal procedures with no BC25 event (e.g., `FindFirstAllowedRec`,
`FindNextAllowedRec` on Warehouse Receipt Header). Options:

1. Override at the **page level** using `OnFindRecord` / `OnNextRecord` triggers
2. Use **record-level security** (SecurityFilters) if the logic is permission-based
3. Accept the limitation and document as "behavior gap" requiring manual testing
4. File an event request on the [BCApps GitHub](https://github.com/microsoft/BCApps/issues)

---

## Find('-') / Find('+') Modernization

C/AL's `Find('-')` and `Find('+')` have modern AL equivalents. txt2al preserves the old syntax, but it should be updated for clarity and performance:

```al
// C/AL style — still compiles but outdated
if Rec.Find('-') then
    repeat
        ProcessLine(Rec);
    until Rec.Next = 0;

if Rec.Find('+') then
    LastNo := Rec."No.";

// AL style — clear intent, consistent with modern codebase
if Rec.FindSet() then
    repeat
        ProcessLine(Rec);
    until Rec.Next() = 0;

if Rec.FindLast() then
    LastNo := Rec."No.";
```

### Migration Map

| C/AL | AL | Notes |
|---|---|---|
| `Find('-')` in a loop | `FindSet()` | Most common — iterating forward |
| `Find('-')` without loop | `FindFirst()` | Just checking existence or reading first |
| `Find('+')` | `FindLast()` | Reading the last record |
| `Find('=')` | `Find('=')` or `Get(...)` | Exact match — `Get` preferred when using PK |
| `Find('>') / Find('<')` | `Find('>') / Find('<')` | Still valid — no direct replacement |
| `until Find('-') = false` | `until not FindFirst()` | Rare pattern — loop until no records match |

### Batch Regex

| Find (regex) | Replace | Notes |
|---|---|---|
| `\.Find\('-'\)` | `.FindSet()` | ⚠️ Only in loop contexts — verify no single-record usage |
| `\.Find\('\+'\)` | `.FindLast()` | Safe |
| `\.FIND\('-'\)` | `.FindSet()` | Uppercase C/AL variant |
| `\.FIND\('\+'\)` | `.FindLast()` | Uppercase C/AL variant |

**Warning:** `Find('-')` outside a `repeat...until` loop should become `FindFirst()`, not `FindSet()`. Context matters.

---

## CODEUNIT.Run with Magic Numbers

C/AL code sometimes calls standard codeunits by numeric ID instead of by name:

```al
// C/AL style — magic numbers
CODEUNIT.Run(80, SalesHeader);   // Sales-Post
CODEUNIT.Run(90, PurchHeader);   // Purch.-Post
CODEUNIT.Run(12, GenJnlLine);   // Gen. Jnl.-Post Line
CODEUNIT.Run(22, ItemJnlLine);  // Item Jnl.-Post Line

// AL style — named references
Codeunit.Run(Codeunit::"Sales-Post", SalesHeader);
Codeunit.Run(Codeunit::"Purch.-Post", PurchHeader);
Codeunit.Run(Codeunit::"Gen. Jnl.-Post Line", GenJnlLine);
Codeunit.Run(Codeunit::"Item Jnl.-Post Line", ItemJnlLine);
```

### Common Magic Numbers

| ID | Standard Codeunit Name |
|---|---|
| 12 | Gen. Jnl.-Post Line |
| 13 | Gen. Jnl.-Post Batch |
| 22 | Item Jnl.-Post Line |
| 80 | Sales-Post |
| 81 | Sales-Post (Yes/No) |
| 90 | Purch.-Post |
| 91 | Purch.-Post (Yes/No) |
| 396 | NoSeriesManagement |
| 397 | Mail |
| 400 | SMTP Mail |

**Rule:** Always use `Codeunit::"Name"` syntax. If you see a magic number, look it up and replace. This also applies to `Report.Run(ID)`, `Page.Run(ID)`, and `Xmlport.Run(ID)`.

---

## EventSubscriber with Numeric Object IDs

Event subscribers should use named references, not numeric IDs:

```al
// BAD — numeric IDs reduce readability and break if objects are renumbered
[EventSubscriber(ObjectType::Codeunit, 22, 'OnBeforeCode', '', false, false)]
[EventSubscriber(ObjectType::Table, 50148, 'OnAfterModifyEvent', '', false, false)]
[EventSubscriber(ObjectType::Page, 5740, 'OnOpenPageEvent', '', false, false)]

// GOOD — named references
[EventSubscriber(ObjectType::Codeunit, Codeunit::"Item Jnl.-Post Line", 'OnBeforeCode', '', false, false)]
[EventSubscriber(ObjectType::Table, Database::"Custom Table<Suffix>", 'OnAfterModifyEvent', '', false, false)]
[EventSubscriber(ObjectType::Page, Page::"Transfer Order", 'OnOpenPageEvent', '', false, false)]
```

**Detection:** Search for `ObjectType::\w+,\s*\d+` across all `.al` files. Every match should be replaced with a named constant.

**Note:** For standard BC objects, use `Database::"Table Name"`, `Codeunit::"CU Name"`, `Page::"Page Name"`. For custom objects, use the custom object name (with suffix if applicable).

---

## Empty Separator Procedures

C/AL developers used no-op procedures as visual section dividers in the text editor:

```al
// C/AL-era separator procedures — DELETE these
procedure "=====================Functions====================="()
begin
end;

procedure _______________________________()
begin
end;

procedure "--- SECTION ---"()
begin
end;
```

**Action:** Delete all separator procedures. They have no runtime effect. If you need section markers in AL, use `#region` / `#endregion`:

```al
#region Budget Calculation
procedure CalcBudget()
begin
    // ...
end;
#endregion
```

---

## SecurityFiltering Attribute on Record Variables

Some copied standard codeunits and custom codeunits use the `SecurityFiltering` attribute on record variables:

```al
var
    [SecurityFiltering(SecurityFilter::Filtered)]
    GLEntry: Record "G/L Entry";
```

This attribute controls how security filters apply to record operations. During migration:
- **Keep** the attribute if the codeunit processes records that should respect user permissions
- **Verify** the filtering mode matches the business intent (`Filtered`, `Validated`, `Ignored`, `Disallowed`)
- **For subscriber codeunits:** Default is `SecurityFilter::Filtered` — usually correct. Only change if the subscriber needs to read records regardless of permissions (e.g., system-level operations)

---

## SuspendStatusCheck Pattern for Document Line Manipulation

When creating or modifying Purchase/Sales lines programmatically in event subscribers during posting (e.g., splitting cost lines, creating holdback/penalties lines), calling `Validate("Direct Unit Cost", ...)` or `Validate("Qty. to Receive", ...)` triggers status checks that fail because the order is in a "Released" state.

**The pattern — bracket Validate calls with `SuspendStatusCheck`:**

```al
NewPurchLine.SuspendStatusCheck(true);
NewPurchLine.Validate("Direct Unit Cost", NewAmount);
NewPurchLine.Validate("Qty. to Receive", 0);
NewPurchLine.SuspendStatusCheck(false);
NewPurchLine.Modify();
```

**When to use:**
- Subscriber creates new purchase/sales lines during posting (e.g., deduction lines, split lines)
- Subscriber modifies existing line amounts or quantities during posting
- Any programmatic `Validate` call on a line belonging to a released document

**When NOT needed:**
- Lines on documents that are still in "Open" status
- Direct field assignment without `Validate` (no trigger fires, no status check)

**Real example — holdback line creation during posting:**

```al
NewPurchLine.Init();
NewPurchLine."Document Type" := PurchLine."Document Type";
NewPurchLine."Document No." := PurchLine."Document No.";
NewPurchLine."Line No." := PurchLine."Line No." + 100;
NewPurchLine.SuspendStatusCheck(true);
NewPurchLine.Validate(Type, NewPurchLine.Type::"G/L Account");
NewPurchLine.Validate("No.", GLAccountNo);
NewPurchLine.Validate(Quantity, 1);
NewPurchLine.Insert(true);
NewPurchLine.Validate("Direct Unit Cost", -DeductionAmount);
NewPurchLine.Modify(true);
NewPurchLine.SuspendStatusCheck(false);
```

---

## TempPurchLineGlobal Dual-Update Pattern

In BC25, `Codeunit "Purch.-Post"` maintains a temporary record set `TempPurchLineGlobal` that mirrors the real purchase lines. The posting engine iterates over this temp table, not the real table. Several events pass `TempPurchLineGlobal` as a `var` parameter (e.g., `OnBeforePostLines`, `OnAfterPurchRcptLineInsert`).

**Critical timing difference:** In BC14, pre-processing code (e.g., `PreProcessPurchaseLines`) ran on `OnRun` **before** `FillTempLines` populated the temp table. In BC25, the nearest event (`OnBeforePostLines`) fires **after** `FillTempLines`. This means any modification to real purchase lines must **also be synced to the temp posting table**.

**The dual-update pattern:**

```al
// Step 1: Modify the real DB line
PurchLine.SuspendStatusCheck(true);
PurchLine.Validate("Direct Unit Cost", NewAmount);
PurchLine.SuspendStatusCheck(false);
PurchLine.Modify();

// Step 2: Sync the temp posting table (CRITICAL — without this, posting uses stale data)
if TempPurchLineGlobal.Get(PurchLine."Document Type", PurchLine."Document No.", PurchLine."Line No.") then begin
    TempPurchLineGlobal.TransferFields(PurchLine, false);
    TempPurchLineGlobal.Modify();
end;
```

**When adding new lines, insert into both:**

```al
// Insert new line in DB
NewPurchLine.Insert(true);

// Also add to temp posting table so the posting engine processes it
TempPurchLineGlobal := NewPurchLine;
TempPurchLineGlobal.Insert();
```

**When to use:**
- Any `OnBeforePostLines` subscriber that creates, modifies, or deletes purchase lines
- Any subscriber that receives `var TempPurchLineGlobal` and modifies real lines

**Forgetting step 2** means the posting engine uses stale data from the temp table — amounts, quantities, or entirely new lines are silently ignored during posting.

The same pattern applies to `TempSalesLineGlobal` in CU 80 "Sales-Post".

---

## Dead Procedure Detection in Copied Standard Codeunits

Before extracting custom procedures from a large copied standard CU (8000+ lines), verify each custom procedure is actually called. C/AL developers sometimes added procedures that were never wired up or whose call sites were later removed.

**Detection method — search for calls within the same file:**

```bash
# For each custom procedure name, search the file for call sites
rg "PostHoldbackEntry" PurchPost.Codeunit.al
rg "PostLatePenaltiesEntry" PurchPost.Codeunit.al
```

If a procedure appears only at its own definition (the `procedure` keyword line) and nowhere else in the file → dead code, skip extraction.

**Common dead code patterns in copied CUs:**
- Helper procedures added for a feature that was later redesigned (calls removed but procedure left)
- Procedures that were only called from other copied CUs that have since been cleaned up
- Procedures prefixed with `Post*` or `Create*` that duplicate logic already in the main flow

**Action:** Document the dead procedure in the extraction plan as "defined but never called — skipped" and do not create a subscriber for it.

---

## Additional Encoding Corruption Characters

Beyond the standard corruption map, these additional characters have also been found in real BC14 migration projects:

| Corrupted | Correct | Example | Notes |
|---|---|---|---|
| `╔` (U+2554) | `°` (U+00B0) | `N╔` → `N°` | Box-drawing char replacing degree sign |
| `Ëûæ` | (empty/zero) | `0Ëûæ` → `0` | Corruption of null/zero in Labels |
| `d╔` | `d'` | `d╔un` → `d'un` | Apostrophe corruption variant |

**Detection strategy:** Search for Unicode characters in the box-drawing range (U+2500–U+257F) in `.al` files — any occurrence is corruption.

### Extended Regex for Additional Encoding

| Find | Replace | Context |
|---|---|---|
| `╔` (U+2554) after `N` | `°` (U+00B0) | `N°` (Numéro) |
| `╔` (U+2554) after `d` | `'` (apostrophe) | `d'un`, `d'une` |
| `Ëûæ` | `` (empty) | Null byte corruption in Labels |

---

## Legacy Variable Naming Cleanup — Scope Suffixes and Type Prefixes

C/AL codebases use two legacy naming conventions that should be cleaned up:

- **Scope suffixes** (`_G`, `_L`, `_P`) — indicate where a variable lives (Global/Local/Parameter). This is a scope-indicator convention common in French/Belgian/Luxembourg C/AL shops, not technically Hungarian notation.
- **Type prefixes** (`rec`, `int`, `dec`, `txt`) — encode the variable's type. This *is* classic Hungarian notation.

Both are redundant in modern AL where `var` sections declare scope and type explicitly.

| Suffix | Meaning | Example |
|---|---|---|
| `_G` | Global variable | `Employee_G`, `File_G`, `ParamètresGesper_G` |
| `_L` | Local variable | `PurchaseLine_L`, `UserSetup_L`, `Amount_L` |
| `_P` | Parameter | `Item_P`, `JobNo_P`, `FileName_P` |

In AL, these suffixes are noise — `var` sections already declare scope, and parameters are visually distinct in procedure signatures.

### Cleanup Strategy

1. Remove the `_G`, `_L`, `_P` suffixes
2. Use descriptive PascalCase names: `Employee_G` → `Employee`, `PurchaseLine_L` → `PurchaseLine`
3. For parameters, keep the `var` keyword where appropriate — no suffix needed
4. When the base name collides with a type name (e.g., `Employee: Record Employee`), the collision is acceptable in AL — it's the standard BC convention

### Also Clean These Hungarian Prefixes

| Prefix | Meaning | Example | Clean name |
|---|---|---|---|
| `rec` | Record | `recItem` | `Item` |
| `cod` | Code variable | `codVendor` | `VendorCode` |
| `int` | Integer | `intCount` | `Count` |
| `dec` | Decimal | `decAmount` | `Amount` |
| `txt` | Text | `txtFileName` | `FileName` |
| `opt` | Option | `optStatus` | `Status` |
| `l_` | Local | `l_recEntry` | `Entry` |
| `p_` | Parameter | `p_intCount` | `Count` |
| `g` prefix | Global | `gDateCreation_txt` | `CreationDateText` |
| `R` + table ID | Record by ID | `R5606` | `FAPostingGroup` |

### When NOT to Rename

- Variable names that are part of event subscriber signatures (compiler-enforced names)
- Variables whose names are referenced in text constants or label parameters
- During Phase 2 if the codeunit has many cross-references — defer to Phase 3

---

## Debug and Test Code Detection

Production codeunits sometimes contain leftover debug/test code that should be removed:

### Common Debug Patterns

```al
// Debug messages — REMOVE
Message('loulou %1', SomeVar);
Message('TEST: %1', DebugValue);
Message('%1|%2', Field1, Field2);
Error('TEST - stop here');

// Hardcoded test data — REMOVE or parameterize
Employee.Get('SCTO840305190');
SalesHeader."No." := 'TEST-001';

// Test/debug procedures — REMOVE
procedure TestManual()
begin
    Employee.Get('MAT-12345');
    ProcessEmployee(Employee);
    Message('Done');
end;

// Busy-wait loops (debug timing) — REMOVE
while i < 10000 do
    i := i + 1;
```

### Detection Regex

| Find (regex) | What it catches |
|---|---|
| `Message\('(loulou\|TEST\|test\|debug\|TODO)` | Debug messages |
| `Error\('TEST` | Debug error stops |
| `procedure Test\w*\(\)` | Test procedures (verify not actual test codeunits) |
| `while \w+ < \d+ do\s+\w+ := \w+ \+ 1` | Busy-wait loops |
| `\.Get\('[A-Z]{2,}[0-9]{6,}'\)` | Hardcoded record IDs (likely test data) |

**Rule:** Any `Message` call containing `'test'`, `'debug'`, `'loulou'`, `'TODO'`, or similar casual text is debug code. Remove it.

---

## Page Extension Modify Block Triage

Page extensions are the noisiest object type after txt2al conversion. A typical page extension has 10–70 `modify` blocks, of which **80–95% are pure noise** restating standard BC ToolTips or Captions. The cleanup strategy below eliminates this noise while preserving every functional customization.

### Classification Rules

| Content of modify block | Classification | Action |
|---|---|---|
| Only `ToolTip = '...'` | Noise | **DELETE** — restates standard BC tooltip |
| Only `Caption = '...'` | Usually noise | **DELETE** — even if it renames (e.g., "Buy-from Vendor No." → "Vendor No."), these renames create confusion and override standard terminology |
| `Caption` + `ToolTip` only | Noise | **DELETE** — both are standard restates or unnecessary renames |
| `Visible = true/false` | Functional | **KEEP** — changes layout |
| `Importance = Additional/Promoted/Standard` | Functional | **KEEP** — changes field display priority |
| `Enabled = true/false` | Functional | **KEEP** — changes interactivity |
| `Editable = true/false` | Functional | **KEEP** — changes editability |
| `ShowMandatory = true/false` | Functional | **KEEP** — changes visual indicator |
| Has `trigger OnValidate/OnLookup/OnDrillDown` | Functional | **KEEP** — custom behavior |
| Mixed: ToolTip/Caption + functional properties | Partial noise | **Strip** ToolTip/Caption lines, **KEEP** functional properties only |

### After Removing All Noise Modify Blocks

If a page extension has **no custom content** remaining after removing noise modify blocks (no `addafter`/`addbefore`/`addfirst`/`addlast`, no triggers, no variables, no Unsupported code comments), **DELETE the entire file**.

**CRITICAL: Read the FULL file before classifying as a delete candidate.** In page extensions with 50–70 modify blocks, a single `addafter` block with a custom field can be buried at the very end of the file (e.g., line 277 of 286). If you only read the first 40–50 lines and see nothing but ToolTip modify blocks, you will miss it. **Never classify a file as "delete" based on a partial read — always read or search the entire file for `addafter`, `addbefore`, `addfirst`, `addlast`, `trigger`, and `var` keywords.**

### Unsupported Feature Comment Classification for Pages

| Unsupported feature type | Action |
|---|---|
| `Property Modification (TextConstString)` | **DELETE** entire comment block — XLIFF handles translations |
| `Property Modification (ImplicitType)` | **DELETE** — handled natively by modern BC |
| `Property Modification (Id)` | **DELETE** entire block — internal variable ID changes, no functional impact |
| `Property Modification (CardPageID)` | **DELETE** — can be set as page property in extension if needed |
| `Code Modification` on triggers | **KEEP** — real business logic needing extraction to page triggers or event subscribers |
| `Code Modification` on local procedures (e.g. `SetColumns`) | **KEEP** — hardest case, see "Code Modification on Local Procedures" below |
| `Code Insertion` on triggers | **KEEP** — real business logic needing extraction |
| `Property Insertion (Permissions)` | **KEEP** — note the permissions for the subscriber codeunit |
| `Property Insertion (SourceTableView)` | **KEEP** — cannot be changed in extension, needs redesign |
| `Property Deletion (SourceTableView/Visible)` | **KEEP** — cannot be removed in extension, needs redesign |

### Code Modification on Local Procedures (Hardest Migration Case)

When a C/AL DELTA modifies a **local procedure** (not a trigger) of the base page, the migration is significantly harder than trigger modifications. This pattern appears in matrix pages, setup pages, and calculation-heavy pages.

**Why it's hard**: Local procedure variables (e.g., `TempMatrixLocation` in page 491's `SetColumns`) are NOT accessible from page extensions or event subscribers. There's no trigger event to hook into.

**Resolution strategy (try in order):**

1. **Check against the verified Base App source** for the target page or symbol definition. Look for:
   - `IntegrationEvent` published inside the procedure
   - The variable declared as `protected` (accessible from page extensions since BC23 Wave 2)
   - If either exists → subscribe to the event or access the protected variable

2. **Submit an event request**: File at github.com/microsoft/ALAppExtensions with:
   - Title: `[Event Request] Page XXX "Page Name" — OnAfterXxx in ProcedureName`
   - Clear description of what parameter you need passed by var reference

3. **Create a custom replacement page**: Copy the entire base page to a custom page (50XXX), embed the same subforms, add the modification directly. Redirect users via Search/Tell Me or profile customization. This is the **reliable fallback** for on-premises.

**Documentation template for the page extension file:**

```al
// MANUAL_TASK: Code Modification on ProcedureName(PROCEDURE N)
//
// BUSINESS LOGIC:
//   (describe what the modification does functionally)
//
// WHY THIS CANNOT BE A SIMPLE PAGE EXTENSION:
//   (explain which variable is inaccessible and why)
//
// RESOLUTION OPTIONS (try in order):
//   1. VERIFY AGAINST BASE APP SOURCE: check the page for events/protected vars
//   2. EVENT REQUEST: github.com/microsoft/ALAppExtensions
//   3. CUSTOM REPLACEMENT PAGE: Copy to page 50XXX
//
// ORIGINAL C/AL DELTA:
//   (paste the relevant DELTA excerpt)
//
// RELATED OBJECTS:
//   (list table extensions, codeunits, etc. that are part of this feature)
```

**Example**: a matrix-style page `SetColumns` procedure adds a filter on a local temporary record based on a UI toggle. The temp record is local and inaccessible from a page extension, so the change requires either an event, a protected variable, or a replacement page.

### Additional Page Extension Cleanup

| What you see | Action |
|---|---|
| `//The property 'PromotedIsBig' can only be set...` + `//PromotedIsBig = true;` | **DELETE** both lines — txt2al artifact when action isn't promoted |
| `//The property 'PromotedCategory' can only be set...` + `//PromotedCategory = Process;` | **DELETE** both lines — same artifact |
| `PromotedActionCategories = '...'` at page level | **KEEP** — fully supported in BC25. No conversion to `actionref` needed during migration |
| `Promoted = true; PromotedIsBig = true;` on custom actions | **KEEP** — fully supported in BC25. No conversion needed |
| `PromotedCategory = Process/Report/Category5/...` on custom actions | **KEEP** — fully supported in BC25. No conversion needed |
| Variable used in trigger code but undeclared in page ext | **ADD** the variable declaration — txt2al sometimes omits `var` sections from page extensions |
| Commented-out code block (`/* ... */`) inside a custom action trigger | Evaluate: if it's dead alternatives, **DELETE**. If it's fallback logic, **KEEP** |

### Batch Processing Strategy for Large Page Extension Folders

When processing 50+ page extensions:

1. **Fast triage**: Count `modify` blocks per file. Files with 0 modify blocks + no Unsupported code = already clean
2. **Delete candidates**: Files with ONLY ImplicitType/TextConstString/Caption/ToolTip content and no custom fields/actions/triggers = DELETE
3. **Batch small files** (<50 lines): Usually have 0–3 modify blocks, quick manual cleanup
4. **Parallelize medium files** (50–200 lines): Group 6–8 files per batch for subagent processing
5. **Individual large files** (200+ lines): Read fully and write clean version — too complex for blind batch

**Expected results**: In a typical BC14 migration, this cleanup reduces total page extension line count by **60–70%** while preserving 100% of functional customizations.

---

## Namespace Suffix Duplication Trap

When applying the project suffix (for example, `PROJ`, `CUST`, or another project affix) to namespace declarations, watch for accidental triple or quadruple application:

```al
// WRONG — suffix applied 3 times (copy-paste error or automated tool bug)
namespace MyProjectPROJPROJPROJ;

// CORRECT — suffix applied once
namespace MyProjectPROJ;
```

**Why this happens:** When a batch rename tool or developer applies the suffix to an already-suffixed string, the suffix concatenates. This is especially common when:
- A search-and-replace adds the suffix to every occurrence of the project name, including ones that already have it
- A namespace was auto-generated from the object name that already contained the suffix
- Copy-pasting from an already-processed file

**Detection:** Search for your suffix appearing more than once in the same identifier:
```
Pattern: PROJ.*PROJ  (or your project suffix)
```

**Prevention:** Before applying a batch suffix rename, first search for existing occurrences of the suffix to avoid double-applying.

---

## Empty Then Clause — `if Rec.Insert() then ;`

C/AL codebases frequently use `if Rec.Insert() then ;` — an `if` with an empty `then` clause (just a semicolon). This is a C/AL idiom for "call the function and ignore the boolean return value."

```al
// C/AL idiom — compiles in AL but is a code smell
if TempDimSetEntry.Insert() then
;

// PREFERRED in AL — clear intent
if not TempDimSetEntry.Insert() then; // explicit: we don't care about the result

// BEST — if you truly don't care about the return value
TempDimSetEntry.Insert(false); // Insert without triggers, discard result
```

**Why it matters:**
- The dangling `;` on a new line confuses readers and linters
- It's unclear whether the developer meant "ignore failure" or forgot the else branch
- In AL, methods like `Insert()`, `Modify()`, `Delete()` return `Boolean` — explicitly deciding what to do on failure is better practice

**When migrating:** Don't block on this — it's cosmetic, not a bug. But if you're already cleaning the file, tighten it up. During Phase 2 cleanup, leave it as-is if the file has higher-priority issues.

---

## Custom Helper Procedures — Standalone Codeunit vs Subscriber

Not all code extracted from copied standard codeunits becomes event subscribers. Some C/AL modifications added **public helper procedures** that are called by other custom codeunits, pages, or reports. These should become standalone codeunits, not subscribers.

**When to use a standalone codeunit (not a subscriber):**
- The procedure is a **public API** called by other custom objects (e.g., `fuShowEditableDimensionSet`, `ValidateShortcutDimValuesFromDimCode`)
- The procedure has no dependency on a standard trigger or event — it's purely custom logic
- Multiple callers reference it — changing the signature would break them

**When to use a subscriber:**
- The procedure must run at a specific point in a standard process (posting, validation, copy)
- It was injected into a standard trigger (`OnInsert`, `OnValidate`, `SetColumns`, etc.)
- No external callers — it's internal to the modification

**Pattern — standalone codeunit for extracted helpers:**

```al
codeunit 54025 "DimensionManagementExt<Suffix>"
{
    // Extracted from: Copied Codeunit 408 "Dimension Management"
    // These are custom public procedures added by Dynavol, NOT modifications
    // to standard triggers. Called by multiple custom pages and codeunits.

    procedure fuShowEditableDimensionSet(DimSetID: Integer; NewCaption: Text[250]; VarRecord: Variant)
    begin
        // Custom dimension set editor with base record context
    end;

    procedure UpdateGlobalDimFromDimSetID5(DimSetID: Integer; var GlobalDimVal5: Code[20])
    begin
        // Custom shortcut dimension 5 resolver
    end;
}
```

**Real example:** One migration extracted 3 custom procedures from a 2,458-line Dimension Management copy into an 84-line standalone codeunit. These are public APIs called by various pages — they don't subscribe to any event.

---

## SMTP Mail / Mail (CU 397/400) → BC25 Email Module — Wrapper Pattern

When a copied standard `SMTP Mail` (CU 400) or `Mail` (CU 397) had custom procedures added (e.g., `CreateMessageNew` with CC parameter, `AddAttachmentS` for multiple attachments), the extraction strategy differs from normal trigger-based extraction:

**Strategy: Thin wrapper codeunit + event subscriber**

1. **For added public procedures** (e.g., `CreateMessageNew`): Create a wrapper codeunit that provides the same call surface but uses `Codeunit "Email Message"` + `Codeunit "Email"` internally
2. **For modified standard procedures** (e.g., `CreateAndSendMessage` with multi-attachment logic): Use an event subscriber on the standard codeunit's event (e.g., `Mail.OnBeforeCreateAndSendMessage`) with `IsHandled = true`
3. **Rename the wrapper** to avoid conflict with the standard codeunit name (e.g., `"SMTP Mail Ext<Suffix>"` instead of `"SMTP Mail"`)
4. **Update all callers** to reference the new codeunit name

**Key differences from standard subscriber extraction:**
- The wrapper keeps the original call flow (`Create → AddAttachment → Send`) for minimal caller disruption
- `SenderName`/`SenderAddress` may be ignored — BC25 Email module uses configured Email Accounts
- DotNet `SmtpMessage` is completely gone — all attachment handling uses `InStream`
- `FileMgt.BLOBImportFromServerFile` is deprecated — use `File.Open()` + `CreateInStream()` directly

**Real example:** One migration replaced a 436-line copied SMTP Mail with a 64-line wrapper (`"SMTP Mail Ext<Suffix>"`) plus a small event subscriber for multi-attachment support.

---

## Page Structure: Cuegroup Actions Require `actions { }` Wrapper

Inside a `cuegroup` on a Role Center page, individual `action()` blocks **must** be wrapped in an `actions { }` container. Only `field()` controls can appear directly inside `cuegroup` — actions need the explicit wrapper.

```al
// WRONG — action() directly inside cuegroup
cuegroup(MyGroup)
{
    field("Open Orders"; "Open Orders") { ApplicationArea = All; }
    action("Process Order")                // AL0104: '}' expected
    {
        RunObject = Page "Sales Order";
    }
}

// CORRECT — actions wrapped in actions { }
cuegroup(MyGroup)
{
    field("Open Orders"; "Open Orders") { ApplicationArea = All; }
    actions
    {
        action("Process Order")
        {
            RunObject = Page "Sales Order";
        }
    }
}
```

**How this breaks:** During cleanup, a developer or tool may accidentally remove the `actions { }` wrapper while trying to fix a "duplicate actions block" issue. The compiler then reports `AL0104: Syntax error, '}' expected` at the first `action()` because the parser expects only `field()` or `actions` inside `cuegroup`.

**Detection:** Search for `action(` at the same indentation level as `field(` inside `cuegroup` blocks — these are missing their `actions { }` wrapper.

---

## Page Extension: `area()` Cannot Be Nested Inside `add*()` Blocks

In page extensions, `area(processing)`, `area(reporting)`, etc. must be **direct children** of the `actions { }` block. txt2al sometimes places an `area()` block inside `addfirst()`, `addafter()`, or `addlast()` blocks, which is structurally invalid.

```al
// WRONG — area() nested inside addafter()
actions
{
    addafter("Absence Registration")
    {
        action(Unarchive) { ... }
        area(reporting)          // AL0104: '}' expected
        {
            action("Report A") { ... }
        }
    }
}

// CORRECT — area() is a sibling of addafter(), both inside actions
actions
{
    addafter("Absence Registration")
    {
        action(Unarchive) { ... }
    }
    area(reporting)
    {
        action("Report A") { ... }
    }
}
```

**How this breaks:** txt2al converts C/AL action containers into `area()` blocks, but doesn't always place them at the correct nesting level. The parser expects `area()` only as a direct child of `actions { }`, so nesting it inside `add*()` produces cascading syntax errors that propagate through all subsequent action definitions.

**Fix:** Close the `add*()` block before the `area()`, then open the `area()` at the same level.

---

## C/AL-Only Types: `Automation` Variables

C/AL supported COM Automation objects via the `Automation` type. This type has **no equivalent in AL** — the `Automation` keyword, `Create()` function, and all COM interop methods are completely removed.

```al
// C/AL — valid
var
    wscript: Automation MyAutomationAlias;
begin
    Create(wscript, false, true);
    wscript.SendKeys('%{F4}');
end;

// AL — Automation type does not exist
// Must remove or replace with AL-native approach
```

**Common Automation objects found in BC14 migrations:**

| Automation Object | C/AL Usage | AL Replacement |
|---|---|---|
| `WScript.Shell` | `SendKeys`, `Run`, `Popup` | No direct equivalent — remove or redesign |
| `Excel.Application` | Workbook manipulation | `System.IO` + `Codeunit "Excel Buffer"` |
| `MSXML2.DOMDocument` | XML processing | `XmlDocument`, `XmlElement` (AL native) |
| `ADODB.Stream` | Binary file handling | `InStream` / `OutStream` (AL native) |
| `Scripting.FileSystemObject` | File/folder operations | `File` data type + `File Management` CU |

**Fix strategy:**
1. Search the file for all usages of the Automation variable
2. If the usage is trivial (e.g., `SendKeys` to close a window) — comment out or remove entirely
3. If the usage implements real business logic — redesign using AL-native APIs
4. Remove the variable declaration

---

## Object Virtual Table: `Compiled` Field Removed

The `Object` virtual table (Table 2000000001) in modern BC no longer exposes the `Compiled` field. C/AL reports and pages that filter on `Compiled=CONST(true)` will fail with `AL0224: Expression expected`.

```al
// BROKEN — Compiled field doesn't exist in modern BC
DataItemTableView = SORTING(Type, "Company Name", ID)
    WHERE(Type = CONST(Table),
          "Version List" = FILTER(*RH*),
          Compiled=CONST(true));

// FIXED — remove the Compiled filter
DataItemTableView = SORTING(Type, "Company Name", ID)
    WHERE(Type = CONST(Table),
          "Version List" = FILTER(*RH*));
```

**Why it's safe to remove:** In the AL extension model, all objects are always compiled — there is no concept of uncompiled objects. The filter was meaningful in C/AL (where objects could exist in an uncompiled state) but is meaningless in AL.

**Note:** The `Object` table itself is a limited virtual table in modern BC. Other fields like `Version List` may also have limited functionality. Reports and pages that rely heavily on the Object table may need more substantial redesign.

---

## Object Identifier Length Limit — 30 Characters

AL enforces a maximum of **30 characters** for application object identifiers (the object name). This is a hard compiler error (`The length of the application object identifier '...' cannot exceed 30 characters`).

### Why This Happens During Migration

In C/AL, object names could be much longer. During migration, the project suffix (for example `PROJ`) is appended to object names, pushing many past the 30-char limit. Names that were 25–30 chars in C/AL can become 31–36 chars once suffixed.

### Shortening Strategy

Use **PascalCase abbreviations** while preserving recognizability:

| Original (too long) | Shortened (≤30) | Technique |
|---|---|---|
| `Purch. Notification ManagementPROJ` (32) | `PurchNotifMgmtPROJ` (20) | Abbreviate words |
| `Mgt Communication StructuredPROJ` (30) | `MgtCommStructuredPROJ` (23) | Shorten middle words |
| `BlanketPurchaseOrderSubformPROJ` (29) | `BlnkPurchOrdSubformPROJ` (26) | Abbreviate common prefixes |
| `WhseReclassificationJournalPROJ` (31) | `WhseReclassJournalPROJ` (24) | Drop redundant middle |
| `InvoiceHandlerLocalizationPROJ` (30) | `InvHandlerLocalPROJ` (19) | Compress long segments |

**Common abbreviation patterns:**

| Full word | Abbreviation | Context |
|---|---|---|
| `Purchase` | `Purch` | Standard BC convention |
| `Management` | `Mgmt` or `Mgt` | Standard BC convention |
| `Notification` | `Notif` | |
| `Communication` | `Comm` | |
| `Correction` | `Corr` | |
| `Interface` | `Intf` | |
| `Dimension` | `Dim` | Standard BC convention |
| `Registered` | `Reg` | |
| `Reclassification` | `Reclass` | |
| `Warehouse` | `Whse` | Standard BC convention |
| `Blanket` | `Blnk` | |
| `Transfer` | `Transf` | |

### Cross-Reference Updates

Renaming objects requires updating all references project-wide. The risk level depends on object type:

| Object type | Cross-reference risk | Reference patterns |
|---|---|---|
| **Page extensions** | **None** — page extension names are never referenced | Safe to rename without search |
| **Table extensions** | **Rare** — only if explicitly referenced by name | Quick grep to confirm |
| **Codeunits** | **High** — referenced in variable declarations, `RunObject`, event subscribers | Full project search required |
| **Pages/Tables** | **High** — referenced in `SourceTable`, `RunObject`, `PAGE.RunModal`, `CalcFormula`, `TableRelation` | Full project search required |

**For codeunits**, reference patterns to search for:
- `Codeunit "Old Name"` — variable declarations
- `Codeunit::"Old Name"` — enum-style references
- `RunObject = Codeunit "Old Name"` — page actions
- `Codeunit."Old Name"` — direct invocation

**For pages/tables**, reference patterns:
- `SourceTable = "Old Name"` — page definitions
- `Record "Old Name"` — variable declarations
- `PAGE::"Old Name"` / `Page.RunModal(Page::"Old Name")` — page references
- `TableRelation = "Old Name"` / `CalcFormula = Lookup("Old Name"...)` — field references

### Mixed Encoding in Names

When objects have encoding corruption in their names (accented chars → multi-byte corruption like `"¿` for `è`), the corrupted chars may inflate the byte count. Additionally, **reference files may use different encoding** — some have the corrupted form, others have the correct UTF-8 form.

**Both variants must be replaced:**

```powershell
# Build corrupted character sequences
$corrupt_e_grave = [char]0x201C + [char]0x00BF  # è → "¿
$corrupt_o_circ = [char]0x201C + [char]0x201E   # ô → "„
$corrupt_a_grave = [char]0x201C + [char]0x00E1   # à → "á

# Replace BOTH forms in all files
$corruptName = "Groupes traitement du carri${corrupt_e_grave}re"
$correctName = "Groupes traitement du carrière"
$newName = "GrpTraitCarriere"

foreach ($f in $allFiles) {
    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
    $content = [System.Text.Encoding]::UTF8.GetString($bytes)
    $changed = $false
    if ($content.Contains($corruptName)) {
        $content = $content.Replace($corruptName, $newName); $changed = $true
    }
    if ($content.Contains($correctName)) {
        $content = $content.Replace($correctName, $newName); $changed = $true
    }
    if ($changed) {
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($f.FullName, $content, $utf8NoBom)
    }
}
```

### Batch Detection

Find all objects exceeding the limit:

```powershell
Get-ChildItem -Path $srcPath -Filter "*.al" -Recurse | ForEach-Object {
    $line1 = Get-Content $_.FullName -TotalCount 1 -Encoding UTF8
    if ($line1 -match '^(\w+) (\d+) "(.+?)"') {
        if ($Matches[3].Length -gt 30) {
            Write-Host "$($Matches[1]) $($Matches[2]) `"$($Matches[3])`" ($($Matches[3].Length) chars)"
        }
    }
}
```

### File Rename

Always use `git mv` to preserve history:
```
git mv "OldLongName<Suffix>.Codeunit.al" "ShortName<Suffix>.Codeunit.al"
```

---

## Procedure `begin`/`end` Imbalance After Code Surgery

When fixing truncated code, dangling else blocks, or commented-out code inside procedures, the `begin`/`end` nesting can become unbalanced. This is a **regression risk** — the fix for one error introduces another.

**Symptoms:** `AL0104: Syntax error, 'end' expected` pointing at the next procedure's attribute (e.g., `[Scope('Internal')]`) or at the next `procedure` keyword.

```al
// BROKEN — procedure begin has no matching end
procedure ConfirmDateCalc(...)
var
    TextTosend: Text[500];
begin
    if Format(DateCalcTmp) <> Format(DateCalc) then begin
        // ... nested logic ...
    end;
                    // ← Missing end; for the procedure itself!
[Scope('Internal')]
procedure NextProcedure(...)
```

**Prevention checklist after any code surgery:**
1. Count every `begin` in the procedure (including nested `if...then begin`)
2. Count every `end;` — the counts must match
3. The LAST `end;` before the next procedure attribute closes the procedure body
4. If you remove a `begin` (e.g., by fixing a dangling else), also remove the corresponding `end;`
5. If you add code after a conditional block, verify the procedure's own `end;` is still present

**Detection:** Compile after every structural change. If the error points to the *next* procedure's attribute or declaration rather than to code inside the current procedure, the current procedure is missing its closing `end;`.

---

## Encoding Corruption — Tool Workaround for StrReplace

When txt2al produces files with garbled encoding (common with French/Belgian/Dutch characters), text replacement tools (StrReplace, sed) will fail to match the corrupted bytes even though they appear identical when displayed.

**Symptoms:**
- StrReplace reports "string not found" even when the text appears to match
- Fuzzy match suggestions show the exact same text
- Characters like `"¬` (should be `ê`), `"á` (should be `à`), `"ë` (should be `é`), `"º` (should be `ç`), `"¿` (should be `è`) are present

**Root cause:** The garbled characters are multi-byte sequences that display one way in the Read tool but are stored differently on disk. The replacement tool's byte comparison fails.

**Workaround:** Instead of trying to match the corrupted text:
1. Read the full file
2. Identify the clean section you want to keep (by line numbers)
3. Write the entire file with only the clean content
4. Verify the result

**Example:** To remove TextConstString comment blocks (lines 82-112) from a file while keeping lines 1-79:
```
1. Read the file to confirm structure
2. Write the file with only lines 1-79 content + closing brace
```

This is more reliable than trying to match garbled strings character-by-character.

---

## Migration Codeunit Necessity Analysis

When reviewing a large BC14→BC25 migration, it may seem like many manual data migration codeunits should be needed. In practice, most projects need very few.

**Why most custom data migrates automatically:**

Microsoft's Cloud Migration Tool moves data based on field IDs and data types. If a custom table extension adds `field(50000; "MyField"; Text[50])` in BC14, and the same field definition exists in the BC25 extension, the data migrates automatically. No migration codeunit needed.

**When a manual migration codeunit IS needed:**

| Scenario | Example | Migration CU Type |
|---|---|---|
| Table is obsolete in BC25 | Product Group (5723) → Item Category hierarchy | Manual utility (`Run ONCE` pattern) |
| Field restructuring across tables | Custom fields on obsolete table need to move to replacement table | `Subtype = Upgrade` or manual utility |
| Data type transformation | Option values need remapping after Enum conversion | `Subtype = Upgrade` |
| Hierarchical data restructuring | 2-level → 3-level category hierarchy with custom "Sous Code" key | Manual utility |
| Belgian → Luxembourg table migration | TAB2000001 → TAB69001 (different table, same purpose) | Manual utility |

**When a migration codeunit is NOT needed:**

| Scenario | Why |
|---|---|
| Custom fields with same IDs and types | Cloud Migration Tool handles automatically |
| FlowFields (FieldClass = FlowField) | No stored data — calculated at runtime |
| FlowFilters (FieldClass = FlowFilter) | No stored data — runtime filter |
| Custom tables with same structure | Cloud Migration Tool handles automatically |
| Table extensions where only captions changed | No data impact |

**Best practice:** Always create a `Subtype = Upgrade` codeunit skeleton early, even if empty. This gives you a place to add version-gated migration logic as the extension evolves post-go-live.
