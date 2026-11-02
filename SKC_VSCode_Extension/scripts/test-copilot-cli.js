#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const http = require("node:http");
const { spawn } = require("node:child_process");
const esbuild = require("esbuild");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StreamableHTTPClientTransport } = require("@modelcontextprotocol/sdk/client/streamableHttp.js");

const projectRoot = path.resolve(__dirname, "..");
const result = esbuild.buildSync({
    stdin: {
        contents: 'export * from "./src/copilotCli"; export * from "./src/copilotCliBridge";',
        resolveDir: projectRoot,
        loader: "ts"
    },
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
const { getCopilotCliHome, convertCopilotCliServers, writeCopilotCliMcpFile, updateCopilotCliBridgeConfig, startCopilotCliBridge } = testModule.exports;

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
            { id: "custom", command: "node", args: ["script.js"], env: { KEY: "${input:apiKey}", SCRIPT_PATH: "${env:SCRIPT_PATH}", MODE: "${MODE:-sandbox}" }, tools: ["read"] },
            { id: "sse", type: "sse", url: "http://localhost:7878/sse", tools: [] },
            { id: "unsupported", type: "http", url: "https://example.com/${command:getUrl}" },
            { id: "workspace", command: "node", args: ["${workspaceFolder}"] },
            { id: "invalid", type: "invalid" },
            { id: "missingCommand", type: "stdio" },
            null,
            { type: "stdio", command: "node" }
        ], log);
        assert.deepEqual(Object.keys(custom), ["custom", "sse"]);
        assert.deepEqual(custom.custom.args, ["script.js"]);
        assert.deepEqual(custom.custom.env, { KEY: "${apiKey}", SCRIPT_PATH: "${SCRIPT_PATH}", MODE: "${MODE:-sandbox}" });
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
        const concurrentHome = path.join(temporaryRoot, "concurrent-home");
        await Promise.all(Array.from({ length: 4 }, (_, index) => new Promise((resolve, reject) => {
            const child = spawn(process.execPath, ["-"], {
                cwd: projectRoot,
                env: { ...process.env, COPILOT_HOME: concurrentHome },
                stdio: ["pipe", "ignore", "pipe"]
            });
            let errors = "";
            child.stderr.on("data", chunk => { errors += chunk.toString(); });
            child.on("error", reject);
            child.on("close", code => code === 0 ? resolve() : reject(new Error(errors)));
            child.stdin.end(result.outputFiles[0].text + `\nmodule.exports.writeCopilotCliMcpFile(process.env.COPILOT_HOME, [{id: "concurrent-${index}", command: "node"}], () => {}).catch(error => { console.error(error); process.exitCode = 1; });`);
        })));
        const concurrentConfig = JSON.parse(await fs.readFile(path.join(concurrentHome, "mcp-config.json"), "utf8"));
        assert.equal(Object.keys(concurrentConfig.mcpServers).length, 4);
        assert.deepEqual(await fs.readdir(concurrentHome), ["mcp-config.json"]);
        if (process.platform !== "win32") {
            const linkedHome = path.join(temporaryRoot, "linked-home");
            const target = path.join(temporaryRoot, "linked-config.json");
            await fs.mkdir(linkedHome);
            await fs.writeFile(target, JSON.stringify({ mcpServers: { personal: { tools: [] } } }));
            await fs.symlink(target, path.join(linkedHome, "mcp-config.json"));
            await writeCopilotCliMcpFile(linkedHome, servers, log);
            assert.equal((await fs.lstat(path.join(linkedHome, "mcp-config.json"))).isSymbolicLink(), true);
            assert.equal(Object.keys(JSON.parse(await fs.readFile(target, "utf8")).mcpServers).length, 7);
        }

        const manifest = JSON.parse(await fs.readFile(path.join(projectRoot, "package.json"), "utf8"));
        const toolkit = JSON.parse(await fs.readFile(path.join(projectRoot, "..", "AL_Workspace_Toolkit", "package.json"), "utf8"));
        let tools = [...manifest.contributes.languageModelTools, ...toolkit.contributes.languageModelTools].map(tool => ({
            name: tool.name, description: tool.modelDescription, inputSchema: tool.inputSchema
        }));
        const invocations = [];
        let invocationStarted;
        let invocationCancelled;
        const bridge = await startCopilotCliBridge({
            listTools: () => tools,
            invokeTool: async (name, input, signal) => {
                assert.equal(signal.aborted, false);
                invocations.push({ name, input });
                if (input.sourceFilePath === "fail") throw new Error("Invocation failed");
                if (input.sourceFilePath === "cancel") {
                    invocationStarted();
                    await new Promise((_resolve, reject) => {
                        signal.addEventListener("abort", () => {
                            invocationCancelled();
                            reject(new Error("Cancelled"));
                        }, { once: true });
                    });
                }
                return [`Invoked ${name}`];
            }
        });
        const client = new Client({ name: "skc-cli-test", version: "1.0.0" });
        try {
            assert.equal(new URL(bridge.url).hostname, "127.0.0.1");
            assert.equal(bridge.token.length, 64);
            const headers = { Authorization: ["Bearer", bridge.token].join(" ") };
            assert.equal((await fetch(bridge.url, { method: "POST" })).status, 401);
            assert.equal((await fetch(bridge.url, { method: "POST", headers: { Authorization: "invalid" } })).status, 401);
            assert.equal((await fetch(bridge.url, { method: "POST", headers: { ...headers, Origin: "https://example.com" } })).status, 403);
            const wrongHostStatus = await new Promise((resolve, reject) => {
                const request = http.request(bridge.url, { method: "POST", headers: { ...headers, Host: "example.com" } }, response => {
                    response.resume();
                    resolve(response.statusCode);
                });
                request.on("error", reject);
                request.end();
            });
            assert.equal(wrongHostStatus, 403);
            assert.equal((await fetch(bridge.url.replace("/mcp", "/other"), { method: "POST", headers })).status, 404);
            assert.equal((await fetch(bridge.url, { headers })).status, 405);
            assert.equal((await fetch(bridge.url, { method: "POST", headers, body: "invalid JSON" })).status, 400);
            assert.equal((await fetch(bridge.url, { method: "POST", headers, body: "x".repeat(65537) })).status, 413);
            assert.equal(invocations.length, 0);

            const bridgeHome = path.join(temporaryRoot, "bridge-home");
            await writeCopilotCliMcpFile(bridgeHome, servers, log);
            await fs.chmod(path.join(bridgeHome, "mcp-config.json"), 0o644);
            await updateCopilotCliBridgeConfig(bridgeHome, bridge.url, bridge.token);
            let bridgeConfig = JSON.parse(await fs.readFile(path.join(bridgeHome, "mcp-config.json"), "utf8"));
            assert.deepEqual(bridgeConfig.mcpServers["skc-vscode-tools"], { type: "http", url: bridge.url, headers, tools: ["*"], timeout: 660000 });
            if (process.platform !== "win32") assert.equal((await fs.stat(path.join(bridgeHome, "mcp-config.json"))).mode & 0o777, 0o600);
            await updateCopilotCliBridgeConfig(bridgeHome, "http://127.0.0.1:1/mcp");
            assert.deepEqual(JSON.parse(await fs.readFile(path.join(bridgeHome, "mcp-config.json"), "utf8")), bridgeConfig);
            await updateCopilotCliBridgeConfig(bridgeHome, bridge.url);
            bridgeConfig = JSON.parse(await fs.readFile(path.join(bridgeHome, "mcp-config.json"), "utf8"));
            assert.deepEqual(bridgeConfig.mcpServers, converted);

            const clientTransport = new StreamableHTTPClientTransport(new URL(bridge.url), { requestInit: { headers } });
            await client.connect(clientTransport);
            assert.deepEqual((await client.listTools()).tools, tools);
            for (const tool of tools) {
                const input = { sourceFilePath: "/tmp/Contoso.g.xlf", filePath: "/tmp/Contoso.al", targetLanguage: "fr-FR" };
                const response = await client.callTool({ name: tool.name, arguments: input });
                assert.deepEqual(response.content, [{ type: "text", text: `Invoked ${tool.name}` }]);
                assert.deepEqual(invocations.at(-1), { name: tool.name, input });
            }
            const failed = await client.callTool({ name: tools[0].name, arguments: { sourceFilePath: "fail" } });
            assert.equal(failed.isError, true);
            for (let index = 0; index < 20; index++) {
                const started = new Promise(resolve => { invocationStarted = resolve; });
                const cancelled = new Promise(resolve => { invocationCancelled = resolve; });
                const cancellation = new AbortController();
                const pending = client.callTool({ name: tools[0].name, arguments: { sourceFilePath: "cancel" } }, undefined, { signal: cancellation.signal });
                await started;
                cancellation.abort();
                await assert.rejects(pending);
                await cancelled;
            }
            const rawStarted = new Promise(resolve => { invocationStarted = resolve; });
            const rawCancelled = new Promise(resolve => { invocationCancelled = resolve; });
            const rawPending = fetch(bridge.url, {
                method: "POST",
                headers: { ...headers, "mcp-session-id": clientTransport.sessionId, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
                body: JSON.stringify({ jsonrpc: "2.0", id: 999, method: "tools/call", params: { name: tools[0].name, arguments: { sourceFilePath: "cancel" } } })
            });
            await rawStarted;
            await client.notification({ method: "notifications/cancelled", params: { requestId: 999 } });
            const rawResponse = await rawPending;
            assert.equal(rawResponse.status, 200);
            assert.match(rawResponse.headers.get("content-type"), /text\/event-stream/);
            const event = (await rawResponse.text()).split("\n").find(line => line.startsWith("data:"));
            assert.deepEqual(JSON.parse(event.slice(5)), { jsonrpc: "2.0", id: 999, error: { code: -32800, message: "Tool invocation cancelled." } });
            await rawCancelled;
            for (let index = 0; index < 20; index++) {
                const reconnect = new Client({ name: "skc-reconnect-test", version: "1.0.0" });
                try {
                    await reconnect.connect(new StreamableHTTPClientTransport(new URL(bridge.url), { requestInit: { headers } }));
                    assert.equal((await reconnect.listTools()).tools.length, tools.length);
                } finally {
                    await reconnect.close();
                }
            }
            const count = invocations.length;
            const rejected = await client.callTool({ name: "unrelated_tool", arguments: {} });
            assert.equal(rejected.isError, true);
            assert.equal(invocations.length, count);
            const previouslyAvailable = tools[0].name;
            tools = [];
            assert.deepEqual((await client.listTools()).tools, []);
            assert.equal((await client.callTool({ name: previouslyAvailable, arguments: {} })).isError, true);
            assert.equal(invocations.length, count);
        } finally {
            await client.close();
            await bridge.dispose();
        }
        await assert.rejects(fetch(bridge.url));

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
