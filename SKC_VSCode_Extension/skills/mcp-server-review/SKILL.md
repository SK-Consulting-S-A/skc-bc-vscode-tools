---
name: mcp-server-review
description: "Review a Model Context Protocol (MCP) server entry or config file (mcp.json, .vscode/mcp.json, presets/mcp.json, claude_desktop_config.json, Cursor mcpServers, etc.) for config-level privacy/security risk before it is added, merged, or approved. Distinguishes inherent config risk (unpinned versions, unsafe live/production defaults, overly broad scopes, plaintext secrets, dead inputs, unverified publishers for high-privilege access) from capability that is only risky depending on how the agent is later told to use it (browser automation, filesystem, shell). Use when asked to add a new MCP server, review/audit an mcp.json, assess MCP data privacy or security, or when a PR/change touches an MCP config file."
---

# MCP Server Review

Judge an MCP server entry by what the **configuration** does, not by what category of tool
it is. A browser-automation or filesystem server is not inherently risky — the risk is in
what the agent is told to do with it later. Only flag what the entry itself gets wrong.

## Review checklist

For every server object in the config, check:

| # | Check | Bad example | Good example |
|---|---|---|---|
| 1 | Version pin (for `stdio` servers reached via `npx`/`uvx`/`pipx`, especially ones touching sensitive/live data) | `"args": ["-y", "@vendor/tool@latest"]` | `"args": ["-y", "@vendor/tool@1.4.2"]` |
| 2 | Safe default environment/dataset | `"BC_ENVIRONMENT": "Production"` shipped as the default in a shared preset | `"BC_ENVIRONMENT": "Sandbox"`, or no default (forces the user to choose) |
| 3 | Least-privilege scope | App registration/API scope grants `*.ReadWrite.All` when only reads happen | Scope limited to the specific read (or write) operation actually used |
| 4 | No plaintext secrets in `env` | `"env": { "API_KEY": "sk-abc123..." }` | `"env": { "API_KEY": "${input:apiKey}" }` with a matching `inputs` entry (`password: true`) |
| 5 | No dead `inputs` | An `inputs` entry with an `id` no server's `${input:...}` references | Every `inputs` entry is referenced by at least one server |
| 6 | Publisher trust matches privilege | A finance/ERP/customer-data proxy published under a random individual npm/PyPI account | Vendor's own npm/PyPI scope, or a package whose install step visibly fetches the vendor's official source (verify by reading its `install`/`postinstall` script) |
| 7 | Remote (`http`/`sse`) endpoint trust | `url` points at an unfamiliar third-party domain | `url` points at a known first-party or already-vetted internal endpoint |

## Not risks by themselves

Do not flag these unless a specific check above also fails:
- Local `stdio` servers for browser automation, filesystem access, shell/process execution,
  or document conversion — general capability, not a config defect.
- A pinned, vendor-published package requesting only the scope it needs.

## How to investigate an unfamiliar package before approving it

1. Read the package's own README/`install` or `postinstall` script if available in the
   workspace or via the registry page — confirm what it downloads/builds and from where.
2. Check the npm/PyPI publisher account name against the actual vendor (e.g. does a
   "Business Central" integration come from `microsoft`-owned source, even if wrapped by a
   third-party npm user?). Note the wrapper's trust level explicitly either way.
3. Check the OAuth/API scopes or permissions the tool's docs say it requires, and compare
   against what the workflow actually needs.

## Reporting format

Report findings as a short table (server, issue, concrete fix) or inline bullets — not a
vague "looks fine, review carefully." Every flagged item must name the specific field/value
that's wrong and the specific fix (pin version X, change default to Y, narrow scope to Z,
move secret to `inputs`, delete unused input).
