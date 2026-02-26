# ============================================================================
# Phase 3: Compilation and Review
# ============================================================================
# Compiles the converted AL code and runs quality checks using BC Knowledge
# specialists and the bc-reviewer subagent.
# ============================================================================

param(
  [Parameter(Mandatory = $true)]
  [PSCustomObject]$Config
)

$ErrorActionPreference = 'Stop'

Write-Host "Phase 3: Compilation and Review" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$workspace = $Config.bcWorkspace

# ============================================================================
# Step 3.1: Prepare for Compilation
# ============================================================================

Write-Host "Step 3.1: Preparing for Compilation" -ForegroundColor Cyan
Write-Host "-------------------------------------" -ForegroundColor Cyan
Write-Host ""

# Count AL files
$alFiles = Get-ChildItem (Join-Path $workspace 'src') -Filter "*.al" -Recurse
$alFileCount = ($alFiles | Measure-Object).Count

Write-Host "Found $alFileCount AL files to compile" -ForegroundColor Yellow
Write-Host ""

# Create .vscode directory if it doesn't exist
$vscodeDir = Join-Path $workspace '.vscode'
New-Item -ItemType Directory -Path $vscodeDir -Force | Out-Null

# Create launch.json for debugging
$launchJsonPath = Join-Path $vscodeDir 'launch.json'
if (-not (Test-Path $launchJsonPath)) {
  Write-Host "Creating launch.json for debugging..." -ForegroundColor Yellow
    
  $launchJson = @{
    version        = "0.2.0"
    configurations = @(
      @{
        name                           = "Your own server"
        type                           = "al"
        request                        = "launch"
        server                         = "http://localhost"
        serverInstance                 = "BC270"
        authentication                 = "Windows"
        startupObjectId                = 22
        startupObjectType              = "Page"
        breakOnError                   = $true
        launchBrowser                  = $true
        enableLongRunningSqlStatements = $true
        enableSqlInformationDebugger   = $true
      }
    )
  } | ConvertTo-Json -Depth 10
    
  $launchJson | Out-File -FilePath $launchJsonPath -Encoding UTF8
  Write-Host "[OK] launch.json created" -ForegroundColor Green
}

Write-Host ""

# ============================================================================
# Step 3.2: Create Compilation Instructions for Cursor
# ============================================================================

Write-Host "Step 3.2: Creating Compilation Instructions" -ForegroundColor Cyan
Write-Host "---------------------------------------------" -ForegroundColor Cyan
Write-Host ""

$compileInstructionsPath = Join-Path $workspace 'compile-instructions.md'

$compileInstructions = @"
# Compilation and Review Instructions

## Overview

The CAL to AL conversion is complete. This phase focuses on compiling the code and running quality checks.

## Compilation Status

- **AL Files Generated**: $alFileCount
- **Workspace**: ``$workspace``
- **Target BC Version**: $($Config.bcTargetVersion)

## Step 1: Download Symbols

Before compilation, download BC symbols using the AL Language extension.

### Instructions for Cursor:

Use the VS Code tool to download symbols:

``````
al_downloadsymbols(workspace_path: "$workspace")
``````

This downloads the BC platform symbols and dependencies needed for compilation.

## Step 2: Compile the Extension

Compile the AL code to check for errors.

### Instructions for Cursor:

Use the VS Code tool to build:

``````
al_build(workspace_path: "$workspace")
``````

### Expected Issues:

1. **Missing references**: Some BC objects may have been renamed or moved
2. **Obsolete patterns**: NAV 2017 patterns that need modernization
3. **Type mismatches**: Data type changes between NAV and BC
4. **Permission errors**: Permission model has changed

## Step 3: Get Diagnostics

After compilation, get detailed diagnostics.

### Instructions for Cursor:

``````
al_getdiagnostics(workspace_path: "$workspace")
``````

This returns all compilation errors, warnings, and information messages.

## Step 4: Consult BC Knowledge Specialists

For each type of issue, consult the appropriate specialist:

### logan-legacy (Upgrade Issues)

For obsolete patterns, breaking changes, and migration issues:

``````
ask_bc_expert(
  question: "How do I fix this NAV 2017 pattern in BC 2027: [describe pattern]?",
  context: "[code snippet]",
  preferred_specialist: "logan-legacy",
  autonomous_mode: true
)
``````

### sam-coder (Modern AL Patterns)

For modernizing code and applying best practices:

``````
ask_bc_expert(
  question: "What's the modern AL pattern for [legacy pattern]?",
  context: "[code snippet]",
  preferred_specialist: "sam-coder",
  autonomous_mode: true
)
``````

### eva-errors (Error Handling)

For error handling and validation issues:

``````
ask_bc_expert(
  question: "How should I handle errors in this scenario: [describe]?",
  context: "[code snippet]",
  preferred_specialist: "eva-errors",
  autonomous_mode: true
)
``````

## Step 5: Run bc-reviewer Subagent

After fixing compilation errors, run comprehensive quality review.

### Instructions for Cursor:

Delegate to the bc-reviewer subagent:

``````
Invoke bc-reviewer subagent to review the AL code in this workspace.
Check for:
- Code quality issues
- Security vulnerabilities
- AppSource compliance (if targeting AppSource)
- Best practice violations
``````

The bc-reviewer will:
1. Run al_build to verify compilation
2. Run al_getdiagnostics to get all issues
3. Consult roger-reviewer for code quality
4. Consult seth-security for security review
5. Consult morgan-market for AppSource readiness (if applicable)
6. Generate a comprehensive review report

## Step 6: Address Review Findings

Review the findings from bc-reviewer and address them by priority:

### Critical Issues (Must Fix)
- Compilation errors
- Security vulnerabilities
- Breaking changes

### Warnings (Should Fix)
- Code quality issues
- Performance concerns
- Deprecated patterns

### Suggestions (Nice to Have)
- Code style improvements
- Optimization opportunities
- Documentation gaps

## Step 7: Start BC Version Upgrade Workflow (Optional)

For systematic file-by-file review and modernization:

``````
workflow_start(
  workflow_type: "bc-version-upgrade",
  scope: "workspace",
  options: {
    source_version: "NAV2017",
    target_version: "$($Config.bcTargetVersion)"
  }
)
``````

This provides structured guidance for each file.

## Common Issues and Solutions

### Issue: "Table 'X' not found"

**Solution**: The table may have been renamed or moved in BC. Use al_symbolsearch to find it:

``````
al_symbolsearch(
  query: "X",
  filters: {kinds: ["Table"], scope: "dependencies"}
)
``````

### Issue: ".NET type 'Y' not found"

**Solution**: .NET interop is not supported in BC SaaS. Replace with AL alternatives:

- HttpClient (DotNet) → HttpClient (AL codeunit)
- XmlDocument (DotNet) → XmlDocument (AL)
- File operations → InStream/OutStream patterns

Consult logan-legacy for specific replacements.

### Issue: "BLOB field handling"

**Solution**: BLOB fields should be migrated to Media or MediaSet:

- Single file (image, PDF) → Media
- Multiple files → MediaSet

Consult logan-legacy for migration patterns.

### Issue: "WITH statement not allowed"

**Solution**: BC requires explicit record qualification. Remove WITH statements:

``````al
// Old (NAV)
WITH Customer DO BEGIN
  Name := 'Test';
END;

// New (BC)
Customer.Name := 'Test';
``````

### Issue: "Option field"

**Solution**: Convert Option fields to Enum types. Consult sam-coder for enum creation patterns.

## Quality Gates

Before proceeding to testing:

- ✅ All compilation errors fixed
- ✅ No critical security issues
- ✅ No breaking changes
- ✅ bc-reviewer findings addressed
- ✅ Code compiles successfully

## Next Steps After Compilation

1. Run bc-tester subagent to create test coverage
2. Deploy to BC 2027 test environment
3. Run integration tests
4. User acceptance testing
5. Production deployment

---

Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
"@

$compileInstructions | Out-File -FilePath $compileInstructionsPath -Encoding UTF8

Write-Host "[OK] Compilation instructions created: $compileInstructionsPath" -ForegroundColor Green
Write-Host ""

# ============================================================================
# Step 3.3: Create Review Checklist
# ============================================================================

Write-Host "Step 3.3: Creating Review Checklist" -ForegroundColor Cyan
Write-Host "-------------------------------------" -ForegroundColor Cyan
Write-Host ""

$checklistPath = Join-Path $workspace 'review-checklist.md'

$checklist = @"
# BC 2027 Upgrade Review Checklist

## Pre-Compilation Checks

- [ ] All AL files generated from CAL conversion
- [ ] app.json configured correctly
- [ ] ID ranges allocated properly
- [ ] Naming conventions applied consistently

## Compilation Checks

- [ ] Symbols downloaded successfully
- [ ] Project compiles without errors
- [ ] All warnings reviewed and addressed
- [ ] No critical diagnostics

## Code Quality Checks

- [ ] No .NET interop (or properly replaced)
- [ ] No direct SQL statements
- [ ] No file system access (or using InStream/OutStream)
- [ ] BLOB fields migrated to Media/MediaSet
- [ ] WITH statements removed
- [ ] Option fields converted to Enums

## Security Checks

- [ ] Proper permission handling
- [ ] No hardcoded credentials
- [ ] Sensitive data properly classified
- [ ] Error messages don't expose sensitive info

## BC Best Practices

- [ ] Access modifiers applied (Internal vs Public)
- [ ] DataClassification on all fields
- [ ] ApplicationArea on page fields/actions
- [ ] ToolTip on all page fields
- [ ] Error labels (not inline strings)
- [ ] Regions for code organization
- [ ] XML documentation on public procedures

## Extension Design

- [ ] Table extensions only contain custom fields
- [ ] Page extensions only contain custom fields/actions
- [ ] Extension object IDs in correct range
- [ ] Extension names follow convention
- [ ] No modifications to standard BC code

## Performance

- [ ] SetLoadFields used where appropriate
- [ ] Proper filtering on large tables
- [ ] No unnecessary FINDFIRST/FINDLAST loops
- [ ] CalcFields only when needed

## Testing Readiness

- [ ] Test scenarios identified
- [ ] Test data prepared
- [ ] Test environment configured
- [ ] Rollback plan in place

## AppSource Readiness (if applicable)

- [ ] No direct database access
- [ ] No external dependencies
- [ ] Proper error handling
- [ ] Telemetry implemented
- [ ] Help/documentation provided

## Deployment Readiness

- [ ] Version number set
- [ ] Dependencies documented
- [ ] Installation instructions prepared
- [ ] Upgrade codeunit created (if needed)
- [ ] Data migration tested

---

**Reviewer**: _______________  
**Date**: _______________  
**Sign-off**: _______________
"@

$checklist | Out-File -FilePath $checklistPath -Encoding UTF8

Write-Host "[OK] Review checklist created: $checklistPath" -ForegroundColor Green
Write-Host ""

# ============================================================================
# Summary
# ============================================================================

Write-Host "Phase 3 preparation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Open Cursor in the BC workspace: $workspace" -ForegroundColor White
Write-Host "2. Read the compilation instructions: compile-instructions.md" -ForegroundColor White
Write-Host "3. Download symbols and compile using VS Code tools" -ForegroundColor White
Write-Host "4. Run bc-reviewer subagent for quality check" -ForegroundColor White
Write-Host "5. Use review-checklist.md to track progress" -ForegroundColor White
Write-Host ""
