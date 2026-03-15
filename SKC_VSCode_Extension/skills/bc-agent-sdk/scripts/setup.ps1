# BC Agent SDK - Setup Script
# Deploys the bc-agent-sdk subagent to ~/.cursor/agents/

$ErrorActionPreference = 'Stop'

$SkillDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$CursorHome = Join-Path $env:USERPROFILE '.cursor'
$AgentsTarget = Join-Path $CursorHome 'agents'

Write-Host "BC Agent SDK Setup" -ForegroundColor Cyan
Write-Host "==================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Skill directory: $SkillDir"
Write-Host "Target agents:   $AgentsTarget"
Write-Host ""

# Create target directory
if (-not (Test-Path $AgentsTarget)) {
    New-Item -ItemType Directory -Path $AgentsTarget -Force | Out-Null
    Write-Host "[Created] $AgentsTarget" -ForegroundColor Green
}
else {
    Write-Host "[Exists]  $AgentsTarget" -ForegroundColor DarkGray
}

Write-Host ""

# Copy agent file
$AgentsSource = Join-Path $SkillDir 'agents'
$AgentFiles = Get-ChildItem -Path $AgentsSource -Filter 'bc-*.md'
$CopiedAgents = 0

foreach ($file in $AgentFiles) {
    $dest = Join-Path $AgentsTarget $file.Name
    Copy-Item -Path $file.FullName -Destination $dest -Force
    Write-Host "[Deployed] agents/$($file.Name)" -ForegroundColor Green
    $CopiedAgents++
}

Write-Host ""
Write-Host "Done! Deployed $CopiedAgents agent(s)." -ForegroundColor Cyan
Write-Host "Restart Cursor to pick up the new agent." -ForegroundColor Yellow
