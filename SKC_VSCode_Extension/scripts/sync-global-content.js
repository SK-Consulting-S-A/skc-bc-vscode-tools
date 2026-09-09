#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");
const { applyBcQualityIntegration } = require("./bcquality-integration");

const EXCLUDED_NAMES = new Set([".git", "node_modules", "__pycache__"]);
const BCQUALITY_SKILL_NAME = "bcquality";
const RENAMED_TOOL_IDS = new Map([
    ["memory", "vscode/memory"],
    ["al_build", "ms-dynamics-smb.al/al_build"],
    ["al_publish", "ms-dynamics-smb.al/al_publish"],
    ["al_symbolsearch", "ms-dynamics-smb.al/al_symbolsearch"],
    ["al_debug", "ms-dynamics-smb.al/al_debug"],
    ["al_setbreakpoint", "ms-dynamics-smb.al/al_setbreakpoint"],
    ["al_snapshotdebugging", "ms-dynamics-smb.al/al_snapshotdebugging"],
    ["al_downloadsymbols", "ms-dynamics-smb.al/al_downloadsymbols"],
    ["al_getdiagnostics", "ms-dynamics-smb.al/al_get_diagnostics"],
]);

function copyDirectory(source, target) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
        if (EXCLUDED_NAMES.has(entry.name) || entry.name.endsWith(".pyc")) {
            continue;
        }

        const sourcePath = path.join(source, entry.name);
        const targetPath = path.join(target, entry.name);
        if (entry.isDirectory()) {
            copyDirectory(sourcePath, targetPath);
        } else if (entry.isFile()) {
            fs.copyFileSync(sourcePath, targetPath);
        }
    }
}

function replaceDirectory(source, target) {
    fs.rmSync(target, { recursive: true, force: true });
    copyDirectory(source, target);
}

function normalizeAgentFrontmatter(filePath) {
    const original = fs.readFileSync(filePath, "utf8");
    const lines = original.split(/\r?\n/);
    if (lines[0]?.trim() !== "---") {
        return;
    }

    const metadataKeys = /^(name|description|model|tools|agents|argument-hint):/;
    let contentStart = 1;
    while (contentStart < lines.length) {
        const line = lines[contentStart];
        if (line.trim() === "---") {
            writeNormalizedAgent(filePath, lines.join("\n"));
            return;
        }
        if (!line.trim()) {
            lines.splice(contentStart, 0, "---");
            writeNormalizedAgent(filePath, lines.join("\n"));
            return;
        }
        if (metadataKeys.test(line.trim()) || /^\s+-\s/.test(line)) {
            contentStart++;
            continue;
        }
        break;
    }

    lines.splice(contentStart, 0, "---");
    writeNormalizedAgent(filePath, lines.join("\n"));
}

function writeNormalizedAgent(filePath, content) {
    const normalized = content.replace(/^(\s*tools:\s*\[)([^\]\r\n]*)(\]\s*)$/m, (match, prefix, tools, suffix) => {
        const renamedTools = tools.split(",").map((tool) => {
            const trimmed = tool.trim();
            const identifier = trimmed.replace(/^['"]|['"]$/g, "");
            const renamed = RENAMED_TOOL_IDS.get(identifier);
            return renamed ? `"${renamed}"` : trimmed;
        });
        return `${prefix}${renamedTools.join(", ")}${suffix}`;
    });
    fs.writeFileSync(filePath, normalized, "utf8");
}

function resolveArguments() {
    const args = process.argv.slice(2);
    const sourceArg = valueAfter(args, "--source");
    const targetArg = valueAfter(args, "--target");
    const sourceRoot = path.resolve(
        sourceArg || process.env.SKC_COPILOT_ROOT || path.join(os.homedir(), ".copilot")
    );
    const targetRoot = path.resolve(targetArg || path.join(__dirname, ".."));
    return { sourceRoot, targetRoot };
}

function valueAfter(args, flag) {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
}

function syncSkills(sourceRoot, targetRoot) {
    const sourceSkills = path.join(sourceRoot, "skills");
    const targetSkills = path.join(targetRoot, "skills");
    if (!fs.existsSync(sourceSkills)) {
        console.warn(`[SKC] Global skills source not found at ${sourceSkills}; keeping checked-in skills (offline fallback).`);
        return 0;
    }

    fs.mkdirSync(targetSkills, { recursive: true });
    const skillDirectories = fs.readdirSync(sourceSkills, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !EXCLUDED_NAMES.has(entry.name) && entry.name !== BCQUALITY_SKILL_NAME)
        .sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of skillDirectories) {
        replaceDirectory(
            path.join(sourceSkills, entry.name),
            path.join(targetSkills, entry.name)
        );
    }

    console.log(`[SKC] Synchronized ${skillDirectories.length} global skill bundle(s) from ${sourceSkills}.`);
    return skillDirectories.length;
}

function syncAgents(sourceRoot, targetRoot) {
    const sourceAgents = path.join(sourceRoot, "agents");
    const targetAgents = path.join(targetRoot, "agents");
    if (!fs.existsSync(sourceAgents)) {
        console.warn(`[SKC] Global agents source not found at ${sourceAgents}; keeping checked-in agents (offline fallback).`);
        return 0;
    }

    fs.mkdirSync(targetAgents, { recursive: true });
    const agentFiles = fs.readdirSync(sourceAgents, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".agent.md") && entry.name !== "algo-settings.agent.md")
        .sort((left, right) => left.name.localeCompare(right.name));
    const allowedNames = new Set(agentFiles.map((entry) => entry.name));

    for (const entry of fs.readdirSync(targetAgents, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith(".agent.md") && !allowedNames.has(entry.name)) {
            fs.rmSync(path.join(targetAgents, entry.name), { force: true });
        }
    }

    for (const entry of agentFiles) {
        const targetPath = path.join(targetAgents, entry.name);
        fs.copyFileSync(path.join(sourceAgents, entry.name), targetPath);
        normalizeAgentFrontmatter(targetPath);
    }

    console.log(`[SKC] Synchronized ${agentFiles.length} global agent(s), excluding algo-settings.agent.md.`);
    return agentFiles.length;
}

function main() {
    const { sourceRoot, targetRoot } = resolveArguments();
    const skills = syncSkills(sourceRoot, targetRoot);
    const agents = syncAgents(sourceRoot, targetRoot);
    applyBcQualityIntegration(targetRoot);
    console.log(`[SKC] Global content sync complete: ${skills} skill bundle(s), ${agents} agent(s).`);
}

main();