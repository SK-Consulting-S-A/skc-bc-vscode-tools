# BC Knowledge MCP Specialists Reference

## Specialist Roster

| ID | Name | Primary Expertise |
|----|------|-------------------|
| `alex-architect` | Alex Architect | Solution design, requirements, technical architecture, integration strategy |
| `jordan-bridge` | Jordan Bridge | System integration, event-driven architecture, API design, extensibility |
| `sam-coder` | Sam Coder | Rapid development, pattern application, code generation, optimization |
| `dean-debug` | Dean Debug | Performance analysis, error diagnosis, system monitoring, optimization |
| `eva-errors` | Eva Errors | Error handling strategy, exception patterns, validation, failure analysis |
| `quinn-tester` | Quinn Tester | Test strategy, test case development, validation, quality assurance |
| `roger-reviewer` | Roger Reviewer | Code review, best-practice enforcement, standards compliance |
| `seth-security` | Seth Security | Permission model design, data access controls, security validation, privacy |
| `uma-ux` | Uma UX | UI design, UX optimization, accessibility, usability validation |
| `logan-legacy` | Logan Legacy | Code archaeology, system evolution, architecture recovery, migration |
| `maya-mentor` | Maya Mentor | Concept explanation, skill building, pattern education, best-practice guidance |
| `taylor-docs` | Taylor Docs | Technical writing, knowledge organization, documentation systems |
| `morgan-market` | Morgan Market | AppSource strategy, ISV business development, market analysis |
| `casey-copilot` | Casey Copilot | AI workflow optimization, prompting strategy, tool evolution |
| `chris-config` | Chris Config | MCP server configuration, layered knowledge architecture, environment management |

## Subagent-to-Specialist Mapping

### bc-cal-converter

| When | Consult | Via |
|------|---------|-----|
| Always (migration phase) | `logan-legacy` | `ask_bc_expert` with `autonomous_mode: true` for migration patterns |
| Modern AL patterns | `sam-coder` | `ask_bc_expert` with `autonomous_mode: true` for AL replacements |
| Restructuring to extensions | `alex-architect` | `ask_bc_expert` for extension design strategy |

### bc-architect

| When | Consult | Via |
|------|---------|-----|
| Always (design phase) | `alex-architect` | `get_specialist_advice` with requirement description |
| Integration/API involved | `jordan-bridge` | `get_specialist_advice` for API/event strategy |
| Upgrade/migration | `logan-legacy` | `ask_bc_expert` for migration planning |

### bc-al-logic

| When | Consult | Via |
|------|---------|-----|
| AL patterns and code | `sam-coder` | `ask_bc_expert` with code context |
| Complex error handling | `eva-errors` | `ask_bc_expert` for error strategy |
| HTTP/API integration | `jordan-bridge` | `get_specialist_advice` for integration patterns |
| Performance-sensitive code | `dean-debug` | `ask_bc_expert` for optimization |

### bc-al-ui

| When | Consult | Via |
|------|---------|-----|
| Page design and UX | `uma-ux` | `get_specialist_advice` with page requirements |
| Implementation patterns | `sam-coder` | `ask_bc_expert` for rapid implementation |
| Documentation needs | `taylor-docs` | `ask_bc_expert` for tooltips, captions |

### bc-tester

| When | Consult | Via |
|------|---------|-----|
| Test strategy | `quinn-tester` | `ask_bc_expert` with objects to test |
| Error path testing | `eva-errors` | `ask_bc_expert` for failure scenarios |

### bc-reviewer

| When | Consult | Via |
|------|---------|-----|
| Code quality review | `roger-reviewer` | `get_specialist_advice` with code |
| Security and permissions | `seth-security` | `get_specialist_advice` for security review |
| AppSource readiness | `morgan-market` | `ask_bc_expert` for AppSource checklist |
| Automated analysis | (tool) | `analyze_al_code` with code or "workspace" |

## MCP Tools Reference

### Consultation Tools

**`ask_bc_expert`** -- Direct specialist consultation. Auto-detects the best specialist if `preferred_specialist` is omitted.
```
Parameters: question (required), context (optional), preferred_specialist (optional)
```

**`get_specialist_advice`** -- Session-based conversation with a specific specialist. Supports multi-turn dialogue.
```
Parameters: specialist_id (required), message (required), session_id (optional), problem_context (optional)
```

**`handoff_to_specialist`** -- Transfer context between specialists mid-workflow.
```
Parameters: target_specialist_id, handoff_type (transfer|consultation|collaboration|escalation), handoff_reason, problem_summary, work_completed
```

### Workflow Tools

**`workflow_start`** -- Begin a structured multi-phase workflow.
```
Types: new-bc-app, enhance-bc-app, review-bc-code, debug-bc-issues, modernize-bc-code, onboard-developer, bc-version-upgrade, add-ecosystem-features, document-bc-solution
Parameters: workflow_type (required), scope (workspace|directory|files), path (optional), options (optional, includes source_version and target_version for bc-version-upgrade)
```

**`workflow_progress`** -- Report progress and obtain the next action in an active workflow.
```
Parameters: session_id (required), completed_action (optional), findings (optional), proposed_changes (optional)
```

**`workflow_complete`** -- Finish a workflow session and generate the final report.
```
Parameters: session_id (required), generate_report (optional), apply_changes (optional)
```

### Analysis Tools

**`analyze_al_code`** -- Automated AL code analysis.
```
Parameters: code (required, or "workspace"), analysis_type (performance|quality|security|patterns|comprehensive)
```

**`suggest_specialist`** -- Find the best specialist for a question.
```
Parameters: question (required), context (optional)
```
