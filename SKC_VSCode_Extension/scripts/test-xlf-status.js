#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");
const esbuild = require("esbuild");

const projectRoot = path.resolve(__dirname, "..");
const entryPoint = path.join(projectRoot, "src", "xlfStatus.ts");
const result = esbuild.buildSync({
    entryPoints: [entryPoint],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false
});

const testModulePath = path.join(projectRoot, "out", "xlfStatus.test.cjs");
const testModule = new Module(testModulePath, module);
testModule.filename = testModulePath;
testModule.paths = Module._nodeModulePaths(projectRoot);
testModule._compile(result.outputFiles[0].text, testModulePath);
const status = testModule.exports;

const nested = status.getTranslationUnitStatus(
    '<source>Hello</source><target state="translated"><g id="1">Bonjour &amp; monde</g></target>'
);
assert.equal(nested.targetText, "Bonjour & monde");
assert.equal(nested.isTranslated, true);

const pending = status.getTranslationUnitStatus(
    "<source>Hello</source><target><![CDATA[[NAB: NEEDS TRANSLATION]]]></target>"
);
assert.equal(pending.hasPlaceholder, true);
assert.equal(pending.isTranslated, false);

assert.equal(status.hasTranslatableSource("<source><g>Visible text</g></source>"), true);
assert.equal(status.hasTranslatableSource('<source><g id="1"></g></source>'), false);

console.log("XLF status tests passed.");
