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

    // extensionPack is a top-level manifest field; VS Code ignores it under "contributes".
    // Deliberately not extensionDependencies: those cannot be uninstalled individually,
    // and this extension's code requires none of them.
    delete pkg.extensionDependencies;
    if (pkg.contributes) {
        delete pkg.contributes.extensionDependencies;
        delete pkg.contributes.extensionPack;
    }

    const ordered = {};
    for (const [key, value] of Object.entries(pkg)) {
        if (key === "extensionPack") continue;
        ordered[key] = value;
        if (key === "contributes") ordered.extensionPack = extensions;
    }
    if (!ordered.extensionPack) ordered.extensionPack = extensions;

    fs.writeFileSync(packagePath, `${JSON.stringify(ordered, null, 2)}\n`);
    console.log(`Synced ${extensions.length} extensions into package.json (top-level extensionPack)`);
}

main();

