#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bcquality-sync-test-"));
const extensionRoot = path.join(tempRoot, "extension");
const scripts = path.join(extensionRoot, "scripts");
const fakeHome = path.join(tempRoot, "home");
const bundled = path.join(extensionRoot, "skills", "bcquality");
const installed = path.join(fakeHome, ".vscode-insiders", "agent-plugins", "github.com", "microsoft", "BCQuality");

function createSnapshot(root, marker) {
    for (const file of [
        "plugin.json", "knowledge-index.json", "skills/entry.md", "skills/read.md",
        "skills/do.md", "skills/al-code-review/SKILL.md", "tools/Build-KnowledgeIndex.ps1", marker
    ]) {
        const destination = path.join(root, file);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, "");
    }
    for (const directory of ["microsoft", "community", "custom"]) {
        fs.mkdirSync(path.join(root, directory), { recursive: true });
    }
}

function runSync() {
    const env = { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome };
    delete env.SKC_BCQUALITY_SOURCE;
    return spawnSync(process.execPath, [path.join(scripts, "sync-bcquality.js")], {
        cwd: extensionRoot, env, encoding: "utf8"
    });
}

try {
    fs.mkdirSync(scripts, { recursive: true });
    for (const file of ["sync-bcquality.js", "bcquality-integration.js"]) {
        fs.copyFileSync(path.join(__dirname, file), path.join(scripts, file));
    }
    createSnapshot(installed, "home-only.txt");

    const missing = runSync();
    assert.equal(missing.status, 1, missing.stderr);
    assert.match(missing.stderr, /No BCQuality source snapshot was found/);
    assert.equal(fs.existsSync(path.join(bundled, "home-only.txt")), false);

    createSnapshot(bundled, "bundled-only.txt");
    const available = runSync();
    assert.equal(available.status, 0, available.stderr);
    assert.match(available.stdout, /BCQUALITY_SYNC_STATUS=updated/);
    assert.equal(fs.existsSync(path.join(bundled, "bundled-only.txt")), true);
    assert.equal(fs.existsSync(path.join(bundled, "home-only.txt")), false);
    console.log("BCQuality sync tests passed.");
} finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
}
