#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const esbuild = require("esbuild");

const projectRoot = path.resolve(__dirname, "..");
const result = esbuild.buildSync({
    entryPoints: [path.join(projectRoot, "src", "copilotCli.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false
});
const testModulePath = path.join(projectRoot, "out", "copilotCli.test.cjs");
const testModule = new Module(testModulePath, module);
testModule.filename = testModulePath;
testModule.paths = Module._nodeModulePaths(projectRoot);
testModule._compile(result.outputFiles[0].text, testModulePath);
const { getCopilotCliHome, convertCopilotCliServers, writeCopilotCliMcpFile } = testModule.exports;

async function main() {
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "skc-copilot-cli-"));
    const previousHome = process.env.COPILOT_HOME;
    try {
        delete process.env.COPILOT_HOME;
        assert.equal(getCopilotCliHome(), path.join(os.homedir(), ".copilot"));
        process.env.COPILOT_HOME = temporaryRoot;
        assert.equal(getCopilotCliHome(), temporaryRoot);

        const preset = JSON.parse(await fs.readFile(path.join(projectRoot, "presets", "mcp.json"), "utf8"));
        const servers = Object.entries(preset.servers).map(([id, server]) => ({ ...server, id }));
        const snapshot = JSON.stringify(servers);
        const logs = [];
        const log = message => logs.push(message);
        const converted = convertCopilotCliServers(servers, log);
        assert.deepEqual(Object.keys(converted), Object.keys(preset.servers));
        for (const [id, server] of Object.entries(preset.servers)) {
            assert.equal(converted[id].type, server.type === "stdio" ? "local" : server.type);
            assert.deepEqual(converted[id].tools, ["*"]);
            assert.equal(Object.hasOwn(converted[id], "id"), false);
            if (server.command) {
                assert.equal(converted[id].command, server.command);
                assert.deepEqual(converted[id].args, server.args);
            } else {
                assert.equal(converted[id].url, server.url);
            }
        }
        assert.deepEqual(converted.businesscentral.headers, {
            TenantId: "${bcTenantId}",
            EnvironmentName: "${bcEnvironmentName}",
            Company: "${bcCompany}",
            ConfigurationName: ""
        });
        assert.equal(JSON.stringify(servers), snapshot);
        assert.equal(logs.length, 0);

        const custom = convertCopilotCliServers([
            { id: "custom", command: "node", args: ["${env:SCRIPT_PATH}"], env: { KEY: "${input:apiKey}", MODE: "${MODE:-sandbox}" }, tools: ["read"] },
            { id: "sse", type: "sse", url: "http://localhost:7878/sse", tools: [] },
            { id: "unsupported", type: "http", url: "https://example.com/${command:getUrl}" },
            { id: "workspace", command: "node", args: ["${workspaceFolder}"] },
            { id: "invalid", type: "invalid" },
            { id: "missingCommand", type: "stdio" },
            null,
            { type: "stdio", command: "node" }
        ], log);
        assert.deepEqual(Object.keys(custom), ["custom", "sse"]);
        assert.deepEqual(custom.custom.args, ["${SCRIPT_PATH}"]);
        assert.deepEqual(custom.custom.env, { KEY: "${apiKey}", MODE: "${MODE:-sandbox}" });
        assert.deepEqual(custom.custom.tools, ["read"]);
        assert.deepEqual(custom.sse.tools, []);
        assert.equal(logs.length, 4);
        assert.equal(logs.some(message => message.includes("apiKey")), false);
        assert.deepEqual(convertCopilotCliServers([{ id: "noArgs", command: "node" }], log).noArgs.args, []);
        assert.equal(Object.hasOwn(convertCopilotCliServers([{ id: "__proto__", command: "node" }], log), "__proto__"), true);

        const copilotHome = path.join(temporaryRoot, "new-home");
        const filePath = path.join(copilotHome, "mcp-config.json");
        await writeCopilotCliMcpFile(copilotHome, servers, log);
        assert.deepEqual(JSON.parse(await fs.readFile(filePath, "utf8")), { mcpServers: converted });
        if (process.platform !== "win32") {
            assert.equal((await fs.stat(filePath)).mode & 0o777, 0o600);
        }

        const existing = {
            customMetadata: { keep: true },
            mcpServers: {
                playwright: { ...converted.playwright, tools: ["browser_snapshot"], disabled: true },
                personal: { type: "http", url: "https://example.com/mcp", tools: [] }
            }
        };
        await fs.writeFile(filePath, JSON.stringify(existing));
        await writeCopilotCliMcpFile(copilotHome, servers, log);
        const merged = JSON.parse(await fs.readFile(filePath, "utf8"));
        assert.deepEqual(merged.customMetadata, existing.customMetadata);
        assert.deepEqual(merged.mcpServers, { ...converted, ...existing.mcpServers });
        const firstWrite = await fs.readFile(filePath, "utf8");
        await writeCopilotCliMcpFile(copilotHome, servers, log);
        assert.equal(await fs.readFile(filePath, "utf8"), firstWrite);

        for (const invalid of ["{ broken JSON", "null", "[]", '{"mcpServers":[]}', '{"mcpServers":null}']) {
            await fs.writeFile(filePath, invalid);
            await assert.rejects(writeCopilotCliMcpFile(copilotHome, servers, log), /existing file left unchanged/);
            assert.equal(await fs.readFile(filePath, "utf8"), invalid);
        }
        const directoryPath = path.join(temporaryRoot, "directory-config");
        await fs.mkdir(path.join(directoryPath, "mcp-config.json"), { recursive: true });
        await assert.rejects(writeCopilotCliMcpFile(directoryPath, servers, log), /existing file left unchanged/);
        const blockedHome = path.join(temporaryRoot, "file-not-directory");
        await fs.writeFile(blockedHome, "");
        await assert.rejects(writeCopilotCliMcpFile(blockedHome, servers, log));

        console.log("Copilot CLI configuration tests passed.");
    } finally {
        if (previousHome === undefined) delete process.env.COPILOT_HOME;
        else process.env.COPILOT_HOME = previousHome;
        await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
