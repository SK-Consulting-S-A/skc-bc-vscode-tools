#!/usr/bin/env node
"use strict";

// Gate that runs before the extension is packaged or published.
//
// This repo is public and everything under skills/ is force-included by
// .vscodeignore (`!skills/**`), so any stray bundle is published to the
// Marketplace. A build must therefore fail loudly rather than ship an asset
// nobody reviewed.
//
// Adding a name to PUBLISHABLE_SKILLS or PUBLISHABLE_AGENTS is the point at
// which someone confirms the bundle contains nothing internal: no customer or
// engagement names, no internal hostnames, tenants or groups, and no company
// operational process. Internal material belongs in a private repo.

const fs = require("fs");
const path = require("path");

const extensionRoot = path.resolve(__dirname, "..");

const PUBLISHABLE_SKILLS = new Set([
    "anthropic-skills",
    "applying-brand-guidelines",
    "bc-agent-sdk",
    "bc-control-addin",
    "bc-migration",
    "bc-orchestration",
    "bc-word-layout",
    "bcquality",
    "docx",
    "frontend-slides",
    "loop",
    "mermaid-to-word",
    "pbi-to-bc-dashboard",
    "pptx",
    "ui-ux-pro-max",
    "web-artifacts-builder",
    "xlsx",
]);

const PUBLISHABLE_AGENTS = new Set([
    "al-development.agent.md",
    "bc-agent-sdk.agent.md",
    "bc-al-logic.agent.md",
    "bc-al-ui.agent.md",
    "bc-architect.agent.md",
    "bc-cal-converter.agent.md",
    "bc-control-addin.agent.md",
    "bc-orchestration.agent.md",
    "bc-researcher.agent.md",
    "bc-reviewer.agent.md",
    "bc-tester.agent.md",
    "bc-translator.agent.md",
    "dashboard-addin-specialist.agent.md",
]);

const PUBLISHABLE_INSTRUCTIONS = new Set([
    "skc-context-hygiene.instructions.md",
]);

// Settings that reconfigure the machine of anyone who runs Apply Presets.
// These are workstation preferences, not AL tooling defaults, and shipping them
// silently disables Copilot or weakens the workspace trust prompt.
const FORBIDDEN_SETTING_KEYS = [
    "github.copilot.enable",
    "security.workspace.trust.untrustedFiles",
    "git.confirmSync",
];

const failures = [];

function listDirectories(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
}

function listFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => e.name);
}

function checkAllowlists() {
    for (const name of listDirectories(path.join(extensionRoot, "skills"))) {
        if (!PUBLISHABLE_SKILLS.has(name)) {
            failures.push(
                `skills/${name} is not on the publishable allowlist. Either it is internal ` +
                `and belongs in a private repo, or it has been reviewed and should be added ` +
                `to PUBLISHABLE_SKILLS in scripts/check-publishable.js.`
            );
        }
    }
    for (const name of listFiles(path.join(extensionRoot, "agents"))) {
        if (!name.endsWith(".agent.md")) continue;
        if (!PUBLISHABLE_AGENTS.has(name)) {
            failures.push(
                `agents/${name} is not on the publishable allowlist. See PUBLISHABLE_AGENTS ` +
                `in scripts/check-publishable.js.`
            );
        }
    }
    for (const name of listFiles(path.join(extensionRoot, "instructions"))) {
        if (!name.endsWith(".instructions.md")) continue;
        if (!PUBLISHABLE_INSTRUCTIONS.has(name)) {
            failures.push(
                `instructions/${name} is not on the publishable allowlist. See ` +
                `PUBLISHABLE_INSTRUCTIONS in scripts/check-publishable.js.`
            );
        }
    }
}

function checkNoHomeFolderSync() {
    // A build step that copies from ~/.copilot into the repo is how unreviewed
    // content reached the Marketplace. The repo is the source of truth.
    const scriptsDir = path.join(extensionRoot, "scripts");
    for (const name of listFiles(scriptsDir)) {
        if (/sync.*global|global.*sync/i.test(name)) {
            failures.push(
                `scripts/${name} looks like a home-folder content sync. Content must flow ` +
                `repo to home folder only, never the reverse.`
            );
        }
    }
    const pkgPath = path.join(extensionRoot, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    for (const [scriptName, body] of Object.entries(pkg.scripts || {})) {
        if (/\.copilot|\.cursor/.test(String(body))) {
            failures.push(
                `package.json script "${scriptName}" references a home folder. Build steps ` +
                `must not read from or write to ~/.copilot or ~/.cursor.`
            );
        }
    }
}

function checkPresetSettings() {
    const presetPath = path.join(extensionRoot, "presets", "settings.json");
    if (!fs.existsSync(presetPath)) return;
    const raw = fs.readFileSync(presetPath, "utf8");
    for (const key of FORBIDDEN_SETTING_KEYS) {
        if (raw.includes(`"${key}"`)) {
            failures.push(
                `presets/settings.json sets "${key}". That is a workstation preference, not ` +
                `an AL tooling default, and Apply Presets writes it globally on the user's machine.`
            );
        }
    }
}

// Optional extra patterns, supplied by the environment rather than committed, so
// that the strings being screened for are not themselves published here.
// Provide as newline-separated regular expressions in PUBLISH_DENY_PATTERNS.
function checkEnvSuppliedPatterns() {
    const raw = process.env.PUBLISH_DENY_PATTERNS;
    if (!raw || !raw.trim()) return;

    const patterns = raw.split(/\r?\n/).map((p) => p.trim()).filter(Boolean);
    if (patterns.length === 0) return;

    const roots = ["skills", "agents", "instructions", "presets", "src", "scripts"];
    const files = [];
    for (const root of roots) walk(path.join(extensionRoot, root), files);

    for (const pattern of patterns) {
        let re;
        try {
            re = new RegExp(pattern, "i");
        } catch {
            failures.push(`PUBLISH_DENY_PATTERNS contains an invalid regular expression.`);
            continue;
        }
        for (const file of files) {
            let text;
            try {
                text = fs.readFileSync(file, "utf8");
            } catch {
                continue;
            }
            if (re.test(text)) {
                // Report the location only. Echoing the match would print the
                // screened string into a public build log.
                failures.push(
                    `${path.relative(extensionRoot, file).replace(/\\/g, "/")} matches a ` +
                    `denied pattern from PUBLISH_DENY_PATTERNS.`
                );
            }
        }
    }
}

function walk(dir, out) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, out);
        } else if (/\.(md|json|ts|js|ps1|mdc|txt|yml|yaml)$/i.test(entry.name)) {
            out.push(full);
        }
    }
}

checkAllowlists();
checkNoHomeFolderSync();
checkPresetSettings();
checkEnvSuppliedPatterns();

if (failures.length > 0) {
    console.error("[SKC] Refusing to package or publish. This extension is public.\n");
    for (const f of failures) console.error(`  - ${f}`);
    console.error("");
    process.exit(1);
}

console.log("[SKC] Publish gate passed.");
