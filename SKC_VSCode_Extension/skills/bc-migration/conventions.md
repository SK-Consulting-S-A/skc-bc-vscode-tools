# Project Conventions Template — C/AL to AL Migration

Every migration project must define its own conventions before starting cleanup.
This template lists what to define, with examples. Adapt it to your project.

## Project Suffix

Choose a unique suffix for all custom fields and objects. This prevents naming collisions
with other extensions and clearly identifies your customizations.

**Examples:** `PROJ`, `ABC`, `CUST1`, `CONTOSO`

**Where to find the suffix in an existing project:**

| Location | Property | When used |
|---|---|---|
| `AppSourceCop.json` | `"mandatoryAffixes": ["PROJ"]` | **AppSource apps** — the analyzer enforces this suffix on all objects and fields. This is the most authoritative source. |
| `.vscode/settings.json` | `"al.codeAnalyzers"` referencing AppSourceCop, plus the `AppSourceCop.json` above | Indirectly — if AppSourceCop is enabled, the suffix is enforced |
| `app.json` | No dedicated suffix property | The app `name` and `publisher` may hint at the convention, but the suffix itself is not stored here |
| Existing AL code | Search for `field(5xxxx;` declarations in table extensions | The suffix is visible on every custom field name — look at the pattern (e.g., `BuyFromVendorNoPROJ` → suffix is `PROJ`) |

**For PTE (Per-Tenant Extensions):** The suffix is typically a team convention, not enforced by a config file. Look at existing custom field names in the codebase to discover it. If multiple developers worked on the project, there may be **multiple suffixes** (one per developer or per feature area).

**For AppSource apps:** The suffix is mandatory and enforced by `AppSourceCop.json`. If this file exists, read the `mandatoryAffixes` array — that is your definitive suffix.

**Rule:** All custom field names in table extensions use the suffix. Custom table fields may use normal BC naming.

## Object Naming

Define a naming pattern for each object type. Typical patterns:

| Object type | Object name pattern | File name pattern |
|---|---|---|
| Table extension | `<StandardTable><Suffix>` | `<StandardTable><Suffix>.TableExt.al` |
| Page extension | `<StandardPage><Suffix>` | `<StandardPage><Suffix>.PageExt.al` |
| Report extension | `<StandardReport><Suffix>` | `<StandardReport><Suffix>.ReportExt.al` |
| Subscriber codeunit | `<StandardObject>Event<Suffix>` | `<StandardObject>Event<Suffix>.Codeunit.al` |
| Custom table | `<DescriptiveName><Suffix>` | `<DescriptiveName><Suffix>.Table.al` |
| Custom codeunit | `<DescriptiveName><Suffix>` | `<DescriptiveName><Suffix>.Codeunit.al` |
| Custom page | `<DescriptiveName><Suffix>` | `<DescriptiveName><Suffix>.Page.al` |
| Custom report | `<DescriptiveName><Suffix>` | `<DescriptiveName><Suffix>.Report.al` |
| Enum | `<EnumName><Suffix>` | `<EnumName><Suffix>.Enum.al` |
| Permission set | `<Name><Suffix>` | `<Name><Suffix>.PermissionSet.al` |
| Install codeunit | `Install<Suffix>` | `Install<Suffix>.Codeunit.al` |
| Upgrade codeunit | `Upgrade<Suffix>` | `Upgrade<Suffix>.Codeunit.al` |

### Field Naming Rules

| Context | Spaces allowed? | Suffix required? | Example |
|---|---|---|---|
| Custom field in table extension | No | Yes | `"ShipmentStatusPROJ"` |
| Custom field in custom table | Yes | Optional | `"Job No."`, `"Line Amount"` |
| Standard field (never rename) | N/A | N/A | `"No."`, `"Posting Date"` |

### File Rename Mapping (txt2al → clean)

txt2al generates ugly names. Define your cleanup pattern:

```
tableextension50077.TableExt-Transfer Receipt Header.al
  → TransferReceiptHeader<Suffix>.TableExt.al

pageextension50043.PageExt-Vendor Item Catalog.al
  → VendorItemCatalog<Suffix>.PageExt.al
```

The object name inside the file must also be updated:
```al
// Before (txt2al output)
tableextension 50077 tableextension50077 extends "Transfer Receipt Header"

// After (cleaned)
tableextension 50077 TransferReceiptHeaderPROJ extends "Transfer Receipt Header"
```

## Folder Structure

Define how files are organized. Common approaches:

### By object type (simple)
```
src/
├── TableExtensions/
├── PageExtensions/
├── ReportExtensions/
├── Codeunits/
├── Tables/
├── Pages/
├── Reports/
├── Enums/
└── PermissionSets/
```

### By object type + owner (multi-developer)
```
src/
├── TableExtensions/
│   ├── <Owner1>/
│   └── <Owner2>/
├── PageExtensions/
│   ├── <Owner1>/
│   └── <Owner2>/
├── Codeunits/
│   ├── <Owner1>/
│   └── <Owner2>/
└── ...
```

### By functional area
```
src/
├── Core/
├── Sales/
├── Purchasing/
├── Warehouse/
├── Finance/
├── HR/
└── Localization/
```

## ID Ranges

Define ID ranges for each object type. Ensure no overlaps:

| Object type | Range | Notes |
|---|---|---|
| Table extensions | 50000–50199 | |
| Page extensions | 50000–50199 | |
| Report extensions | 50000–50099 | |
| Custom tables | 50000–50299 | |
| Custom pages | 50000–50299 | |
| Custom codeunits | 50000–50099 | Business logic |
| Subscriber codeunits | 50100–50199 | Event subscribers |
| Custom reports | 50050–50199 | |
| Custom enums | 50000–50099 | |
| Permission sets | 50000–50009 | |
| Install codeunit | 50250 | Single |
| Upgrade codeunit | 50251 | Single |

Localization-specific ranges (if applicable):
| Range | Purpose |
|---|---|
| 69000–69099 | Country-specific legislation fields |

## Variable Naming Conventions — Hungarian Notation Cleanup

C/AL projects commonly use Hungarian notation with scope suffixes and type prefixes. During migration, these should be cleaned up to follow AL's PascalCase convention.

### Scope Suffixes (Most Common in French/Belgian BC14)

| Suffix | Meaning | Example | Clean name |
|---|---|---|---|
| `_G` | Global variable | `Employee_G` | `Employee` |
| `_L` | Local variable | `PurchaseLine_L` | `PurchaseLine` |
| `_P` | Parameter | `Item_P` | `Item` |
| `_R` | Record (rare) | `Vendor_R` | `Vendor` |

### Type Prefixes

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
| `g` | Global | `gDateCreation_txt` | `CreationDateText` |
| `R` + ID | Record by table ID | `R5606`, `R27` | `FAPostingGroup`, `Item` |
| `l` + name | Local record | `lCustomer` | `Customer` |
| `fu` | Function utility (rare) | `fuGetValue` | `GetValue` |

### Cleanup Priority

1. **Phase 2** — Clean during per-object cleanup for custom tables and codeunits
2. **Phase 3** — Verify no cross-references broke after renames
3. **Defer** for subscriber extraction — focus on correctness first, naming second
4. **Never rename** event subscriber parameter names that are compiler-enforced

### Project-Specific Pattern: `_G` / `_L` / `_P`

Some legacy codebases use `_G` / `_L` / `_P` extensively across a large share of codeunits. The suffixes carry no information that the `var` section and procedure signature don't already provide. Remove them systematically using find-and-replace within each procedure scope.

**Collision avoidance:** When removing `_L` from `Employee_L` and `_G` from `Employee_G` in the same codeunit, you'd have two variables named `Employee`. Resolution: keep the global as `Employee` and name the local contextually (e.g., `TempEmployee`, `FilteredEmployee`, or by its purpose).

## Reference Source Code Locations

Define where the standard BC source code is located. This prevents the ambiguous reference trap (see [delta-methodology.md](delta-methodology.md)).

| Source | Path | Notes |
|---|---|---|
| **BC standard source (authoritative)** | External folder outside the repo (e.g., `<StandardSourcePath>`) | Unpacked from `Microsoft_Base Application.app`. Kept outside the repo to avoid bloating git. |
| **DELTA files from BC14** | `<MigrationRoot>/Exports/Delta/Codeunit/COD*.DELTA` | Ground truth for what was customized. Never modify these. |
| **Copied codeunit AL files** | `<RepoRoot>/src/DeltaAL/Codeunits/<Owner>/` | txt2al output being decomposed. These are deleted after extraction. |
| **`.alpackages/` folder** | `.alpackages/` in the project root | Contains downloaded `.app` symbols. Can be unzipped for source, but prefer the dedicated external folder. |

**IMPORTANT:** Never use "Go to Definition" output as standard source — VS Code may navigate to the project's copied codeunit instead of the real standard. Always use the unzipped `.app` source from the dedicated folder.

## Ownership Rules

If multiple developers work on the migration, define clear ownership boundaries:
- Each developer owns specific functional areas
- Never modify objects in another owner's area without coordination
- Subscriber codeunits live in the owner's folder for the subscribed-to area

## Commit Conventions

Define commit message patterns for the migration:
- Cleanup: `Remove obsolete table extensions for X, Y, Z`
- New subscriber: `Extract event subscriber for Purch.-Post custom fields`
- File renames: `Refactor AL code for consistency and clarity`
- Batch operations: list affected objects in commit body
- Phase work: `Phase 2 cleanup: [owner]'s table extensions`

## Legacy Comment Tags

Document the comment tags used in the C/AL codebase. These identify who changed what and why:

| Tag pattern | Meaning |
|---|---|
| `//DEV` or `//JD` | Developer initials |
| `//FEAT-001` or `//PT-0044` | Feature/ticket reference |
| `//FEAT-A`, `//FEAT-B` | Feature area tags |
| `//-->TAG` ... `//<--TAG` | Block delimiters around custom code in copied codeunits |

**Rule:** Preserve tags when they document business context. Remove only when associated code is deleted. When extracting to subscribers, preserve the tag for traceability:
```al
// Extracted from Purch.-Post (CU 90), tag: //DEV
```

## Field Description Metadata

The `Description` property on fields is often used as a metadata marker in C/AL projects:

| Description pattern | Typical meaning |
|---|---|
| `'OBSOLETE'` | Developer intended to deprecate the field |
| `'DEV 180218 OBSOLETE'` | Developer + date + obsolete marker |
| `'DEV 060118'` | Developer + date field was added |
| `'FEAT01'` | Feature/module reference |

**CRITICAL:** These descriptions are **opinions from the past**, not verified facts.
A field marked `OBSOLETE` years ago may still have data if the cleanup never happened.
Always verify before acting on Description metadata.

## app.json Template

```json
{
    "id": "<project GUID>",
    "name": "<Project Name>",
    "publisher": "<Publisher>",
    "version": "25.0.0.0",
    "dependencies": [],
    "platform": "25.0.0.0",
    "runtime": "14.0",
    "target": "OnPrem",
    "idRanges": [
        { "from": 50000, "to": 50299 }
    ],
    "features": ["TranslationFile"],
    "resourceExposurePolicy": {
        "allowDebugging": true,
        "allowDownloadingSource": true,
        "includeSourceInSymbolFile": true
    }
}
```

Adjust `runtime`, `platform`, and `target` to match your deployment scenario.
For AppSource apps, add `"target": "Cloud"` and configure AppSourceCop.
