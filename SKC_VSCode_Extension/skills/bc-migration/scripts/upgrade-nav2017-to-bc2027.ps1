# ============================================================================
# NAV 2017 to BC 2027 Upgrade Pipeline - Master Script
# ============================================================================
# This master script orchestrates the complete upgrade process from NAV 2017
# to Business Central 2027 using the bc-cal-converter subagent and BC Knowledge
# specialists.
#
# Prerequisites:
# - NAV 2017 databases (base and customer)
# - NAV 2017 Model Tools installed
# - Txt2Al.exe (from BC AL extension or in workspace bin/)
# - VS Code with bc-migration skill installed
# - BC development environment
#
# Usage:
#   .\upgrade-nav2017-to-bc2027.ps1 -ConfigFile "upgrade-config.json"
#
# ============================================================================

param(
    [Parameter(Mandatory = $false)]
    [string]$ConfigFile = "upgrade-config.json",
    
    [Parameter(Mandatory = $false)]
    [switch]$SkipPhase1,  # Skip NAV export and delta generation
    
    [Parameter(Mandatory = $false)]
    [switch]$SkipPhase2,  # Skip CAL to AL conversion
    
    [Parameter(Mandatory = $false)]
    [switch]$SkipPhase3,  # Skip compilation and review
    
    [Parameter(Mandatory = $false)]
    [switch]$DryRun       # Show what would be done without executing
)

$ErrorActionPreference = 'Stop'

# ============================================================================
# Configuration
# ============================================================================

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "NAV 2017 → BC 2027 Upgrade Pipeline" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Load configuration
if (-not (Test-Path $ConfigFile)) {
    Write-Host "ERROR: Configuration file not found: $ConfigFile" -ForegroundColor Red
    Write-Host ""
    Write-Host "Creating template configuration file..." -ForegroundColor Yellow
    
    $templateConfig = @{
        sqlServer              = ".\NAVDEMO"
        nav2017BaseDb          = "NAV2017_BASE"
        nav2017CustomerDb      = "NAV2017 CUSTOMER"
        exportRoot             = "C:\NAV2017Upgrade"
        bcWorkspace            = "C:\BC2027Extension"
        bcTargetVersion        = "BC27"
        appName                = "MyCompany Extension"
        appPublisher           = "MyCompany"
        appIdRangeStart        = 84000
        appIdRangeEnd          = 84999
        customObjectRangeStart = 50000
        customObjectRangeEnd   = 59999
        prefix                 = "021SKC"
        finsqlPath             = "C:\Program Files (x86)\Microsoft Dynamics NAV\100\RoleTailored Client\finsql.exe"
        modelToolsPath         = "C:\Program Files (x86)\Microsoft Dynamics NAV\100\RoleTailored Client\Microsoft.Dynamics.Nav.Model.Tools.psd1"
        txt2alPath             = ""  # Leave empty to auto-detect
    } | ConvertTo-Json -Depth 10
    
    $templateConfig | Out-File -FilePath $ConfigFile -Encoding UTF8
    
    Write-Host "Template created: $ConfigFile" -ForegroundColor Green
    Write-Host "Please edit the configuration file and run the script again." -ForegroundColor Yellow
    exit 0
}

Write-Host "Loading configuration from: $ConfigFile" -ForegroundColor Yellow
$config = Get-Content $ConfigFile -Raw | ConvertFrom-Json

# Validate configuration
$requiredFields = @('sqlServer', 'nav2017BaseDb', 'nav2017CustomerDb', 'exportRoot', 'bcWorkspace', 'bcTargetVersion')
foreach ($field in $requiredFields) {
    if (-not $config.$field) {
        Write-Host "ERROR: Required field '$field' missing in configuration" -ForegroundColor Red
        exit 1
    }
}

Write-Host "[OK] Configuration loaded" -ForegroundColor Green
Write-Host ""

# ============================================================================
# Phase 1: NAV 2017 Export and Delta Generation
# ============================================================================

if (-not $SkipPhase1) {
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "Phase 1: NAV 2017 Export & Delta Generation" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
    
    $phase1Script = Join-Path $PSScriptRoot "phase1-nav-export-delta.ps1"
    
    if ($DryRun) {
        Write-Host "[DRY RUN] Would execute: $phase1Script" -ForegroundColor Yellow
    }
    else {
        if (Test-Path $phase1Script) {
            & $phase1Script -Config $config
        }
        else {
            Write-Host "WARNING: Phase 1 script not found: $phase1Script" -ForegroundColor Yellow
            Write-Host "Using your existing NAV export script instead..." -ForegroundColor Yellow
            # Assume user's existing script has already run
        }
    }
    
    Write-Host ""
}

# ============================================================================
# Phase 2: CAL to AL Conversion (Dual-Mode)
# ============================================================================

if (-not $SkipPhase2) {
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "Phase 2: CAL to AL Conversion (Dual-Mode)" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
    
    $phase2Script = Join-Path $PSScriptRoot "phase2-cal-to-al-conversion.ps1"
    
    if ($DryRun) {
        Write-Host "[DRY RUN] Would execute: $phase2Script" -ForegroundColor Yellow
    }
    else {
        & $phase2Script -Config $config
    }
    
    Write-Host ""
}

# ============================================================================
# Phase 3: Compilation and Review
# ============================================================================

if (-not $SkipPhase3) {
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "Phase 3: Compilation and Review" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
    
    $phase3Script = Join-Path $PSScriptRoot "phase3-compile-review.ps1"
    
    if ($DryRun) {
        Write-Host "[DRY RUN] Would execute: $phase3Script" -ForegroundColor Yellow
    }
    else {
        & $phase3Script -Config $config
    }
    
    Write-Host ""
}

# ============================================================================
# Summary
# ============================================================================

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Upgrade Pipeline Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Review the conversion report in: $($config.bcWorkspace)\conversion-report.md" -ForegroundColor White
Write-Host "2. Address any manual review items flagged in the report" -ForegroundColor White
Write-Host "3. Run tests using bc-tester subagent" -ForegroundColor White
Write-Host "4. Deploy to BC 2027 test environment" -ForegroundColor White
Write-Host ""
