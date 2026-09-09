# Checklists — Per-Object and Per-Phase Migration Checklists

## Phase 0: Pre-Conversion Inventory

Before running txt2al or any conversion tool, build a complete inventory.

- [ ] **Export all C/AL objects** in new TXT syntax from BC14 using `Export-NAVApplicationObject`
- [ ] **Categorize every object** into: Standard-modified (delta), Fully-custom, Test object
- [ ] **Document all custom object IDs** — tables, pages, codeunits, reports, XMLports, queries
- [ ] **Document all standard objects with modifications** — these become extensions or subscribers
- [ ] **Identify all DotNet dependencies** — list every DotNet assembly reference
- [ ] **Identify all inter-object dependencies** — which custom objects reference which
- [ ] **Identify external integrations** — web services, OData, Power BI, Power Automate
- [ ] **Snapshot the production database schema** — record every custom column, its data type, and row count
- [ ] **Identify all RDLC/Word report layouts** — list custom layouts and their dataset dependencies
- [ ] **Identify obsolete BC25 tables** — check if any extensions target tables removed since BC14
- [ ] **Assign ownership** — who owns each object based on team folder structure (as defined in project conventions)
- [ ] **Set up a BC25 sandbox** — for compiling and testing against BC25 symbols
- [ ] **Generate a Cross-Reference Inventory Report** — a CSV/spreadsheet mapping every modified NAV object to its AL equivalent. This is the central progress-tracking artifact for the entire migration. See below for the matching methodology.

### Cross-Reference Inventory Report

The cross-reference report maps every modified C/AL object (from the NAV object list) to its AL equivalent in the `src/` folder. It answers: "For each modified NAV object, does an AL replacement exist, and where is it?"

**Columns:** NAVType, NAVId, NAVName, IsCustom (Custom/Standard), ExpectedAL (expected migration approach), Status (FOUND/MISSING), MatchType, ALObjectType, ALObjectName, ALFilePath, ExportFile (location of C/AL .DELTA/.TXT), VersionList

**Six matching strategies (applied in order — first match wins):**

| # | Strategy | What it matches | Example |
|---|---|---|---|
| 1 | **Direct ID match** | AL object with same type + ID as NAV object | Table 50095 → `table 50095` |
| 2 | **Extension by extends name** | tableextension/pageextension `extends "NAV Name"` | Table 18 "Customer" → `tableextension extends "Customer"` |
| 3 | **EventSubscriber match** | `[EventSubscriber(ObjectType::Codeunit, Codeunit::"NAV Name", ...)]` in any codeunit | Codeunit 80 "Sales-Post" → subscriber in `SalesPostEvent<Suffix>` |
| 4 | **Extension by fuzzy name** | Extension whose name contains the NAV object name | Page 42 "Sales Order" → pageextension "Sales Order Ext" |
| 5 | **Codeunit name match (new ID)** | AL codeunit with same name but different ID (txt2al renumbered it) | Codeunit 408 "Dimension Management" → codeunit 54025 with same name |
| 6 | **Origin comment match** | `// Replaces standard Codeunit NNN` comment in file header | Codeunit 231 → file starting with `// Replaces standard Codeunit 231` |

**Also track:** Whether a corresponding C/AL export file (.DELTA or .TXT) exists, and where (root vs backup folder). This helps prioritize MISSING objects — those with export files can be analyzed; those without may have been trivial.

**Automation:** Write a PowerShell script that:
1. Parses the NAV object CSV (filtering Modified=Yes, excluding system objects and MenuSuites)
2. Scans all `.al` files to build an index of AL objects (type, ID, name, extends clause)
3. Scans all codeunit `.al` files for `[EventSubscriber]` attributes
4. Scans file headers for `// Replaces standard...` comments
5. Cross-references using the 6 strategies
6. Exports a CSV sorted by Status (MISSING first) with match type and file paths

**Regenerate regularly** — after each batch of cleanup/extraction work, regenerate the report to track progress. The FOUND count should increase monotonically.

---

## Phase 1: Mechanical Conversion (txt2al)

- [ ] Run `txt2al` on delta files → table extensions, page extensions, report extensions
- [ ] Run `txt2al` on custom tables → custom table AL files
- [ ] Run `txt2al` on custom codeunits → codeunit AL files
- [ ] Run `txt2al` on custom pages → page AL files
- [ ] Run `txt2al` on custom reports → report AL files
- [ ] Run `txt2al` on custom XMLports → XMLport AL files
- [ ] **Log all conversion failures** — record every object that txt2al could not convert
- [ ] **Log all txt2al warnings** — `Unsupported feature`, `Parameters not exported`, encoding errors
- [ ] **Verify output count matches input count** — no silently dropped objects
- [ ] Copy output into the AL project folder structure

### Post-Conversion Triage (before Phase 2)

- [ ] **Consolidate DotNet declarations** — merge all per-folder `dotnet.al` files into a single root `dotnet.al` (see [obsolete-apis.md](obsolete-apis.md))
- [ ] **Delete per-folder `dotnet.al` files** — after consolidation
- [ ] **Delete system/platform tables** — remove ALL tables with IDs in the 2000000xxx range (Access Control, Active Session, Company, Device, etc.) and standard BC app tables that were exported but have zero custom fields (see SKILL.md → System / Platform Tables)
- [ ] **Delete test framework objects** — CAL Test Suite, CAL Test Results, CAL Export Test Result, etc.
- [ ] **Verify remaining objects are all custom or modified** — only custom objects (ID 50000+) and modification deltas should remain

---

## Phase 2: Per-Object Cleanup

### Table Extension Checklist

For each `.TableExt.al` file:

- [ ] **Rename object** from `tableextension 50XXX tableextension50XXX` to `tableextension 50XXX ObjectName<Suffix>`
- [ ] **Rename file** from `tableextension50XXX.TableExt-Object Name.al` to `ObjectName<Suffix>.TableExt.al`
- [ ] **Check if target table still exists in BC25** — if obsolete (e.g., Product Group 5723), see [safety-rules.md](safety-rules.md)
- [ ] **Delete caption-only modify blocks** — those restating standard captions with no trigger/relation changes
- [ ] **Investigate "Unsupported feature" comments**:
  - [ ] `Property Modification (TextConstString)` → delete (handled by XLIFF)
  - [ ] `Property Modification (Data type)` → investigate why data type was changed; document decision
  - [ ] `Code Modification on "OnValidate"` → find BC25 event (see [event-mapping.md](event-mapping.md))
  - [ ] `Code Insertion on "OnInsert/OnModify/OnDelete"` → subscriber codeunit
  - [ ] `Code Modification on "CopyFrom*"` → subscriber codeunit using `OnAfterCopyFrom*` event
  - [ ] `Parameters and return type have not been exported` → search BC25 symbols for actual signature
- [ ] **Keep meaningful modify blocks** — those with `OnAfterValidate`, `TableRelation` changes, `OptionCaption` changes
- [ ] **Add `<Suffix>` suffix** to custom field names missing it
- [ ] **Add `DataClassification`** to all non-FlowField custom fields
- [ ] **Remove `DataClassification`** from FlowFields (not applicable)
- [ ] **Fix character encoding** — apply encoding map from [patterns.md](patterns.md)
- [ ] **Remove unnecessary quotes** from field names that have no spaces or special characters (see [patterns.md](patterns.md))
- [ ] **Rename keys** from generic `Key1`/`Key2` to project-prefixed names (`Key50000`, `Key50001`, etc.) (see [patterns.md](patterns.md))
- [ ] **Replace `Record TempBlob`** with native BLOB stream operations (see [obsolete-apis.md](obsolete-apis.md))
- [ ] **Replace client-side file ops** — `FileMgt.ClientFileExists` → `Exists()`, `[RunOnClient]` → remove (see [obsolete-apis.md](obsolete-apis.md))
- [ ] **Clean up unused variables** — after DotNet/TempBlob removal, cascade-delete orphaned vars
- [ ] **Use `Modify(false)` for BLOB writes** — skip trigger execution for internal data updates
- [ ] **Rename opaque variables** — `R5606` → `FAPostingGroup` etc.
- [ ] **Add parentheses** to all method calls (`.Reset()`, `.FindSet()`, `.Insert()`, etc.)
- [ ] **Remove empty triggers** — triggers with only comments, AND triggers with orphaned variable declarations but empty `begin...end` body (txt2al artifact where original logic was lost). See [patterns.md](patterns.md) → Empty Triggers with Orphaned Variables.
- [ ] **Verify FlowField targets exist** — CalcFormula references must resolve
- [ ] **Verify TableRelation targets exist** — especially cross-extension references
- [ ] **Check Description metadata** — understand what it tells you (see [conventions.md](conventions.md))
- [ ] **If nothing custom remains** → delete file (after SQL verification per [safety-rules.md](safety-rules.md))

### Page Extension Checklist

For each `.PageExt.al` file:

**Step 1: Fast triage** (classify before editing)
- [ ] **Check if source page still exists in BC25** — some pages were removed/replaced (e.g., Session List, old debugger pages)
- [ ] **Count modify blocks vs custom content** — if file has ONLY ToolTip/Caption modify blocks and/or ImplicitType/TextConstString comments with no `addafter`/`addbefore`/triggers/variables → **DELETE entire file**

**Step 2: Remove noise** (see [patterns.md](patterns.md) → Page Extension Modify Block Triage)
- [ ] **Delete ToolTip-only modify blocks** — these restate standard BC tooltips, zero functional impact
- [ ] **Delete Caption-only modify blocks** — even "meaningful" renames (e.g., "Buy-from Vendor No." → "Vendor No.") create confusion by overriding standard BC terminology
- [ ] **Strip Caption/ToolTip from mixed modify blocks** — keep only functional properties (`Visible`, `Importance`, `Enabled`, `Editable`, `ShowMandatory`)
- [ ] **Delete TextConstString Unsupported comments** — XLIFF handles translations
- [ ] **Delete ImplicitType Unsupported comments** — modern BC handles natively
- [ ] **Delete Id/CardPageID Unsupported comments** — no functional impact
- [ ] **Delete `//The property 'PromotedIsBig/PromotedCategory' can only be set...`** lines and their commented-out property lines
- [ ] **Delete historic change-tracking comments** at file top (`// AL20 - 2019/...`, `// 031018:DEV:...`, `// @VendorName`, etc.)
- [ ] **Remove inline historic tags** (`//-->DATE-TAG`, `//<--DATE-TAG`) but KEEP the code between them

**Step 3: Verify custom content**
- [ ] **Review layout changes** — verify `addafter`/`addbefore`/`moveafter` anchor controls exist in BC25
- [ ] **Review custom actions** — verify `RunObject`/`RunPageLink` targets still exist
- [ ] **Update field control names and source expressions** — both parts of `field(ControlName; SourceExpression)` must match actual field names in table extensions (spaces removed + PascalCase + suffix)
- [ ] **Verify Record references use suffixed custom table names** — do NOT skip English-named tables
- [ ] **Fix missing parentheses** — `.Get;` → `.Get()`, `.Reset;` → `.Reset()`, `.RunModal;` → `.RunModal()`, etc.
- [ ] **Add missing variable declarations** — txt2al sometimes omits `var` sections for variables used in trigger code
- [ ] **Ensure ApplicationArea** on all custom fields and actions

**Step 4: Preserve for later**
- [ ] **Keep Code Modification/Insertion Unsupported comments** — these are real business logic to extract into triggers or event subscribers later
- [ ] **Keep SourceTableView/Visible Property Insertion/Deletion comments** — cannot be changed in extensions, need redesign
- [ ] **Keep `PromotedActionCategories`** — still works in BC25. Convert to `area(Promoted)` with `actionref` only if you are doing a separate UI modernization pass
- [ ] **If nothing custom remains after cleanup** → delete file

### Custom Table Checklist

For each custom table AL file:

- [ ] **Verify table ID is in custom range** (50000+)
- [ ] **Rename table with `<Suffix>` suffix** — e.g., `"Alert Entry"` → `"Alert Entry<Suffix>"`
- [ ] **Run cross-reference sweep after rename** — search the ENTIRE project for the old table name in:
  - [ ] `TableRelation` declarations on all table/table extension fields
  - [ ] `CalcFormula` expressions on all FlowFields
  - [ ] `Record "Old Name"` variable declarations in all codeunits, tables, pages, and XMLports
  - [ ] `SourceTable = "Old Name"` on all pages and page extensions
  - [ ] `Database::"Old Name"` in event subscriber attributes
  - [ ] Report dataset references and RDLC/Word layout bindings
  - [ ] Page extension `field(ControlName; SourceExpression)` — both parts reference the old name
  - [ ] `Codeunit "Old Name"` variable declarations across pages, reports, codeunits, and XMLports
  - [ ] `Page "Old Name"` references in `RunObject`, `LookupPageID`, `DrillDownPageID`
  - [ ] **Include English-named objects** — do NOT assume an English name means it's a standard BC object
- [ ] **Add `DataClassification`** to every field
- [ ] **Add `Caption`** to every field
- [ ] **Fix field names** — clean up French encoding, apply PascalCase
- [ ] **Add key names with `<Suffix>` suffix** — e.g., `Key1<Suffix>` (see [conventions.md](conventions.md))
- [ ] **Fix key definitions** — syntax may differ from C/AL
- [ ] **Verify all table relations** — targets must exist (use suffixed names for custom tables)
- [ ] **Verify all FlowField CalcFormulas** — referenced tables/fields must exist
- [ ] **Convert Option fields to Enum** where appropriate — especially when a `TableRelation WHERE` compares against a standard Enum field (AL0603 warning). Verify ordinals match before converting. See [patterns.md](patterns.md) → Option to Enum Migration.
- [ ] **Remove phantom `FieldN` references** in fieldgroups — txt2al generates `Field3`, `Field7` etc. for deleted fields still referenced in fieldgroup metadata. See [patterns.md](patterns.md) → Phantom FieldN References.
- [ ] **Review triggers** — OnInsert, OnModify, OnDelete, OnRename, field OnValidate
- [ ] **Fix all DotNet references** — replace with AL native alternatives (see [obsolete-apis.md](obsolete-apis.md))
- [ ] **Replace `Record TempBlob` with native BLOB streams** — use `BlobField.CreateInStream/CreateOutStream` instead of TempBlob intermediary (see [obsolete-apis.md](obsolete-apis.md))
- [ ] **Replace client-side file operations** — `FileMgt.ClientFileExists` → `Exists()`, `FileMgt.DeleteClientFile` → `Erase()`, etc. (see [obsolete-apis.md](obsolete-apis.md))
- [ ] **Remove `[RunOnClient]` attributes** — not supported in SaaS
- [ ] **Clean up unused variables** — after removing DotNet/TempBlob, cascade-delete unused `Record TempBlob`, `CR: Text[1]`, DotNet `StreamReader/Writer/Encoding`, and any `Path`, `CellValueText`, `Nbre` etc. vars
- [ ] **Use `Modify(false)` for BLOB writes** — when writing stream data, skip trigger execution (see [patterns.md](patterns.md))
- [ ] **Remove commented-out code** — safe in custom tables since all code is custom (see [patterns.md](patterns.md))
- [ ] **Remove historic change-tracking tags** — `//-->DATE-TAG`, `//YYMMDD:dev:`, `//Begin IT-NNNNN` etc.
- [ ] **Remove txt2al unsupported property comments** — after addressing the underlying issue
- [ ] **Keep functional comments** — comments that explain active code logic
- [ ] **Add proper access modifiers** — `Access = Internal` unless API exposure needed
- [ ] **Move to correct owner folder** (per project conventions) under the appropriate team/owner subfolder

### Custom Codeunit Checklist

For each custom codeunit AL file:

- [ ] **Verify codeunit ID is in custom range** (50000+)
- [ ] **Add project suffix to codeunit object name** — e.g., `"Alert Management"` → `"Alert Management<Suffix>"`. For unquoted single-word names, add quotes: `LotManagement` → `"LotManagement<Suffix>"`. Then search-and-replace the old name across the **entire project** (declaration + all references + file rename). See [patterns.md](patterns.md) → Batch Codeunit Suffix Renaming.
- [ ] **Resolve ALL custom table/object references against the actual inventory** — verify every `Record "..."`, `Codeunit "..."`, `Page "..."`, `Report "..."`, `Database::` reference matches the actual renamed object with project suffix. Build the inventory of suffixed table names first, then search-and-replace old names. This is the **#1 missed step** in batch cleanup — without it, all the syntax modernization is useless because the code won't compile. Watch for combined encoding + suffix changes (e.g., `"Paramètres Setup"` → `"ParametresSetup<Suffix>"` where the accent was also stripped).
- [ ] **Fix all DotNet references** — this is the most common issue in codeunits
- [ ] **Replace `Record TempBlob`** with native BLOB stream operations (`BlobField.CreateInStream/CreateOutStream`) — see [obsolete-apis.md](obsolete-apis.md)
- [ ] **Replace client-side file operations** — `FileMgt.ClientFileExists` → `Exists()`, `FileMgt.DeleteClientFile` → `Erase()`, `[RunOnClient]` → remove entirely — see [obsolete-apis.md](obsolete-apis.md)
- [ ] **Clean up unused variables** — after DotNet/TempBlob removal, cascade-delete orphaned variables (`Record TempBlob`, `CR: Text[1]`, DotNet `StreamReader/Writer/Encoding`, etc.)
- [ ] **Use `Modify(false)` for BLOB writes** — skip trigger execution for internal data updates
- [ ] **Remove WITH statements** — unwind every WITH block (see [obsolete-apis.md](obsolete-apis.md))
- [ ] **Fix TextConst → Label** — move translations to XLIFF
- [ ] **Add parentheses** to all method calls
- [ ] **Fix variable declarations** — follow declaration order from AL guidelines
- [ ] **Fix TRUE/FALSE → true/false** — lowercase booleans
- [ ] **Fix string constants** — single quotes in AL, not double quotes for strings
- [ ] **Verify all record references** — table names, field names must match BC25
- [ ] **Verify all codeunit/page/report/XMLport references** — names must use the suffixed form. A renamed codeunit (`"Old Name"` → `"Old Name<Suffix>"`) can break 40+ references across pages, reports, and other codeunits. Always search-and-replace project-wide after renaming.
- [ ] **Review Permissions** property — set appropriate table permissions
- [ ] **Check for `FORM.*` references** — change to `PAGE.*`
- [ ] **Check for `NAS*` references** — Task Scheduler replaced NAS in cloud
- [ ] **Check for direct SQL calls** — not allowed in BC25 cloud; use AL APIs
- [ ] **Modernize `Find('-')` / `Find('+')`** — replace with `FindSet()` / `FindFirst()` / `FindLast()` (see [patterns.md](patterns.md) → Find('-') Modernization)
- [ ] **Replace CODEUNIT.Run magic numbers** — `CODEUNIT.Run(80, ...)` → `Codeunit.Run(Codeunit::"Sales-Post", ...)` (see [patterns.md](patterns.md) → CODEUNIT.Run with Magic Numbers)
- [ ] **Fix EventSubscriber numeric IDs** — replace `ObjectType::Table, 50148` with `Database::"Table Name"` (see [patterns.md](patterns.md) → EventSubscriber with Numeric Object IDs)
- [ ] **Replace `Record File` directory listing** — replace with `File Management` or `List of [Text]` (see [obsolete-apis.md](obsolete-apis.md) → Record File for Directory Listing)
- [ ] **Replace DotNet `ZipFile`** — use `Codeunit "Data Compression"` (see [obsolete-apis.md](obsolete-apis.md) → ZipFile DotNet)
- [ ] **Add `GuiAllowed` guards** — wrap all `Message`, `Confirm`, `Dialog.Open`, `Page.RunModal`, `Report.RunModal` calls with `if GuiAllowed then` (except in page triggers where GuiAllowed is always true)
- [ ] **Remove debug/test code** — `Message('loulou')`, `Error('TEST')`, `TestManual()` procedures, busy-wait loops, hardcoded test record IDs (see [patterns.md](patterns.md) → Debug and Test Code Detection)
- [ ] **Remove empty separator procedures** — `"===Functions==="()`, `___()` — C/AL visual dividers (see [patterns.md](patterns.md) → Empty Separator Procedures)
- [ ] **Clean legacy variable names** — remove scope suffixes (`_G`/`_L`/`_P`) and type prefixes (`rec`/`cod`/`int`/`dec`/`txt`) (see [patterns.md](patterns.md) → Legacy Variable Naming Cleanup)
- [ ] **Evaluate `Commit` calls** — keep only justified commits; remove debug commits (see [obsolete-apis.md](obsolete-apis.md) → Commit Statement Guidance)
- [ ] **Migrate No. Series calls** — `GetNextNo` → `NoSeries.GetNextNo()`, `InitSeries` → `NoSeries.GetNextNo()` + `AreRelated()`, `TryGetNextNo` → `PeekNextNo()`. BEWARE Boolean parameter trap! Search: `NoSeriesManagement|NoSeriesMgt|InitSeries|GetNextNo|TryGetNextNo` (see [obsolete-apis.md](obsolete-apis.md) → No. Series Module Migration)
- [ ] **Replace `SMTP Mail` / `Codeunit Mail`** — rewrite using Email module (see [obsolete-apis.md](obsolete-apis.md))

### One-Shot / Migration Codeunit Checklist

Codeunits that were created for a single data fix, one-time migration, or debugging purpose. These are identifiable by hardcoded record keys, `DeleteAll` on ledger tables, specific date ranges, and names like `RAZ`, `MAJ`, `OneShotImo`, `Reopen*`, `netttoyage`.

For each one-shot codeunit:

- [ ] **Classify**: Is this a one-time migration script, a data repair tool, a debug utility, or a recurring batch job?
- [ ] **If one-time migration**: Convert to an `Upgrade` codeunit (Subtype = Upgrade) if still needed, or **delete** if the migration already ran in BC14
- [ ] **If data repair tool**: Evaluate if the scenario can recur. If yes, keep and modernize. If no, delete.
- [ ] **If debug utility**: Delete. These include `Testcalcdate`, `RAZentries`, `UpdateEmployee` (with hardcoded data), etc.
- [ ] **If recurring batch**: Modernize syntax and keep as a regular codeunit or Job Queue handler
- [ ] **Check for dangerous operations**: `DeleteAll` on standard ledger tables (`Item Ledger Entry`, `G/L Entry`, etc.) — these must NEVER run in production
- [ ] **Verify hardcoded data**: Remove or parameterize hardcoded vendor numbers, document numbers, dimension set IDs
- [ ] **Document the purpose**: If keeping, add a clear comment explaining when/why to use it

### Subscriber Codeunit Quality Checklist

For each subscriber codeunit created during extraction:

- [ ] **Declare `Access = Internal`** on the codeunit
- [ ] **Add RunTrigger guard** to all generic record event subscribers (`OnBefore/AfterInsertEvent`, `OnBefore/AfterModifyEvent`, `OnBefore/AfterDeleteEvent`):
  ```al
  if not RunTrigger then
      exit;
  ```
- [ ] **Use `false, false`** for IncludeSender and GlobalVarAccess unless specifically needed
- [ ] **Verify every field name** uses the `<Suffix>` suffix where applicable
- [ ] **Verify every condition** — watch for always-true/always-false comparisons from copy-paste errors
- [ ] **Check variable initialization** — ensure every `Record.Get()` call uses a valid key value
- [ ] **Use PascalCase** for all variables (e.g., `IsHandled`, not `ishandled`)
- [ ] **Preserve legacy comment tags** for traceability: `// Extracted from Sales-Post (CU 80), tag: //DEV`
- [ ] **Replace magic numbers** with named constants, enums, or at minimum a comment explaining the value
- [ ] **Verify timing equivalence** — if BC14 code ran at a different point in the posting flow (e.g., before `FillTempLines`), account for the timing shift in BC25:
  - [ ] Does the subscriber need to update both real DB records AND temp posting tables (`TempPurchLineGlobal`/`TempSalesLineGlobal`)?
  - [ ] Does the subscriber need `SuspendStatusCheck` around `Validate` calls on released document lines?
  - [ ] See [patterns.md](patterns.md) → TempPurchLineGlobal Dual-Update Pattern + SuspendStatusCheck Pattern
- [ ] **Verify procedure relocation** — confirm the event is still on the same codeunit in BC25. In BC25, Microsoft refactored posting logic from CU 80/90 into companion CUs (CU 815/816). Check [event-mapping.md](event-mapping.md) for documented relocations.
- [ ] **Verify dead procedures are skipped** — before extracting custom procedures, grep for call sites within the copied CU. Procedures defined but never called are dead code — do not create subscribers for them.

### Copied Standard Codeunit Checklist

For each full copy of a standard codeunit (the 60 files in EventSubscribers):

- [ ] **CRITICAL: This is NOT a valid AL file** — it's a reference for extraction only
- [ ] **Identify all custom code blocks** using legacy comment tags (see [conventions.md](conventions.md))
- [ ] **For each custom block**:
  - [ ] Is it active code or commented-out code?
  - [ ] What business function does it serve?
  - [ ] Which BC25 event can replace it? (see [event-mapping.md](event-mapping.md))
  - [ ] Does it reference custom fields? → Verify field names in extensions
  - [ ] Does it reference other copied codeunits? → Map cross-dependencies
  - [ ] Does it reference DotNet types? → Find AL replacement
- [ ] **Create subscriber codeunit** with all extracted custom code
- [ ] **Compile and test** the subscriber against BC25 symbols
- [ ] **Track intermediate state** — if the codeunit is too complex for single-pass extraction:
  - [ ] Assign a custom ID (50000+) and move to the owner's folder
  - [ ] Log the reassigned copy in the conversion log with status "pending decomposition"
  - [ ] Schedule decomposition in a subsequent pass
- [ ] **Delete the copied standard codeunit** — it must NOT be in the final app
- [ ] **Verify behavior** — the subscriber must produce the same result as the original modification

### Report / Report Extension Checklist

For each report or report extension:

- [ ] **Determine if this is a full copy or extension** — txt2al may generate full copies of standard reports
- [ ] **For full copies of standard reports**: Convert to report extension if possible (only layout/request page changes)
- [ ] **For custom reports**: Clean up as standalone report object
- [ ] **Verify dataset columns** — all field references must resolve against BC25 tables
- [ ] **Verify RDLC layout bindings** — column names in RDLC must match dataset
- [ ] **Fix DotNet in report triggers** — replace with AL native code
- [ ] **Fix TextConst in report labels** — convert to Label variables
- [ ] **Check RequestPage** — verify all filter fields exist
- [ ] **Verify Processing instructions** — `SETTABLEVIEW`, `COPYFILTERS` syntax may need updates

### Copied Standard Page/Report Triage Checklist

For each page or report in `CustomAL/` with a standard-range ID (99000xxx, 2000xxx, 130xxx, or any ID outside the 50000+ custom range):

**Step 1: Identification**
- [ ] **List all files with standard-range IDs** in `CustomAL/Page/` and `CustomAL/Report/` — group by ID range (manufacturing 99000xxx, Belgian localization 2000xxx, test pages 130xxx)
- [ ] **Verify the compiler reports AL0197 or AL0264** for each file — this confirms the Base Application declares the same object

**Step 2: Pass 1 — DELTA folder check**
- [ ] **Check `Exports/Delta/Page/` for each page ID** — look for `PAG<ID>.DELTA` (e.g., `PAG99000806.DELTA`)
- [ ] **Check `Exports/Delta/Report/` for each report ID** — look for `REP<ID>.DELTA`
- [ ] **Classify**: DELTA exists → **HAS MODIFICATIONS** (do NOT delete). No DELTA → proceed to Pass 2

**Step 3: Pass 2 — BC25 source code comparison** (for files with no DELTA)
- [ ] **Custom marker scan**: Search file content for project-specific patterns:
  - [ ] Project suffix (e.g., `002CGD`, `003SKC`)
  - [ ] Project/customer name (`CGDIS`, `CGIDIS`, etc.)
  - [ ] Custom field ID ranges: `field(5[0-9]{4}` or `field(6[0-9]{4}`
  - [ ] `Unsupported feature` comments
  - [ ] Custom procedure naming patterns
- [ ] **Structural procedure comparison**: Extract all `procedure` and `trigger` names, verify each exists in BC25 standard (`BC25/Microsoft_Base Application/src/`)
- [ ] **Investigate any "missing" procedures individually**: Check if the body calls only standard objects (→ BC14 refactoring, not a customization)
- [ ] **Line count comparison**: Verify the copy has fewer or equal lines vs BC25 (expected for BC14 vintage)

**Step 4: Action**
- [ ] **No DELTA + clean Pass 2** → **Delete the file** (pure unmodified copy)
- [ ] **Has DELTA** → **Renumber** to custom ID range (e.g., 53xxx for reports) + add project suffix to name + rename file
- [ ] **No DELTA but custom markers found** → **Investigate** — custom code was embedded outside the DELTA process
- [ ] **Document all decisions** in the master tracking file before executing deletions

**Step 5: Post-deletion verification**
- [ ] **Recompile** — verify AL0197/AL0264 errors are resolved
- [ ] **Spot-check from git**: Recover a sample of deleted files from git history, re-run Pass 2 checks as confirmation

### XMLport Checklist

For each XMLport:

- [ ] **Fix namespace declarations** — XML namespace handling differs in AL
- [ ] **Fix DotNet XML processing** — replace with AL native XmlDocument
- [ ] **Verify all field references** — table/field names must match BC25
- [ ] **Check file handling** — `File` operations may need `TempBlob` + `Download/Upload` for cloud
- [ ] **Fix TextConst → Label**
- [ ] **Verify encoding** — UTF-8 handling may need explicit specification

### Enum Checklist

For each new Enum object (created from Option → Enum conversion):

- [ ] **Assign unique Enum ID** in custom range
- [ ] **Set `Extensible = true`** if other extensions might extend it
- [ ] **Add Caption to every value**
- [ ] **Verify ordinal values match** the original Option ordinals (0, 1, 2, ...)
- [ ] **Update all references** from `Option` type to `Enum` type
- [ ] **File name**: `EnumName<Suffix>.Enum.al`

---

## Phase 3: Cross-Object Verification

After all individual objects are cleaned:

- [ ] **Compile the full project** against BC25 symbols
- [ ] **Fix all compile errors** — missing references, changed signatures, type mismatches
- [ ] **Verify all FlowField cross-references** — CalcFormulas referencing other extensions
- [ ] **Verify all TableRelation cross-references** — especially cross-ownership (across developer/team boundaries)
- [ ] **Verify all event subscriber signatures** — match against BC25 symbol definitions
- [ ] **Check for circular dependencies** — especially between subscriber codeunits
- [ ] **Run CodeCop analyzer** — fix all violations
- [ ] **Run UICop analyzer** — fix all UI violations (ToolTips, ApplicationArea)
- [ ] **Run PerTenantExtensionCop** — even if this is PTE, catches common issues
- [ ] **Verify ID uniqueness** — no duplicate object IDs, no duplicate field IDs across extensions
- [ ] **Generate XLIFF translation file** — base language
- [ ] **Create permission sets** — one per functional area

---

## Phase 4: Data Verification

Before deploying to any environment with data:

- [ ] **For each deleted field**: Verify SQL column has no live data (see [safety-rules.md](safety-rules.md))
- [ ] **For each deleted table extension**: Verify all custom columns have no data
- [ ] **For each renamed field**: Verify the rename doesn't change the SQL column name
- [ ] **For each changed data type**: Verify existing data is compatible
- [ ] **For obsolete table migrations**: Verify upgrade codeunit handles all data
- [ ] **Test publish to a COPY of production** (never production directly)
- [ ] **Run `Sync-NAVApp` in ForceSync mode on test copy** — check for sync errors
- [ ] **Run upgrade codeunits on test copy** — verify data migration
- [ ] **Spot-check migrated data** — compare critical fields between old and new

---

## Phase 5: Functional Verification

- [ ] **For each custom feature** (identified by legacy tags):
  - [ ] Test the feature end-to-end in BC25
  - [ ] Compare behavior with BC14
  - [ ] Document any behavior gaps
- [ ] **For each subscriber codeunit**:
  - [ ] Verify it fires at the right time
  - [ ] Verify custom fields are populated correctly after posting
  - [ ] Verify no duplicate processing (subscriber + standard both running)
- [ ] **For each report extension**:
  - [ ] Run the report and verify output
  - [ ] Compare layout with BC14 output
- [ ] **For each page extension**:
  - [ ] Open the page and verify all custom fields display
  - [ ] Test all custom actions
  - [ ] Verify lookup pages work
- [ ] **Web service compatibility**:
  - [ ] Republish all web services
  - [ ] Test OData endpoints
  - [ ] Verify Power BI reports still connect
- [ ] **Workflow compatibility**:
  - [ ] Test all custom workflow templates
  - [ ] Verify approval flows

---

## Phase 6: Go-Live Preparation

- [ ] **Write upgrade codeunit** for production data migration
- [ ] **Test upgrade codeunit** on fresh copy of production
- [ ] **Document rollback plan** — what happens if the migration fails mid-way
- [ ] **Schedule downtime window** — publish + sync + upgrade takes time
- [ ] **Prepare monitoring checklist** — what to check in the first hour after go-live
- [ ] **Notify external integration owners** — Power BI, Power Automate, third-party systems
- [ ] **Final commit** — clean, tested, reviewed code with clear commit message

---

## Conversion Failure Triage

When txt2al fails to convert an object (as logged in `*_conversion_failures.txt`):

### Common Failure Causes

| Failure | Cause | Resolution |
|---|---|---|
| French characters in object name | txt2al cannot parse `è`, `é`, `ç` etc. in file names | Rename source file to ASCII before conversion |
| Hex character 0x14 in source | Control characters in C/AL text | Clean source file: remove control chars |
| Complex DotNet interop | txt2al cannot convert advanced DotNet patterns | Manual conversion required |
| Very large objects | txt2al timeout or memory limit | Split source file or increase resources |
| Invalid C/AL syntax in source | The original C/AL had compile warnings | Fix in C/AL first, then re-export and convert |

### For Each Failed Object

1. Read the original C/AL source file
2. Identify why txt2al failed (encoding? DotNet? syntax?)
3. If encoding: clean the source and retry
4. If structural: manual conversion — write the AL file by hand using C/AL as reference
5. Document the manual conversion in a comment at the top of the AL file
