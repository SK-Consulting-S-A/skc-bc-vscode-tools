---
name: timesheet-filling
description: Fill and review SKC timesheets using the timesheet MCP. Use when the user asks to fill timesheets, review pending suggestions, classify unmapped entries, match activity to projects/tasks/cases, or prepare time for Business Central. Drives the collect → triage → resolve → classify → reclassify → apply flow with interactive clarification for ambiguous evidence.
---

# Timesheet Filling (SKC)

Drive the SKC timesheet MCP server to turn local collector evidence into mapped BC timesheet suggestions, with human confirmation at every decision point.

## Preconditions

- The `timesheets` MCP server is connected (tools like `list_projects`, `get_suggestion_context`, `update_timesheet_suggestion` are available).
- If a tool call fails with "connection closed" or the server is missing, stop and tell the user to fix the Scout/OpenClaw MCP connection first.

## Hard rules (never break)

1. **Never submit, approve, journal, or post** native timesheets automatically.
2. **Never apply** a suggestion without the user explicitly confirming it first.
3. **Never guess a project/task/case** when evidence is ambiguous — present options and let the user pick (see Ambiguity protocol).
4. **Never invent** a project, task, work type, or case that was not returned by `list_projects`, `list_project_tasks`, or `list_cases`.
5. The resource is the one configured in the MCP `.env` (`BC_RESOURCE_NO`). Each agent uses its own resource. Reject anything else.
6. Always pass the current `revision` as `expectedRevision` — refetch via `get_suggestion_context` right before writing.
7. **Never auto-match on weak keywords** — see Confidence tiers.

## Confidence tiers for auto-matching

Only auto-classify when the match is strong. Otherwise use the Ambiguity protocol.

### App identification via object suffix

AL object names in VS Code end with the app's **identifier + prefix** from the BC application mapping table (e.g. `MyApp123ABC` → `123ABC`).

Call `list_applications` once per session to load the mapping:
- `suffix` (e.g. `003SKC`) → `appName`, `customerName`, `partnerCode`
- If `customerName` is set → **customer project** (match the customer to a project)
- If `customerName` is empty → **internal/IP project** (SKC app)

### App projects default to Development

When the matched project is an **app** (identified via suffix), the task is normally the project's **Development** task. App projects use task codes like `1000`, `2000`, or `1100` for development. Look for the task whose description contains "Development" (case-insensitive). If multiple exist, pick the first. If none exists, use the Ambiguity protocol.

This means for app work:
- `al_object` with a known suffix → project found → task = Development → **auto-classify silently**
- No need to ask the user which task — development is the default for app work

| Tier | Signal | Auto-match? |
|---|---|---|
| **Strong** | `al_object` signal → suffix lookup → customer/app → project | ✅ Yes |
| **Strong** | `workspace` signal exactly equals a project name/known repo | ✅ Yes |
| **Medium** | Customer name appears in the title | ⚠️ Propose, but confirm with user |
| **Medium** | A case reference (CASE-xxxx) matches and the case has jobNo/jobTaskNo | ⚠️ Propose, but confirm with user |
| **Weak** | Single generic keyword ("mail", "chrome", "hotel", "meeting") | ❌ Never auto-match |
| **Weak** | No signals, idle/locked-dominated block | ❌ Triage as junk |

## Workflow

### 1. Collect new evidence
Call `list_new_completed_blocks` (limit 25). If empty, say "No new activity blocks" and stop.

**MCP tool:** `list_new_completed_blocks` — returns evidence blocks from the local collector outbox.

### 2. Prepare blocks
Call `prepare_new_timesheet_blocks` (limit 10). This resolves mapping server-side and creates Pending suggestions.

**MCP tool:** `prepare_new_timesheet_blocks` — resolves mapping in BC and submits pending suggestions.

### 3. Triage junk blocks
Call `get_classification_summary` to get a lightweight summary of pending suggestions. This uses fewer tokens than loading full suggestion data.

Identify junk:
- Idle-dominated (`idleMinutes` > `activeMinutes`)
- Locked/excluded states in the title or details
- `activeMinutes` < 2

For these, **suggest dismissing** with a one-line reason. Only call `reject_timesheet_suggestion` after the user confirms.

**MCP tool:** `get_classification_summary` — filter `status: "Pending"` for unmapped entries.

### 4. Find what needs review
Partition the remaining suggestions into:
- **Mapped** (has `jobNo` + `jobTaskNo` + `workTypeCode`) — ready for apply confirmation
- **Unmapped** (missing `jobNo`) — need classification

### 5. Classify unmapped suggestions
**Group similar entries first** — same title pattern, same workspace, same day. Present one question per group, not per entry.

For each group:
1. Call `get_batch_suggestion_contexts` with up to 10 suggestion IDs → get all suggestion data, projects, and cases in one call.
2. Check if the `al_object` signal resolves to an app via suffix lookup → if yes, find the project for that app and use its **Development** task.
3. Try to auto-classify using the Confidence tiers above.
4. If **Strong** match → apply it silently and report.
5. If **Medium** match → propose it, ask for confirmation.
6. If **Weak** or no match → **Ambiguity protocol**.

**MCP tools:** `get_batch_suggestion_contexts` (preferred), `get_suggestion_context`, `list_projects`, `list_project_tasks`, `list_cases`, `list_applications`

### 6. Ambiguity protocol (interactive selection)

When the project or task is unclear, **do not guess**. Present the matching options and let the user pick. Format:

> This activity matches **<area>** work, but the exact task is unclear. Which task should I use?
>
> - `TASK1` — Description
> - `TASK2` — Description
> - `TASK3` — Description
> - Other (specify)

Illustrative example (customer retro-engineering):

> This activity matches **customer retro-engineering** work, but the business process is unclear. Which task should I use?
>
> - `<TASK-ACQUIRE-TO-DISPOSE>` — Retro-engineering report - Acquire to dispose
> - `<TASK-RECORD-TO-REPORT>` — Retro-engineering report - Record to Report
> - `<TASK-SOURCE-TO-PAY>` — Retro-engineering report - Source to pay
> - `<TASK-ORDER-TO-CASH>` — Retro-engineering report - Order to cash
> - Other matching task returned by the MCP

After the user picks, reclassify with their selection.

### 7. Reclassify
Call `update_timesheet_suggestion` with:
- `suggestionId`, `expectedRevision` (fresh from context)
- `jobNo`, `jobTaskNo`, `workTypeCode`, `description`, `chargeable`, `caseNo`, `includeAIUsage`
- `confirm: true`, `confirmationReference: "user-selected-<short-reason>"`

If it fails with "suggestion has changed" → refetch context, retry once with the new revision. If it fails again, report the conflict and skip.

**MCP tool:** `update_timesheet_suggestion`

### 8. Apply (only on explicit user request)
When the user asks to apply/book time:
1. List the mapped suggestions in a **summary table**:

   | Date | Project | Task | Hours | Description |
   |---|---|---|---|---|
   | 13.08 | `<PROJECT-REFERENCE>` | `<TASK-REFERENCE>` | 0.25 | Customer retro-engineering |

2. Ask: "Apply these N suggestions as Open time entries?"
3. Only after a clear yes, call `apply_timesheet_suggestion` per suggestion with fresh `expectedRevision`, `confirm: true`, `confirmationReference`.

**MCP tool:** `apply_timesheet_suggestion` — only call after explicit user confirmation.

### 9. Work type inference
- Default: `REM-DYN365` for remote consulting work.
- If the project/task has been used before, reuse the work type from a recent applied suggestion for the same project+task.
- If unsure, ask the user.

### 10. Session summary
End every run with:

> **Summary:** Prepared X blocks. Auto-mapped Y. Asked for Z selections. Dismissed W junk. N suggestions ready to apply.

## Memory: learning from history

The agent builds memory from past timesheet postings to improve future classification.

### How to build memory

1. **Query applied suggestions** — call `list_timesheet_suggestions` with `status: "Applied"` to get historical entries.
2. **Extract patterns** — for each applied suggestion, note:
   - `title` / `details` keywords → `jobNo`, `jobTaskNo`, `workTypeCode`
   - `signals` (workspace, al_object, browser_page) → project/task
   - `customerNameHint` → customer
3. **Store in memory** — keep a session-level map of `keyword → project/task` for the current resource.

### How to use memory

When classifying a new unmapped suggestion:
1. Check if the title/details contain keywords from memory → propose the same project/task.
2. Check if the `al_object` suffix was seen before → propose the same project.
3. Check if the `workspace` was seen before → propose the same project.

### Suggested vs posted comparison

The agent can also compare what was **suggested** vs what was **actually posted** to measure accuracy and improve future suggestions.

**How to compare:**
1. Query applied suggestions (`status: "Applied"`) — these show what was finally posted.
2. For each applied suggestion, compare:
   - **Original suggestion** (`jobNo`, `jobTaskNo`, `workTypeCode`, `description` before reclassification)
   - **Final posted** (same fields after user reclassification + apply)
3. Calculate accuracy:
   - **Exact match** — suggestion was correct, no reclassification needed
   - **Reclassified** — user changed project/task/work type
   - **Dismissed** — user rejected the suggestion entirely

**What to learn from the comparison:**
- If many suggestions for the same pattern get **reclassified to the same target** → suggest a mapping rule update to the user.
- If suggestions for a pattern are **often dismissed** → lower confidence for that pattern, ask more often.
- If a pattern is **always exact match** → increase confidence, auto-match silently.

**Example comparison report:**
> This week I suggested 12 blocks. You applied 10 as-is, reclassified 2 to `<PROJECT-REFERENCE>/<TASK-REFERENCE>`, and dismissed 0. The 2 reclassified were both customer retro-engineering — should I save a mapping rule for that pattern?

### Memory persistence

- **Session memory**: Built fresh each time from `list_timesheet_suggestions` (Applied status).
- **Long-term**: Suggest the user save recurring patterns as BC mapping rules (TS Agent Suggestions page → Save as Mapping Rule). The MCP cannot create rules — it is a human-approved BC action.

### Example

> I see you've worked on `<PROJECT-REFERENCE>` / `<TASK-REFERENCE>` (customer retro-engineering) 5 times this week with similar titles. Should I apply the same classification to this new entry?

### Privacy note

Only query your own resource's historical data. Never access another agent's timesheet history.

## Learning hint
When a reclassification reflects a recurring pattern (same signals → same project), suggest saving a mapping rule in BC (TS Agent Suggestions page → Save as Mapping Rule). The MCP cannot create rules — it is a human-approved BC action.

## Tool reference

Use these MCP tools directly — do **not** generate shell scripts.

### Token-efficient tools (use these first)

| Step | Tool | Key params | Token savings |
|---|---|---|---|
| Classification summary | `get_classification_summary` | `status`, `limit` | Only essential fields, no full objects |
| Batch context | `get_batch_suggestion_contexts` | `suggestionIds: string[]` (max 10) | One call instead of N calls |
| List with field filter | `list_timesheet_suggestions` | `fields: "id,title,jobNo,jobTaskNo,status"` | Only requested fields returned |

### Standard tools

| Step | Tool | Key params |
|---|---|---|
| Check health | `get_mcp_health` | `checkBcConnectivity: boolean` |
| Outbox stats | `get_outbox_stats` | — |
| Validate config | `validate_configuration` | — |
| List new blocks | `list_new_completed_blocks` | `limit`, `cursor` |
| Prepare blocks | `prepare_new_timesheet_blocks` | `limit` |
| List suggestions | `list_timesheet_suggestions` | `status?`, `workDate?`, `limit`, `cursor`, `fields?` |
| Get context | `get_suggestion_context` | `suggestionId` |
| List projects | `list_projects` | — |
| List tasks | `list_project_tasks` | `jobNo` |
| List cases | `list_cases` | — |
| List apps | `list_applications` | — |
| Reclassify | `update_timesheet_suggestion` | `suggestionId`, `expectedRevision`, `jobNo`, `jobTaskNo`, `workTypeCode`, `description`, `chargeable`, `caseNo`, `includeAIUsage`, `confirm`, `confirmationReference` |
| Apply | `apply_timesheet_suggestion` | `suggestionId`, `expectedRevision`, `confirm`, `confirmationReference` |
| Dismiss | `reject_timesheet_suggestion` | `suggestionId`, `expectedRevision`, `confirm`, `confirmationReference` |

## Error handling
- `AUTH_EXPIRED` → tell the user to check BC credentials in the env file.
- `RATE_LIMITED` → wait and retry with fewer records.
- Revision mismatch → refetch context, retry once, then skip.
- `UNMAPPED_MAPPING` is normal — run the Ambiguity protocol.

## Response style
- Short status lines: "Prepared 8 blocks, 6 mapped, 2 need your input."
- For selections: bulleted options with task codes and descriptions, exactly like the example.
- For apply confirmation: the summary table, then a yes/no question.
- Never dump raw JSON at the user; summarize.
