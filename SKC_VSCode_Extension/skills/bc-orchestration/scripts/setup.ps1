# BC Orchestration - Setup Script
# Deploys subagent files and orchestrator rule to ~/.cursor/

$ErrorActionPreference = 'Stop'

$SkillDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$CursorHome = Join-Path $env:USERPROFILE '.cursor'
$AgentsTarget = Join-Path $CursorHome 'agents'
$RulesTarget = Join-Path $CursorHome 'rules'

Write-Host "BC Orchestration Setup" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Skill directory: $SkillDir"
Write-Host "Target agents:   $AgentsTarget"
Write-Host "Target rules:    $RulesTarget"
Write-Host ""

# Create target directories
if (-not (Test-Path $AgentsTarget)) {
    New-Item -ItemType Directory -Path $AgentsTarget -Force | Out-Null
    Write-Host "[Created] $AgentsTarget" -ForegroundColor Green
} else {
    Write-Host "[Exists]  $AgentsTarget" -ForegroundColor DarkGray
}

if (-not (Test-Path $RulesTarget)) {
    New-Item -ItemType Directory -Path $RulesTarget -Force | Out-Null
    Write-Host "[Created] $RulesTarget" -ForegroundColor Green
} else {
    Write-Host "[Exists]  $RulesTarget" -ForegroundColor DarkGray
}

Write-Host ""

# Copy agent files
$AgentsSource = Join-Path $SkillDir 'agents'
$AgentFiles = Get-ChildItem -Path $AgentsSource -Filter 'bc-*.md'
$CopiedAgents = 0

foreach ($file in $AgentFiles) {
    $dest = Join-Path $AgentsTarget $file.Name
    Copy-Item -Path $file.FullName -Destination $dest -Force
    Write-Host "[Deployed] agents/$($file.Name)" -ForegroundColor Green
    $CopiedAgents++
}

# Copy rule file
$RulesSource = Join-Path $SkillDir 'rules'
$RuleFiles = Get-ChildItem -Path $RulesSource -Filter 'bc-*.mdc'
$CopiedRules = 0

foreach ($file in $RuleFiles) {
    $dest = Join-Path $RulesTarget $file.Name
    Copy-Item -Path $file.FullName -Destination $dest -Force
    Write-Host "[Deployed] rules/$($file.Name)" -ForegroundColor Green
    $CopiedRules++
}

Write-Host ""
Write-Host "Done! Deployed $CopiedAgents agent(s) and $CopiedRules rule(s)." -ForegroundColor Cyan
Write-Host "Restart Cursor to pick up the new agents and rule." -ForegroundColor Yellow
