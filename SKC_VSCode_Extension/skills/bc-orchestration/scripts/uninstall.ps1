# BC Orchestration - Uninstall Script
# Removes deployed subagent files and orchestrator rule from ~/.cursor/

$ErrorActionPreference = 'Stop'

$CursorHome = Join-Path $env:USERPROFILE '.cursor'
$AgentsTarget = Join-Path $CursorHome 'agents'
$RulesTarget = Join-Path $CursorHome 'rules'

Write-Host "BC Orchestration Uninstall" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan
Write-Host ""

$Removed = 0

# Remove agent files
$AgentNames = @(
    'bc-cal-converter.md',
    'bc-researcher.md',
    'bc-architect.md',
    'bc-al-logic.md',
    'bc-al-ui.md',
    'bc-tester.md',
    'bc-reviewer.md',
    'bc-translator.md'
)

foreach ($name in $AgentNames) {
    $path = Join-Path $AgentsTarget $name
    if (Test-Path $path) {
        Remove-Item -Path $path -Force
        Write-Host "[Removed] agents/$name" -ForegroundColor Yellow
        $Removed++
    } else {
        Write-Host "[Skip]    agents/$name (not found)" -ForegroundColor DarkGray
    }
}

# Remove rule file
$RuleNames = @(
    'bc-orchestrator.mdc'
)

foreach ($name in $RuleNames) {
    $path = Join-Path $RulesTarget $name
    if (Test-Path $path) {
        Remove-Item -Path $path -Force
        Write-Host "[Removed] rules/$name" -ForegroundColor Yellow
        $Removed++
    } else {
        Write-Host "[Skip]    rules/$name (not found)" -ForegroundColor DarkGray
    }
}

Write-Host ""
if ($Removed -gt 0) {
    Write-Host "Done! Removed $Removed file(s)." -ForegroundColor Cyan
    Write-Host "Restart Cursor to apply changes." -ForegroundColor Yellow
} else {
    Write-Host "Nothing to remove. BC Orchestration was not installed." -ForegroundColor DarkGray
}
