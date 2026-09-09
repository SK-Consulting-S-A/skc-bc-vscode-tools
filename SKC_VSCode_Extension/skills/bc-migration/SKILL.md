---
name: bc-migration
description: "Migrate and clean up legacy C/AL customizations from NAV/BC14 into modern AL for BC25+. Keep orchestration and migration separated: use this skill directly for txt2al output, delta files, copied standard codeunits, unsupported feature cleanup, DotNet replacement strategy, WITH removal, and full DELTA-first migration work. ALWAYS present a plan for confirmation before writing, deleting, or modifying migration files."
---

# BC Migration Skill

Convert legacy C/AL customizations into maintainable, safe, production-ready AL for Business Central 25+.

This is the independent migration skill. Use it directly for conversion and cleanup work. Use `bc-orchestration` when migration is one phase of a broader end-to-end BC delivery workflow.

This skill covers the **entire lifecycle** after raw txt2al conversion: triaging every object type, extracting custom logic from copied standard codeunits into event subscribers, handling DotNet references (replace for SaaS or keep for on-prem), fixing encoding corruption, modernizing syntax, and — above all — **guaranteeing zero data loss**.

## Mandatory Safety Gate: Plan Before Acting

**Before writing, deleting, or modifying any file**, present a plan and get user confirmation before proceeding.

This migration operates on production data paths. Deleting a codeunit, removing a field, or rewriting a subscriber is irreversible in practice — even if git can revert the file, the reasoning behind the change is lost. A quick plan confirmation prevents costly mistakes.

### When Plan Mode Is Required

Switch to Plan Mode before ANY of these actions:

| Action | Why |
|---|---|
| Deleting a file (table ext, page ext, copied codeunit) | May discard custom logic or orphan SQL data |
| Creating a new subscriber codeunit | Defines production event wiring — wrong event = silent data loss |
| Extracting custom code from a copied standard codeunit | Highest-risk part of the migration; execution order matters |
| Renaming objects or fields | Cross-references may break silently |
| Batch operations (cleaning multiple files at once) | Compound risk; user must see the full scope |
| Changing field data types or removing modify blocks | Schema changes can break sync on databases with data |

### What the Plan Must Include

Present a concise summary covering:

1. **Which files** will be touched (list them)
2. **What action** on each file (delete / create / modify)
3. **Execution order** (dependencies between files)
4. **Risks identified** (cross-references, data in SQL, missing events, external consumers)
5. **Open questions** (anything requiring user input before proceeding)

### When Plan Mode Is NOT Required

Skip the plan for read-only analysis: reading DELTAs, triaging files, answering questions about the codebase, or producing documentation. These have zero risk.

### Resuming After Confirmation

Once the user confirms (or adjusts) the plan, proceed in Agent Mode with the agreed changes. Reference the plan if any ambiguity arises during execution.

---

## When to Use

- Workspace contains `.TXT`, `.DELTA`, or partially converted `.al` files from a BC14/NAV migration
- AL contains `Unsupported feature` comments, `Parameters and return type have not been exported`, or broken trigger translations
- Table/page extensions have redundant `modify` blocks restating standard captions
- Standard-object modifications must be re-expressed via events or extensions
- Copied standard codeunits (full copies of CU 12, 80, 90, etc.) need custom code extracted into subscribers
- DotNet references (SMTP, HTTP, File, XML, JSON) need evaluation — see the DotNet Strategy section below
- `WITH` statements need removal
- French/Belgian/Dutch character encoding is corrupted from txt2al export
- Option fields should be evaluated for Enum conversion

## Foundational Principles

### 1. Safety First — Trust Nothing

**Read [safety-rules.md](safety-rules.md) before touching any file.**

- Field descriptions saying "OBSOLETE" or "no longer used" are **opinions from years ago**, not facts
- A field with no references in AL code may still have data in SQL and consumers in Power BI
- Never delete a field without the 5-point verification (SQL check, cross-reference, external consumers, report layouts, business owner)
- When in doubt, deprecate with `ObsoleteState = Pending` instead of deleting
- The default action for anything uncertain is **keep it**

### 2. Preserve Business Intent, Not Literal C/AL Structure

The goal is not a 1:1 translation of C/AL to AL. The goal is to deliver the same business functionality using modern BC architecture (extensions, events, enums, modern APIs).

### 3. Fix Architecturally — Don't Preserve Dead Comments

`Unsupported feature` comments are migration artifacts that tell you what work remains. Process them and remove them.

### 4. Prefer Modern BC Patterns

Event subscribers > copied codeunits. Extensions > modifications. Enums > Options. Labels + XLIFF > TextConst. ObsoleteState > deletion. For DotNet, see the DotNet Strategy section below — the right answer depends on your deployment target.

### 5. Apply Project Conventions Consistently

Every migration project should define its own conventions (suffix, naming, folders, ID ranges). See [conventions.md](conventions.md) for a template of what to define. Apply it consistently across all objects.

### 6. Object ID Normalization

txt2al preserves the original C/AL object IDs, but these may conflict with the project's planned ID range or with other extensions. During migration, you may need to renumber objects to fit a defined ID allocation plan.

**When renumbering is needed:**
- Multiple table extensions target the same standard table with conflicting IDs
- IDs fall outside the project's assigned range (e.g., a PTE accidentally used AppSource range)
- Two converted objects ended up with the same ID from separate C/AL conversion runs

**When renumbering, update ALL cross-references:**
- `Database::` constants in event subscribers
- `TableRelation` and `CalcFormula` references (if using table name, this is unaffected)
- `SourceTable` on pages
- `RunObject` targets
- Permission sets

### 7. Start From the DELTA, Never From the Full Copy

The `.DELTA` files are the **ground truth** for copied standard codeunits. They show exactly what was changed — every variable added, every line of code inserted or modified, every property change.

**Never try to reverse-engineer changes from the 8000-line txt2al full copy.** The full copy mixes thousands of standard lines with a handful of custom ones. The DELTA isolates the custom parts precisely.

See [delta-methodology.md](delta-methodology.md) for the complete DELTA-first workflow.

---

## DotNet Strategy — Deployment Target

DotNet interop handling is one of the most impactful decisions in a BC14→BC25 migration. The right approach depends entirely on the deployment target. **Ask the customer early.**

### Option A: On-Premises Target (or On-Prem Pitstop Before Cloud)

If the first deployment is **BC25 on-premises**, DotNet interop still compiles and runs. The pragmatic strategy is:

1. **Keep** all DotNet references during the structural migration (phases 1–3)
2. **Consolidate** per-folder `dotnet.al` files into a single root `dotnet.al` (see [obsolete-apis.md](obsolete-apis.md) → DotNet Consolidation)
3. **Set `"target": "OnPrem"` in `app.json`** — this enables DotNet compilation
4. **Tag every DotNet usage** with a `// TODO: Replace for SaaS` comment or tracking item
5. **Defer DotNet replacement** to a dedicated "cloud readiness" wave after the app is stable on-prem

This reduces the immediate migration scope significantly — you avoid rewriting HTTP utilities, ZIP handling, Excel formatting, custom .NET assemblies, etc. while focusing on the structural work (events, extensions, table cleanup).

### Option B: SaaS / Cloud Target

If deploying directly to **BC25 SaaS** (or AppSource), DotNet interop is completely blocked:

1. **Replace** every DotNet type with its AL-native equivalent (see [obsolete-apis.md](obsolete-apis.md) → DotNet Types → AL Native Replacements)
2. Custom .NET assemblies must be redesigned as Azure Functions, AL HTTP calls, or AL-native logic
3. Set `"target": "Cloud"` in `app.json`
4. Any DotNet type without an AL replacement requires an architectural redesign

### Decision Matrix

| Scenario | DotNet Strategy | `app.json` target |
|---|---|---|
| On-prem only (no cloud plans) | Keep, consolidate `dotnet.al` | `OnPrem` |
| On-prem pitstop, cloud later | Keep now, replace in cloud-readiness wave | `OnPrem` → `Cloud` |
| Direct to SaaS | Replace everything before first deployment | `Cloud` |
| AppSource app | Replace everything (mandatory) | `Cloud` |

### What "Keep" Means in Practice

"Keep DotNet" does NOT mean ignore it. You still must:
- Consolidate all `dotnet.al` fragments into one file
- Resolve type alias conflicts (see [obsolete-apis.md](obsolete-apis.md) → Custom-Prefix Aliasing)
- Ensure `app.json` has `"target": "OnPrem"`
- Document every DotNet dependency for the future cloud-readiness wave
- Verify DotNet assemblies are deployed with the server (custom .NET DLLs must be in the Add-ins folder)

---

## Migration Phases

The migration follows six phases. Each phase has a detailed checklist in [checklists.md](checklists.md).

### Phase 0: Pre-Conversion Inventory
Build a complete catalog of every C/AL object, classify it, assign ownership, identify external consumers. This phase produces no AL code — only documentation.

### Phase 1: Mechanical Conversion (txt2al)
Run txt2al on all exports. Log every failure. Verify output counts match input counts. The output is a draft, not a finished migration.

### Phase 2: Per-Object Cleanup
The bulk of the work. Each object type has its own cleanup process; see the Object Type Guides section below.

### Phase 2.5: DELTA-to-AL Cross-Reference Verification
Before moving to Phase 3, verify every DELTA file has a corresponding AL file. For each object type (Table, Page, Report, Codeunit):
1. List all `.DELTA` files and extract the object ID + name from line 1
2. List all `.al` files and extract the object declaration
3. Map each DELTA to its AL counterpart
4. Classify unmatched DELTAs: CaptionML-only (no action), obsolete table (no action), genuine gap (action required), covered by event subscriber (verify)
5. Update the master tracking document with findings

This step catches missed objects that would otherwise surface as compile errors or — worse — missing functionality in production. See [delta-methodology.md](delta-methodology.md) → DELTA-to-AL Cross-Reference Verification.

### Phase 2.6: Migration Codeunit Analysis
Determine which data migration codeunits are needed. Microsoft's Cloud Migration Tool automatically moves data when field IDs and types are unchanged. Manual migration codeunits are only needed for **structural transformations**:
- Table obsolescence (e.g., Product Group → Item Category hierarchy)
- Field renaming/restructuring across tables
- Data type changes that require value transformation

Also plan for a `Subtype = Upgrade` codeunit skeleton for future extension version upgrades.

### Phase 3: Cross-Object Verification
Compile the full project. Fix cross-references, event signatures, FlowField targets. Run all code analyzers (CodeCop, UICop, PerTenantExtensionCop).

### Phase 4: Data Verification
Verify no data loss. Test against a copy of production. Run upgrade codeunits. Spot-check critical fields.

### Phase 5: Functional Verification
Test every custom feature end-to-end. Compare behavior with BC14. Document gaps.

### Phase 6: Go-Live
Write upgrade codeunits, test on production copy, schedule downtime, notify integration owners.

---

## Object Type Guides

### Table Extensions

The largest category in most migrations. Most require cleanup of txt2al noise.

**Triage each file into one of these buckets:**

| Bucket | When | Action |
|--------|------|--------|
| **Keep as extension** | Custom fields, meaningful `modify` triggers, local logic still valid | Clean syntax, rename, add project suffix |
| **Replace with subscribers** | Standard trigger modifications (`OnInsert`, `OnValidate`, `CopyFrom*`) | Create subscriber codeunit, delete dead block |
| **Delete as obsolete** | Only caption-restating `modify` blocks, dead TextConstString comments, or targets obsolete table | Remove file entirely — after [safety verification](safety-rules.md) |
| **Manual rewrite** | Missing signatures, DotNet usage, no event available | Investigate BC symbols, redesign |

**Decision: Clean vs Rewrite from Scratch**

When a txt2al table extension is heavily bloated (hundreds of lines of TextConstString comments, dozens of redundant modify blocks, copied standard procedures), it is often faster and safer to **create a fresh minimal file** containing only the custom fields and procedures, rather than line-by-line cleaning the bloated output.

Signs that a fresh rewrite is warranted:
- The file is >200 lines but only has 1–3 custom fields
- >80% of the file is TextConstString comments or redundant modify blocks
- The file contains copied standard procedures (e.g., `CreateEmployee` inside a Contact extension)
- The file contains dozens of `modify("FieldName") { Caption = '...'; }` blocks with no trigger changes

In these cases: identify the custom fields/procedures from the txt2al output (or from the DELTA), create a new clean file, and delete the bloated one.

**Standard cleanup for every table extension (in order):**

1. Rename object from `tableextension 50XXX tableextension50XXX` to a meaningful name with project suffix
2. Rename file to match your project's file naming convention
3. Check if target table still exists in modern BC — if obsolete (e.g., Product Group 5723), see [patterns.md](patterns.md)
4. Delete caption-only `modify` blocks (txt2al noise)
5. Keep meaningful `modify` blocks (those with triggers, TableRelation changes, OptionCaption changes)
6. Process every `Unsupported feature` comment using the decision shortcuts in this file
7. Add project suffix to custom field names missing it
8. Add `DataClassification` to all non-FlowField custom fields
9. Fix character encoding — see [patterns.md](patterns.md)
10. Remove unnecessary quotes from field names that have no spaces/special chars — see [patterns.md](patterns.md)
11. Rename keys from generic `Key1`/`Key2` to project-prefixed names (`Key50000`, etc.) — see [patterns.md](patterns.md)
12. Rename opaque variables — see [patterns.md](patterns.md)
13. Modernize AL syntax (parentheses, lowercase keywords, booleans)
14. Remove empty triggers — including triggers with orphaned variable declarations but empty `begin...end` body (see [patterns.md](patterns.md) → Empty Triggers with Orphaned Variables)
15. Replace `Record TempBlob` with native BLOB stream operations — see [obsolete-apis.md](obsolete-apis.md)
16. Replace client-side file operations with server-side AL — see [obsolete-apis.md](obsolete-apis.md)
17. Verify FlowField/TableRelation targets exist
18. If nothing custom remains → delete file (after safety verification)
19. Cross-reference against DELTA files — verify every table DELTA has a corresponding AL file (Phase 2.5)

### Page Extensions

Similar cleanup to table extensions, plus UI-specific concerns.

**Critical: Field name alignment with table extensions**

txt2al generates page extension field controls using the **original C/AL field name**, but the underlying table extension field may have been renamed (spaces removed, suffix added, encoding fixed). Every `field(ControlName; SourceExpression)` in a page extension must match the actual field name in the corresponding table extension. Both the control name and source expression must be updated — see [patterns.md](patterns.md) → Page Extension Field Control Resolution.

**Additional page-specific checks:**
- **Verify all field source expressions** match the actual field names in the table/table extension — this is the #1 source of page extension errors
- Verify anchor controls (`addafter`, `addbefore`) still exist in the target BC version
- Add `ApplicationArea` to all fields and actions
- Add `ToolTip` to all fields and promoted actions (UICop requirement)
- Promoted actions: `Promoted`, `PromotedIsBig`, `PromotedCategory`, and `PromotedActionCategories` still work in modern BC. Keep them during migration unless you are already doing a dedicated UI modernization pass. Converting to `actionref` is optional modernization, not required migration work. Only delete txt2al comment artifacts (`//The property 'PromotedIsBig' can only be set...`)
- Verify `RunObject` targets exist
- Check if target page was removed (e.g., old debugger pages, Session List)
- Guard `Dialog.Open`, `Message`, `Confirm` with `GuiAllowed` in triggers

### Copied Standard Codeunits (highest risk)

These are full copies of standard codeunits generated by txt2al when the C/AL source had direct modifications. They are the **most complex and dangerous** part of any migration.

**These files cannot exist in the final app.** They must be decomposed into event subscriber codeunits.

#### Step 0: Fast Triage Using DELTA Files (eliminates ~40% immediately)

Before opening any full copy, read the matching `.DELTA` file. Scan for element types:

| DELTA element | Meaning | Action |
|---|---|---|
| `PropertyModification` on `TextConstString` only | Translation tweaks (é→É, quotation marks) | **DELETE copied codeunit.** No subscriber needed. XLIFF handles translations. |
| `PropertyModification` on `Permissions` | Added table access for custom code | Note the permissions — subscriber will need them |
| `PropertyModification` on `Version List` | Tags which features modified this CU | Read the tags to classify the modification |
| `CodeModification` | Lines of standard code were changed | **EXTRACT** — this is real business logic |
| `Insertion` with `ChangedElements=VariableCollection` | New variables added | Comes with the code extraction |
| `Insertion` with `ChangedElements=PROCEDURECollection` | Entirely new procedures added | **EXTRACT** to new codeunit or subscriber |

In typical French/Belgian BC14 migrations, this fast triage reveals that **~40% of copied codeunits are TextConstString-only** — deletable immediately with zero extraction work.

#### How to Read a DELTA's Code Sections

The `ModifiedCode` block uses `#N..M` range notation to reference unchanged standard lines:
```
ModifiedCode=BEGIN
               #1..29          ← lines 1–29 of the standard procedure are unchanged
               // custom code here
               #30..55         ← lines 30–55 of the standard are unchanged
             END;
```

This tells you exactly where the custom code was injected. Match the injection point to the nearest BC event.

#### The `Version List` Property Is Your Quick Classifier

Tags like `FEAT-A`, `FEAT-B`, `VENDOR-X`, `MODULE-Y`, `NAVBE10.00` tell you which feature area modified the codeunit. Use these to assign ownership and prioritize.

#### Extraction Process

For each `CodeModification` or `Insertion`:
1. Read the `Target=` — which procedure was modified
2. Read `ModifiedCode` — find custom lines (everything not in `#N..M` ranges)
3. Match to a BC event using [event-mapping.md](event-mapping.md)
4. Create subscriber codeunit with the extracted logic
5. Fix field names, DotNet references, WITH statements, syntax
6. Delete the full copy after verification

See [delta-methodology.md](delta-methodology.md) for the complete workflow including cross-dependency handling and priority wave planning.

### Custom Tables

Tables with non-ASCII characters in names often fail txt2al conversion. These need manual conversion:
1. Read the original C/AL delta or TXT file
2. Write the AL table manually
3. Fix encoding, add DataClassification, fix keys, modernize syntax
4. Remove commented-out code and historic change-tracking tags — safe in custom tables (see [patterns.md](patterns.md))
5. Remove txt2al unsupported property comments after addressing the underlying issue
6. Keep functional comments that explain active code logic

### Custom Codeunits

Fully custom codeunits (in the custom ID range) are generally cleaner:
1. **Resolve all custom table/object references** — verify every `Record "..."`, `Codeunit "..."`, `Page "..."` reference matches the actual renamed object with project suffix. This is the **#1 missed step** in batch cleanup — syntax modernization without reference resolution leaves the code uncompilable. Build the table inventory first, then fix all references. See [patterns.md](patterns.md) → Name Resolution.
2. Handle DotNet references per deployment target: replace with AL native for SaaS, or keep + consolidate `dotnet.al` for on-prem (see [obsolete-apis.md](obsolete-apis.md) and the DotNet Strategy section in this file)
3. Remove `WITH` statements
4. Fix `TextConst` → `Label` (see [patterns.md](patterns.md))
5. Modernize syntax (parentheses, `Find('-')` → `FindSet()`, lowercase keywords, booleans)
6. Add proper access modifiers
7. Remove commented-out code and historic change-tracking tags — safe in custom objects (see [patterns.md](patterns.md))
8. Replace `Record File` directory listing with `File Management` or `List of [Text]` (see [obsolete-apis.md](obsolete-apis.md))
9. Replace DotNet `ZipFile` with `Codeunit "Data Compression"` (see [obsolete-apis.md](obsolete-apis.md))
10. Replace `CODEUNIT.Run(80, ...)` magic numbers with `Codeunit.Run(Codeunit::"Sales-Post", ...)` (see [patterns.md](patterns.md))
11. Replace EventSubscriber numeric IDs with named references (see [patterns.md](patterns.md))
12. Add `GuiAllowed` guards on `Message`, `Confirm`, `Dialog.Open`, `Page.RunModal`, `Report.RunModal`
13. Remove debug/test code — `Message('loulou')`, `TestManual()` procedures, busy-wait loops (see [patterns.md](patterns.md))
14. Remove empty separator procedures — `"===Functions==="()` (see [patterns.md](patterns.md))
15. Clean legacy variable names — scope suffixes (`_G`/`_L`/`_P`) and type prefixes (`rec`/`cod`/`int`) (see [patterns.md](patterns.md))
16. Evaluate each `Commit` call — keep only justified ones (see [obsolete-apis.md](obsolete-apis.md))

### One-Shot / Migration Codeunits

Many BC14 projects contain codeunits created for one-time data fixes, test utilities, or single-run migrations. These are identifiable by:
- Names like `RAZ*`, `MAJ*`, `OneShot*`, `Reopen*`, `netttoyage*`, `Test*`
- Hardcoded record keys, vendor numbers, or document numbers
- `DeleteAll` on standard ledger tables (extremely dangerous)
- No meaningful business logic — just batch data manipulation

**Triage each one-shot codeunit:**

| Type | Action |
|---|---|
| **One-time migration** (already ran in BC14) | **Delete** — its job is done |
| **Entirely commented-out body** (empty `begin...end` after cleanup) | **Delete the file** — nothing left to execute. Don't leave an empty shell behind. |
| **Data repair tool** (scenario may recur) | **Keep and modernize** — parameterize hardcoded values |
| **Debug/test utility** (`Testcalcdate`, `RAZentries`) | **Delete** — not needed in production |
| **Recurring batch** (Job Queue handler) | **Keep and modernize** — full cleanup like any codeunit |

See [checklists.md](checklists.md) → One-Shot / Migration Codeunit Checklist for the complete triage.

### Copied Standard Codeunits in Unexpected Locations

txt2al sometimes places copied standard codeunits in the **Custom** folder instead of the **Delta** folder, especially when:
- The object ID is in the standard range but was fully overwritten in C/AL
- The original C/AL export didn't separate deltas from full copies
- A custom codeunit was assigned a standard-range ID (e.g., 99000836 "Transfer Line-Reserve")

**Detection:** Search for object IDs outside the custom range (50000+) in your Custom folders. Common examples:
- `99000836` — Transfer Line-Reserve
- `99000817` — Manu. Print Report
- `50047` — Navigate by Dimension (~3000 lines, clearly a standard copy)

These files follow the **Copied Standard Codeunit** workflow, not the Custom Codeunit workflow — they need DELTA-based extraction, not direct cleanup.

### Reports & Report Extensions

txt2al generates full report copies, not report extensions. Triage:
- Layout-only changes → custom layout (not code)
- Dataset additions → report extension
- Heavy logic changes → custom report (keep as separate object with new ID)

Fix RDLC bindings after any dataset changes. See [patterns.md](patterns.md) for report extension patterns.

### Copied Standard Pages and Reports

txt2al batch conversion often includes **full copies of standard pages and reports** in the `CustomAL/` folder alongside genuine custom objects. These are standard BC objects (manufacturing pages, Belgian localization reports, etc.) that were part of the C/AL export but were never customized. They cause `AL0197` (name clash) and `AL0264` (ID clash) compilation errors because the Base Application already declares the same objects.

**How to recognize them:**
- Object IDs in standard ranges (99000xxx for manufacturing, 2000xxx for Belgian localization, 130xxx for test wizards) but located in `CustomAL/` rather than `DeltaAL/`
- The compiler reports `"An application object of type 'Page/Report' with name/ID 'X' is already declared by extension 'Base Application by Microsoft'"`
- No corresponding page/report extension exists in `DeltaAL/` for the same object

**Two-pass verification before deletion** (mandatory):

| Pass | What to check | How | What it catches |
|---|---|---|---|
| 1. DELTA check | Does a `.DELTA` file exist for this object ID in `Exports/Delta/Page/` or `Exports/Delta/Report/`? | List the DELTA folder, match by object type + ID (e.g., `PAG99000806.DELTA`) | Identifies objects with BC14-tracked modifications |
| 2. BC25 source comparison | Does the file content match the BC25 standard? | Recover from git if already deleted; scan for custom markers, compare procedures, check line counts | Catches modifications not captured by DELTAs |

**Pass 2 — BC25 source comparison details:**

1. **Custom marker scan**: Search the file for project-specific patterns — project suffix (e.g., `002CGD`), project name, custom field ID ranges (50000-69999), `Unsupported feature` comments, custom procedure naming patterns. Any hit means the file has custom content.
2. **Structural procedure comparison**: Extract all `procedure` and `trigger` names from the file. Verify each exists in the BC25 standard counterpart. Procedures missing from BC25 need individual investigation — they may be standard BC14 code refactored in later versions (common for helper methods like `GetLastViewedJournalBatchName`, `ShowTracking`, `MATRIX_GenerateColumnCaptions`) or actual customizations.
3. **Line count comparison**: The copy should have **fewer or equal** lines compared to BC25 (BC25 adds namespaces, copyright headers, modern features). A copy with significantly **more** lines than BC25 likely contains custom code.

**Triage outcomes:**

| DELTA? | Custom markers? | BC25 procedures match? | Action |
|---|---|---|---|
| No | No | Yes (all standard) | **Delete** — pure unmodified copy |
| Yes | — | — | **Keep and renumber** to custom ID range + add project suffix |
| No | Yes | — | **Investigate** — custom code was embedded outside the DELTA process |
| No | No | Some missing | **Investigate** each missing procedure — likely BC14→BC25 refactoring, but verify |

**When renumbering (objects with DELTAs):**
- Assign a new ID in your custom range (e.g., 53xxx for reports)
- Add project suffix to the object name (e.g., `"Payment Journal Post002CGD"`)
- Update the file name to match your naming convention
- The DELTA content tells you what customizations exist — plan cleanup for a later wave

**False positives in procedure comparison:**
Standard BC14 helper procedures are frequently renamed, inlined, or removed in later BC versions. These show up as "missing in BC25" but are NOT customizations. Common examples:
- `GetLastViewedJournalBatchName` / `SetLastViewedJournalBatchName` — journal batch tracking, refactored in BC25
- `ShowTracking` / `ShowReservationEntries` — production order line helpers, inlined
- `MATRIX_GenerateColumnCaptions` — matrix page helpers, redesigned
- `SetSourceType` — option parameter helpers, refactored

To confirm a "missing" procedure is standard: (1) no DELTA exists, (2) the procedure body calls only standard BC objects/codeunits, (3) no project-specific naming or field references.

See [checklists.md](checklists.md) → Copied Standard Page/Report Triage Checklist and [safety-rules.md](safety-rules.md) → Two-Pass Verification for Object Deletion.

### XMLports

XMLports with non-ASCII names or complex DotNet processing often fail conversion. Manual conversion required:
- Fix namespace handling
- Replace DotNet XML processing with AL-native `XmlDocument`
- Verify all field references against current BC tables

### Enums

Created when converting Option fields to Enum types. See [patterns.md](patterns.md) for when this is safe and the conversion pattern.

---

## Decision Shortcuts

| What you see | What to do |
|---|---|
| File has only `modify` blocks restating captions | **Delete file** (after safety check) |
| `Unsupported feature: Property Modification (TextConstString)` | **Delete the comment block** — handled by XLIFF |
| `Unsupported feature: Code Modification on "CopyFrom..."` | **Subscriber codeunit** on `OnAfterCopyFrom*` event |
| `Code Modification` on a local procedure (e.g. `SetColumns`) | **Hardest case** — local vars are inaccessible. Check for events/protected vars at compile time, else custom replacement page. See [patterns.md](patterns.md) → "Code Modification on Local Procedures" |
| `Unsupported feature: Code Insertion on "OnInsert"` | **Subscriber** on `OnAfterInsertEvent` |
| `Unsupported feature: Code Modification on "OnValidate"` of standard field | Find field-level event or redesign |
| `Unsupported feature: Code Insertion on "OnModify"` | **Subscriber** on `OnAfterModifyEvent` |
| `Unsupported feature: Code Insertion on "OnDelete"` | **Subscriber** on `OnAfterDeleteEvent` |
| `Unsupported feature: Property Modification (Data type)` | **Cannot change data type** in extension — investigate, redesign |
| `Parameters and return type have not been exported` | **Search BC symbols** — never guess |
| Table is obsolete (e.g., Product Group 5723) | Delete extension or create data migration — see [patterns.md](patterns.md) |
| Field uses `Option` type | Evaluate for Enum conversion — see [patterns.md](patterns.md) |
| FlowField references custom field on another table | Verify the referenced extension exists |
| Code uses `DotNet` types | **On-prem target**: keep + consolidate `dotnet.al`, tag for future replacement. **SaaS target**: replace with AL native. See [obsolete-apis.md](obsolete-apis.md) and the DotNet Strategy section in this file. |
| Code uses `WITH ... DO BEGIN` | Unwind — see [patterns.md](patterns.md). For batch removal across many files, expect ~85% automation with ~15% compiler-guided manual fixes. See [patterns.md](patterns.md) → Batch Strategy for WITH Removal. |
| After automated WITH removal: `RecA.SetRange(RecB."Field"...)` where A ≠ B | **Overcorrected first param** — remove `RecB.` prefix. The first param of SetRange/SetFilter must be a field on the caller record. See [patterns.md](patterns.md) → Batch Strategy for WITH Removal. |
| After automated WITH removal: unquoted field names (`Amount`, `City`, etc.) cause compiler errors | **Unqualified field from former WITH block** — add `RecVar.` prefix. The compiler points to each one. See [patterns.md](patterns.md) → Batch Strategy for WITH Removal. |
| Planning batch cleanup across hundreds of files | Follow the **Phased Batch Cleanup Order**: safe/simple ops first (Scope, Find, empty triggers, quotes), WITH removal last. See [patterns.md](patterns.md) → Phased Batch Cleanup. |
| Code uses `FORM.RUNMODAL` | Change to `Page.RunModal` |
| Code calls `NoSeriesManagement.GetNextNo` | **Migrate** to `Codeunit "No. Series"` — CU 396 is `Pending` in BC25, will be `Removed`. BEWARE: Boolean param has different meaning in old vs new! See [obsolete-apis.md](obsolete-apis.md) → No. Series Module Migration |
| Code calls `NoSeriesMgt.InitSeries(...)` | **Migrate** to `NoSeries.GetNextNo()` + `NoSeries.AreRelated()` — most common in custom table OnInsert triggers. See [obsolete-apis.md](obsolete-apis.md) |
| Code calls `NoSeriesMgt.TryGetNextNo(...)` | **Replace** with `NoSeries.PeekNextNo()` — see [obsolete-apis.md](obsolete-apis.md) |
| Code uses `array of Codeunit NoSeriesManagement` | **Replace** with single `Codeunit "No. Series - Batch"` — see [obsolete-apis.md](obsolete-apis.md) |
| Code calls `SMTP Mail` functions | Rewrite using Email module — see [obsolete-apis.md](obsolete-apis.md) |
| Code uses `Record TempBlob` with `.ReadAsText` / `.WriteAsText` | Replace with native BLOB streams (`BlobField.CreateInStream/CreateOutStream`) — see [obsolete-apis.md](obsolete-apis.md) |
| Code uses `Record TempBlob` + `BLOBExportToServerFile` to write BLOB to disk | **Replace** — use `BlobField.CreateInStream` + `File.Create` + `CopyStream` directly, no intermediary needed — see [obsolete-apis.md](obsolete-apis.md) |
| Code uses `FileMgt.ClientFileExists` / `DeleteClientFile` / `UploadFileSilent` / `BLOBImport` | Replace with server-side AL: `Exists()`, `Erase()`, `UploadIntoStream()` — see [obsolete-apis.md](obsolete-apis.md) |
| Code has `[RunOnClient]` attribute | **Remove** — not supported in SaaS |
| Table extension has `key(Key1; ...)` generic names | Rename to project-prefixed: `key(Key50000; ...)` — see [patterns.md](patterns.md) |
| Field name in quotes but has no spaces/special chars | Remove unnecessary quotes: `"FieldNamePROJ"` → `FieldNamePROJ` — see [patterns.md](patterns.md) |
| Table extension is >200 lines but only 1–3 custom fields | Consider **fresh rewrite** instead of line-by-line cleanup — see Table Extensions section above |
| Caption contains `N'` (smart quote U+2019) | Replace `'` with `°` (degree sign) — it's `N°` (French "Numéro") — see [patterns.md](patterns.md) |
| Caption/Label contains `"` (smart quote U+201C) + diacritical | Same encoding fix as ASCII `"` variant but needs Unicode-aware tools — see [patterns.md](patterns.md) |
| Field marked `Description = 'OBSOLETE'` | **Do NOT auto-delete** — verify per [safety-rules.md](safety-rules.md) |
| DELTA has only `PropertyModification` on `TextConstString` | **Delete the entire copied codeunit** — no subscriber needed. See [delta-methodology.md](delta-methodology.md) → FRB Encoding-Only DELTA Recognition |
| DELTA has zero `CodeModification` + zero `Insertion` + only `TextConstString`/`Version List` mods | **FRB encoding-only DELTA** — accented chars (é→?) corrupted during export. No AL subscriber needed; XLIFF handles translations |
| DELTA `ModifiedCode` starts with "merged but contained errors" | **Do NOT dismiss as dead code.** This is a C/AL merge tool artifact — uncomment the block, diff against `OriginalCode`, find the real change. See [delta-methodology.md](delta-methodology.md). |
| Commented-out code in **custom table** | **Safe to remove** — all code is custom; git preserves history. See [patterns.md](patterns.md). |
| Commented-out code in **table extension or copied CU** | **Dangerous** — may be standard BC code. Analyze each block individually before removing. See [safety-rules.md](safety-rules.md). |
| Historic change-tracking tags (`//-->DATE-TAG`, `//YYMMDD:dev:`) | **Remove** in any object type — git replaces C/AL-era change tracking |
| `'FieldName' does not exist in the current context` | Try: (1) add project suffix, (2) fix diacritics + suffix, (3) strip diacritics + suffix, (4) search by ID. See [patterns.md](patterns.md) → Name Resolution. |
| `Table 'X' is missing` | Same name resolution strategy — the table was renamed with suffix and/or diacritics changed. Search project for the table ID. **Do NOT skip English-named tables** — see [patterns.md](patterns.md) → "English-Looking" Custom Table Names. |
| `Codeunit/Page/Report/XMLport 'X' is missing` | Same suffix resolution as tables — custom objects of ALL types get renamed with suffix. A single codeunit rename can break 40+ references project-wide. Always search-and-replace the old name across the **entire project**. |
| `'Record X' does not contain a definition for 'Y'` (table ext field) | Field was renamed: spaces removed + PascalCase + suffix. E.g., `"Applied Doc number Firstly"` → `AppliedDocNumberFirstly<Suffix>`. Search the table extension for the actual field name. See [patterns.md](patterns.md) → Table Extension Field Name Transformation. |
| Page ext `field("Old Name"; "Old Name")` with linter error | Update **both** control name and source expression to match the actual field in the table extension. See [patterns.md](patterns.md) → Page Extension Field Control Resolution. |
| Trigger has `var` declarations but empty `begin...end` body | **Delete the entire trigger** (including the `var` block). This is a txt2al artifact — the original logic was lost or already extracted. See [patterns.md](patterns.md) → Empty Triggers with Orphaned Variables. |
| `fieldgroup` references `FieldN` (e.g., `Field3`) that doesn't exist | **Remove the phantom reference.** txt2al generates `FieldN` placeholders when a deleted field was still referenced in a fieldgroup. See [patterns.md](patterns.md) → Phantom FieldN References. |
| `Option` field in `TableRelation WHERE` compared to standard `Enum` field (AL0603) | **Convert the Option field to the matching Enum type** — safe in custom tables when ordinals match exactly. Remove `OptionCaption`/`OptionMembers` (they come from the enum). See [patterns.md](patterns.md) → Option to Enum Conversion. |
| Code uses `Find('-')` in a loop | Replace with `FindSet()`. Outside a loop, use `FindFirst()`. See [patterns.md](patterns.md) → Find('-') Modernization. |
| Page ext has only `modify` blocks with Caption/ToolTip | **Delete entire file** — no custom content, standard BC provides these values natively |
| Page ext `modify` block has only `ToolTip = '...'` | **Delete the modify block** — restates standard BC tooltip, zero functional impact |
| Page ext `modify` block has only `Caption = '...'` | **Delete the modify block** — even "meaningful" renames create confusion by overriding standard terminology |
| Page ext `modify` has Caption/ToolTip + `Visible`/`Importance` | **Strip** Caption/ToolTip lines, **keep** only the functional properties. See [patterns.md](patterns.md) → Page Extension Modify Block Triage. |
| `//The property 'PromotedIsBig' can only be set...` | **Delete** both comment lines (this + the `//PromotedIsBig = true;` below it) — txt2al artifact |
| `//The property 'PromotedCategory' can only be set...` | **Delete** both comment lines — same txt2al artifact |
| Active `Promoted = true` / `PromotedIsBig = true` / `PromotedCategory` | **KEEP as-is** — fully supported in BC25 latest CU. No `actionref` conversion needed during migration |
| `PromotedActionCategories = '...'` at page level | **KEEP as-is** — fully supported in BC25. No conversion needed |
| `//Unsupported feature: Property Modification (ImplicitType)` in page ext | **Delete** — handled natively by modern BC |
| `//Unsupported feature: Property Modification (TextConstString)` in page ext | **Delete** the entire comment block including the var/value sections — XLIFF handles translations |
| Page ext has 50+ `modify` blocks but only 1–5 custom fields | Triage first: remove all noise blocks. If nothing custom remains, delete the file. See [patterns.md](patterns.md) → Batch Processing Strategy. |
| Code uses `Find('+')` | Replace with `FindLast()`. See [patterns.md](patterns.md) → Find('-') Modernization. |
| Code uses `CODEUNIT.Run(80, ...)` with magic number | Replace with `Codeunit.Run(Codeunit::"Sales-Post", ...)`. See [patterns.md](patterns.md) → CODEUNIT.Run with Magic Numbers. |
| EventSubscriber uses numeric object ID (`ObjectType::Table, 50148`) | Replace with named ref: `Database::"Table Name"`. See [patterns.md](patterns.md) → EventSubscriber with Numeric Object IDs. |
| Code uses `Record File` or `Record File temporary` for directory listing | Replace with `File Management` codeunit or `List of [Text]`. See [obsolete-apis.md](obsolete-apis.md) → Record File for Directory Listing. |
| Code uses DotNet `ZipFile` / `ZipArchive` | Replace with `Codeunit "Data Compression"`. See [obsolete-apis.md](obsolete-apis.md) → ZipFile DotNet. |
| Code has `Commit` without clear justification | Evaluate: keep before `RunModal`/HTTP calls; remove debug commits. See [obsolete-apis.md](obsolete-apis.md) → Commit Statement Guidance. |
| `Message` / `Confirm` / `Dialog.Open` without `GuiAllowed` guard | Wrap with `if GuiAllowed then` — prevents runtime errors in Job Queue/web service context. |
| Code contains `Message('loulou')`, `Error('TEST')`, or `TestManual()` procedure | **Delete** — debug/test code left in production. See [patterns.md](patterns.md) → Debug and Test Code Detection. |
| Codeunit named `RAZ*`, `MAJ*`, `OneShot*` with hardcoded data | **Triage as one-shot** — delete if migration already ran; keep and modernize if still needed. See One-Shot / Migration Codeunits. |
| Codeunit body is entirely commented-out or empty after cleanup | **Delete the file** — an empty codeunit with no executable code has no reason to exist. Don't leave empty shells behind. |
| Any AL object with an empty body and zero references project-wide | **Delete the file** after: (1) read full file, (2) search for name AND ID across the entire project. Zero code + zero refs = dead weight. See [patterns.md](patterns.md). |
| Procedure named `"===Functions==="()` or `___()` | **Delete** — C/AL section separator, no runtime effect. See [patterns.md](patterns.md) → Empty Separator Procedures. |
| `Record "Custom Table"` without project suffix | **Resolve** — build the table inventory, find the suffixed name (e.g., `"Alert Entry"` → `"Alert Entry<Suffix>"`). Watch for combined encoding + suffix changes. See [patterns.md](patterns.md) → Name Resolution. |
| Bare `"Field Name"` without record variable prefix after WITH removal | **Critical bug** — incomplete WITH removal. Either qualify all fields with `RecVar."Field Name"` or put the WITH back. See [patterns.md](patterns.md) → Incomplete WITH Removal. |
| Variable uses `_G`/`_L`/`_P` suffix or `rec`/`cod`/`int` prefix | **Rename** to PascalCase. See [patterns.md](patterns.md) → Legacy Variable Naming Cleanup. |
| Object ID outside custom range (50000+) in Custom folder | **Suspect copied standard codeunit** — may need DELTA-based extraction, not direct cleanup. See Copied Standard Codeunits in Unexpected Locations. |
| Caption contains `╔` (U+2554, box-drawing char) | Replace with `°` (degree sign) — it's `N°`. See [patterns.md](patterns.md) → Additional Encoding Corruption Characters. |
| Namespace contains the project suffix more than once (e.g., `MyProject<Suffix><Suffix><Suffix>`) | **Fix** — suffix was accidentally applied multiple times. See [patterns.md](patterns.md) → Namespace Suffix Duplication Trap. |
| `if Rec.Insert() then ;` (empty then clause with dangling semicolon) | **Cosmetic cleanup** — C/AL idiom. Not a bug, but tighten during Phase 2 cleanup. See [patterns.md](patterns.md) → Empty Then Clause. |
| Copied standard CU has custom **public procedures** called by other objects (not trigger mods) | Extract to **standalone codeunit** (not subscriber). These are APIs, not event hooks. See [patterns.md](patterns.md) → Custom Helper Procedures. |
| Copied `SMTP Mail` (CU 400) or `Mail` (CU 397) with custom procedures | Create a **thin wrapper codeunit** using the BC Email module plus an event subscriber for modified standard behavior. Rename it to avoid conflict. See [patterns.md](patterns.md) → SMTP Mail Wrapper Pattern. |
| `FileMgt.BLOBImportFromServerFile(TempBlob, Path)` | **Deprecated** — replace with `File.Open(Path)` + `File.CreateInStream(InStr)`. See [obsolete-apis.md](obsolete-apis.md). |
| `action()` directly inside `cuegroup` without `actions { }` wrapper | **Wrap** in `actions { }` — cuegroups require the wrapper around action definitions. See [patterns.md](patterns.md) → Cuegroup Actions Require `actions { }` Wrapper. |
| `area(reporting)` or `area(processing)` nested inside `addfirst()`/`addafter()` | **Restructure** — close the `add*()` block first, then start `area()` at the same level. See [patterns.md](patterns.md) → `area()` Cannot Be Nested Inside `add*()` Blocks. |
| Variable declared as `wscript: Automation <AutomationAlias>;` or similar | **Remove** — `Automation` type has no AL equivalent. Remove or redesign all usages (`Create()`, method calls). See [patterns.md](patterns.md) → C/AL-Only Types: `Automation` Variables. |
| `Compiled=CONST(true)` in DataItemTableView or SourceTableView | **Remove** the `Compiled` filter — field doesn't exist on Object virtual table in modern BC. See [patterns.md](patterns.md) → Object Virtual Table: `Compiled` Field Removed. |
| `AL0104: 'end' expected` pointing at next procedure's `[Scope('Internal')]` | **Missing procedure `end;`** — count `begin`/`end` pairs in the preceding procedure. See [patterns.md](patterns.md) → Procedure `begin`/`end` Imbalance After Code Surgery. |
| `The length of the application object identifier '...' cannot exceed 30 characters` | **Shorten the name** using PascalCase abbreviations (e.g., `Purchase` → `Purch`, `Management` → `Mgmt`). Update ALL cross-references project-wide — codeunits are high-risk (variable declarations, `RunObject`), page extensions are usually low-risk. For names with encoding corruption, replace BOTH corrupted and correct forms. See [patterns.md](patterns.md) → Object Identifier Length Limit. |
| Copied CU 90/80 with 10+ custom blocks across unrelated features | **Split into multiple subscriber CUs by feature area** — e.g., `PurchPostCoreEvent<Suffix>`, `PurchPostReceiptEvent<Suffix>`, `PurchPostDocMgmtEvent<Suffix>`. See the feature-area splitting guidance later in this file. |
| BC14 DELTA modifies `PostBalancingEntry` in CU 90 or CU 80 | **Event is NOT on CU 90/80** — in modern BC, invoice posting moved to CU 816/815. Subscribe to `Codeunit "Purch. Post Invoice Events"` or `"Sales Post Invoice Events"`. See [event-mapping.md](event-mapping.md) → Purch. Post Invoice Events. |
| Subscriber modifies purchase/sales lines during posting | **Dual-update required** — modify both real DB lines AND `TempPurchLineGlobal`/`TempSalesLineGlobal`. Use `SuspendStatusCheck` around `Validate` calls. See [patterns.md](patterns.md) → TempPurchLineGlobal Dual-Update Pattern + SuspendStatusCheck Pattern. |
| User provides "standard source" with custom 54xxx object IDs | **Ambiguous reference trap** — this is the project's *copy*, not the real standard. See [delta-methodology.md](delta-methodology.md) → The Ambiguous Reference Trap. |
| User provides "standard source" with dated developer comments | **Same trap** — project change tags prove it is a custom copy. Request the unpacked Base App source instead. |
| User provides "standard source" with custom field names | **Same trap** — project-specific fields are never part of standard BC. |
| BC25 standard `InsertTransShptLine` already calls `Insert()` outside qty check | **BC25 already implements zero-qty posting** — delete the copy, no subscriber needed. See [delta-methodology.md](delta-methodology.md) → BC25 Already Implements It. |
| BC25 `OnBeforeOnRun` event has `SkipTypeCheck` parameter | **BC25 already supports non-item types** — a one-line subscriber may replace the entire copied CU. |
| BC25 standard already has `if Type = Item` guards in posting loop | **No subscriber needed for type filtering** — verify by reading the verified standard source at the DELTA injection point. |
| Copied CU publishes `[IntegrationEvent]` that other CUs subscribe to | **Create a publisher codeunit** — move custom events and public procedures to a new CU, redirect subscribers, then delete the copy. See [delta-methodology.md](delta-methodology.md) → Custom Integration Events. |
| Two CUs with the same name but different IDs (54xxx vs standard) | **Name collision** — resolve by decomposing the 54xxx copy first. Any `Codeunit::"Name"` reference is ambiguous until the copy is deleted. See [delta-methodology.md](delta-methodology.md) → Name Collision Detection. |
| `Codeunit::"Approvals Mgmt."` resolves to a 54xxx copy instead of standard 1535 | **Blocking ambiguity** — decompose the copy as a high-priority item before any other work that references this CU. |
| Copied CU with `DotNet` types (`SMTP`, `HttpWebRequest`, `ZipFile`, `OpenFileDialog`) | **SaaS target**: redesign around BC Email, HttpClient, and Data Compression patterns. **On-prem target**: extract custom logic into subscriber, keep DotNet calls if they still work, tag for future replacement. Either way, do not keep the full standard copy. |
| `[Scope('Internal')]` attribute on procedures | **Remove** — deprecated in modern AL. Use `Access = Internal` on the codeunit level instead. |
| DELTA has only spacing/line-number changes with no code diff | **Formatting-only DELTA** — delete the copy, no subscriber needed. The DELTA lines are identical to standard except for whitespace. |
| Standard CU procedure was renamed between BC14 and BC25 | **Event may have moved** — search the verified Base App source for the procedure name. Check companion `"*Events"` codeunits. See [delta-methodology.md](delta-methodology.md) → Assuming BC25 events live on the same codeunit. |
| `SingleInstance = true` needed to pass state between pre/post events | **Use sparingly** — `SingleInstance` codeunits persist across calls within a session. Only use them when you must pass data between paired events. |
| Table DELTA has only CaptionML/TextConst changes (no custom fields, no code) | **No table extension needed** — classify as `CaptionML-only`. XLIFF handles translations. Do not create empty extensions. |
| Table DELTA has CaptionML + standard field data type change (e.g., Text50→Text100) | **Cannot change data type in extension** — create a parallel custom field with a wider type if the business still needs it, plus a migration codeunit to copy data. Classify as `GAP`. |
| Table DELTA modifies an obsolete BC25 table (e.g., Product Group 5723) | **Check for custom fields in the DELTA** — if they exist, create a migration codeunit to move data to the replacement table (e.g., Item Category). |
| Multiple documentation/review markdown files accumulating in a migration project | **Consolidate into one master tracking file** with appendices. Avoid scattering status across several overlapping review files. |
| Search-and-replace fails on garbled txt2al encoding characters | **Rewrite the affected file section directly**. Garbled bytes may not match reliably even when they look identical in the editor. Strategy: read the file, identify the clean section to keep, then rewrite only the intended content. |
| Only 1 manual migration codeunit exists despite 100+ table extensions | **Likely correct** — the Cloud Migration Tool auto-migrates data when field IDs and types match. Manual codeunits are usually only needed for structural transformations (obsolete tables, field restructuring). Verify that the custom fields keep the same IDs and types. |
| Custom field on table extension is a FlowField | **No data migration needed** — FlowFields are calculated at runtime, with no stored data to migrate. Safe to rename, restructure, or delete without a migration codeunit. |
| `AL0197` / `AL0264` on a page or report in `CustomAL/` with standard-range ID | **Copied standard object** — run two-pass verification (DELTA check + BC25 source comparison) before deleting. See Copied Standard Pages and Reports section. |
| Page/report in `CustomAL/` with ID 99000xxx, 2000xxx, or 130xxx | **Suspect copied standard** — check for DELTA file. If no DELTA + no custom markers in source = pure copy, safe to delete. |
| Page/report has DELTA but causes AL0197/AL0264 | **Renumber** to custom ID range (e.g., 53xxx) and add project suffix to name. Do NOT delete — contains real customizations. |
| Procedure in deleted copy "not found in BC25" | **Investigate individually** — likely standard BC14 code refactored in BC25. Verify: (1) no DELTA, (2) procedure body calls only standard objects, (3) no project-specific naming. |
| `AL0155` (member already defined) in a page extension | **Duplicate field/action** — the member now exists in standard BC25 and in your extension. Remove the duplicate from the extension. Verify the extension's `addafter`/`addbefore` block isn't left empty after removal. |

---

## Subscriber Codeunit Patterns

### Traceability Comments — Linking AL Files to NAV Predecessors

Every event subscriber codeunit or renumbered standard codeunit in the `DeltaAL/` folder should start with a **traceability comment** on line 1, before the `codeunit` declaration. This comment links the AL file back to the original NAV object it replaces and serves as a machine-readable cross-reference anchor (used by Strategy 6 of the Cross-Reference Inventory Report).

**For renumbered copies of standard codeunits (same name, new ID):**
```al
// Replaces standard Codeunit 408 "Dimension Management"
codeunit 54025 "DimensionManagementExt<Suffix>"
```

**For event subscriber codeunits replacing modifications on standard codeunits:**
```al
// Replaces standard Codeunit 231 "Gen. Jnl.-Post"
codeunit 50101 "GenJnlPostEvent<Suffix>"
```

**For event subscriber codeunits replacing modifications on standard tables:**
```al
// Replaces modifications on standard Table 36 "Sales Header"
codeunit 50050 "SalesHeaderEvents<Suffix>"
```

**For consolidated subscribers covering multiple standard codeunits:**
```al
// Replaces standard Codeunit 231 "Gen. Jnl.-Post"
codeunit 50101 "GenJnlPostEvent<Suffix>"
{
    // Example feature A: budget envelope check for recurring journals
    //   Replaces custom code in copied "Gen. Jnl.-Post" (54xxx).
    // Example feature B: pre-post validation before Post+Print
    //   Replaces custom code in copied "Gen. Jnl.-Post+Print" (54xxx).
```

**Rules:**
- Comment goes on **line 1** of the file, before the `codeunit` keyword
- Use exact format `// Replaces standard <ObjectType> <ID> "<Name>"` for codeunit/table/page replacements
- Use `// Replaces modifications on standard <ObjectType> <ID> "<Name>"` when the subscriber handles table/page event modifications (not a direct codeunit replacement)
- When one subscriber covers multiple standard objects, list the primary one on line 1 and detail the others inside the object body as descriptive comments
- These comments are both documentation **and** machine-readable anchors — the cross-reference script parses them

### Subscriber Organization

Use this decision rule to keep subscriber structure consistent:

- **Default:** one subscriber codeunit per standard table or codeunit that was modified
- **Consolidate:** when several small modifications belong to the same functional chain and remain cohesive in one file
- **Split by feature area:** when one standard codeunit has many unrelated customizations or the combined subscriber becomes difficult to review

The goal is clarity and traceability, not rigid uniformity.

### CopyFrom* pattern

Original C/AL added field copies inside `CopyFromTransferHeader`. BC publishes `OnAfterCopyFromTransferHeader`:

```al
codeunit 50XXX "TransferReceiptHeaderEvents"
{
    Access = Internal;

    [EventSubscriber(ObjectType::Table, Database::"Transfer Receipt Header", OnAfterCopyFromTransferHeader, '', false, false)]
    local procedure CopyCustomFields(var TransferReceiptHeader: Record "Transfer Receipt Header"; TransferHeader: Record "Transfer Header")
    begin
        TransferReceiptHeader."CustomField" := TransferHeader."CustomField";
    end;
}
```

### OnInsert code insertion pattern

```al
[EventSubscriber(ObjectType::Table, Database::"Transfer Line", 'OnAfterInsertEvent', '', false, false)]
local procedure TransferLineOnAfterInsert(var Rec: Record "Transfer Line"; RunTrigger: Boolean)
begin
    if not RunTrigger then
        exit;
    if Rec."Item No." <> '' then
        Rec.Validate("Custom Lot No.");
end;
```

### Standard field OnValidate insertion

Find field-level events:
- Look for `OnAfterValidate` events on the specific field
- Or use `OnAfterValidateEvent` with field number filtering
- If no event exists, assess page-level override or functional redesign

### No Event Available

See [event-mapping.md](event-mapping.md) → Fallback Strategies for options when no event exists.

### Feature-Area Splitting for Large Standard Codeunits

When a copied standard codeunit has **10+ customizations spanning unrelated feature areas** (e.g., CU 90 "Purch.-Post" with posting core, receipt handling, document management, and legislation-specific logic), creating a single subscriber codeunit produces a monolithic file that is hard to maintain and review.

**Split into multiple subscriber codeunits by feature area:**

| CU | Feature area | Subscriber name | Example content |
|---|---|---|---|
| CU 90 | Core posting logic | `PurchPostCoreEvent<Suffix>` | SrcCode override, line pre-processing, status updates |
| CU 90 | Receipt line handling | `PurchPostReceiptEvent<Suffix>` | Service item creation, FA depreciation, warehouse FA |
| CU 90 | Document management | `PurchPostDocMgmtEvent<Suffix>` | Document metadata, attachments, or custom posting artifacts |
| CU 90 | Localization-specific logic | `PurchPostLocalizationEvent<Suffix>` | Country or industry-specific posting adjustments |
| CU 74 | Get receipt lines | `PurchGetReceiptEvent<Suffix>` | Receipt line filtering, purchaser code propagation |

**Naming convention:** `<StandardCUShortName><FeatureArea>Event<Suffix>`

**When to split:**
- The standard CU has modifications across 3+ unrelated business domains
- The combined subscriber would exceed ~200 lines
- Different team members own different feature areas
- The modifications subscribe to events on different codeunits (e.g., CU 90 + CU 816)

**When NOT to split:**
- All modifications serve the same business purpose (keep together)
- The combined subscriber is under 100 lines
- Splitting would create subscriber CUs with only 1 event each (marginal value)

**Traceability:** Use the standard traceability comment on line 1 of each subscriber, and add an inline comment noting the feature area:

```al
// Replaces standard Codeunit 90 "Purch.-Post" — receipt line customizations
codeunit 50118 "PurchPostReceiptEvent<Suffix>"
{
    Access = Internal;
    // ...
}
```

---

## Supporting Reference Files

| File | Purpose |
|---|---|
| [conventions.md](conventions.md) | Template for defining project conventions: naming, suffixes, folders, ID ranges |
| [patterns.md](patterns.md) | Encoding fixes, syntax modernization, WITH removal, TextConst→Label, variable naming, report/page patterns, Option→Enum, obsolete table handling |
| [safety-rules.md](safety-rules.md) | Trust-nothing philosophy, 5-point verification, field preservation hierarchy, schema change safety |
| [event-mapping.md](event-mapping.md) | C/AL trigger → BC event mapping for common standard codeunits |
| [obsolete-apis.md](obsolete-apis.md) | DotNet→AL replacements, removed codeunits/tables/pages, syntax changes |
| [checklists.md](checklists.md) | Phase-by-phase and per-object-type checklists |
| [delta-methodology.md](delta-methodology.md) | How to read DELTA files, fast-triage technique, extraction workflow, cross-dependency handling |
