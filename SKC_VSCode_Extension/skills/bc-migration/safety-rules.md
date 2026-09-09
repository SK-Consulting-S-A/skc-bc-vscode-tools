# Safety Rules — Data Integrity During C/AL to AL Migration

## Plan Mode Gate — Confirm Before Touching Files

Before writing, deleting, or modifying any file in this migration, present the proposed changes for user approval before proceeding.

**Why this matters:**
- Deleting a copied codeunit removes the only reference to custom logic that may still be needed
- Creating a subscriber with the wrong event signature causes silent data loss in production
- Renaming fields without a full cross-reference sweep breaks FlowFields, CalcFormulas, and external consumers
- Batch operations compound individual risks — the user must see and approve the full scope

**The plan must list:**
- Every file that will be created, modified, or deleted
- The action and rationale for each
- The execution order (dependencies first)
- Any risks or open questions

**Only proceed in Agent Mode after the user confirms the plan.** If the user adjusts the plan, follow their version. If new risks emerge during execution, pause and re-confirm.

Read-only work (reading DELTAs, triaging files, answering questions) does not require a plan.

---

## Verifying Source Code Authenticity

Before using any file as a reference for "standard BC25 behavior," verify it is actually from the standard Base Application — not a project copy.

### The Ambiguous Reference Problem

In a project with copied standard codeunits (e.g., CU 54038 `"Approvals Mgmt."` copying standard CU 1535), VS Code and Cursor IDE will resolve `Codeunit::"Approvals Mgmt."` to whichever object they find first — often the **project's copy** rather than the standard. This means:

- "Go to Definition" navigates to your copy, not the standard
- Exporting via "Go to Definition" gives you custom code labeled as standard
- Any comparison against this "standard" is invalid

### Five Signs of a Non-Standard Source

Check EVERY file claimed to be "standard source" for these red flags:

| # | Check | Standard | Custom copy |
|---|---|---|---|
| 1 | **Object ID** | < 50000 (e.g., 1535, 80, 226) | 50000+ or 54xxx (e.g., 54038, 54010) |
| 2 | **Field references** | Only standard BC field names | Custom fields like `"Free Text"`, `"Diplomatic Exemption"` |
| 3 | **Developer comments** | None, or Microsoft's standardized comments | Date-tagged comments: `//130618:DEV:`, `//-->20220328-FEAT01` |
| 4 | **Traceability header** | None | `// Replaces standard Codeunit NNN "Name"` |
| 5 | **Custom procedures** | Only procedures documented in MS Learn | Procedures like `CreateServItemOnPurchLineRcpt`, `UnApplyCodaStatementCustLedgerEntry` |

### Safe Source for Standard BC25 Code

The **only reliable source** for standard BC25 code is the unzipped `.app` file:

```
.alpackages/Microsoft_Base Application/src/
```

Or better, a **dedicated folder outside the repo** (for example `<StandardSourcePath>`) to avoid bloating git. See [conventions.md](conventions.md) for the template.

This source contains Microsoft's actual code. It cannot contain project customizations because it's extracted directly from the signed `.app` package.

### Impact of Using Wrong Source

If you discover that you've been comparing against a project copy:
- **DELTA-based analysis remains valid** — DELTAs are diffs against the original standard, unaffected by copies
- **Event signatures may be wrong** — re-verify all subscriber event names and parameters against the real BC25 source
- **"BC25 already handles it" conclusions may be wrong** — re-check by reading the actual standard code

---

## Two-Pass Verification for Object Deletion

Before deleting **any** copied standard object (page, report, codeunit, or XMLport), apply both verification passes. A single pass is insufficient — each catches different failure modes.

### Why One Check Is Not Enough

| Check alone | What it misses |
|---|---|
| DELTA only | Modifications made outside BC14's delta process (manual file edits, post-txt2al changes, custom code injected directly into the export) |
| BC25 source only | Objects that look standard but have subtle business-logic changes not detectable by marker scan (e.g., a modified `WHERE` clause, a changed constant, a reordered procedure call) |

### Pass 1: DELTA Folder Check

Check whether a `.DELTA` file exists for the object in the appropriate `Exports/Delta/<ObjectType>/` folder.

- **Match by object type + ID**: e.g., page 99000806 → `PAG99000806.DELTA`, report 2000041 → `REP2000041.DELTA`
- **DELTA exists** → object was modified in BC14 → **do NOT delete** (renumber + suffix instead)
- **No DELTA** → BC14's change-tracking system recorded no modifications → proceed to Pass 2

### Pass 2: BC25 Source Code Comparison

Recover the file (from git history if already deleted) and compare against the BC25 standard source in `BC25/Microsoft_Base Application/src/`.

**Three sub-checks:**

1. **Custom marker scan**: Search the file content for project-specific patterns:
   - Project suffix (e.g., `002CGD`, `003SKC`)
   - Project/customer name
   - Custom field ID ranges (50000-69999)
   - `Unsupported feature` comments
   - Custom procedure naming patterns
   - Any match → file has custom content → **do NOT delete**

2. **Structural procedure comparison**: Extract all `procedure` and `trigger` names from the file. Verify each exists in the BC25 standard counterpart.
   - All present → confirmed standard code
   - Some missing → **investigate individually**: check the procedure body (does it call only standard BC objects?), check for the DELTA (already confirmed absent in Pass 1), determine if it's a standard BC14 method refactored in BC25
   - Common BC14→BC25 refactoring examples: `GetLastViewedJournalBatchName`, `ShowTracking`, `MATRIX_GenerateColumnCaptions`, `SetSourceType`

3. **Line count comparison**: Compare line counts between the copy and BC25 standard.
   - Copy has **fewer or equal** lines → expected (BC14 vintage lacks namespaces, copyright headers, modern features)
   - Copy has **significantly more** lines → likely contains custom code → **investigate**

### Decision Matrix

| Pass 1 (DELTA) | Pass 2 (BC25 source) | Action |
|---|---|---|
| No DELTA | Clean (no markers, all procs match, fewer lines) | **Delete** — confirmed pure copy |
| Has DELTA | — | **Keep and renumber** to custom ID range + project suffix |
| No DELTA | Custom markers found | **Investigate** — custom code exists outside DELTA process |
| No DELTA | Procedures missing from BC25 | **Investigate** each — likely BC14 refactoring, verify individually |
| No DELTA | More lines than BC25 | **Investigate** — possible embedded custom code |

### Batch Operations

When deleting many files at once (e.g., 50+ copied standard pages), run both passes systematically:
1. List all candidate files with standard-range IDs
2. Batch-check the DELTA folder for all IDs at once
3. Batch-scan all files for custom markers using regex
4. Batch-extract procedure names and compare against BC25
5. Document results in the master tracking file before executing any deletions

---

## The Cardinal Rule: Trust Nothing

Every C/AL-to-AL migration operates on a **live production system** with real business data.
The txt2al tool is a mechanical converter — it knows nothing about your business.
Field descriptions, developer comments, and "OBSOLETE" markers are **human opinions from years ago**.
Treat them as hints, not as authorization to delete.

## Never Delete Without Verification

### Field Descriptions Are Not Reliable

| What you see | What it might mean | What you must do |
|---|---|---|
| `Description = 'OBSOLETE'` | A developer **intended** to deprecate it years ago | Check: does the SQL column still contain data? |
| `Description = 'no longer used'` | Someone **believed** it was unused at the time | Check: are there reports, integrations, or Power BI queries reading it? |
| `Description = 'ASS 180218 OBSOLETE'` | Developer ASS marked it obsolete on 2018-02-18 | Check: was the data actually migrated to the replacement field? |
| `Description = 'migrated to X'` | The migration was **planned** | Check: did the migration actually run? Is `X` populated? |
| No description at all | Nobody documented it | This field is just as likely to be critical as any other |

### The Five-Point Verification Before Any Deletion

Before deleting ANY field, table extension, or object:

1. **SQL check** — Query the production database. Does the column contain non-null, non-default data?
   ```sql
   SELECT COUNT(*) FROM [dbo].[Company$TableName] WHERE [FieldName] <> '' AND [FieldName] IS NOT NULL;
   ```
2. **Cross-reference check** — Search the entire codebase for references to this field (FlowFields, CalcFormulas, TableRelations, code references, report columns).
3. **External consumer check** — Are there Power BI reports, OData feeds, web services, or external integrations reading this field?
4. **Report layout check** — Do RDLC or Word layouts reference this field in their datasets?
5. **Business owner confirmation** — When in doubt, ask the functional owner. Never assume.

### The "It Compiles" Trap

A file that compiles is NOT necessarily correct:
- A deleted field won't cause a compile error if nothing references it in AL code
- But the data in SQL is now orphaned and inaccessible
- External consumers (Power BI, web services) will silently break
- Users will discover the loss weeks later when running quarterly reports

## Field Preservation Hierarchy

When triaging fields, follow this hierarchy from safest to most dangerous:

| Action | Risk | When to use |
|---|---|---|
| **Keep as-is** | None | Default for any field you're unsure about |
| **Keep + mark ObsoleteState = Pending** | Low | Field has no code references but might have data |
| **Keep + add ObsoleteTag** | Low | You've confirmed it's unused but want a grace period |
| **Remove from extension** | **HIGH** | ONLY after all 5 verification points pass |

### ObsoleteState as a Safety Net

When you suspect a field is unused but cannot verify 100%, don't delete — deprecate:

```al
field(50015; "OldBudgetControl"; Boolean)
{
    ObsoleteState = Pending;
    ObsoleteReason = 'Believed unused since 2018. Verify data before removal. Original description: DEV 180218 OBSOLETE';
    ObsoleteTag = '26.0';
    Caption = 'Old Budget Control';
    DataClassification = CustomerContent;
}
```

This approach:
- Preserves the SQL column and data
- Generates compiler warnings if anything references it
- Documents intent for future developers
- Gives a full version cycle to discover hidden dependencies

## Modify Block Preservation Rules

### Safe to Delete (caption-only noise)

```al
modify("No.")
{
    Caption = 'No.';
}
```

This is safe because it restates the standard caption with zero behavioral change.

### NEVER Delete Without Investigation

```al
modify("Dimension Value Name")
{
    // Unsupported feature: Property Modification (Data type)
    Description = 'ACH01';
}
```

This looks like noise but tells you:
- Someone **changed the data type** of this field in C/AL (e.g., widened Text[30] to Text[50])
- The Description `ACH01` references a feature/ticket
- You need to understand WHY the data type was changed and whether BC25's default is sufficient
- If users relied on the wider field, BC25's standard width may truncate data

### Investigation Checklist for "Unsupported" Modify Blocks

1. What property was modified? (Data type, TextConstString, OptionString, etc.)
2. What was the original value vs the modified value? (Check the C/AL delta file)
3. Is the modification still needed in BC25? (BC25 may have already adopted the change)
4. If still needed, what's the BC25 approach? (Different property? Event? Impossible?)
5. Document the finding even if no action needed

## Commented-Out Code Safety

### Custom Tables: Safe to Clean

In **custom tables** (objects fully in your ID range), all code is custom. Commented-out code was disabled by a developer and is safe to remove. Git preserves history if it's ever needed. Historic change-tracking tags (`//-->DATE-TAG`, `//YYMMDD:dev:description`) are C/AL-era source control — git replaces them.

### Table Extensions and Copied Standard Codeunits: Dangerous

In **table extensions** and **copied standard codeunits**, commented-out code may be:
- **Standard BC code** that was commented out during C/AL modification — removing it loses the reference to what the standard code looked like
- **C/AL merge tool artifacts** — commented blocks that indicate unresolved merge conflicts (see [delta-methodology.md](delta-methodology.md))
- **Custom code** that was disabled — only this category is safe to remove

**Never bulk-remove comments from table extensions or copied codeunits.** Each commented block must be individually analyzed to determine whether it is standard code, a merge artifact, or disabled custom code.

### The Exception: Change-Tracking Tags Are Always Safe

Regardless of object type, **change-tracking tags** are always safe to remove because they are custom metadata, never standard BC code:
- `//-->YYYYMMDD-TAG` / `//<--YYYYMMDD-TAG`
- `//Begin IT-NNNNN` / `//End IT-NNNNN`
- `//YYMMDD:dev:description`
- Header change-log blocks listing dates and developers

See [patterns.md](patterns.md) for the full classification of comment types and cleanup strategy.

---

## Copied Standard Codeunit Safety

The 60 full copies of standard codeunits are the highest-risk area.

### Before Extracting Any Custom Code

1. **Identify every custom line** — Use legacy comment tags (`//DEV`, `//TICKET-01`, `//FEAT-A`, etc.)
2. **For each custom block, determine**:
   - Is it modifying data? → Must be preserved via event subscriber
   - Is it modifying flow control? → May need a different approach
   - Is it adding validation? → Find the right OnBefore/OnAfter event
   - Is it dead code (commented out)? → Safe to skip, but document what it was
3. **Never assume commented-out code is irrelevant** — It may document business rules that should be implemented differently

### Cross-Codeunit Dependencies

Copied codeunits often reference each other's custom procedures. Before deleting any copied codeunit:
- Search for its custom procedure names across ALL copied codeunits
- Map the dependency graph
- Extract shared procedures to a utility codeunit first
- Then replace callers one at a time

## Data Migration Safety

### Upgrade Codeunit Principles

1. **Always write upgrade codeunits BEFORE deleting old structures**
2. **Test the upgrade on a copy of production data** — Never on production directly
3. **Include rollback logging** — Record what was migrated so you can verify
4. **Handle nulls and edge cases** — Production data is messy; test data is clean
5. **Run the upgrade idempotently** — It should be safe to run twice

### The "Production Data Is Weird" Rule

Test databases have clean, predictable data. Production databases have:
- Fields containing values that don't match their OptionMembers
- Dates from the year 1753 (SQL minimum) or 9999 (placeholder for "never")
- Text fields with leading/trailing spaces, newlines, or control characters
- Records that violate table relations (because they were created before the relation was added)
- "Soft deleted" records with Status = Closed but still present

Your migration code must handle all of these gracefully.

## External Integration Safety

### Before Removing Any Object or Field

Check for external consumers:
- **Web Services** — Is the table/page published as a web service? (`Web Service` table)
- **OData** — Are there OData-enabled pages exposing this data?
- **Power BI** — Are there Power BI datasets connected to this table?
- **Power Automate** — Are there flows triggered by or reading this data?
- **Custom APIs** — Are there API pages exposing this data?
- **RapidStart** — Are there configuration packages referencing these fields?
- **Excel integration** — Do users export this data via Edit in Excel?

### Web Service Registry Check

```sql
SELECT "Object Type", "Object ID", "Object Name", "Service Name", Published
FROM [dbo].[Company$Web Service]
WHERE Published = 1;
```

Any object in this list must be treated with extreme caution during migration.

## Common Logic Bugs Found During Migration Review

When reviewing migrated codeunits line-by-line, these bug patterns appear repeatedly. They are introduced during C/AL development (not by txt2al) but are only caught during careful migration review. Add these to your review checklist:

### Always-False / Always-True Conditions

```al
// BUG: Comparing a field to itself — always true, condition is meaningless
if Customer."VAT Registration No." <> Customer."VAT Registration No." then
    Error(VATMismatchErr);

// FIX: Should compare against xRec or a different variable
if Customer."VAT Registration No." <> xRec."VAT Registration No." then
    Error(VATMismatchErr);
```

```al
// BUG: Range check where min = max — always false for non-'A' chars
if (EmailAddress[i] >= 'A') and (EmailAddress[i] <= 'A') then

// FIX: Should be A..Z
if (EmailAddress[i] >= 'A') and (EmailAddress[i] <= 'Z') then
```

### Missing Record Initialization

```al
// BUG: UserSetup is never loaded before using it
procedure SendMail(...)
var
    UserSetup: Record "User Setup";
begin
    CDUmail.NewMessage('', UserSetup."E-Mail", ...);  // UserSetup is empty!
end;

// FIX: Load the record first
procedure SendMail(...)
var
    UserSetup: Record "User Setup";
begin
    UserSetup.Get(UserId());
    CDUmail.NewMessage('', UserSetup."E-Mail", ...);
end;
```

### Inverted Condition Logic

```al
// BUG: When email IS empty, assigns empty string; when NOT empty, uses a different source
if SalespersonPurchaser."E-Mail" = '' then
    EmailAddress := ''
else
    EmailAddress := UserSetup."E-Mail";

// The developer likely meant the opposite — use the direct email when available
```

### Dead Code via Early Exit

```al
// BUG: Procedure starts with unconditional exit — entire body is dead
procedure CreateCustomerBillTo(...)
begin
    exit;  // Everything below is unreachable
    Customer.Get(CustomerNo);
    // ... 50 lines of dead code ...
end;
```

### Wrong Record Type in Dimension Logic

```al
// BUG: Using Vendor Ledger Entry table for Customer dimension lookup
DetailedVendorLedgEntry.SetRange("Customer No.", CustomerNo);  // Wrong table!

// FIX: Use the correct table
DetailedCustLedgEntry.SetRange("Customer No.", CustomerNo);
```

### Duplicate Event Subscribers on Same Table

```al
// BUG: Two subscribers fire for the same event — logic runs twice
[EventSubscriber(ObjectType::Table, Database::"Custom Table<Suffix>", 'OnAfterModifyEvent', '', false, false)]
local procedure PosteTable_OnAfterModifyEvent(...)

[EventSubscriber(ObjectType::Table, Database::"Custom Table<Suffix>", 'OnAfterModifyEvent', '', false, false)]
local procedure Poste_OnAfterModifyEvent(...)
```

**Detection:** Search for duplicate `[EventSubscriber(...)]` attributes targeting the same object + event combination.

### Prevention Strategy

After extracting or cleaning each codeunit:
1. **Read every condition** — is it comparing the right variables?
2. **Trace every record variable** — is it loaded (`Get`, `Find`, `SetRange`) before use?
3. **Check every assignment** — source and target fields match logically?
4. **Search for early exits** — `exit` without conditions at the start of a procedure = dead code
5. **Search for duplicate subscribers** — same table + same event in the same or different codeunits

---

## The "Why Was This Changed?" Investigation

For every C/AL modification, there is a reason. The reason may be:
- A legal requirement (Luxembourg VAT, customs, domiciliation)
- A business process optimization
- A bug fix for a BC standard issue
- An integration requirement
- No longer relevant (but you must prove this, not assume it)

### Investigation Sources (in order of reliability)

1. **The code itself** — Comments, variable names, procedure names
2. **Legacy comment tags** — `//FEAT-A`, `//ACH01`, `//FEAT-01` point to features
3. **Commit history** — Git/TFS history may have change descriptions
4. **Field Description metadata** — Dates and developer initials give context
5. **The functional owner** — The person who requested the change
6. **Ticket/project references** — `PT-0044`, `AL15`, etc.

### When You Cannot Determine the Reason

If you cannot determine why a modification exists:
- **Keep it** as the default action
- Add a `// TODO(migration): Purpose unknown — verify with [owner] before removing` comment
- Log it in the migration tracking document
- Schedule a review with the functional team

## Schema Change Safety

### Changes That Can Break Synchronization

These changes will cause `Sync-NAVApp` to fail on a database with data:

| Change | Risk | Mitigation |
|---|---|---|
| Removing a field from an extension | Data loss | Use ForceSync (destroys data) or write upgrade codeunit |
| Changing a field's data type | Incompatible | Add new field, migrate data, deprecate old field |
| Changing a field's length (shorter) | Truncation | Only safe if no data exceeds new length |
| Removing a table extension entirely | All custom field data lost | Verify no data exists first |
| Changing field ID | Treated as remove + add | Never do this |

### The Safe Migration Pattern for Field Changes

```
1. Add new field (with correct type/length)
2. Write upgrade codeunit to copy data: old field → new field
3. Mark old field ObsoleteState = Pending
4. Deploy and run upgrade
5. Verify all data migrated correctly
6. In NEXT version: mark old field ObsoleteState = Removed
7. In version AFTER that: physically remove the old field
```

This takes 3 release cycles but guarantees zero data loss.
