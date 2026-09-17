#!/usr/bin/env node
"use strict";

// Deletes specific published versions from the Visual Studio Marketplace.
//
// The publisher portal can do this by hand (More Actions > Reports > Manage >
// Delete this version), but only for an account that is a member of the
// publisher. This script uses the same VSCE_PAT that publishes releases, so it
// works from CI without anyone needing portal access.
//
// Deletion is irreversible and the version number cannot be published again.
//
// Usage:
//   node scripts/delete-marketplace-versions.js --versions 3.0.0,3.0.1
//   node scripts/delete-marketplace-versions.js --versions 3.0.0 --confirm DELETE
//
// Without --confirm DELETE it only reports what it would do.

const path = require("path");

const GALLERY = "https://marketplace.visualstudio.com";
const API_VERSION = "7.2-preview.2";

const pkg = require(path.resolve(__dirname, "..", "package.json"));
const publisher = pkg.publisher;
const extension = pkg.name;

function parseArgs(argv) {
    const args = { versions: [], confirm: "" };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--versions") {
            args.versions = String(argv[++i] || "")
                .split(",")
                .map(v => v.trim())
                .filter(Boolean);
        } else if (argv[i] === "--confirm") {
            args.confirm = String(argv[++i] || "").trim();
        }
    }
    return args;
}

function authHeader(pat) {
    // vsce authenticates the gallery API as Basic OAuth:<pat>.
    return "Basic " + Buffer.from(`OAuth:${pat}`).toString("base64");
}

async function listPublishedVersions() {
    const response = await fetch(`${GALLERY}/_apis/public/gallery/extensionquery?api-version=3.0-preview.1`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json;api-version=3.0-preview.1" },
        body: JSON.stringify({
            filters: [{ criteria: [{ filterType: 7, value: `${publisher}.${extension}` }], pageNumber: 1, pageSize: 1 }],
            flags: 2151,
        }),
    });
    if (!response.ok) {
        throw new Error(`Could not read the Marketplace listing (HTTP ${response.status}).`);
    }
    const body = await response.json();
    const found = body.results?.[0]?.extensions?.[0];
    if (!found) {
        throw new Error(`${publisher}.${extension} was not found on the Marketplace.`);
    }
    // The gallery returns versions newest first.
    return found.versions.map(v => v.version);
}

async function deleteVersion(version, pat) {
    const url = `${GALLERY}/_apis/gallery/publishers/${publisher}/extensions/${extension}`
        + `?version=${encodeURIComponent(version)}&api-version=${API_VERSION}`;
    const response = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: authHeader(pat), Accept: `application/json;api-version=${API_VERSION}` },
    });
    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status} ${response.statusText}${text ? ` - ${text.slice(0, 300)}` : ""}`);
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const pat = process.env.VSCE_PAT || process.env.VSCODE_MARKETPLACE_TOKEN || "";

    if (args.versions.length === 0) {
        throw new Error("Pass --versions with a comma-separated list, for example --versions 3.0.0,3.0.1");
    }
    if (!pat) {
        throw new Error("No token. Set VSCE_PAT (in CI it comes from the repository secret).");
    }

    const published = await listPublishedVersions();
    const latest = published[0];

    console.log(`Extension : ${publisher}.${extension}`);
    console.log(`Published : ${published.length} versions, latest is ${latest}`);
    console.log(`Requested : ${args.versions.join(", ")}`);
    console.log("");

    // The latest version is what every new install resolves to. Deleting it
    // would silently promote an older build, which in this repo's history is
    // exactly the accident being cleaned up.
    if (args.versions.includes(latest)) {
        throw new Error(
            `Refusing to delete ${latest}: it is the current latest version. Publish a newer ` +
            `version first, so that installs do not fall back to an older build.`
        );
    }

    const unknown = args.versions.filter(v => !published.includes(v));
    if (unknown.length > 0) {
        throw new Error(`Not published, so nothing to delete: ${unknown.join(", ")}`);
    }

    if (args.confirm !== "DELETE") {
        console.log("Dry run. Nothing was deleted.");
        console.log(`Would delete ${args.versions.length} version(s): ${args.versions.join(", ")}`);
        console.log("Re-run with --confirm DELETE to proceed. This cannot be undone.");
        return;
    }

    let failed = 0;
    for (const version of args.versions) {
        try {
            await deleteVersion(version, pat);
            console.log(`  deleted ${version}`);
        } catch (error) {
            failed++;
            console.error(`  FAILED  ${version}: ${error.message}`);
        }
    }

    console.log("");
    const remaining = await listPublishedVersions();
    console.log(`Remaining versions (${remaining.length}): ${remaining.join(", ")}`);

    const stillThere = args.versions.filter(v => remaining.includes(v));
    if (stillThere.length > 0) {
        throw new Error(`Still published after the attempt: ${stillThere.join(", ")}`);
    }
    if (failed > 0) {
        throw new Error(`${failed} deletion(s) reported an error.`);
    }
    console.log("All requested versions are gone.");
}

main().catch(error => {
    console.error(`\n[Marketplace] ${error.message}`);
    process.exitCode = 1;
});
