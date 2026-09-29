---
applyTo: '**'
description: Stops proprietary code/context from being sent to remote (http/sse) MCP tools such as MS Learn Docs.
---

# Remote MCP data minimization

A `stdio` MCP server runs on the local machine — it doesn't send anything anywhere by
itself. An `http`/`sse` MCP server (e.g. `MS Learn Docs` at `learn.microsoft.com/api/mcp`)
is different: whatever text is sent as the tool call's arguments leaves this machine and is
processed by that remote service. Treat every such call as a message to a third party that
may be logged.

## Before calling a remote MCP tool

1. **Search locally first.** Use `semantic_search`/`grep_search`/existing skills to see if
   the workspace already answers the question. Only fall back to a remote lookup for
   genuinely general, public knowledge (language/platform/API behavior, official docs,
   error messages for a public API).
2. **Generalize the question.** Ask about the underlying platform concept, not the
   customer's implementation. Rephrase "how do I fix this in
   `Codeunit 50134 "Acme Ltd Sales Posting"`" as "how does event subscription work for
   posting routines in Business Central."
3. **Never include in a remote query:**
   - Full file contents, proprietary business logic, or pasted customer code.
   - Customer/tenant names, tenant IDs, company names, environment names, or internal
     hostnames/URLs.
   - Credentials, tokens, connection strings, or any other secret.
   - Anything the user has marked confidential in the conversation.
4. **When a question can't be generalized** without losing the context needed to get a
   useful answer, stop and ask the user whether it's OK to send that specific text remotely,
   instead of deciding on their behalf.

This applies to any current or future `http`/`sse` MCP server, not just MS Learn Docs.
