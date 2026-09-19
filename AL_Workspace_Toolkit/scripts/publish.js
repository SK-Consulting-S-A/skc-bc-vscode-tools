#!/usr/bin/env node
const { execFileSync } = require("child_process");
const path = require("path");

if (process.env.GITHUB_ACTIONS !== "true" && process.env.CI !== "true") {
  console.error("Publishing from a workstation is disabled. Use the GitHub Actions publish workflow.");
  process.exit(1);
}

if (!process.env.VSCE_PAT) {
  console.error("VSCE_PAT is required.");
  process.exit(1);
}

const root = path.resolve(__dirname, "..");
const vsce = path.join(root, "node_modules", "@vscode", "vsce", "vsce");
execFileSync(process.execPath, [vsce, "publish"], {
  cwd: root,
  env: process.env,
  stdio: "inherit"
});
