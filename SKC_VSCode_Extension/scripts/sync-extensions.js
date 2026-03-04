#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const presetPath = path.join(root, "presets", "extensions.json");
const packagePath = path.join(root, "package.json");

function readJson(filePath) {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
}

function ensureExtensionsArray(value) {
    return Array.isArray(value) && value.every(
        (item) => typeof item === "string" || (typeof item === "object" && item !== null && typeof item.id === "string")
    );
}

function extractId(entry) {
    return typeof entry === "string" ? entry : entry.id;
}

function main() {
    if (!fs.existsSync(presetPath)) {
        throw new Error(`Preset file not found at ${presetPath}`);
    }

    const preset = readJson(presetPath);
    if (!ensureExtensionsArray(preset.extensions)) {
        throw new Error("presets/extensions.json must contain an 'extensions' array of strings or { id, preRelease? } objects.");
    }

    const extensions = Array.from(new Set(preset.extensions.map(extractId)));

    const pkg = readJson(packagePath);
    pkg.contributes = pkg.contributes ?? {};
    pkg.contributes.extensionDependencies = extensions;
    pkg.contributes.extensionPack = extensions;

    fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
    console.log(`Synced ${extensions.length} extensions into package.json`);
}

main();

