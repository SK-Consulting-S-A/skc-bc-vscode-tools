# ============================================================================
# Phase 2: CAL to AL Conversion (Dual-Mode)
# ============================================================================
# Converts CAL objects to AL using the dual-mode approach:
# - Mode 1: Smart Detection for standard BC objects (ID < 50000)
# - Mode 2: Txt2Al.exe bulk conversion for custom objects (ID >= 50000)
#
# This script prepares the input for the bc-cal-converter subagent and
# invokes Txt2Al.exe for Mode 2 objects.
# ============================================================================

param(
    [Parameter(Mandatory = $true)]
    [PSCustomObject]$Config
)

$ErrorActionPreference = 'Stop'

Write-Host "Phase 2: CAL to AL Conversion (Dual-Mode)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# Step 2.1: Prepare BC Workspace
# ============================================================================

Write-Host "Step 2.1: Preparing BC Workspace" -ForegroundColor Cyan
Write-Host "-----------------------------------" -ForegroundColor Cyan
Write-Host ""

# Create BC workspace directory
Write-Host "Creating BC workspace: $($Config.bcWorkspace)" -ForegroundColor Yellow
New-Item -ItemType Directory -Path $Config.bcWorkspace -Force | Out-Null
Write-Host "[OK] Workspace created" -ForegroundColor Green

# Create src directory
$srcDir = Join-Path $Config.bcWorkspace 'src'
New-Item -ItemType Directory -Path $srcDir -Force | Out-Null
Write-Host "[OK] src directory created" -ForegroundColor Green

# Create app.json if it doesn't exist
$appJsonPath = Join-Path $Config.bcWorkspace 'app.json'
if (-not (Test-Path $appJsonPath)) {
    Write-Host "Creating app.json..." -ForegroundColor Yellow
    
    $appJson = @{
        id                     = [guid]::NewGuid().ToString()
        name                   = $Config.appName
        publisher              = $Config.appPublisher
        version                = "1.0.0.0"
        brief                  = "Upgraded from NAV 2017"
        description            = "Business Central extension upgraded from NAV 2017"
        privacyStatement       = ""
        EULA                   = ""
        help                   = ""
        url                    = ""
        logo                   = ""
        dependencies           = @()
        screenshots            = @()
        platform               = "1.0.0.0"
        application            = "27.0.0.0"
        idRanges               = @(
            @{
                from = $Config.appIdRangeStart
                to   = $Config.appIdRangeEnd
            }
        )
        resourceExposurePolicy = @{
            allowDebugging            = $true
            allowDownloadingSource    = $false
            includeSourceInSymbolFile = $false
        }
        runtime                = "14.0"
        features               = @("NoImplicitWith")
    } | ConvertTo-Json -Depth 10
    
    $appJson | Out-File -FilePath $appJsonPath -Encoding UTF8
    Write-Host "[OK] app.json created" -ForegroundColor Green
}
else {
    Write-Host "[OK] app.json already exists" -ForegroundColor Green
}

Write-Host ""

# ============================================================================
# Step 2.2: Separate Objects by ID Range
# ============================================================================

Write-Host "Step 2.2: Separating Objects by ID Range" -ForegroundColor Cyan
Write-Host "-------------------------------------------" -ForegroundColor Cyan
Write-Host ""

$deltaFolder = Join-Path $Config.exportRoot 'Delta'
$customerFolder = Join-Path $Config.exportRoot 'Customer'

# Create directories for separated objects
$mode1Dir = Join-Path $Config.exportRoot 'Mode1_StandardObjects'
$mode2Dir = Join-Path $Config.exportRoot 'Mode2_CustomObjects'
New-Item -ItemType Directory -Path $mode1Dir, $mode2Dir -Force | Out-Null

Write-Host "Analyzing delta files..." -ForegroundColor Yellow

# Process DELTA files (Mode 1 - standard objects with customizations)
$deltaFiles = Get-ChildItem $deltaFolder -Filter "*.DELTA" -ErrorAction SilentlyContinue
$mode1Count = 0
$mode2Count = 0

foreach ($file in $deltaFiles) {
    # Read first line to get object ID
    $firstLine = Get-Content $file.FullName -First 1
    
    # Extract object ID using regex
    if ($firstLine -match 'OBJECT\s+\w+\s+(\d+)') {
        $objectId = [int]$Matches[1]
        
        if ($objectId -lt 50000) {
            # Mode 1: Standard BC object with customizations
            Copy-Item $file.FullName -Destination $mode1Dir
            $mode1Count++
        }
        else {
            # Mode 2: Fully custom object (rare in DELTA, but possible)
            Copy-Item $file.FullName -Destination $mode2Dir
            $mode2Count++
        }
    }
}

Write-Host "[OK] Delta files analyzed:" -ForegroundColor Green
Write-Host "  Mode 1 (Standard objects < 50000): $mode1Count files" -ForegroundColor White
Write-Host "  Mode 2 (Custom objects >= 50000):  $mode2Count files" -ForegroundColor White

# Process full .txt files from Customer folder (Mode 2 - custom objects)
Write-Host ""
Write-Host "Analyzing customer object files..." -ForegroundColor Yellow

$customerFiles = Get-ChildItem $customerFolder -Filter "*.txt" -ErrorAction SilentlyContinue
$customObjectCount = 0

foreach ($file in $customerFiles) {
    # Read first line to get object ID
    $firstLine = Get-Content $file.FullName -First 1
    
    # Extract object ID using regex
    if ($firstLine -match 'OBJECT\s+\w+\s+(\d+)') {
        $objectId = [int]$Matches[1]
        
        if ($objectId -ge $Config.customObjectRangeStart -and $objectId -le $Config.customObjectRangeEnd) {
            # Fully custom object - copy to Mode 2 directory
            Copy-Item $file.FullName -Destination $mode2Dir
            $customObjectCount++
        }
    }
}

Write-Host "[OK] Custom object files analyzed:" -ForegroundColor Green
Write-Host "  Mode 2 custom objects (50000-59999): $customObjectCount files" -ForegroundColor White
Write-Host ""

$totalMode2 = $mode2Count + $customObjectCount

Write-Host "Conversion Mode Summary:" -ForegroundColor Cyan
Write-Host "  Mode 1 (Smart Detection):    $mode1Count objects" -ForegroundColor Yellow
Write-Host "  Mode 2 (Bulk Conversion):    $totalMode2 objects" -ForegroundColor Yellow
Write-Host "  Total objects to convert:    $($mode1Count + $totalMode2)" -ForegroundColor Yellow
Write-Host ""

# ============================================================================
# Step 2.3: Mode 2 - Bulk Conversion with Txt2Al.exe
# ============================================================================

if ($totalMode2 -gt 0) {
    Write-Host "Step 2.3: Mode 2 - Bulk Conversion with Txt2Al.exe" -ForegroundColor Cyan
    Write-Host "----------------------------------------------------" -ForegroundColor Cyan
    Write-Host ""
    
    # Find Txt2Al.exe
    $txt2alPath = $Config.txt2alPath
    
    if ([string]::IsNullOrWhiteSpace($txt2alPath)) {
        Write-Host "Searching for Txt2Al.exe..." -ForegroundColor Yellow
        
        # Check workspace bin
        $workspaceBin = Join-Path $Config.bcWorkspace 'bin\Txt2Al.exe'
        if (Test-Path $workspaceBin) {
            $txt2alPath = $workspaceBin
            Write-Host "[OK] Found in workspace bin" -ForegroundColor Green
        }
        
        # Check AL extension path
        if ([string]::IsNullOrWhiteSpace($txt2alPath)) {
            $alExtPath = "$env:USERPROFILE\.vscode\extensions"
            $txt2alCandidates = Get-ChildItem -Path $alExtPath -Filter "Txt2Al.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($txt2alCandidates) {
                $txt2alPath = $txt2alCandidates.FullName
                Write-Host "[OK] Found in AL extension" -ForegroundColor Green
            }
        }
    }
    
    if ([string]::IsNullOrWhiteSpace($txt2alPath) -or -not (Test-Path $txt2alPath)) {
        Write-Host "[WARNING] Txt2Al.exe not found. Mode 2 objects will need manual conversion." -ForegroundColor Yellow
        Write-Host "  You can:" -ForegroundColor Yellow
        Write-Host "  1. Install the AL Language extension for VS Code" -ForegroundColor White
        Write-Host "  2. Download Txt2Al.exe and place it in: $workspaceBin" -ForegroundColor White
        Write-Host "  3. Set txt2alPath in configuration file" -ForegroundColor White
        Write-Host ""
        Write-Host "  Mode 2 objects will be processed by bc-cal-converter subagent instead." -ForegroundColor Yellow
    }
    else {
        Write-Host "Using Txt2Al.exe: $txt2alPath" -ForegroundColor Green
        Write-Host ""
        
        Write-Host "Converting $totalMode2 custom objects..." -ForegroundColor Yellow
        
        # Run Txt2Al.exe
        $txt2alArgs = @(
            '--source', $mode2Dir,
            '--target', $srcDir,
            '--rename',
            '--extensionStartId', $Config.customObjectRangeStart
        )
        
        try {
            $process = Start-Process -FilePath $txt2alPath -ArgumentList $txt2alArgs -Wait -PassThru -NoNewWindow
            
            if ($process.ExitCode -eq 0) {
                $alFiles = (Get-ChildItem $srcDir -Filter "*.al" | Measure-Object).Count
                Write-Host "[OK] Txt2Al.exe completed successfully" -ForegroundColor Green
                Write-Host "  Generated $alFiles AL files" -ForegroundColor White
            }
            else {
                Write-Host "[WARNING] Txt2Al.exe exited with code: $($process.ExitCode)" -ForegroundColor Yellow
                Write-Host "  Some objects may need manual review" -ForegroundColor Yellow
            }
        }
        catch {
            Write-Host "[ERROR] Txt2Al.exe failed: $_" -ForegroundColor Red
            Write-Host "  Mode 2 objects will need manual conversion" -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
}

# ============================================================================
# Step 2.4: Create Conversion Instructions for bc-cal-converter
# ============================================================================

Write-Host "Step 2.4: Creating Conversion Instructions" -ForegroundColor Cyan
Write-Host "--------------------------------------------" -ForegroundColor Cyan
Write-Host ""

$instructionsPath = Join-Path $Config.bcWorkspace 'conversion-instructions.md'

$instructions = @"
# CAL to AL Conversion Instructions

## Overview

This document provides instructions for the bc-cal-converter subagent to complete the conversion from NAV 2017 to BC 2027.

## Conversion Summary

- **Mode 1 (Smart Detection)**: $mode1Count objects
- **Mode 2 (Bulk Conversion)**: $totalMode2 objects ($(if ($txt2alPath) { "completed by Txt2Al.exe" } else { "needs conversion" }))
- **Total**: $($mode1Count + $totalMode2) objects

## Mode 1: Smart Detection Required

**Input Directory**: ``$mode1Dir``

These are DELTA files containing customizations to standard BC objects (ID < 50000).

### Instructions for bc-cal-converter:

1. Parse each DELTA file in the Mode 1 directory
2. Extract ONLY custom fields (field IDs 50000..99999)
3. Extract ONLY custom code (procedures, triggers added by customer)
4. Create tableextension/pageextension for each object
5. Allocate extension object IDs from range: $($Config.appIdRangeStart)-$($Config.appIdRangeEnd)
6. Apply naming convention with prefix: $($Config.prefix)
7. Consult logan-legacy for upgrade patterns
8. Consult sam-coder for modern AL replacements
9. Generate AL extension files in: ``$srcDir``

### Expected Output:

- Table extensions for tables with custom fields
- Page extensions for pages with custom fields/actions
- Codeunit extensions (if any event subscribers)

## Mode 2: Bulk Conversion Status

**Input Directory**: ``$mode2Dir``

$(if ($txt2alPath) {
"**Status**: ✅ Completed by Txt2Al.exe

These custom objects (ID >= 50000) have been converted to AL using Txt2Al.exe.

### Next Steps:

1. Review generated AL files in: ``$srcDir``
2. Run bc-reviewer subagent for quality check
3. Consult sam-coder for modernization suggestions
4. Address any manual review items"
} else {
"**Status**: ⚠️ Needs Conversion

Txt2Al.exe was not found. The bc-cal-converter subagent should process these using Mode 2.

### Instructions for bc-cal-converter:

1. Parse each .txt file in the Mode 2 directory
2. Convert entire object to AL (not just customizations)
3. Keep original object IDs (they're in the custom range)
4. Apply naming convention with prefix: $($Config.prefix)
5. Generate new AL objects in: ``$srcDir``"
})

## Project Configuration

- **Workspace**: ``$($Config.bcWorkspace)``
- **app.json**: ``$appJsonPath``
- **Target BC Version**: $($Config.bcTargetVersion)
- **Extension ID Range**: $($Config.appIdRangeStart)-$($Config.appIdRangeEnd)
- **Custom Object Range**: $($Config.customObjectRangeStart)-$($Config.customObjectRangeEnd)
- **Naming Prefix**: $($Config.prefix)

## Specialist Consultation

### logan-legacy (Migration Patterns)
- Consult for NAV 2017 → BC 2027 breaking changes
- Ask about deprecated patterns and replacements
- Get guidance on BLOB → Media/MediaSet migration
- Verify .NET interop replacements

### sam-coder (Modern AL Patterns)
- Get modern AL replacements for legacy constructs
- Ask about Access modifiers (Internal vs Public)
- Get error handling patterns (Error() vs ErrorInfo)
- Verify procedure structure and documentation

### alex-architect (Extension Design)
- Consult when restructuring objects into extensions
- Get guidance on extension object ID allocation
- Verify extension naming conventions

## Manual Review Items to Flag

1. .NET interop (DotNet variables)
2. Direct SQL (EXECUTE, EXECUTEQUERY)
3. File system access (FILE, UPLOAD, DOWNLOAD)
4. Automation/OCX
5. BLOB field handling
6. Complex WITH statements
7. RunFormOnRec patterns
8. MenuSuite objects
9. Option fields (convert to Enum)
10. Permission definitions

## Next Steps After Conversion

1. Review conversion report
2. Compile with al_build
3. Address compilation errors
4. Run bc-reviewer for quality check
5. Run bc-tester for test coverage
6. Deploy to BC 2027 test environment

---

Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
"@

$instructions | Out-File -FilePath $instructionsPath -Encoding UTF8

Write-Host "[OK] Conversion instructions created: $instructionsPath" -ForegroundColor Green
Write-Host ""

# ============================================================================
# Step 2.5: Invoke bc-cal-converter Subagent
# ============================================================================

Write-Host "Step 2.5: Ready for bc-cal-converter Subagent" -ForegroundColor Cyan
Write-Host "-----------------------------------------------" -ForegroundColor Cyan
Write-Host ""

Write-Host "The workspace is ready for the bc-cal-converter subagent." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Open VS Code in the BC workspace: $($Config.bcWorkspace)" -ForegroundColor White
Write-Host "2. Read the conversion instructions: conversion-instructions.md" -ForegroundColor White
Write-Host "3. Invoke the bc-cal-converter subagent with:" -ForegroundColor White
Write-Host "   'Convert the CAL files in Mode1_StandardObjects to AL extensions'" -ForegroundColor Cyan
Write-Host ""

if (-not $txt2alPath) {
    Write-Host "4. Also convert Mode 2 objects:" -ForegroundColor White
    Write-Host "   'Convert the CAL files in Mode2_CustomObjects to AL'" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "Phase 2 preparation complete!" -ForegroundColor Green
Write-Host ""

# Return paths for next phase
return @{
    workspace  = $Config.bcWorkspace
    mode1Dir   = $mode1Dir
    mode2Dir   = $mode2Dir
    srcDir     = $srcDir
    mode1Count = $mode1Count
    mode2Count = $totalMode2
}
