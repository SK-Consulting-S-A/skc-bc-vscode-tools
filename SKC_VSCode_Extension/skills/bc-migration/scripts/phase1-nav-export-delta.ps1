# ============================================================================
# Phase 1: NAV 2017 Export and Delta Generation
# ============================================================================
# Exports objects from NAV 2017 base and customer databases, then generates
# delta files using Model Tools to identify customizations.
#
# This is an enhanced version of your existing script with better error handling
# and integration with the upgrade pipeline.
# ============================================================================

param(
    [Parameter(Mandatory=$true)]
    [PSCustomObject]$Config
)

$ErrorActionPreference = 'Stop'

Write-Host "Phase 1: NAV 2017 Export & Delta Generation" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Validate prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

if (-not (Test-Path $Config.finsqlPath)) {
    Write-Host "ERROR: finsql.exe not found at: $($Config.finsqlPath)" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $Config.modelToolsPath)) {
    Write-Host "ERROR: Model Tools module not found at: $($Config.modelToolsPath)" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] finsql.exe found" -ForegroundColor Green
Write-Host "[OK] Model Tools module found" -ForegroundColor Green
Write-Host ""

# Create export root directory
Write-Host "Creating export directory: $($Config.exportRoot)" -ForegroundColor Yellow
New-Item -ItemType Directory -Path $Config.exportRoot -Force | Out-Null
Write-Host "[OK] Directory created" -ForegroundColor Green
Write-Host ""

# Define file paths
$BaseTxt     = Join-Path $Config.exportRoot 'NAV2017_Base_All.txt'
$CustomerTxt = Join-Path $Config.exportRoot 'NAV2017_Customer_All.txt'
$BaseLog     = Join-Path $Config.exportRoot 'Export_Base.log'
$CustomerLog = Join-Path $Config.exportRoot 'Export_Customer.log'

# ============================================================================
# 1.1 Export objects from NAV 2017
# ============================================================================

Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host "Step 1.1: Exporting NAV 2017 Objects" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host ""

# Export BASE NAV 2017
Write-Host "Exporting BASE database: $($Config.nav2017BaseDb)" -ForegroundColor Yellow
Write-Host "  Server: $($Config.sqlServer)" -ForegroundColor Gray
Write-Host "  Output: $BaseTxt" -ForegroundColor Gray

try {
    $finsqlArgs = "command=exportobjects,file=$BaseTxt,servername=$($Config.sqlServer),database=$($Config.nav2017BaseDb),ntauthentication=yes,logfile=$BaseLog"
    $process = Start-Process -FilePath $Config.finsqlPath -ArgumentList $finsqlArgs -Wait -PassThru -NoNewWindow
    
    if ($process.ExitCode -eq 0 -and (Test-Path $BaseTxt)) {
        $fileSize = (Get-Item $BaseTxt).Length / 1MB
        $fileSizeRounded = [math]::Round($fileSize, 2)
        Write-Host "[OK] Base export completed ($fileSizeRounded MB)" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Base export failed. Exit code: $($process.ExitCode)" -ForegroundColor Red
        if (Test-Path $BaseLog) {
            Write-Host "Log file contents:" -ForegroundColor Yellow
            Get-Content $BaseLog -Tail 20 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
        }
        exit 1
    }
} catch {
    Write-Host "[ERROR] Error exporting base database: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Export CUSTOMER NAV 2017
Write-Host "Exporting CUSTOMER database: $($Config.nav2017CustomerDb)" -ForegroundColor Yellow
Write-Host "  Server: $($Config.sqlServer)" -ForegroundColor Gray
Write-Host "  Output: $CustomerTxt" -ForegroundColor Gray

try {
    # Try PowerShell cmdlet first (handles corrupted objects better)
    Import-Module $Config.modelToolsPath -ErrorAction Stop
    
    # Export in two parts to exclude corrupted object ID 17367042 if it exists
    $tempFile1 = Join-Path $Config.exportRoot 'Customer_Part1.txt'
    $tempFile2 = Join-Path $Config.exportRoot 'Customer_Part2.txt'
    
    Write-Host "  Exporting objects 1-17367041..." -ForegroundColor Gray
    Export-NAVApplicationObject `
        -DatabaseName $Config.nav2017CustomerDb `
        -Path $tempFile1 `
        -DatabaseServer $Config.sqlServer `
        -Filter 'Id=1..17367041' `
        -ErrorAction Stop
    
    Write-Host "  Exporting objects 17367043-1999999999..." -ForegroundColor Gray
    Export-NAVApplicationObject `
        -DatabaseName $Config.nav2017CustomerDb `
        -Path $tempFile2 `
        -DatabaseServer $Config.sqlServer `
        -Filter 'Id=17367043..1999999999' `
        -ErrorAction Stop
    
    # Combine the two files
    Write-Host "  Combining exported files..." -ForegroundColor Gray
    Get-Content $tempFile1, $tempFile2 | Set-Content $CustomerTxt -Encoding UTF8
    Remove-Item $tempFile1, $tempFile2 -ErrorAction SilentlyContinue
    
    if (Test-Path $CustomerTxt) {
        $fileSize = (Get-Item $CustomerTxt).Length / 1MB
        $fileSizeRounded = [math]::Round($fileSize, 2)
        Write-Host "[OK] Customer export completed ($fileSizeRounded MB)" -ForegroundColor Green
    } else {
        throw "Combined file was not created"
    }
} catch {
    Write-Host "[WARNING] PowerShell cmdlet export failed, trying finsql.exe..." -ForegroundColor Yellow
    
    # Fallback to finsql.exe
    $finsqlArgs = "command=exportobjects,file=$CustomerTxt,servername=$($Config.sqlServer),database=$($Config.nav2017CustomerDb),ntauthentication=yes,logfile=$CustomerLog"
    $process = Start-Process -FilePath $Config.finsqlPath -ArgumentList $finsqlArgs -Wait -PassThru -NoNewWindow
    
    if ($process.ExitCode -eq 0 -and (Test-Path $CustomerTxt)) {
        $fileSize = (Get-Item $CustomerTxt).Length / 1MB
        $fileSizeRounded = [math]::Round($fileSize, 2)
        Write-Host "[OK] Customer export completed via finsql.exe ($fileSizeRounded MB)" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Both export methods failed" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# ============================================================================
# 1.2 Generate NAV 2017 deltas using Model Tools
# ============================================================================

Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host "Step 1.2: Generating NAV 2017 Deltas" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host ""

# Define folders for split objects and deltas
$BaseFolder  = Join-Path $Config.exportRoot 'Base'
$CustFolder  = Join-Path $Config.exportRoot 'Customer'
$DeltaFolder = Join-Path $Config.exportRoot 'Delta'
$ResultFile  = Join-Path $Config.exportRoot 'CompareResult_NAV2017.txt'

Write-Host "Creating working directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $BaseFolder,$CustFolder,$DeltaFolder -Force | Out-Null
Write-Host "[OK] Directories created" -ForegroundColor Green
Write-Host ""

# Load NAV 2017 model tools
Write-Host "Loading NAV Model Tools module..." -ForegroundColor Yellow
try {
    Import-Module $Config.modelToolsPath -ErrorAction Stop
    Write-Host "[OK] Model Tools module loaded" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to load Model Tools module: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Split exports into per-object files
Write-Host "Splitting BASE export into per-object files..." -ForegroundColor Yellow
try {
    Split-NAVApplicationObjectFile -Source $BaseTxt -Destination $BaseFolder -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    $baseCount = (Get-ChildItem $BaseFolder -Filter "*.txt" -ErrorAction SilentlyContinue | Measure-Object).Count
    
    if ($baseCount -gt 0) {
        Write-Host "[OK] Base split completed ($baseCount object files)" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Failed to split base export - no files created" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "[ERROR] Failed to split base export: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Splitting CUSTOMER export into per-object files..." -ForegroundColor Yellow
try {
    Split-NAVApplicationObjectFile -Source $CustomerTxt -Destination $CustFolder -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    $custCount = (Get-ChildItem $CustFolder -Filter "*.txt" -ErrorAction SilentlyContinue | Measure-Object).Count
    
    if ($custCount -gt 0) {
        Write-Host "[OK] Customer split completed ($custCount object files)" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Failed to split customer export - no files created" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "[ERROR] Failed to split customer export: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Compare base vs customer → deltas
Write-Host "Comparing BASE vs CUSTOMER to generate deltas..." -ForegroundColor Yellow
Write-Host "  Original (Base):   $BaseFolder" -ForegroundColor Gray
Write-Host "  Modified (Cust):   $CustFolder" -ForegroundColor Gray
Write-Host "  Delta output:      $DeltaFolder" -ForegroundColor Gray

try {
    Compare-NAVApplicationObject `
        -OriginalPath $BaseFolder `
        -ModifiedPath $CustFolder `
        -DeltaPath    $DeltaFolder `
        -ErrorAction Stop
    
    # Count DELTA files
    $deltaCount = (Get-ChildItem $DeltaFolder -Filter "*.DELTA" | Measure-Object).Count
    Write-Host "[OK] Comparison completed ($deltaCount delta files)" -ForegroundColor Green
    
    # Generate summary file
    Write-Host "Generating summary file..." -ForegroundColor Yellow
    $summary = @()
    $summary += "NAV 2017 Delta Comparison Summary"
    $summary += "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $summary += ""
    $summary += "Total Delta Files: $deltaCount"
    $summary += ""
    $summary += "Delta Files by Object Type:"
    $summary += "----------------------------------------"
    
    # Group by object type
    $deltaFiles = Get-ChildItem $DeltaFolder -Filter "*.DELTA" | Sort-Object Name
    $grouped = $deltaFiles | Group-Object { $_.Name.Substring(0,3) }
    foreach ($group in $grouped) {
        $summary += "$($group.Name): $($group.Count) objects"
    }
    
    $summary += ""
    $summary += "All Delta Files:"
    $summary += "----------------------------------------"
    $deltaFiles | ForEach-Object { $summary += $_.Name }
    
    $summary | Out-File -FilePath $ResultFile -Encoding UTF8
    Write-Host "[OK] Summary file created: $ResultFile" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to compare objects: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# ============================================================================
# Summary
# ============================================================================

Write-Host "Phase 1 Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Output locations:" -ForegroundColor Yellow
Write-Host "  Base export:     $BaseTxt" -ForegroundColor White
Write-Host "  Customer export: $CustomerTxt" -ForegroundColor White
Write-Host "  Delta files:     $DeltaFolder" -ForegroundColor White
Write-Host "  Summary file:    $ResultFile" -ForegroundColor White
Write-Host ""

# Return delta folder path for next phase
return $DeltaFolder
