---
name: bcquality-code-review
description: Apply the BCQuality review workflow to Business Central AL pull requests, changed AL files, or AL app folders. Use this skill for AL code reviews.
---

# BCQuality code review

This review skill bundles the official Microsoft BCQuality plugin at version 1.10.0 (source commit `b58d29b1c1a2af993bfa90009daf74a2376f7905`). The plugin root is this directory, which contains `plugin.json`.

For an AL pull request, use the actual PR diff as the `pr-diff` input. Follow `skills/al-code-review/SKILL.md` exactly: it is the official host adapter and delegates routing to `skills/entry.md`. Resolve all plugin-relative paths from this skill directory, not from the reviewed repository's working directory.

Run Entry before reviewing and follow its returned dispatch record. Read the official READ and DO contracts on demand. Preserve verified references and the official DO JSON result; do not invent rule IDs, findings, or citations.

Do not treat this skill as a substitute for running AL-Go builds or tests.
