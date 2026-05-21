// extaudit - Report command tests
import { describe, it } from "node:test";
import assert from "node:assert";
import { exec } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";

const execAsync = promisify(exec);
const cliPath = join(process.cwd(), "dist/index.js");

const sampleScanResult = {
  timestamp: "2026-01-01T00:00:00.000Z",
  version: "0.1.0",
  scannedDirectories: ["/test"],
  totalExtensions: 1,
  extensions: [
    {
      extensionName: "test-ext",
      extensionPath: "/test/test-ext",
      score: 50,
      label: "high",
      findings: [
        {
          ruleId: "scripts-postinstall",
          description: "Has postinstall",
          severity: "critical",
          extensionName: "test-ext",
          extensionPath: "/test/test-ext",
          evidence: ["postinstall: npm rebuild"],
        },
      ],
    },
  ],
  summary: { critical: 1, high: 0, medium: 0, low: 0, info: 0, maxScore: 50, averageScore: 50 },
  appliedRules: ["scripts-postinstall"],
};

describe("Report Command", () => {
  it("converts JSON scan result to markdown", async () => {
    const tmpFile = join(tmpdir(), `extaudit-test-${Date.now()}.json`);
    writeFileSync(tmpFile, JSON.stringify(sampleScanResult));
    try {
      const { stdout } = await execAsync(`node ${cliPath} report ${tmpFile} --format markdown`);
      assert.ok(stdout.includes("# extaudit Security Report"));
      assert.ok(stdout.includes("test-ext"));
      assert.ok(stdout.includes("postinstall"));
    } finally {
      rmSync(tmpFile, { force: true });
    }
  });

  it("re-formats JSON to consistent JSON output", async () => {
    const tmpFile = join(tmpdir(), `extaudit-test-${Date.now()}.json`);
    writeFileSync(tmpFile, JSON.stringify(sampleScanResult));
    try {
      const { stdout } = await execAsync(`node ${cliPath} report ${tmpFile} --format json`);
      const data = JSON.parse(stdout);
      assert.ok(Array.isArray(data.extensions));
      assert.strictEqual(data.totalExtensions, 1);
    } finally {
      rmSync(tmpFile, { force: true });
    }
  });

  it("writes report to output file", async () => {
    const tmpFile = join(tmpdir(), `extaudit-test-${Date.now()}.json`);
    const outFile = join(tmpdir(), `extaudit-output-${Date.now()}.md`);
    writeFileSync(tmpFile, JSON.stringify(sampleScanResult));
    try {
      await execAsync(`node ${cliPath} report ${tmpFile} --format markdown --output ${outFile}`);
      const content = readFileSync(outFile, "utf-8");
      assert.ok(content.includes("# extaudit Security Report"));
    } finally {
      rmSync(tmpFile, { force: true });
      rmSync(outFile, { force: true });
    }
  });

  it("errors gracefully on missing file", async () => {
    try {
      await execAsync(`node ${cliPath} report /nonexistent/file.json`);
      assert.fail("Should have thrown");
    } catch (err) {
      assert.ok(err.code !== 0);
      assert.ok(err.stderr.includes("File not found") || err.stdout.includes("File not found"));
    }
  });
});
