---
applyTo: '**/mcp.json'
description: Flags risky MCP server configurations before they are added or approved.
---

# MCP server safety

When adding, reviewing, or approving an entry in an MCP config file (`.vscode/mcp.json`,
`presets/mcp.json`, or equivalent), judge it by whether the **configuration itself** creates
avoidable risk — not by what class of tool it is. General-purpose capability (browser
automation, filesystem access, shell execution) is not a red flag by itself: the risk in
those lives entirely in how the agent is later instructed to use them, not in the config
entry. Only flag what the config actually does wrong.

## Config-level risks to flag

1. **Unpinned versions** (`@latest`, no version) run via `npx`/`uvx`/`pipx` for a **stdio**
   server that touches sensitive data or credentials (any ERP/finance/customer-data proxy).
   Each invocation can silently run different, unreviewed code. Prefer a pinned version.
2. **Unsafe defaults.** A server that defaults to a live/production environment, tenant, or
   dataset when a safer default (sandbox, read-only, dry-run) exists. A shipped preset value
   of `"Environment": "Production"` is a config-level risk even when other fields are
   placeholders — someone will apply the preset without editing it.
3. **Overly broad scopes.** OAuth/API scopes wider than the server needs, e.g.
   `*.ReadWrite.All` when the server only ever reads data.
4. **Plaintext secrets.** Tenant IDs, client IDs treated as if they were secrets, tokens, or
   keys hard-coded in an `env` block instead of routed through `${input:...}` prompts backed
   by VS Code secret storage.
5. **Dead inputs.** An `inputs` entry that no server references. Remove it so nobody is
   prompted for a credential that does nothing.
6. **Unverified publisher for high-privilege access.** A stdio server with access to live
   business data, financial systems, or write-capable APIs, published under an individual or
   unofficial npm/PyPI account rather than the vendor's own namespace — call this out even
   when the underlying source it fetches/builds is legitimate.
7. **Remote `http` servers.** Query/prompt text sent to that host leaves the machine. Only
   flag this as a risk when the host is not a known, trusted first-party endpoint.

## Not risks by themselves

- General-purpose local tools (browser automation, filesystem, shell/process execution) —
  their risk is entirely about what the agent is told to do with them, not the `mcp.json`
  entry that launches them.
- A pinned, well-known vendor package with an already-least-privilege scope.

## What to do when you find one

Report the specific issue, not a vague "review carefully," and propose the concrete fix:
pin a version, change the default env value, narrow the scope, move a secret to `inputs`,
or delete a dead input.
