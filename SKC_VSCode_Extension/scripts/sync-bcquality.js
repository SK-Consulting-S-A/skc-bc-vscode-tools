#!/usr/bin/env node
const fs = require("fs");
const https = require("https");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const REQUIRED_FILES = [
    "plugin.json",
    "knowledge-index.json",
    "skills/entry.md",
    "skills/read.md",
    "skills/do.md",
    "skills/bcquality-al-review/SKILL.md",
    "tools/Build-KnowledgeIndex.ps1"
];
const REQUIRED_DIRECTORIES = ["microsoft", "community", "custom"];
const EXCLUDED_NAMES = new Set([".git", "node_modules", "__pycache__"]);
const ROOT_ADAPTER_NAME = "SKILL.md";
const ROOT_ADAPTER_CONTENT = `---
name: bcquality
description: Official Microsoft BCQuality review bridge for Business Central AL code quality checks.
---

<!-- SKC BCQuality root adapter -->

# BCQuality

Use the official BCQuality review bridge at
skills/bcquality/skills/bcquality-al-review/SKILL.md. It owns the Entry -> dispatch -> DO
workflow over the vendored Microsoft, community, and custom knowledge layers.

For AL reviews, execute Entry first from skills/bcquality/skills/entry.md with the
available pr-diff or file-path input, then follow the returned dispatch record. Read
the official READ and DO contracts on demand. Preserve exact verified references and
the official DO JSON result; never invent rule IDs or citations.

The complete official plugin root is the directory containing plugin.json. The
bundled root adapter is only a discovery entry point and does not duplicate the
official knowledge catalog.
`;

function parseArguments() {
    const args = process.argv.slice(2);
    return {
        live: args.includes("--live"),
        source: valueAfter(args, "--source"),
        target: valueAfter(args, "--target"),
        ref: valueAfter(args, "--ref") || "main",
        upstreamUrl: valueAfter(args, "--upstream-url")
    };
}

function valueAfter(args, flag) {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
}

function pathExists(filePath) {
    try {
        fs.accessSync(filePath);
        return true;
    } catch {
        return false;
    }
}

function removeDirectory(directoryPath) {
    fs.rmSync(directoryPath, {
        recursive: true,
        force: true,
        maxRetries: 8,
        retryDelay: 150
    });
}

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

function validatePluginRoot(pluginRoot) {
    const missingFiles = REQUIRED_FILES.filter((relativePath) => !pathExists(path.join(pluginRoot, relativePath)));
    const missingDirectories = REQUIRED_DIRECTORIES.filter((relativePath) => {
        try {
            return !fs.statSync(path.join(pluginRoot, relativePath)).isDirectory();
        } catch {
            return true;
        }
    });
    return { valid: missingFiles.length === 0 && missingDirectories.length === 0, missingFiles, missingDirectories };
}

function validateSourceStructure(pluginRoot) {
    const requiredFiles = REQUIRED_FILES.filter((relativePath) => relativePath !== "knowledge-index.json");
    const missingFiles = requiredFiles.filter((relativePath) => !pathExists(path.join(pluginRoot, relativePath)));
    const missingDirectories = REQUIRED_DIRECTORIES.filter((relativePath) => {
        try {
            return !fs.statSync(path.join(pluginRoot, relativePath)).isDirectory();
        } catch {
            return true;
        }
    });
    return { valid: missingFiles.length === 0 && missingDirectories.length === 0, missingFiles, missingDirectories };
}

function describeValidation(pluginRoot, validation) {
    const missing = [...validation.missingFiles, ...validation.missingDirectories.map((item) => `${item}/`)].join(", ");
    return `${pluginRoot}: missing ${missing || "unknown required content"}`;
}

function runKnowledgeIndexBuild(pluginRoot) {
    const scriptPath = path.join(pluginRoot, "tools", "Build-KnowledgeIndex.ps1");
    if (!pathExists(scriptPath)) {
        console.warn(`[BCQuality] Index builder not found at ${scriptPath}; using the installed index.`);
        return false;
    }

    const commands = process.platform === "win32" ? ["pwsh", "powershell"] : ["pwsh"];
    for (const command of commands) {
        const result = spawnSync(command, ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath], {
            cwd: pluginRoot,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"]
        });
        if (result.error?.code === "ENOENT") {
            continue;
        }
        if (result.stdout?.trim()) {
            process.stdout.write(`[BCQuality] ${result.stdout.trim()}\n`);
        }
        if (result.stderr?.trim()) {
            process.stderr.write(`[BCQuality] ${result.stderr.trim()}\n`);
        }
        if (result.status === 0) {
            console.log("[BCQuality] Knowledge index refreshed.");
            return true;
        }
        console.warn(`[BCQuality] Knowledge index refresh failed with ${command}; continuing with the installed index.`);
        return false;
    }

    console.warn("[BCQuality] PowerShell was not available; continuing with the installed index.");
    return false;
}

function createDefaultSourceCandidates(repoRoot) {
    return [
        process.env.SKC_BCQUALITY_SOURCE,
        path.join(os.homedir(), ".vscode-insiders", "agent-plugins", "github.com", "microsoft", "BCQuality"),
        path.join(repoRoot, "skills", "bcquality")
    ].filter(Boolean).map((candidate) => path.resolve(candidate));
}

function findUsableSource(candidates) {
    for (const candidate of candidates) {
        if (validateSourceStructure(candidate).valid) {
            return candidate;
        }
    }
    return undefined;
}

function syncPlugin(source, target) {
    if (path.resolve(source) === path.resolve(target)) {
        return;
    }

    const parent = path.dirname(target);
    fs.mkdirSync(parent, { recursive: true });
    for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name.startsWith(".bcquality-staging-")) {
            removeDirectory(path.join(parent, entry.name));
        }
    }
    const staging = path.join(parent, `.bcquality-staging-${process.pid}`);
    removeDirectory(staging);
    copyDirectory(source, staging);

    const existingAdapter = path.join(target, ROOT_ADAPTER_NAME);
    const adapterContent = pathExists(existingAdapter) ? fs.readFileSync(existingAdapter, "utf8") : undefined;
    removeDirectory(target);
    try {
        fs.renameSync(staging, target);
    } catch (error) {
        if (!error || !["EPERM", "EEXIST", "EXDEV"].includes(error.code)) {
            throw error;
        }
        // Windows antivirus/indexer processes can briefly hold the staging
        // directory open. Copying into a fresh target is slower but safe.
        copyDirectory(staging, target);
        removeDirectory(staging);
    }
    fs.writeFileSync(
        path.join(target, ROOT_ADAPTER_NAME),
        adapterContent?.includes("SKC BCQuality root adapter") ? adapterContent : ROOT_ADAPTER_CONTENT,
        "utf8"
    );
}

function ensureRootAdapter(target) {
    const adapterPath = path.join(target, ROOT_ADAPTER_NAME);
    if (!pathExists(adapterPath) || !fs.readFileSync(adapterPath, "utf8").includes("SKC BCQuality root adapter")) {
        fs.mkdirSync(target, { recursive: true });
        fs.writeFileSync(adapterPath, ROOT_ADAPTER_CONTENT, "utf8");
    }
}

function buildUpstreamUrl(options) {
    return options.upstreamUrl || process.env.SKC_BCQUALITY_UPSTREAM_URL ||
        `https://github.com/microsoft/BCQuality/archive/refs/heads/${encodeURIComponent(options.ref)}.tar.gz`;
}

function download(url, targetPath) {
    return downloadWithRedirects(url, targetPath, 0);
}

function downloadWithRedirects(url, targetPath, redirectCount) {
    return new Promise((resolve, reject) => {
        const configuredTimeout = Number(process.env.SKC_BCQUALITY_DOWNLOAD_TIMEOUT_MS);
        const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
            ? configuredTimeout
            : 30000;
        const maxRedirects = 5;
        const client = url.startsWith("http:") ? http : https;
        const request = client.get(url, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                response.resume();
                if (redirectCount >= maxRedirects) {
                    reject(new Error(`Too many redirects while downloading ${url}`));
                    return;
                }
                downloadWithRedirects(
                    new URL(response.headers.location, url).toString(),
                    targetPath,
                    redirectCount + 1
                ).then(resolve, reject);
                return;
            }
            if (response.statusCode !== 200) {
                response.resume();
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }

            const output = fs.createWriteStream(targetPath);
            response.pipe(output);
            output.on("finish", () => output.close(resolve));
            output.on("error", reject);
            response.on("error", reject);
        });
        request.setTimeout(timeoutMs, () => {
            request.destroy(new Error(`Download timed out after ${timeoutMs} ms`));
        });
        request.on("error", reject);
    });
}

async function fetchUpstream(url) {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "skc-bcquality-"));
    const archivePath = path.join(tempRoot, "bcquality.tar.gz");
    await download(url, archivePath);
    const extraction = spawnSync("tar", ["-xzf", archivePath, "-C", tempRoot], { encoding: "utf8" });
    if (extraction.error || extraction.status !== 0) {
        throw new Error(`Unable to extract upstream archive with tar: ${extraction.stderr || extraction.error?.message || "unknown error"}`);
    }

    const extractedDirectory = fs.readdirSync(tempRoot, { withFileTypes: true })
        .find((entry) => entry.isDirectory())?.name;
    if (!extractedDirectory) {
        throw new Error("Upstream archive did not contain a plugin directory.");
    }
    return { root: path.join(tempRoot, extractedDirectory), tempRoot };
}

function cleanTemp(tempRoot) {
    if (tempRoot) {
        removeDirectory(tempRoot);
    }
}

async function main() {
    const options = parseArguments();
    const repoRoot = path.resolve(__dirname, "..");
    const target = path.resolve(options.target || path.join(repoRoot, "skills", "bcquality"));
    const explicitSource = options.source ? path.resolve(options.source) : undefined;
    let source = explicitSource || findUsableSource(createDefaultSourceCandidates(repoRoot));
    let tempRoot;
    ensureRootAdapter(target);

    try {
        if (options.live) {
            const url = buildUpstreamUrl(options);
            console.log(`[BCQuality] Downloading explicit live update from ${url}.`);
            try {
                const upstream = await fetchUpstream(url);
                source = upstream.root;
                tempRoot = upstream.tempRoot;
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.warn(`[BCQuality] Live update failed: ${message}`);
                const targetValidation = validatePluginRoot(target);
                let sourceValidation = source ? validatePluginRoot(source) : undefined;
                if (source && sourceValidation && !sourceValidation.valid) {
                    // A source checkout can be valid before its generated index exists.
                    // Build it before deciding whether it is suitable as an offline seed.
                    runKnowledgeIndexBuild(source);
                    sourceValidation = validatePluginRoot(source);
                }
                if (!targetValidation.valid && source && sourceValidation?.valid) {
                    // A fresh installation may have no usable global snapshot yet. Seed it
                    // from the bundled source instead of reporting a successful fallback
                    // while leaving only the adapter behind.
                    runKnowledgeIndexBuild(source);
                    syncPlugin(source, target);
                }
                const fallback = validatePluginRoot(target).valid
                    ? target
                    : (source && sourceValidation?.valid ? source : undefined);
                if (!fallback) {
                    throw new Error("Live update failed and no valid offline BCQuality snapshot is available.");
                }
                runKnowledgeIndexBuild(fallback);
                const validation = validatePluginRoot(fallback);
                if (!validation.valid) {
                    throw new Error(describeValidation(fallback, validation));
                }
                console.log("BCQUALITY_SYNC_STATUS=fallback");
                return;
            }
        }

        const sourceStructure = source ? validateSourceStructure(source) : undefined;
        if (!source || !sourceStructure?.valid) {
            const validation = source ? sourceStructure : undefined;
            if (validatePluginRoot(target).valid) {
                console.warn(`[BCQuality] No valid source snapshot found${validation ? ` (${describeValidation(source, validation)})` : ""}; keeping ${target} (offline fallback).`);
                runKnowledgeIndexBuild(target);
                console.log("BCQUALITY_SYNC_STATUS=fallback");
                return;
            }
            throw new Error(validation ? describeValidation(source, validation) : "No BCQuality source snapshot was found.");
        }

        runKnowledgeIndexBuild(source);
        const sourceValidation = validatePluginRoot(source);
        if (!sourceValidation.valid) {
            throw new Error(describeValidation(source, sourceValidation));
        }
        syncPlugin(source, target);
        const targetValidation = validatePluginRoot(target);
        if (!targetValidation.valid) {
            throw new Error(describeValidation(target, targetValidation));
        }
        console.log(`[BCQuality] Synchronized official plugin snapshot to ${target}.`);
        console.log("BCQUALITY_SYNC_STATUS=updated");
    } finally {
        cleanTemp(tempRoot);
    }
}

main().catch((error) => {
    console.error(`[BCQuality] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
});