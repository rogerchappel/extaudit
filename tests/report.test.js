// extaudit - Report format tests
import { describe, it } from "node:test";
import assert from "node:assert";
import { generateJsonReport } from "../dist/report/json.js";
import { generateMarkdownReport } from "../dist/report/markdown.js";
import { computeSummary } from "../dist/report/summary.js";

const sampleRisks = [
  {
    extensionName: "safe-ext",
    extensionPath: "/fake/safe",
    score: 0,
    label: "info",
    findings: [],
  },
  {
    extensionName: "dangerous-ext",
    extensionPath: "/fake/dangerous",
    score: 75,
    label: "critical",
    findings: [
      {
        ruleId: "scripts-postinstall",
        description: "Has postinstall",
        severity: "critical",
        extensionName: "dangerous-ext",
        extensionPath: "/fake/dangerous",
        evidence: ["postinstall: npm rebuild"],
      },
    ],
  },
];

describe("JSON Report", () => {
  it("generates valid JSON", () => {
    const json = generateJsonReport({
      version: "0.1.0",
      scannedDirectories: ["/fake"],
      extensions: sampleRisks,
      appliedRules: ["scripts-postinstall"],
    });
    const parsed = JSON.parse(json);
    assert.strictEqual(parsed.totalExtensions, 2);
    assert.strictEqual(parsed.extensions.length, 2);
    assert.ok(parsed.timestamp);
    assert.strictEqual(parsed.version, "0.1.0");
  });

  it("includes summary statistics", () => {
    const json = generateJsonReport({
      version: "0.1.0",
      scannedDirectories: ["/fake"],
      extensions: sampleRisks,
      appliedRules: [],
    });
    const parsed = JSON.parse(json);
    assert.strictEqual(parsed.summary.critical, 1);
    assert.strictEqual(parsed.summary.info, 1);
  });
});

describe("Markdown Report", () => {
  it("generates markdown with header", () => {
    const summary = computeSummary(sampleRisks);
    const md = generateMarkdownReport({
      version: "0.1.0",
      scannedDirectories: ["/fake"],
      extensions: sampleRisks,
      appliedRules: ["scripts-postinstall"],
      summary,
    });
    assert.ok(md.includes("# extaudit Security Report"));
    assert.ok(md.includes("## Summary"));
    assert.ok(md.includes("## Extension Findings"));
    assert.ok(md.includes("## Applied Rules"));
  });

  it("includes per-extension findings in markdown", () => {
    const summary = computeSummary(sampleRisks);
    const md = generateMarkdownReport({
      version: "0.1.0",
      scannedDirectories: ["/fake"],
      extensions: sampleRisks,
      appliedRules: [],
      summary,
    });
    assert.ok(md.includes("### dangerous-ext"));
    assert.ok(md.includes("postinstall"));
    assert.ok(md.includes("No findings") || md.includes("clean"));
  });

  it("handles empty extensions list", () => {
    const summary = computeSummary([]);
    const md = generateMarkdownReport({
      version: "0.1.0",
      scannedDirectories: ["/fake"],
      extensions: [],
      appliedRules: [],
      summary,
    });
    assert.ok(md.includes("No extensions found"));
  });
});

describe("Summary Computation", () => {
  it("computes correct counts", () => {
    const summary = computeSummary(sampleRisks);
    assert.strictEqual(summary.critical, 1);
    assert.strictEqual(summary.info, 1);
    assert.strictEqual(summary.high, 0);
    assert.strictEqual(summary.medium, 0);
    assert.strictEqual(summary.low, 0);
  });

  it("computes max and average scores", () => {
    const summary = computeSummary(sampleRisks);
    assert.strictEqual(summary.maxScore, 75);
    assert.strictEqual(summary.averageScore, 38);
  });

  it("handles empty input", () => {
    const summary = computeSummary([]);
    assert.strictEqual(summary.maxScore, 0);
    assert.strictEqual(summary.averageScore, 0);
  });
});
