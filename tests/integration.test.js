// extaudit - Integration test with multi-extension fixtures
import { describe, it } from "node:test";
import assert from "node:assert";
import { RuleEngine } from "../dist/rules/engine.js";
import { readPackageJson, parseManifest } from "../dist/parser.js";
import { findExtensionDirs } from "../dist/fs.js";
import { join } from "node:path";

const fixturesDir = join(process.cwd(), "fixtures/example-extensions");

describe("Multi-Extension Integration", () => {
  it("scans all fixture extensions and produces risk scores", async () => {
    const extDirs = await findExtensionDirs(fixturesDir);
    assert.ok(extDirs.length >= 4);

    const engine = new RuleEngine();
    const results = [];

    for (const dir of extDirs) {
      const pkg = await readPackageJson(dir);
      assert.ok(pkg !== null, `Should read package.json from ${dir}`);
      if (pkg) {
        const manifest = parseManifest(pkg, dir);
        const risk = engine.evaluate(manifest);
        results.push(risk);
      }
    }

    // Should have results for all 4 fixtures
    assert.strictEqual(results.length, 4);

    // Benign extension should be clean
    const benign = results.find((r) => r.extensionName === "benign-extension");
    assert.ok(benign !== undefined);
    assert.strictEqual(benign?.score, 0, "Benign extension should have 0 risk");

    // Suspicious extension should have findings
    const suspicious = results.find((r) => r.extensionName === "suspicious-extension");
    assert.ok(suspicious !== undefined);
    assert.ok(suspicious.score > 0, "Suspicious extension should have non-zero risk");
    assert.ok(suspicious.findings.length >= 3, "Should have multiple findings");

    // Network extension should have network findings
    const network = results.find((r) => r.extensionName === "network-extension");
    assert.ok(network !== undefined);
    const netFinding = network.findings.find((f) => f.ruleId === "network-fetch-import");
    assert.ok(netFinding !== undefined, "Should detect network imports");

    // Postinstall extension should have postinstall finding
    const postinstall = results.find((r) => r.extensionName === "postinstall-extension");
    assert.ok(postinstall !== undefined);
    const piFinding = postinstall.findings.find((f) => f.ruleId === "scripts-postinstall");
    assert.ok(piFinding !== undefined, "Should detect postinstall script");
  });

  it("risk scores are consistent across multiple runs", async () => {
    const engine = new RuleEngine();
    const extDirs = await findExtensionDirs(fixturesDir);

    const runResults = [];
    for (let run = 0; run < 3; run++) {
      const scores = [];
      for (const dir of extDirs) {
        const pkg = await readPackageJson(dir);
        if (pkg) {
          const manifest = parseManifest(pkg, dir);
          const risk = engine.evaluate(manifest);
          scores.push(risk.score);
        }
      }
      runResults.push(scores);
    }

    // All runs should produce identical scores
    for (let i = 1; i < runResults.length; i++) {
      assert.deepStrictEqual(runResults[i], runResults[0], "Scores should be deterministic");
    }
  });
});
