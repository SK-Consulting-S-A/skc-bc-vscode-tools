#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const profilesPath = path.join(root, "presets", "profiles.json");
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
    if (!fs.existsSync(profilesPath)) {
        throw new Error(`Workstation profile file not found at ${profilesPath}`);
    }

    const definitions = readJson(profilesPath);
    if (!ensureExtensionsArray(definitions.sharedExtensions) || !Array.isArray(definitions.profiles)) {
        throw new Error("presets/profiles.json must contain sharedExtensions and profiles arrays.");
    }

    const profileNames = new Set();
    const extensionIds = new Set(definitions.sharedExtensions.map(extractId));
    for (const profile of definitions.profiles) {
        if (!profile || typeof profile.id !== "string" || typeof profile.name !== "string" ||
            typeof profile.description !== "string" || !ensureExtensionsArray(profile.extensions)) {
            throw new Error("presets/profiles.json contains an invalid profile definition.");
        }
        if (profileNames.has(profile.name.toLowerCase())) {
            throw new Error(`Duplicate workstation profile name: ${profile.name}`);
        }
        profileNames.add(profile.name.toLowerCase());
        for (const entry of profile.extensions) extensionIds.add(extractId(entry));
    }
    if (definitions.profiles.length !== 3) {
        throw new Error(`Expected exactly 3 workstation profiles, found ${definitions.profiles.length}.`);
    }
    for (const id of extensionIds) {
        if (FORBIDDEN_EXTENSIONS.has(id.toLowerCase())) {
            throw new Error(`Forbidden extension in workstation profiles: ${id}`);
        }
    }

    const pkg = readJson(packagePath);

    // Profile-specific tools are installed by SKC: Create or Update Workstation Profiles.
    // A manifest extensionPack would install every ecosystem into every profile.
    delete pkg.extensionDependencies;
    delete pkg.extensionPack;
    if (pkg.contributes) {
        delete pkg.contributes.extensionDependencies;
        delete pkg.contributes.extensionPack;
    }

    fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
    console.log(`Validated ${definitions.profiles.length} workstation profiles with ${extensionIds.size} unique extensions; package.json has no extensionPack.`);
}

main();

