---
name: bcquality
description: Official Microsoft BCQuality review bridge for Business Central AL code quality checks.
---

<!-- SKC BCQuality root adapter -->

# BCQuality

Use the official BCQuality review bridge at
skills/bcquality/skills/al-code-review/SKILL.md. It owns the Entry -> dispatch -> DO
workflow over the vendored Microsoft, community, and custom knowledge layers.

For AL reviews, execute Entry first from skills/bcquality/skills/entry.md with the
available pr-diff or file-path input, then follow the returned dispatch record. Read
the official READ and DO contracts on demand. Preserve exact verified references and
the official DO JSON result; never invent rule IDs or citations.

The complete official plugin root is the directory containing plugin.json. The
bundled root adapter is only a discovery entry point and does not duplicate the
official knowledge catalog.
