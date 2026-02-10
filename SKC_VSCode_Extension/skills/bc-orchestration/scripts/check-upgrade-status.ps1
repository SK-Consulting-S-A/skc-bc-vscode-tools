# ============================================================================
# Check Upgrade Status
# ============================================================================
# Quick status check for the NAV 2017 to BC 2027 upgrade pipeline.
# Shows progress, file counts, and next steps.
# ============================================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$ConfigFile = "upgrade-config.json"
)

$ErrorActionPreference = 'Stop'

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "NAV 2017 → BC 2027 Upgrade Status" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Load configuration
if (-not (Test-Path $ConfigFile)) {
    Write-Host "ERROR: Configuration file not found: $ConfigFile" -ForegroundColor Red
    Write-Host "Run upgrade-nav2017-to-bc2027.ps1 to create it." -ForegroundColor Yellow
    exit 1
}

$config = Get-Content $ConfigFile -Raw | ConvertFrom-Json

# ============================================================================
# Phase 1 Status: NAV Export & Delta Generation
# ============================================================================

Write-Host "Phase 1: NAV Export & Delta Generation" -ForegroundColor Cyan
Write-Host "---------------------------------------" -ForegroundColor Cyan

$phase1Complete = $false
$deltaFolder = Join-Path $config.exportRoot 'Delta'

if (Test-Path $deltaFolder) {
    $deltaFiles = Get-ChildItem $deltaFolder -Filter "*.DELTA" -ErrorAction SilentlyContinue
    $deltaCount = ($deltaFiles | Measure-Object).Count
    
    if ($deltaCount -gt 0) {
        Write-Host "✅ Complete" -ForegroundColor Green
        Write-Host "  Delta files: $deltaCount" -ForegroundColor White
        
        # Group by object type
        $grouped = $deltaFiles | Group-Object { $_.Name.Substring(0,3) }
        foreach ($group in $grouped) {
            Write-Host "    $($group.Name): $($group.Count)" -ForegroundColor Gray
        }
        
        $phase1Complete = $true
    } else {
        Write-Host "⚠️  In Progress" -ForegroundColor Yellow
        Write-Host "  No delta files found yet" -ForegroundColor White
    }
} else {
    Write-Host "❌ Not Started" -ForegroundColor Red
    Write-Host "  Run: .\upgrade-nav2017-to-bc2027.ps1" -ForegroundColor White
}

Write-Host ""

# ============================================================================
# Phase 2 Status: CAL to AL Conversion
# ============================================================================

Write-Host "Phase 2: CAL to AL Conversion" -ForegroundColor Cyan
Write-Host "------------------------------" -ForegroundColor Cyan

$phase2Complete = $false
$bcWorkspace = $config.bcWorkspace
$srcDir = Join-Path $bcWorkspace 'src'
$mode1Dir = Join-Path $config.exportRoot 'Mode1_StandardObjects'
$mode2Dir = Join-Path $config.exportRoot 'Mode2_CustomObjects'

if (Test-Path $bcWorkspace) {
    Write-Host "✅ Workspace Created" -ForegroundColor Green
    Write-Host "  Location: $bcWorkspace" -ForegroundColor White
    
    # Check app.json
    $appJsonPath = Join-Path $bcWorkspace 'app.json'
    if (Test-Path $appJsonPath) {
        Write-Host "  ✅ app.json exists" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  app.json missing" -ForegroundColor Yellow
    }
    
    # Check Mode 1 (Smart Detection)
    if (Test-Path $mode1Dir) {
        $mode1Files = Get-ChildItem $mode1Dir -Filter "*.DELTA" -ErrorAction SilentlyContinue
        $mode1Count = ($mode1Files | Measure-Object).Count
        Write-Host ""
        Write-Host "  Mode 1 (Smart Detection):" -ForegroundColor Yellow
        Write-Host "    Objects to convert: $mode1Count" -ForegroundColor White
        
        # Check if extensions were generated
        if (Test-Path $srcDir) {
            $extFiles = Get-ChildItem $srcDir -Filter "*Ext*.al" -ErrorAction SilentlyContinue
            $extCount = ($extFiles | Measure-Object).Count
            
            if ($extCount -gt 0) {
                Write-Host "    ✅ Extensions generated: $extCount" -ForegroundColor Green
            } else {
                Write-Host "    ⚠️  No extensions generated yet" -ForegroundColor Yellow
                Write-Host "    Action: Run bc-cal-converter in Cursor" -ForegroundColor Cyan
            }
        }
    }
    
    # Check Mode 2 (Bulk Conversion)
    if (Test-Path $mode2Dir) {
        $mode2Files = Get-ChildItem $mode2Dir -Filter "*.txt" -ErrorAction SilentlyContinue
        $mode2Count = ($mode2Files | Measure-Object).Count
        Write-Host ""
        Write-Host "  Mode 2 (Bulk Conversion):" -ForegroundColor Yellow
        Write-Host "    Objects to convert: $mode2Count" -ForegroundColor White
        
        # Check if AL files were generated
        if (Test-Path $srcDir) {
            $alFiles = Get-ChildItem $srcDir -Filter "*.al" -ErrorAction SilentlyContinue
            $alCount = ($alFiles | Measure-Object).Count
            
            if ($alCount -gt 0) {
                Write-Host "    ✅ AL files generated: $alCount" -ForegroundColor Green
                
                # Check if all Mode 2 objects were converted
                if ($alCount -ge $mode2Count) {
                    $phase2Complete = $true
                }
            } else {
                Write-Host "    ⚠️  No AL files generated yet" -ForegroundColor Yellow
                Write-Host "    Action: Run Txt2Al.exe or bc-cal-converter" -ForegroundColor Cyan
            }
        }
    }
} else {
    Write-Host "❌ Not Started" -ForegroundColor Red
    Write-Host "  Run: .\upgrade-nav2017-to-bc2027.ps1 -SkipPhase1" -ForegroundColor White
}

Write-Host ""

# ============================================================================
# Phase 3 Status: Compilation and Review
# ============================================================================

Write-Host "Phase 3: Compilation and Review" -ForegroundColor Cyan
Write-Host "--------------------------------" -ForegroundColor Cyan

$phase3Complete = $false

if (Test-Path $bcWorkspace) {
    $compileInstructions = Join-Path $bcWorkspace 'compile-instructions.md'
    $reviewChecklist = Join-Path $bcWorkspace 'review-checklist.md'
    
    if ((Test-Path $compileInstructions) -and (Test-Path $reviewChecklist)) {
        Write-Host "✅ Instructions Created" -ForegroundColor Green
        Write-Host "  Compile instructions: compile-instructions.md" -ForegroundColor White
        Write-Host "  Review checklist: review-checklist.md" -ForegroundColor White
        
        # Check for compilation artifacts
        $binFolder = Join-Path $bcWorkspace '.alpackages'
        if (Test-Path $binFolder) {
            Write-Host ""
            Write-Host "  ✅ Symbols downloaded" -ForegroundColor Green
            
            # Check for .app file (compiled)
            $appFiles = Get-ChildItem $bcWorkspace -Filter "*.app" -ErrorAction SilentlyContinue
            if ($appFiles) {
                Write-Host "  ✅ Extension compiled" -ForegroundColor Green
                $phase3Complete = $true
            } else {
                Write-Host "  ⚠️  Not compiled yet" -ForegroundColor Yellow
                Write-Host "  Action: Run al_build in Cursor" -ForegroundColor Cyan
            }
        } else {
            Write-Host ""
            Write-Host "  ⚠️  Symbols not downloaded" -ForegroundColor Yellow
            Write-Host "  Action: Run al_downloadsymbols in Cursor" -ForegroundColor Cyan
        }
    } else {
        Write-Host "⚠️  In Progress" -ForegroundColor Yellow
        Write-Host "  Run: .\upgrade-nav2017-to-bc2027.ps1 -SkipPhase1 -SkipPhase2" -ForegroundColor White
    }
} else {
    Write-Host "❌ Not Started" -ForegroundColor Red
}

Write-Host ""

# ============================================================================
# Overall Progress
# ============================================================================

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Overall Progress" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$completedPhases = 0
if ($phase1Complete) { $completedPhases++ }
if ($phase2Complete) { $completedPhases++ }
if ($phase3Complete) { $completedPhases++ }

$progressPercent = [math]::Round(($completedPhases / 3) * 100)

Write-Host "Progress: $completedPhases/3 phases complete ($progressPercent%)" -ForegroundColor Yellow
Write-Host ""

# Progress bar
$barLength = 40
$filledLength = [math]::Floor($barLength * $completedPhases / 3)
$emptyLength = $barLength - $filledLength
$bar = "█" * $filledLength + "░" * $emptyLength
Write-Host "[$bar]" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# Next Steps
# ============================================================================

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host ""

if (-not $phase1Complete) {
    Write-Host "1. Run Phase 1: NAV Export & Delta Generation" -ForegroundColor White
    Write-Host "   .\upgrade-nav2017-to-bc2027.ps1" -ForegroundColor Cyan
}
elseif (-not $phase2Complete) {
    Write-Host "1. Complete Phase 2: CAL to AL Conversion" -ForegroundColor White
    Write-Host "   - Open Cursor in: $bcWorkspace" -ForegroundColor Cyan
    Write-Host "   - Run bc-cal-converter for Mode 1 objects" -ForegroundColor Cyan
    if (Test-Path $mode2Dir) {
        $mode2Files = Get-ChildItem $mode2Dir -Filter "*.txt" -ErrorAction SilentlyContinue
        if ($mode2Files) {
            Write-Host "   - Verify Mode 2 objects were converted by Txt2Al.exe" -ForegroundColor Cyan
        }
    }
}
elseif (-not $phase3Complete) {
    Write-Host "1. Complete Phase 3: Compilation and Review" -ForegroundColor White
    Write-Host "   - Open Cursor in: $bcWorkspace" -ForegroundColor Cyan
    Write-Host "   - Download symbols: al_downloadsymbols" -ForegroundColor Cyan
    Write-Host "   - Compile: al_build" -ForegroundColor Cyan
    Write-Host "   - Review: Run bc-reviewer subagent" -ForegroundColor Cyan
}
else {
    Write-Host "🎉 All phases complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "1. Run bc-tester subagent to create test coverage" -ForegroundColor White
    Write-Host "2. Deploy to BC 2027 test environment" -ForegroundColor White
    Write-Host "3. Run integration tests" -ForegroundColor White
    Write-Host "4. User acceptance testing" -ForegroundColor White
    Write-Host "5. Production deployment" -ForegroundColor White
}

Write-Host ""
