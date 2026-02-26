# BC Subagents Updates

**Date:** February 7, 2026  
**Status:** ✅ **UPDATED**

---

## Changes Made to BC Subagents

### 1. bc-translator.md - NEW Translation Subagent

#### Purpose:
Complete multilanguage translation workflow for BC extensions.

#### Capabilities:
- ✅ **Generate XLF files** - Builds project to create `.g.xlf`
- ✅ **Create target language files** - Uses `createLanguageXlf`
- ✅ **Auto-translate** - Uses `skc_translate_xlf` with Azure Translation
- ✅ **Track progress** - Uses `skc_list_translation_files`
- ✅ **Package translations** - Rebuilds with all languages

#### MCP Tools Used:
```al
// VS Code Language Model tools
al_build                    // Generate .g.xlf and package
createLanguageXlf          // Create target language XLF
skc_translate_xlf          // Auto-translate via Azure
skc_list_translation_files // Check translation status
```

#### Complete Workflow:
```
1. al_build (with GenerateCaptions)
   ↓ Creates Translations/AppName.g.xlf
   
2. createLanguageXlf (per language)
   ↓ Creates Translations/AppName.{lang}.xlf
   
3. skc_translate_xlf (per language)
   ↓ Auto-translates all strings
   
4. skc_list_translation_files
   ↓ Verify 100% complete
   
5. al_build
   ↓ Package with all languages
```

### 2. bc-reviewer.md - Enhanced with AL Build Tools

#### Added Capabilities:
- ✅ **AL Build Integration** - Now runs `al_build` MCP tool before review
- ✅ **Compilation Verification** - Checks if project compiles without errors
- ✅ **Diagnostics Retrieval** - Uses `al_getdiagnostics` to get specific errors
- ✅ **Symbol Management** - Uses `al_downloadsymbols` when needed

#### Updated Review Checklist:
- **New Section**: Compilation checks (build, warnings, symbols, dependencies)
- **New Section**: Internationalization (i18n) checks for multilanguage support
- **Enhanced**: Code Quality section now includes user-facing message checks

#### MCP Tools Used:
```al
// VS Code Language Model tools
al_build                  // Compile project
al_getdiagnostics        // Get compilation errors
al_downloadsymbols       // Download missing symbols
```

#### Review Flow Now:
```
1. Run al_build → Check compilation
   ↓
2. If errors → Fix them first
   ↓
3. Run analyze_al_code → Automated analysis
   ↓
4. Consult specialists (roger, seth, morgan)
   ↓
5. Check i18n compliance (Labels for user messages)
   ↓
6. Generate review report
```

---

## Why These Changes Matter

### Before:
- ❌ Couldn't detect compilation errors during review
- ❌ Had to manually run build separately
- ❌ No automatic i18n checking for hardcoded messages

### After:
- ✅ **Compilation verified** as part of review
- ✅ **Build errors caught early** before detailed review
- ✅ **Multilanguage compliance** checked automatically
- ✅ **Better integration** with AL development workflow

---

## How BC Reviewer Now Works

### Automated Steps:

1. **Compilation Check** (NEW)
   ```
   al_build → Compile project
   If failed → al_getdiagnostics → Get errors → Fix → Retry
   If missing symbols → al_downloadsymbols → Download → Retry
   ```

2. **Code Analysis**
   ```
   analyze_al_code → Run automated checks
   ```

3. **Specialist Consultation**
   ```
   roger-reviewer → Code quality
   seth-security → Security review
   morgan-market → AppSource compliance (if applicable)
   ```

4. **i18n Verification** (NEW)
   ```
   Check for hardcoded Message(), Error(), Confirm()
   Verify Label variables are used
   Ensure telemetry stays in English (Locked = true)
   ```

5. **Report Generation**
   ```
   Organized by severity: Critical / Warning / Suggestion
   Includes compilation status and i18n compliance
   ```

---

## Multilanguage (i18n) Best Practices Enforced

### ✅ Correct (Uses Labels):
```al
var
    ConnectionSuccessMsg: Label 'Connection test successful.';
    CustomerNotFoundErr: Label 'Customer %1 not found.';
begin
    Message(ConnectionSuccessMsg);
    Error(CustomerNotFoundErr, CustomerNo);
end;
```

### ❌ Incorrect (Hardcoded):
```al
begin
    Message('Connection test successful.');  // BAD - Not translatable
    Error('Customer %1 not found.', CustomerNo);  // BAD - Not translatable
end;
```

### Telemetry (OK to Keep in English):
```al
var
    TelemetryMsg: Label 'Customer synced successfully', Locked = true;
begin
    Session.LogMessage('00001', TelemetryMsg, ...);  // OK - For developers
end;
```

---

## Other Subagents That Could Benefit

### bc-al-ui.md
Could add:
- i18n checks for page captions/tooltips
- Label variable usage for actions

### bc-al-logic.md
Could add:
- Pre-implementation build check
- Verify no hardcoded user messages in new code

### bc-tester.md
Could add:
- Test compilation after code generation
- Verify test codeunits compile

---

## Usage Examples

### For Developers:
When triggering a review:
```
"Review this MS Subscription integration"
```

The bc-reviewer will now automatically:
1. Try to build the project
2. Report compilation status
3. Check for hardcoded messages
4. Perform full code quality review

### For Orchestrator:
```
Task(bc-reviewer) → {
  - Compile project (al_build)
  - Get diagnostics if errors
  - Fix compilation first
  - Then proceed with review
  - Check i18n compliance
}
```

---

## What Was Fixed Today

### 1. Hardcoded Messages → Labels
Fixed 20+ hardcoded user-facing messages:
- **CompanialSetup021SKC.Page.al**: 7 messages
- **CompanialSubsCardExt021SKC.PageExt.al**: 7 messages
- **CompanialSubsListExt021SKC.PageExt.al**: 7 messages
- **CompanialMSHelper021SKC.Codeunit.al**: 4 error messages

### 2. Subagent Enhanced
Updated **bc-reviewer.md** to:
- Include AL build tools
- Add i18n compliance checking
- Improve review workflow

---

## Benefits

### For Development Team:
- ✅ **Earlier error detection** - Compilation checked during review
- ✅ **Better code quality** - i18n compliance enforced
- ✅ **Faster feedback** - Don't wait for build to fail later
- ✅ **Multilanguage ready** - All user messages translatable

### For End Users:
- ✅ **Translatable UI** - All messages can be translated
- ✅ **Better UX** - Consistent message formatting
- ✅ **Professional quality** - No hardcoded English-only messages

### For Maintenance:
- ✅ **Easier updates** - Labels centralized, not scattered
- ✅ **Consistent patterns** - All files follow same approach
- ✅ **Better testability** - Can test different languages

---

## Configuration Needed

The bc-reviewer subagent now requires access to:
- **VS Code Language Model tools** (for al_build, al_getdiagnostics, al_downloadsymbols)
- **user-bc-knowledge MCP server** (for analyze_al_code, specialists)

These should already be configured in your Cursor setup.

---

## Next Steps

### Optional Enhancements:
1. **Update other subagents** (bc-al-logic, bc-al-ui, bc-tester) with build tools
2. **Add pre-commit hooks** to check i18n compliance
3. **Create i18n documentation** for the team
4. **Add translation workflow** (export/import xlf files)

### Translation Workflow:
```
1. Export labels → .xlf file (AL: Generate Translation Files)
2. Translate → External tool or service
3. Import → .xlf back to project
4. Build → Creates multilanguage .app
```

---

## Documentation

### Files Created/Updated:
- ✅ `bc-reviewer.md` - Enhanced subagent definition
- ✅ `AGENTS_UPDATES.md` - This file
- ✅ 4 AL files - Hardcoded messages → Labels

### Related Skills:
- **bc-orchestration** - Main orchestrator that delegates to subagents
- **bc-reviewer** - Enhanced with build tools and i18n checks

---

## Conclusion

The BC Reviewer subagent is now more powerful and can:
- ✅ **Verify compilation** before detailed review
- ✅ **Check i18n compliance** automatically
- ✅ **Catch hardcoded messages** early
- ✅ **Provide better feedback** with build diagnostics

All user-facing messages in the MS Subscription integration are now ready for translation!

---

**Status:** ✅ **COMPLETE**  
**BC Reviewer:** ✅ **Enhanced with AL Build Tools**  
**i18n Compliance:** ✅ **All User Messages Use Labels**
