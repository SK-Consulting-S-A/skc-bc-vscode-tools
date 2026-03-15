---
name: bc-agent-sdk
description: Build Business Central AL agent extensions using the BC Agent SDK (preview). Implements IAgentFactory, IAgentMetadata, IAgentTaskExecution interfaces, setup pages, task triggers, and agent session detection. Use when creating a deployable BC agent as an AL extension (.app). Triggers on IAgentFactory, IAgentMetadata, IAgentTaskExecution, Agent Task Builder, Agent Session, "build a BC agent", "create an agent extension", or "AL agent SDK".
---

# BC Agent SDK Skill

Build Business Central AI agents as deployable AL extensions (`.app`) using the **BC Agent SDK** (preview). This skill orchestrates a dedicated subagent that produces every required AL object — from capability registration to task execution — and validates the result with an AL build.

> **Preview only:** BC 27.2+ sandbox environments. Not for production.

## When to Use This Skill

Load this skill when the user asks to:
- Build, scaffold, or implement a BC agent extension
- Use the BC Agent SDK or any of its interfaces (`IAgentFactory`, `IAgentMetadata`, `IAgentTaskExecution`)
- Trigger an agent from a page action, insert/modify event, or external caller
- Detect an agent session inside AL code
- Configure agent instructions, profiles, or permissions programmatically

Also triggered when AL files contain references to:
`IAgentFactory`, `IAgentMetadata`, `IAgentTaskExecution`, `Agent Task Builder`, `Agent Session`, `Agent Task Message Builder`, `Copilot Capability`, `Agent Metadata Provider`

## Installation

Deploys the `bc-agent-sdk` subagent to your Cursor / VS Code agents folder:

```powershell
# From the bc-agent-sdk skill folder:
.\scripts\setup.ps1
# To remove:
.\scripts\uninstall.ps1
```

> The `bc-agent-sdk` subagent is also included in the `bc-orchestration` skill. If you already use `bc-orchestration`, re-run its `setup.ps1` to pick up the new agent.

## What the Subagent Builds

A complete, compilable AL extension containing:

| Object | Purpose |
|--------|---------|
| `enumextension` extends `Copilot Capability` | Registers AI feature flag |
| Install codeunit (`Subtype = Install`) | Auto-registers capability on first install |
| `enumextension` extends `Agent Metadata Provider` | Registers agent type + interface bindings |
| Codeunit implements `IAgentFactory` | Setup page, default profile, default permissions |
| Codeunit implements `IAgentMetadata` | Display name, summary page, annotations, message page |
| Codeunit implements `IAgentTaskExecution` | Input validation, output post-processing, intervention suggestions |
| Setup table + `ConfigurationDialog` page | Agent configuration UI |
| `Instructions.txt` resource file | Natural language agent instructions |
| Session events codeunit | Task-duration event binding |
| Task trigger action | `Agent Task Builder` integration from page actions or events |
| Public API codeunit (optional) | Cross-extension task creation |

## Subagent Delegation

This skill immediately delegates all work to the `bc-agent-sdk` subagent:

```
bc-agent-sdk
  ├── Reads app.json (ID range, namespace, runtime version)
  ├── Verifies SDK interfaces via al_symbolsearch
  ├── Consults sam-coder for pattern guidance
  ├── Generates all AL objects in one pass
  └── Validates with al_build + al_getdiagnostics
```

For a full development lifecycle (design → implement → test → review → translate), use the `bc-orchestration` skill, which includes `bc-agent-sdk` as a subagent.

## Key BC References

| AL Object | Type | Role |
|-----------|------|------|
| `IAgentFactory` | Interface | Creation, default profile/permissions, setup page |
| `IAgentMetadata` | Interface | Initials, summary page, annotations, message page |
| `IAgentTaskExecution` | Interface | Message analysis, intervention suggestions |
| `Agent Task Builder` | Codeunit | Create tasks from page actions / events |
| `Agent Task Message Builder` | Codeunit | Build messages with text and attachments |
| `Agent Session` | Codeunit | Detect agent sessions, get task ID, bind events |
| `Agent` | Codeunit | Configure agent instances (instructions, profile, permissions) |
| `Copilot Capability` | Codeunit | Register AI capabilities |
| `Custom Agent` | Codeunit | Enumerate deployed agent instances |

## MS Docs References

- [BC Agent SDK overview](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/ai/ai-agent-sdk-overview)
- [Define and register an agent](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/ai/ai-agent-sdk-define-register)
- [Agent configuration](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/ai/ai-agent-sdk-configuration)
- [Managing agent tasks](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/ai/ai-agent-sdk-tasks)
- [AI Development Toolkit – Create an agent](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/ai/ai-development-toolkit-agent-create)
