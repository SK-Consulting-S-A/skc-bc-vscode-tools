# BC Agent SDK - Uninstall Script
# Removes the bc-agent-sdk subagent from ~/.cursor/agents/

$ErrorActionPreference = 'Stop'

$CursorHome = Join-Path $env:USERPROFILE '.cursor'
$AgentsTarget = Join-Path $CursorHome 'agents'

Write-Host "BC Agent SDK Uninstall" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host ""

$Removed = 0

$AgentNames = @(
    'bc-agent-sdk.md'
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

Write-Host ""
if ($Removed -gt 0) {
    Write-Host "Done! Removed $Removed file(s)." -ForegroundColor Cyan
    Write-Host "Restart Cursor to apply changes." -ForegroundColor Yellow
} else {
    Write-Host "Nothing to remove. BC Agent SDK was not installed." -ForegroundColor DarkGray
}
