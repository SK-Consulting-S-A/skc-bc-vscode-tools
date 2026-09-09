#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const START_MARKER = "<!-- SKC BCQUALITY INTEGRATION: START -->";
const END_MARKER = "<!-- SKC BCQUALITY INTEGRATION: END -->";

const reviewerSection = `${START_MARKER}
## BCQuality Review Integration

For every AL review that has a pr-diff or file-path input, use the bundled official BCQuality bridge in addition to this agent's normal checklist. Resolve PLUGIN_ROOT to the directory containing plugin.json; after installation that is normally ~/.copilot/skills/bcquality.

1. Best-effort refresh PLUGIN_ROOT/tools/Build-KnowledgeIndex.ps1 with PowerShell. If PowerShell or index generation is unavailable, continue with the installed index or path-based discovery and record that limitation.
2. Read and execute PLUGIN_ROOT/skills/entry.md first with a task context containing the review goal, the available input (pr-diff or file-path), and technologies: [al]. Use BCQUALITY_ENABLED_LAYERS when present; otherwise enable microsoft, community, and custom.
3. Follow the returned dispatch record. Read skills/read.md and skills/do.md on demand, then execute the dispatched action skill(s), including the Source → Relevance → Worklist → Action sequence. Prefer isolated child contexts for composed review leaves when available.
4. Preserve the official DO JSON contract exactly, including outcome, findings, references, per-finding confidence, and suppressed. Return a no-match or failed dispatch record unchanged.
5. Apply the reference-integrity gate: a knowledge-backed reference must exist in PLUGIN_ROOT, be opened in full, and be copied verbatim. Never invent article paths, rule IDs, or citations. Treat BCQuality as additive: retain independent reviewer findings with from-sub-skill: "agent" and empty references.

Use the BCQuality result as a distinct evidence-backed artifact in the final review, then report compilation, analyzer, security, and AppSource findings normally. When the bridge runs, keep two contracts separate: the BCQuality action result is one strict JSON document with no Markdown fences or trailing commentary, while independent reviewer findings use the legacy human-readable format. Never merge prose headings into the BCQuality JSON or rewrite its fields. If the host only accepts one response, encode independent observations as contract-compliant agent findings (id prefixed with agent:, references: [], confidence: medium or lower, severity: minor or lower) instead of appending prose to the JSON.
${END_MARKER}`;

const orchestrationSection = `${START_MARKER}
## BCQuality Review Gate

The Review phase must invoke bc-reviewer with the actual pr-diff or file-path inputs and require the official BCQuality bridge at skills/bcquality/skills/al-code-review/SKILL.md (the installed plugin root is the directory containing plugin.json). The reviewer must refresh the knowledge index best-effort, execute Entry before any dispatched action skill, and return the official DO JSON contract unchanged. Orchestration must preserve exact verified references, keep no-match/failed dispatch records visible, and never accept fabricated citations. BCQuality findings are additive to the normal compiler, analyzer, security, AppSource, and dashboard-specialist review.
${END_MARKER}`;

const skillSection = `${START_MARKER}
## BCQuality Review Integration

During the Review phase, route AL pr-diff and file-path reviews through the official vendored bridge at skills/bcquality/skills/al-code-review/SKILL.md. The bridge owns Entry → dispatch → DO JSON semantics; this orchestration skill must not duplicate its knowledge catalog. Keep index refresh best-effort, preserve exact verified references, and treat no-match or failed dispatch records as explicit outcomes. Continue to use the existing AL build, analyzer, security, AppSource, and dashboard review checks alongside BCQuality.
${END_MARKER}`;

const ruleSection = `${START_MARKER}
### BCQuality review contract

For the review phase, pass the concrete pr-diff or file-path input to bc-reviewer and require the official BCQuality bridge to run Entry first from the plugin root containing plugin.json. The bridge may refresh tools/Build-KnowledgeIndex.ps1 best-effort, then dispatch action skills. Preserve the DO JSON result (outcome, findings, references, confidence, suppressed) without reshaping it; every reference must be verified from an opened file in the installed tree. A no-match or failed dispatch record is a visible review outcome, not a reason to fabricate a citation. Keep the dashboard specialist route available for dashboard/control-addin work.
${END_MARKER}`;

function mergeSection(filePath, section, anchors) {
    if (!fs.existsSync(filePath)) {
        return;
    }

    const original = fs.readFileSync(filePath, "utf8");
    const markerPattern = new RegExp(
        `${escapeRegExp(START_MARKER)}[\\s\\S]*?${escapeRegExp(END_MARKER)}\\r?\\n?`,
        "g"
    );
    const withoutOldSection = original.replace(markerPattern, "");
    const anchor = anchors.find((candidate) => withoutOldSection.includes(candidate));
    let updated;
    if (anchor) {
        const anchorIndex = withoutOldSection.indexOf(anchor);
        const prefix = withoutOldSection.slice(0, anchorIndex).replace(/\n+$/, "\n\n\n");
        const suffix = withoutOldSection.slice(anchorIndex);
        updated = `${prefix}${section}\n\n${suffix}`;
    } else {
        updated = `${withoutOldSection.trimEnd()}\n\n${section}\n`;
    }

    if (updated !== original) {
        fs.writeFileSync(filePath, updated, "utf8");
    }
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
}

function applyBcQualityIntegration(repoRoot) {
    ensureReviewerCanRefreshIndex(path.join(repoRoot, "agents", "bc-reviewer.agent.md"));
    mergeSection(
        path.join(repoRoot, "agents", "bc-reviewer.agent.md"),
        reviewerSection,
        ["## Review Checklist", "## Output Format"]
    );
    mergeSection(
        path.join(repoRoot, "agents", "bc-orchestration.agent.md"),
        orchestrationSection,
        ["## Orchestration Phases", "## Routing Rules"]
    );
    mergeSection(
        path.join(repoRoot, "skills", "bc-orchestration", "SKILL.md"),
        skillSection,
        ["### Orchestration Phases", "## Error Handling"]
    );
    mergeSection(
        path.join(repoRoot, "skills", "bc-orchestration", "rules", "bc-orchestrator.mdc"),
        ruleSection,
        ["## Individual Task Routing", "## Direct Specialist Access", "## Error Handling"]
    );
}

function ensureReviewerCanRefreshIndex(filePath) {
    if (!fs.existsSync(filePath)) {
        return;
    }

    const original = fs.readFileSync(filePath, "utf8");
    const toolsPattern = /^tools:\s*\[(.*)\]$/m;
    const updated = original.replace(toolsPattern, (line, tools) => {
        if (tools.includes("execute/runInTerminal")) {
            return line;
        }
        return `tools: ["execute/runInTerminal", ${tools}]`;
    });
    if (updated !== original) {
        fs.writeFileSync(filePath, updated, "utf8");
    }
}

module.exports = { applyBcQualityIntegration };