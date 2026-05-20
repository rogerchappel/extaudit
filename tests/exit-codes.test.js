// extaudit - CLI integration tests
import { describe, it } from "node:test";
import assert from "node:assert";
import { exec } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const cliPath = join(process.cwd(), "dist/index.js");
const fixturesDir = join(process.cwd(), "fixtures/example-extensions");

describe("CLI scan exit codes", () => {
  it("scan --json returns valid JSON on stdio", async () => {
    let stdout;
    try {
      const result = await execAsync(`node ${cliPath} scan ${fixturesDir} --json`);
      stdout = result.stdout;
    } catch (err) {
      // scan exits with 1 when max score exceeds threshold, but stdout still has JSON
      stdout = err.stdout;
    }
    const data = JSON.parse(stdout);
    assert.ok(Array.isArray(data.extensions));
    assert.ok(typeof data.summary === "object");
    assert.ok("timestamp" in data);
    assert.ok("version" in data);
  });

  it("scan with non-existent directory exits non-zero", async () => {
    let caught = false;
    try {
      await execAsync(`node ${cliPath} scan /nonexistent/path`);
    } catch (err) {
      caught = true;
      assert.ok(err.code !== 0, "Should exit non-zero for no extensions found");
    }
    assert.ok(caught, "Expected command to fail");
  });
});
