#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const settingsPath = path.join(root, "presets", "settings.json");
const packagePath = path.join(root, "package.json");

const FORBIDDEN_EXTENSIONS = new Set([
    "github.vscode-codeql",
    "microsoft-isvexptools.powerplatform-vscode",
    "ms-sarifvscode.sarif-viewer",
]);

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
    if (!fs.existsSync(settingsPath)) {
        throw new Error(`Preset settings file not found at ${settingsPath}`);
    }

    const definitions = readJson(settingsPath);
    if (!ensureExtensionsArray(definitions.extensions)) {
        throw new Error("presets/settings.json must contain an extensions array.");
    }

    const extensionIds = new Set(definitions.extensions.map(extractId));
    for (const id of extensionIds) {
        if (FORBIDDEN_EXTENSIONS.has(id.toLowerCase())) {
            throw new Error(`Forbidden extension in preset extensions: ${id}`);
        }
    }

    const pkg = readJson(packagePath);

    // Extensions are installed into the current (default) profile by SKC: Apply Presets.
    // A manifest extensionPack would force every extension onto every install unconditionally.
    delete pkg.extensionDependencies;
    delete pkg.extensionPack;
    if (pkg.contributes) {
        delete pkg.contributes.extensionDependencies;
        delete pkg.contributes.extensionPack;
    }

    fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
    console.log(`Validated ${extensionIds.size} preset extension(s) for the default profile; package.json has no extensionPack.`);
}

main();

