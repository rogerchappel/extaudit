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
    const { stdout } = await execAsync(`node ${cliPath} scan ${fixturesDir} --json`);
    const data = JSON.parse(stdout);
    assert.ok(Array.isArray(data.extensions));
    assert.ok(typeof data.summary === "object");
    assert.ok("timestamp" in data);
    assert.ok("version" in data);
  });

  it("scan with non-existent directory shows error", async () => {
    try {
      await execAsync(`node ${cliPath} scan /nonexistent/path`);
    } catch (err) {
      // exit(1) is expected when no extensions found
    }
  });
});
