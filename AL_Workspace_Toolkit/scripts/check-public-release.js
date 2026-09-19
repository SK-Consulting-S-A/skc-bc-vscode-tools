#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const ignoredDirectories = new Set([".git", "node_modules", "out"]);
const ignoredFiles = new Set(["scripts/check-public-release.js"]);
const blockedFileNames = [
  /^\.env(?:\.|$)/i,
  /\.(?:pfx|p12|pem|key|snk)$/i,
  /appsettings\.(?:development|production|local)\.json$/i,
  /secrets?\.(?:json|ya?ml|txt)$/i
];
const textExtensions = new Set([".json", ".js", ".ts", ".md", ".txt", ".yml", ".yaml", ".code-workspace"]);
const blockedContent = [
  { label: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i },
  { label: "bearer token", pattern: /authorization\s*:\s*bearer\s+[a-z0-9._-]{16,}/i },
  { label: "connection-string secret", pattern: /(?:accountkey|sharedaccesskey|client_secret|clientsecret|password)\s*[=:]\s*["']?[^\s"'${}<]{8,}/i },
  { label: "embedded API token", pattern: /(?:api[_-]?key|access[_-]?token)\s*[=:]\s*["'][^"'${}<]{12,}["']/i },
  { label: "local workstation path", pattern: /[a-z]:\\(?:users|tfs)\\/i },
  { label: "tenant or object UUID", pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i }
];

const failures = [];
const files = [];
walk(root, files);

for (const file of files) {
  const relative = path.relative(root, file).replace(/\\/g, "/");
  if (ignoredFiles.has(relative)) {
    continue;
  }
  if (blockedFileNames.some((pattern) => pattern.test(path.basename(file)))) {
    failures.push(`${relative}: blocked sensitive filename`);
    continue;
  }
  if (!textExtensions.has(path.extname(file).toLowerCase())) {
    continue;
  }

  const text = fs.readFileSync(file, "utf8");
  for (const rule of blockedContent) {
    if (rule.pattern.test(text)) {
      failures.push(`${relative}: possible ${rule.label}`);
    }
  }

  const extraPatterns = (process.env.PUBLIC_DENY_PATTERNS || "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  for (const pattern of extraPatterns) {
    if (new RegExp(pattern, "i").test(text)) {
      failures.push(`${relative}: matched an organization-supplied deny pattern`);
    }
  }
}

if (failures.length > 0) {
  console.error("Public release safety check failed:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log(`Public release safety check passed (${files.length} files inspected).`);

function walk(directory, output) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name) || entry.name.endsWith(".vsix")) {
      continue;
    }
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, output);
    } else if (entry.isFile()) {
      output.push(fullPath);
    }
  }
}
