// extaudit - CLI integration tests
import { describe, it } from "node:test";
import assert from "node:assert";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const cliPath = join(process.cwd(), "dist/index.js");
const fixturesDir = join(process.cwd(), "fixtures/example-extensions");

describe("CLI Integration", () => {
  it("shows help when run without arguments", async () => {
    try {
      const { stdout } = await exec("node", [cliPath, "--help"]);
      assert.ok(stdout.includes("extaudit"));
      assert.ok(stdout.includes("scan"));
      assert.ok(stdout.includes("rules"));
      assert.ok(stdout.includes("report"));
    } catch (err) {
      const e = err;
      const output = e.stdout ?? e.stderr ?? "";
      assert.ok(output.includes("extaudit") || output.includes("Usage"));
    }
  });

  it("scan command finds fixture extensions", async () => {
    let stdout = "";
    try {
      const result = await exec("node", [cliPath, "scan", fixturesDir, "--json"]);
      stdout = result.stdout;
    } catch (err) {
      stdout = err.stdout ?? "";
    }
    assert.ok(stdout.length > 10, "Expected JSON output");
    const data = JSON.parse(stdout);
    assert.ok(data.extensions.length >= 4, `Expected at least 4 extensions, got ${data.extensions.length}`);
  });

  it("rules command lists all rules", async () => {
    const { stdout } = await exec("node", [cliPath, "rules"]);
    assert.ok(stdout.includes("permissions"));
    assert.ok(stdout.includes("network"));
    assert.ok(stdout.includes("scripts"));
    assert.ok(stdout.includes("publisher"));
  });

  it("scan with markdown flag produces markdown output", async () => {
    let stdout = "";
    try {
      const result = await exec("node", [cliPath, "scan", fixturesDir, "--markdown"]);
      stdout = result.stdout;
    } catch (err) {
      stdout = err.stdout ?? "";
    }
    assert.ok(stdout.includes("# extaudit Security Report"));
  });
});
