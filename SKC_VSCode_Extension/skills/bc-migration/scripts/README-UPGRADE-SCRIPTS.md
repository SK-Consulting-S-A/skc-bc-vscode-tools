# NAV 2017 to BC 2027 Upgrade Scripts

Comprehensive PowerShell scripts to automate the upgrade from NAV 2017 to Business Central 2027 using the bc-migration skill and BC Knowledge specialists.

## Overview

These scripts implement a three-phase upgrade pipeline:

1. **Phase 1**: NAV 2017 Export & Delta Generation
2. **Phase 2**: CAL to AL Conversion (Dual-Mode)
3. **Phase 3**: Compilation and Review

## Prerequisites

### Software Requirements

- NAV 2017 databases (base and customer)
- NAV 2017 Model Tools installed
- VS Code with bc-migration skill installed
- BC development environment (BC 2027)
- Txt2Al.exe (optional, from BC AL extension)

### Skills Required

- `bc-migration` skill installed in VS Code
- BC Knowledge MCP server configured

## Quick Start

### 1. Create Configuration File

```powershell
# Run the master script to generate template
.\upgrade-nav2017-to-bc2027.ps1
```

This creates `upgrade-config.json` with default values. Edit it with your settings:

```json
{
  "sqlServer": ".\\NAVDEMO",
  "nav2017BaseDb": "NAV2017_BASE",
  "nav2017CustomerDb": "NAV2017 CUSTOMER",
  "exportRoot": "C:\\NAV2017Upgrade",
  "bcWorkspace": "C:\\BC2027Extension",
  "bcTargetVersion": "BC27",
  "appName": "MyCompany Extension",
  "appPublisher": "MyCompany",
  "appIdRangeStart": 84000,
  "appIdRangeEnd": 84999,
  "customObjectRangeStart": 50000,
  "customObjectRangeEnd": 59999,
  "prefix": "021SKC",
  "finsqlPath": "C:\\Program Files (x86)\\Microsoft Dynamics NAV\\100\\RoleTailored Client\\finsql.exe",
  "modelToolsPath": "C:\\Program Files (x86)\\Microsoft Dynamics NAV\\100\\RoleTailored Client\\Microsoft.Dynamics.Nav.Model.Tools.psd1",
  "txt2alPath": ""
}
```

### 2. Run Full Upgrade Pipeline

```powershell
# Run all phases
.\upgrade-nav2017-to-bc2027.ps1 -ConfigFile "upgrade-config.json"
```

### 3. Run Individual Phases

```powershell
# Phase 1 only
.\upgrade-nav2017-to-bc2027.ps1 -SkipPhase2 -SkipPhase3

# Phase 2 only
.\upgrade-nav2017-to-bc2027.ps1 -SkipPhase1 -SkipPhase3

# Phase 3 only
.\upgrade-nav2017-to-bc2027.ps1 -SkipPhase1 -SkipPhase2
```

### 4. Dry Run

```powershell
# See what would be done without executing
.\upgrade-nav2017-to-bc2027.ps1 -DryRun
```

## Phase Details

### Phase 1: NAV 2017 Export & Delta Generation

**Script**: `phase1-nav-export-delta.ps1`

**What it does**:
1. Exports all objects from NAV 2017 base database
2. Exports all objects from NAV 2017 customer database
3. Splits exports into per-object files
4. Compares base vs customer to generate DELTA files
5. Creates summary report

**Output**:
- `NAV2017_Base_All.txt` - Full base export
- `NAV2017_Customer_All.txt` - Full customer export
- `Base/` - Per-object base files
- `Customer/` - Per-object customer files
- `Delta/` - DELTA files (customizations only)
- `CompareResult_NAV2017.txt` - Summary report

**Time**: ~10-15 minutes (depends on database size)

### Phase 2: CAL to AL Conversion (Dual-Mode)

**Script**: `phase2-cal-to-al-conversion.ps1`

**What it does**:
1. Creates BC workspace and app.json
2. Separates objects by ID range:
   - Objects < 50000 → Mode 1 (Smart Detection)
   - Objects >= 50000 → Mode 2 (Bulk Conversion)
3. Runs Txt2Al.exe for Mode 2 objects (if available)
4. Creates conversion instructions for bc-cal-converter subagent

**Output**:
- `app.json` - BC extension manifest
- `src/` - Generated AL files (from Txt2Al.exe)
- `Mode1_StandardObjects/` - DELTA files for smart detection
- `Mode2_CustomObjects/` - Full .txt files for bulk conversion
- `conversion-instructions.md` - Instructions for bc-cal-converter

**Time**: 
- Mode 2 (Txt2Al.exe): ~5-10 seconds for 50 objects
- Mode 1 (bc-cal-converter): ~2 minutes per object (manual in VS Code Copilot)

### Phase 3: Compilation and Review

**Script**: `phase3-compile-review.ps1`

**What it does**:
1. Prepares workspace for compilation
2. Creates launch.json for debugging
3. Creates compilation instructions
4. Creates review checklist

**Output**:
- `.vscode/launch.json` - Debug configuration
- `compile-instructions.md` - Compilation guide
- `review-checklist.md` - Quality checklist

**Time**: Preparation is instant; actual compilation and review done in VS Code

## Workflow with VS Code Copilot

After running the scripts, continue in VS Code Copilot:

### Step 1: Mode 1 Conversion (Smart Detection)

Open VS Code in the BC workspace and invoke bc-cal-converter:

```
Convert the CAL files in Mode1_StandardObjects to AL extensions.
Use smart detection to create table/page extensions for standard BC objects.
```

The subagent will:
- Parse DELTA files
- Extract custom fields (50000..99999)
- Create tableextension/pageextension
- Consult logan-legacy for upgrade patterns
- Generate AL files in src/

### Step 2: Compilation

Use VS Code tools:

```
Download symbols and compile the BC extension.
```

This runs:
- `al_downloadsymbols`
- `al_build`
- `al_getdiagnostics`

### Step 3: Review

Invoke bc-reviewer subagent:

```
Review the AL code for quality, security, and best practices.
```

The subagent will:
- Run compilation checks
- Consult roger-reviewer (code quality)
- Consult seth-security (security)
- Consult morgan-market (AppSource readiness)
- Generate review report

### Step 4: Fix Issues

Address findings from bc-reviewer by consulting specialists:

```
Ask logan-legacy how to fix this NAV 2017 pattern: [describe issue]
```

```
Ask sam-coder for the modern AL pattern for [legacy pattern]
```

### Step 5: Testing

Invoke bc-tester subagent:

```
Create test coverage for the converted AL code.
```

## Dual-Mode Strategy

### Mode 1: Smart Detection (High Quality)

**For**: Standard BC objects (ID < 50000) with customizations

**Process**:
- Parse DELTA files
- Extract ONLY custom fields/code
- Create extensions
- Consult BC specialists

**Time**: ~2 min per object  
**Quality**: ⭐⭐⭐⭐⭐

### Mode 2: Bulk Conversion (Fast)

**For**: Fully custom objects (ID >= 50000)

**Process**:
- Use Txt2Al.exe for bulk conversion
- Review and modernize
- Consult BC specialists

**Time**: ~5 sec for 50 objects  
**Quality**: ⭐⭐⭐ → ⭐⭐⭐⭐ (after review)

### Performance Example

**50 objects** (15 standard + 35 custom):

| Approach | Time | Quality |
|----------|------|---------|
| All Manual | ~50 min | ⭐⭐⭐⭐⭐ |
| Dual-Mode | ~25 min | ⭐⭐⭐⭐⭐ |
| **Savings** | **50% faster** | **Same quality** |

## Configuration Options

### SQL Server Settings

```json
"sqlServer": ".\\NAVDEMO",
"nav2017BaseDb": "NAV2017_BASE",
"nav2017CustomerDb": "NAV2017 CUSTOMER"
```

### Export Paths

```json
"exportRoot": "C:\\NAV2017Upgrade",
"bcWorkspace": "C:\\BC2027Extension"
```

### BC Extension Settings

```json
"bcTargetVersion": "BC27",
"appName": "MyCompany Extension",
"appPublisher": "MyCompany"
```

### ID Ranges

```json
"appIdRangeStart": 84000,
"appIdRangeEnd": 84999,
"customObjectRangeStart": 50000,
"customObjectRangeEnd": 59999
```

### Naming Convention

```json
"prefix": "021SKC"
```

Applied to all generated objects:
- `Customer Ext 021SKC` (extensions)
- `Custom Table 021SKC` (new objects)

### Tool Paths

```json
"finsqlPath": "C:\\Program Files (x86)\\Microsoft Dynamics NAV\\100\\RoleTailored Client\\finsql.exe",
"modelToolsPath": "C:\\Program Files (x86)\\Microsoft Dynamics NAV\\100\\RoleTailored Client\\Microsoft.Dynamics.Nav.Model.Tools.psd1",
"txt2alPath": ""
```

Leave `txt2alPath` empty to auto-detect.

## Troubleshooting

### Issue: "finsql.exe not found"

**Solution**: Update `finsqlPath` in config to point to your NAV 2017 installation.

### Issue: "Model Tools module not found"

**Solution**: Update `modelToolsPath` in config. Usually installed with NAV Development Environment.

### Issue: "Txt2Al.exe not found"

**Solution**: 
- Install AL Language extension for VS Code
- Or download Txt2Al.exe and place in workspace `bin/`
- Or set `txt2alPath` in config

Mode 2 objects will be processed by bc-cal-converter if Txt2Al.exe is not available.

### Issue: "Database connection failed"

**Solution**: 
- Verify SQL Server is running
- Check database names in config
- Ensure Windows Authentication is enabled

### Issue: "Export failed with corrupted object"

**Solution**: The script automatically handles corrupted object ID 17367042. If other objects are corrupted, manually exclude them in Phase 1 script.

## Best Practices

### Before Starting

1. **Backup databases** - Always backup NAV databases before export
2. **Test environment** - Run upgrade in test environment first
3. **Clean base** - Use clean NAV 2017 base database for comparison
4. **Review deltas** - Manually review DELTA files before conversion

### During Conversion

1. **Use dual-mode** - Let Txt2Al.exe handle bulk conversion
2. **Consult specialists** - Always consult BC Knowledge specialists
3. **Fix as you go** - Address issues immediately, don't accumulate
4. **Document decisions** - Keep notes on manual changes

### After Conversion

1. **Compile early** - Compile frequently to catch issues early
2. **Review thoroughly** - Use bc-reviewer for comprehensive review
3. **Test extensively** - Create test coverage with bc-tester
4. **Deploy gradually** - Phased deployment to production

## Support

For issues or questions:

1. Check the generated instruction files (`.md` files in workspace)
2. Consult BC Knowledge specialists via VS Code Copilot
3. Review bc-migration skill documentation
4. Check BC upgrade documentation on Microsoft Learn

## License

These scripts are part of the bc-migration skill for Business Central development.
