# Delta-First Methodology — Extracting Custom Code from Copied Standard Codeunits

## Why DELTA Files Are the Ground Truth

When txt2al encounters a standard codeunit that was directly modified in C/AL, it generates a **full copy** — thousands of lines of standard code mixed with a handful of custom ones. These full copies are unusable in modern BC but extremely hard to analyze because the custom code is buried.

The `.DELTA` files from the C/AL export show **only the differences**. They are typically 20–200 lines instead of 2,000–8,000. They tell you exactly:
- Which procedures were modified
- Which variables were added
- Which new procedures were created
- Which properties changed (Permissions, TextConst translations)
- Precisely where in the standard code the custom logic was injected

**Always start from the DELTA. Never start from the full copy.**

## DELTA File Format Reference

A DELTA file has this structure:

```
OBJECT Modification "<CU Name>"(Codeunit <ID>)
{
  OBJECT-PROPERTIES { ... }
  PROPERTIES { Target="<CU Name>"(Codeunit <ID>); }
  CHANGES
  {
    { <ChangeType>; <details> }
    { <ChangeType>; <details> }
    ...
  }
  CODE { BEGIN END. }
}
```

### Change Types

#### `PropertyModification`

A property on a variable, procedure, or the object itself was changed.

```
{ PropertyModification;
  Target=Text001(Variable 1000);
  Property=TextConstString;
  OriginalValue=[ENU=...;FRB=...];
  ModifiedValue=[ENU=...;FRB=...] }
```

**Common cases:**
- `TextConstString` — FRB/NLB translation tweaks (accent marks, quotation style). **Always safe to discard** — handled by XLIFF in modern BC.
- `Permissions` — Added table data access for custom code. **Note for subscriber.**
- `Version List` — Tags like `FEAT-A`, `VENDOR-X` indicating which feature modified the CU.

#### `CodeModification`

Lines of code in an existing procedure were changed.

```
{ CodeModification;
  OriginalCode=BEGIN
                  #1..5
                  StandardLine;
                  #7..10
                END;
  ModifiedCode=BEGIN
                  #1..5
                  StandardLine;
                  // Custom code inserted here
                  CustomLogic();
                  #7..10
                END;
  Target=ProcedureName(PROCEDURE 1) }
```

**The `#N..M` range notation** references unchanged standard lines by line number. Everything NOT in a `#N..M` range is custom code that needs extraction.

#### `Insertion`

New elements were added (variables, procedures, documentation).

```
{ Insertion;
  Target=OnRun;
  ChangedElements=VariableCollection
  {
    MyNewVar@1100074000 : Record "My Table";
  } }
```

```
{ Insertion;
  InsertAfter=ExistingProcedure(PROCEDURE 5);
  ChangedElements=PROCEDURECollection
  {
    PROCEDURE MyNewProcedure@1100074001();
    BEGIN
      // entirely new code
    END;
  } }
```

## The Fast-Triage Technique

Before analyzing any DELTA in depth, do a 30-second scan:

### Step 1: Search for `CodeModification` or `Insertion` with `PROCEDURECollection`

If the DELTA contains neither of these, it has **no code changes** — only property modifications (TextConst translations, Version List, Permissions).

### Step 2: Check if all PropertyModifications are TextConstString

If every `PropertyModification` targets `TextConstString`, the DELTA is a **translation-only change**. These are capitalization tweaks in FRB/NLB translations (e.g., `é` → `É`, `N°` → `Nº`, `écriture` → `Écriture`).

**Action:** Delete the copied codeunit entirely. No subscriber needed. XLIFF handles translations.

#### FRB Encoding-Only DELTA Recognition

A very common pattern in French/Belgian/Luxembourgish BC14 migrations: the DELTA contains ONLY `PropertyModification` entries where accented characters were corrupted during export (e.g., `é` replaced with `?` or a garbled byte sequence). These are NOT functional changes — they are encoding artifacts from the C/AL export process interacting with the FRB (French Belgian) locale.

**Quick test:** If a DELTA has:
- Zero `CodeModification` elements
- Zero `Insertion` elements (except possibly `Documentation` insertions with empty or version-list-only content)
- Only `PropertyModification` on `TextConstString` and/or `Version List`

Then it is an **encoding-only DELTA**. No AL event subscriber is needed.

**Real example — COD225 "Gen. Jnl.-Apply":**
```
{ PropertyModification;
  Property=TextConstString;
  OriginalValue=...FRB=Lettre dénonciation : solde ouvert supérieur ...;
  ModifiedValue=...FRB=Lettre d?nonciation : solde ouvert sup?rieur ... }
```
The only difference is `é` → `?`. This is an encoding artifact, not a business logic change. No action needed — XLIFF handles translations in modern AL.

**Cross-reference report:** Mark these as "MISSING — encoding only, no action needed" or simply leave them as MISSING with a note in the ExportFile column.

### Step 3: If code changes exist, classify them

For each `CodeModification` or `Insertion`:

| What you find | Classification | Action |
|---|---|---|
| Code inserted inside existing procedure | Business logic injection | Find BC event at injection point → subscriber |
| New procedures added (PROCEDURECollection) | New functionality | Extract to standalone codeunit or subscriber |
| Only commented-out code in ModifiedCode | Dead code | Document what it was, delete |
| Variables added (VariableCollection) | Supporting declarations | Come along with code extraction |

### Result of Fast Triage

In a typical French/Belgian BC14 migration, fast triage reveals:
- **~40% of copied codeunits are TextConstString-only** → delete immediately
- **~10% are dead code / commented-out changes** → delete after documentation
- **~50% have real business logic** → extract to event subscribers

This immediately cuts the work in half.

## Extraction Workflow

### For each CodeModification

1. **Read the `Target=`** — identifies which procedure was modified (e.g., `Code(PROCEDURE 1)`, `OnRun`)
2. **Read the `#N..M` ranges** — these are unchanged standard lines. Skip them.
3. **Read everything else** — this is custom code
4. **Identify the injection point** — is the custom code before line 1? Between lines 29 and 30? After the last line?
5. **Find the BC event** that fires at that injection point (see [event-mapping.md](event-mapping.md))
6. **Write the event subscriber** with the custom code

### For each Insertion (PROCEDURECollection)

New procedures don't map to events — they are entirely new functionality:
- If called only from other custom code → absorb into the subscriber codeunit as a helper
- If called from multiple places → extract to a standalone utility codeunit
- If it's a C/AL section separator (`PROCEDURE "--- TAG ---"`) → delete

### For Variable Insertions

Variables added to existing procedures are needed by the custom code. Include them in the subscriber's `var` section. Rename from C/AL legacy naming (scope suffixes like `_L`, type prefixes like `rec`) to PascalCase.

## Handling Cross-Dependencies

Copied codeunits often reference each other's custom procedures. Before deleting any:

1. **Build a dependency graph** — search each DELTA's custom procedures across all other DELTAs
2. **Identify clusters** — groups of codeunits that must be extracted together
3. **Extract shared procedures first** to a utility codeunit
4. **Then extract individual subscribers** that call the utility

Common clusters:
- **Workflow cluster**: Workflow Setup + Event Handling + Response Handling + Approvals Mgmt + Approval WF Setup — custom approval workflows span all of these
- **Posting chain**: Purch.-Post + Purch.-Post (Yes/No) + Purch.-Post + Print + Release Purchase Document — the confirmation/posting/release lifecycle
- **Journal chain**: Gen. Jnl.-Post + Gen. Jnl.-Post+Print — post calls post+print's custom procedures

## Priority Wave Planning

Organize extraction into waves from easiest to hardest:

| Wave | Criteria | Typical count |
|---|---|---|
| **1 — Already done** | Previously extracted subscribers | Variable |
| **2 — Quick wins** | Small deltas, 1 subscriber each, clear BC event | ~7–10 files |
| **3 — Medium** | 2–5 subscribers each, multiple features | ~7–10 files |
| **4 — Complex** | Large codeunits (posting, warehouse), many modifications, deep extraction | ~5–8 files |
| **5 — Batch delete** | TextConstString-only files, one commit | ~25 files |

Do Wave 5 (deletions) early — it reduces noise and makes the remaining work clearer.
Do Wave 2 (quick wins) next — builds momentum and validates the extraction pattern.
Save Wave 4 (complex) for last — requires the most BC event knowledge and testing.

## Verifying Extraction Completeness

After extracting all custom code from a DELTA:

1. **Every `CodeModification` block** should map to at least one event subscriber
2. **Every `Insertion` with `PROCEDURECollection`** should be accounted for (extracted or documented as dead)
3. **The `Permissions` property changes** should be reflected in subscriber codeunit permissions
4. **The `Version List` tags** should be preserved as comments in the subscriber for traceability
5. **Add a traceability comment** on line 1: `// Replaces standard Codeunit NNN "Name"` — this links the subscriber to its NAV predecessor and is parsed by the cross-reference inventory script
6. **Compile the subscriber** against BC symbols — event signature mismatches will surface immediately
7. **Delete the full copy** — it must not exist in the final app

## Using conversion_log.txt for ID Mapping

When txt2al converts standard codeunits, it often **renumbers** them — assigning new IDs in the custom range while preserving the original name. The `conversion_log.txt` file (generated by txt2al) contains these mappings and is a critical data source for the cross-reference inventory.

**Format example:**
```
Codeunit 80 "Sales-Post" -> Codeunit 54001 "Sales-Post"
Codeunit 90 "Purch.-Post" -> Codeunit 54002 "Purch.-Post"
Codeunit 408 "Dimension Management" -> Codeunit 54025 "Dimension Management"
```

**How to use it:**
1. Parse the log to build an `OriginalID → NewID` mapping
2. For each MISSING standard codeunit in the cross-reference report, check if txt2al assigned it a new ID
3. If a mapping exists, verify the AL file exists at the new ID
4. Add the traceability comment `// Replaces standard Codeunit <OriginalID> "<Name>"` to the AL file

**Why this matters:** Without the conversion log, you cannot reliably match a codeunit like `54025 "Dimension Management"` back to standard Codeunit 408. The name-based matching (Strategy 5 in the cross-reference) catches many of these, but the conversion log is the definitive source.

**Location:** Typically in the txt2al output directory or the project's `docs/` folder. If it doesn't exist, reconstruct the mapping by comparing the standard BC object list against your AL codeunit inventory — any standard-named codeunit with a custom-range ID was renumbered.

## Common Pitfalls

### Pitfall: Trusting the full copy instead of the DELTA
The full copy has thousands of lines of standard code. You'll miss custom lines or mistake standard code for custom. Always use the DELTA.

### Pitfall: Extracting TextConst changes as code
French/Belgian C/AL projects have dozens of TextConstString modifications (quotation style, capitalization). These are NOT code changes. Delete the copied codeunit.

### Pitfall: Dismissing "merged but contained errors" blocks as dead code

The C/AL merge tool sometimes produces this header in `ModifiedCode`:

```
//The code has been merged but contained errors that could prevent import
//and the code has been put in comments. Use Shift+Ctrl+O to Uncomment
```

This does **NOT** mean the code was intentionally commented out or abandoned. It means:
1. During a BC cumulative update merge, the tool couldn't auto-merge the custom change with the updated standard
2. It commented out the entire block to prevent import errors
3. The developer was supposed to manually uncomment and re-merge

**Always uncomment the block and diff it against `OriginalCode`** to find the actual change. Often the real modification is tiny — e.g., a single `>` changed to `>=` — but it's buried under garbled merge artifacts with multiple overlapping versions of the same condition. Strip the comments, find the diff, and that diff is the business logic you need to preserve.

### Pitfall: Ignoring commented-out custom code
Commented-out code in a DELTA's `ModifiedCode` may document business rules that should be implemented differently. Read it, understand it, document it — then decide.

### Pitfall: Extracting without checking cross-dependencies
Custom procedure `CustomPrePostCheck()` added to Gen. Jnl.-Post is called from Gen. Jnl.-Post+Print. If you extract Post but not Post+Print, the call breaks. Map dependencies first.

### Pitfall: Assuming BC14 event signatures work in BC25
Event signatures evolve. A subscriber based on BC14's `OnBeforeInsertVATEntry` may need additional parameters in BC25. The compiler will catch this, but plan for it.

### Pitfall: Assuming BC25 events live on the same codeunit as BC14

Microsoft refactors standard codeunits across major versions. A procedure that existed in one codeunit in BC14 may have been **moved to a different codeunit** in BC25, taking its events with it.

**Known relocations:**

| BC14 location | BC25 location | What moved |
|---|---|---|
| CU 90 "Purch.-Post" — `PostBalancingEntry` | CU 816 "Purch. Post Invoice" → events on `Codeunit "Purch. Post Invoice Events"` | Invoice-specific posting logic |
| CU 80 "Sales-Post" — `PostBalancingEntry` | CU 815 "Sales Post Invoice" → events on `Codeunit "Sales Post Invoice Events"` | Invoice-specific posting logic |

**How this bites you:** The DELTA says `Target=PostBalancingEntry(PROCEDURE 42)` on CU 90. You search CU 90's BC25 events — no `PostBalancingEntry` event exists. The event is now on `Codeunit "Purch. Post Invoice Events"`, a completely different object.

**Prevention:** When a DELTA's target procedure has no matching event on the expected BC25 codeunit:
1. Search BC25 symbols for the procedure name across ALL codeunits (not just the original)
2. Check if Microsoft split the codeunit into sub-codeunits (common for CU 80, CU 90, CU 12)
3. Look for companion event publisher codeunits (pattern: `"<CUName> Events"`)
4. Check [event-mapping.md](event-mapping.md) for documented relocations

---

## Essential Files to Request from the User

Before beginning any decomposition or verification work, ensure you have these files available. **Request them proactively** — the user may not know which artifacts you need.

### Required Files

| File | Purpose | Where to find it |
|---|---|---|
| **DELTA files** (`.DELTA`) | Ground truth for what was customized in each standard codeunit | `<MigrationRoot>/Exports/Delta/Codeunit/COD*.DELTA` from the BC14 C/AL export |
| **Base Application source** | Verify event signatures and check whether the target BC version already implements the customization | Unpacked to a **dedicated folder outside the repo** (for example `<StandardSourcePath>`) to avoid bloating git. See [conventions.md](conventions.md) for the template. |
| **conversion_log.txt** | Maps original standard CU IDs to new 54xxx IDs assigned by txt2al | txt2al output directory or the migration docs folder |
| **The copied codeunit AL files** | The txt2al output to be decomposed — but NEVER use as primary analysis source | `<RepoRoot>/src/DeltaAL/Codeunits/` |

### Files That Look Helpful But Are Dangerous

| File | Trap | Detection |
|---|---|---|
| **`code.txt` from editor navigation** | Editor navigation on a standard codeunit name may resolve to the **project's copied codeunit** (same name, 54xxx ID) instead of the real standard. If a user exports that as "standard source," it contains custom code. | Check for: 54xxx object IDs, custom field names, developer comments (date-tagged), `// Replaces standard Codeunit` headers |
| **Symbol files** (`.app` packages) | These contain AL declarations but not implementation bodies — useful for event signatures but not for understanding standard logic | Use only for signature verification, not logic comparison |

### The Ambiguous Reference Trap

This is the single most dangerous mistake in the entire migration workflow:

**Scenario:** You ask the user for the standard BC source code of a codeunit. The user uses editor navigation on `Codeunit "Approvals Mgmt."` and sends you the result. But because the project contains `CU 54038 "Approvals Mgmt."` (a copied standard CU with the exact same name), the editor opened the **copy**, not the standard. You now believe custom code is standard code, and your entire comparison is invalid.

**Detection — 5 signs that "standard" source isn't standard:**

1. **Object ID is in the custom range** (50000+ or 54xxx) — standard CUs have IDs < 50000
2. **Custom field names appear** — fields like `"Free Text"`, `"Custom Vendor Code"`, or `"Diplomatic Exemption"` are never part of standard BC
3. **Developer comments with dates/initials** — `//130618:SSC:`, `//-->20220328-NEM01`, `//PR20/00264:ServItemApprov` are custom change-tracking tags
4. **`// Replaces standard Codeunit NNN` header** — this is the traceability comment from the migration itself
5. **Custom procedures exist** — procedures not found in standard BC documentation (e.g., `CreateServItemOnPurchLineRcpt`, `UnApplyCodaStatementCustLedgerEntry`)

**Prevention:**
- ALWAYS get the standard source by **unpacking the `.app` file directly**, not via editor navigation
- The unzipped source should be in a **dedicated folder outside the repo** (see [conventions.md](conventions.md)), or at `.alpackages/Microsoft_Base Application/src/`
- If the user provides an exported source snippet, verify it against these 5 checks before using it for any comparison
- When in doubt, search the provided source for a field name that only exists in your project — if found, it's the copy

**Impact on existing work:** If you discover midway that you've been comparing against a copy, **don't panic**. All DELTA-based analysis remains valid — the DELTA shows the diff against the *original* standard, not against any copy. Only event signature verification needs to be re-done against the real BC25 source.

---

## BC25 Already Implements It — Check Before Writing Subscribers

A critical step that saves significant effort: **before writing an event subscriber for a BC14 customization, check if BC25 standard already includes the same behavior.** Microsoft has incorporated many common customization patterns into the standard product over the years.

### Known BC25 Standard Incorporations

| BC14 Customization | BC25 Standard Behavior | Action |
|---|---|---|
| **Zero-qty transfer shipment lines** (CU 5704) | `InsertTransShptLine` calls `TransShptLine.Insert()` outside the `if Qty > 0` block — all lines get posted | Delete copy, no subscriber needed |
| **Undo Purchase Receipt for FA/GL Account** (CU 5813) | `Code()` has `if Type = Item` guard; `GetCorrectionLineNo` handles non-item lines; `OnBeforeOnRun` has `SkipTypeCheck` parameter | Delete copy, minimal subscriber for `SkipTypeCheck := true` |
| **Non-item type support in posting codeunits** | Many posting CUs now have type guards and `IsHandled`/`SkipXxxCheck` event parameters | Always check BC25 standard before implementing custom type support |

### How to Check

1. **Read the BC25 standard procedure** at the modification point identified in the DELTA
2. **Compare the logic flow** — does BC25 already have the `if` guard, the loop change, or the additional processing?
3. **Check event parameters** — BC25 events often include `SkipTypeCheck`, `IsHandled`, or `SkipValidation` parameters that enable the exact customization without any code
4. **Search for the custom field/concept** — if BC25 has a similar standard field, the customization may be fully superseded

### When BC25 Partially Covers It

Sometimes BC25 handles 90% of the customization but misses an edge case. In these situations:
- Create a minimal event subscriber for the remaining 10%
- Add a comment documenting what BC25 handles natively and what's custom
- Add a TODO for compile-time verification of the edge case

---

## Custom Integration Events Published by Copied Codeunits

Some copied standard codeunits don't just *modify* existing events — they **publish entirely new integration events** that other codeunits in the project subscribe to. This creates a unique decomposition challenge.

### The Problem

When CU 54038 "Approvals Mgmt." (a copy of standard CU 1535) publishes custom events like:
```al
[IntegrationEvent(false, false)]
procedure OnSendCandidateForApproval(var Candidate: Record "Custom Approval Record")
begin
end;
```

And another codeunit (for example, `WorkflowCustomApproval<Suffix>`) subscribes to it:
```al
[EventSubscriber(ObjectType::Codeunit, Codeunit::"Approvals Mgmt.", OnSendCandidateForApproval, '', false, false)]
local procedure HandleSendCandidateForApproval(var Candidate: Record "Custom Approval Record")
```

If you delete CU 54038, the subscriber has no publisher and won't compile.

### The Solution: Create a Publisher Codeunit

1. **Create a new extension codeunit** (for example, `ApprovalsMgtExt<Suffix>`) that:
   - Publishes all the custom integration events previously on the copied CU
   - Contains all custom public procedures that callers relied on
   - Subscribes to standard CU 1535 events to re-implement the code modifications

2. **Redirect all subscribers** from the copied CU to the new publisher:
   ```al
   // BEFORE (subscribing to the copy):
   [EventSubscriber(ObjectType::Codeunit, Codeunit::"Approvals Mgmt.", OnSendCandidateForApproval, '', false, false)]
   
   // AFTER (subscribing to the new publisher):
   [EventSubscriber(ObjectType::Codeunit, Codeunit::"ApprovalsMgtExt<Suffix>", OnSendCandidateForApproval, '', false, false)]
   ```

3. **Update all callers** of custom public procedures to use the new codeunit

4. **Delete the copied CU** — now safe because nothing references it

### Detection

Before deleting any copied CU, search for:
- `[IntegrationEvent(` declarations in the copied CU
- `[EventSubscriber(ObjectType::Codeunit, Codeunit::"<CopiedCUName>",` across the project
- Direct procedure calls like `CopiedCU.CustomProcedure(...)` across the project

---

## Name Collision Detection and Resolution

### The Problem

Copied standard codeunits in the 54xxx range often keep their original standard name (e.g., CU 54038 `"Approvals Mgmt."` has the same name as standard CU 1535 `"Approvals Mgmt."`). This causes:

1. **Compiler ambiguity** — `Codeunit::"Approvals Mgmt."` could resolve to either object
2. **IDE navigation errors** — editor navigation may open the copy instead of the standard
3. **Event subscriber misdirection** — subscribers intending to target standard CU 1535 may accidentally bind to CU 54038

### Detection

Run this check for every copied CU:
1. List all copied CUs and their names
2. For each name, check if a standard CU with the same name exists
3. For each match, search for `Codeunit::"<Name>"` references in the project
4. Each reference is a potential ambiguity — determine whether it should target the standard or the copy

### Resolution Priority

Name collisions are a **blocking priority** — they must be resolved before other decomposition work, because:
- Any event subscriber targeting `Codeunit::"Approvals Mgmt."` is ambiguous
- The decomposition of other CUs may create new subscribers that hit the same ambiguity
- The compiler may silently bind to the wrong codeunit

### Resolution Approach

1. **Decompose the copied CU first** (extract custom logic to event subscribers)
2. **Delete the copied CU** — this eliminates the name collision
3. **All references** now unambiguously resolve to the standard CU

If the copied CU cannot be deleted immediately (e.g., it has too many callers), **rename it** to a unique name as an interim step.

---

## Cross-Verification Methodology

The complete verification workflow for any copied standard codeunit:

### Step 1: DELTA Analysis (source of truth)
Read the DELTA file to identify every custom modification — code insertions, code modifications, new procedures, property changes.

### Step 2: BC25 Standard Source Comparison
Read the actual BC25 standard source (from the unzipped `.app`) for the same codeunit. For each modification identified in Step 1:
- Does BC25 already implement this behavior? → No subscriber needed
- Does BC25 have an event at the injection point? → Create subscriber
- Has the procedure moved to a different codeunit? → Find the new location

### Step 3: Caller Analysis
Search the project for all references to the copied CU's custom procedures and custom events. Map every caller that needs to be redirected.

### Step 4: Implementation
Create event subscriber codeunits, update callers, delete the copy.

### Step 5: Post-Deletion Verification
After deleting the copy:
- Grep for the old CU name and ID across the entire project
- Verify no stale references remain
- Check that event subscribers now bind to the correct (standard) codeunit

---

## DELTA-to-AL Cross-Reference Verification

After completing object-level cleanup (Phase 2), run a systematic cross-reference to verify nothing was missed. This catches gaps that would surface as missing functionality in production.

### Methodology (per object type: Table, Page, Report)

**Step 1: Build the DELTA inventory**

List all `.DELTA` files for the object type. Extract object ID and name from line 1 of each file:
```
CHANGES TO Table 36 Sales Header    → ID=36, Name="Sales Header"
CHANGES TO Page 42 Sales Order      → ID=42, Name="Sales Order"
```

**Step 2: Build the AL inventory**

List all `.al` files for the corresponding extension type. Extract object declarations:
```
tableextension 50069 "FixedAsset<Suffix>" extends "Fixed Asset"  → extends "Fixed Asset"
pageextension 50200 "SalesOrder<Suffix>" extends "Sales Order"   → extends "Sales Order"
```

**Step 3: Map and classify**

For each DELTA, find a matching AL file (by target table/page name). Classify unmatched DELTAs:

| Classification | Criteria | Action |
|---|---|---|
| CaptionML-only | DELTA contains only `PropertyModification` on CaptionML/TextConst | No extension needed |
| No-op code change | DELTA has CodeModification but Original = Modified | No extension needed |
| Obsolete in BC25 | Target object is removed in BC25 (e.g., Product Group, Assisted Setup) | Check for custom data migration |
| Native in BC25 | DELTA's change is now standard BC behavior (e.g., Employee link on Contact Business Relation) | No extension needed |
| Covered by event subscriber | An event subscriber codeunit already handles this object's modifications | Verify the subscriber is complete |
| Genuine GAP | DELTA contains custom fields, code mods, or property changes not covered by any AL file | **ACTION REQUIRED** — create extension or subscriber |

**Step 4: Document in master tracking file**

Add a cross-reference table to the master file showing every DELTA, its AL match (or classification), and action status.

### Example Migration Results

In one real BC14→BC25 migration with 140 table DELTAs:
- 118 matched existing table extension AL files
- 12 were classified as CaptionML-only (no extension needed)
- 4 were classified as obsolete in BC25
- 2 were covered by event subscribers
- 4 were identified as genuine gaps requiring new work

The cross-reference caught several previously undocumented gaps, including field-size changes that would have caused data truncation in production.
