<#
.SYNOPSIS
    Extract and decode a Power BI template (.pbit) or report (.pbix) for analysis.

.DESCRIPTION
    A .pbit/.pbix file is a ZIP archive. This script copies it to a .zip, expands it,
    and prints a structured inventory of report PAGES, their FILTERS, and the data-model
    MEASURES (DAX) — the three things needed to replicate the report in Business Central.

.PARAMETER PbitPath
    Full path to the .pbit or .pbix file.

.PARAMETER OutDir
    Directory to extract into. Created if missing. Default: .\pbi_extracted

.EXAMPLE
    pwsh ./extract-pbit.ps1 -PbitPath "C:\Reports\VAT.pbit" -OutDir ".\extracted"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$PbitPath,

    [string]$OutDir = ".\pbi_extracted"
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $PbitPath)) {
    throw "File not found: $PbitPath"
}

# 1. Expand the archive (.pbit/.pbix are ZIPs)
$null = New-Item -ItemType Directory -Force -Path $OutDir
$tmpZip = Join-Path $env:TEMP ("pbi_" + [Guid]::NewGuid().ToString('N') + ".zip")
Copy-Item -LiteralPath $PbitPath -Destination $tmpZip -Force
try {
    Expand-Archive -LiteralPath $tmpZip -DestinationPath $OutDir -Force
}
finally {
    Remove-Item $tmpZip -Force -ErrorAction SilentlyContinue
}

Write-Host "Extracted to: $OutDir" -ForegroundColor Green
Get-ChildItem $OutDir -Recurse -File | Select-Object FullName | Format-Table -AutoSize

# Helper: PBI JSON members are Unicode (UTF-16LE) without extension
function Read-PbiJson([string]$Path) {
    if (-not (Test-Path $Path)) { return $null }
    $raw = Get-Content -LiteralPath $Path -Encoding Unicode -Raw
    # Strip BOM / leading junk before first {
    $idx = $raw.IndexOf('{')
    if ($idx -gt 0) { $raw = $raw.Substring($idx) }
    return $raw | ConvertFrom-Json
}

# 2. Report pages + filters
$layoutPath = Join-Path $OutDir "Report\Layout"
$layout = Read-PbiJson $layoutPath
if ($layout) {
    Write-Host "`n========== REPORT PAGES & FILTERS ==========" -ForegroundColor Cyan
    foreach ($section in $layout.sections) {
        Write-Host "`nPAGE: $($section.displayName)" -ForegroundColor Yellow
        if ($section.filters) {
            Write-Host "  FILTERS: $($section.filters)"
        }
        # Visual types on the page
        foreach ($vc in $section.visualContainers) {
            $cfg = $null
            try { $cfg = $vc.config | ConvertFrom-Json } catch {}
            $vt = $cfg.singleVisual.visualType
            if ($vt) { Write-Host "  VISUAL: $vt" }
        }
    }
}
else {
    Write-Host "No Report/Layout found." -ForegroundColor Red
}

# 3. Data-model measures (DAX) and tables
$schemaPath = Join-Path $OutDir "DataModelSchema"
$schema = Read-PbiJson $schemaPath
if ($schema) {
    Write-Host "`n========== DATA MODEL TABLES & MEASURES ==========" -ForegroundColor Cyan
    foreach ($t in $schema.model.tables) {
        Write-Host "`nTABLE: $($t.name)" -ForegroundColor Yellow
        foreach ($m in $t.measures) {
            $expr = ($m.expression -join ' ')
            Write-Host "  MEASURE [$($m.name)] = $expr"
        }
    }
}
else {
    Write-Host "`nNo DataModelSchema found (live-connection report?)." -ForegroundColor DarkYellow
}

Write-Host "`nDone. Use this inventory to build the BC dashboard tabs, filters, columns, and KPIs." -ForegroundColor Green
