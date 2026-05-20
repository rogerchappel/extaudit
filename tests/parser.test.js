// extaudit - Parser tests
import { describe, it } from "node:test";
import assert from "node:assert";
import { readPackageJson, isExtensionManifest, parseManifest } from "../dist/parser.js";
import { join } from "node:path";

const fixturesDir = join(process.cwd(), "fixtures/example-extensions");

describe("PackageJson Parser", () => {
  it("reads a valid package.json", async () => {
    const pkg = await readPackageJson(join(fixturesDir, "benign-ext"));
    assert.ok(pkg !== null);
    assert.strictEqual(pkg?.name, "benign-extension");
  });

  it("returns null for non-existent directory", async () => {
    const pkg = await readPackageJson("/nonexistent/path");
    assert.strictEqual(pkg, null);
  });

  it("identifies extension manifests by engines.vscode", () => {
    const pkg = {
      name: "test",
      engines: { vscode: "^1.80.0" },
    };
    assert.strictEqual(isExtensionManifest(pkg), true);
  });

  it("identifies extension manifests by activationEvents", () => {
    const pkg = {
      name: "test",
      activationEvents: ["onCommand:test.cmd"],
    };
    assert.strictEqual(isExtensionManifest(pkg), true);
  });

  it("identifies extension manifests by contributes field", () => {
    const pkg = {
      name: "test",
      contributes: {},
    };
    assert.strictEqual(isExtensionManifest(pkg), true);
  });

  it("rejects regular package.json without extension fields", () => {
    const pkg = {
      name: "test-lib",
      version: "1.0.0",
      main: "index.js",
    };
    assert.strictEqual(isExtensionManifest(pkg), false);
  });

  it("parses benign extension correctly", () => {
    const pkg = {
      name: "benign-extension",
      version: "1.0.0",
      displayName: "Benign Extension",
      publisher: "trusted-publisher",
      activationEvents: ["onCommand:benign.doSomething"],
      dependencies: {},
      devDependencies: {},
      scripts: {},
      engines: { vscode: "^1.80.0" },
    };
    const manifest = parseManifest(pkg, "/fake/path");
    assert.strictEqual(manifest.name, "benign-extension");
    assert.strictEqual(manifest.publisher, "trusted-publisher");
    assert.strictEqual(manifest.hasPostInstall, false);
    assert.deepStrictEqual(manifest.activationEvents, ["onCommand:benign.doSomething"]);
  });

  it("detects postinstall script", () => {
    const pkg = {
      name: "test",
      version: "1.0.0",
      activationEvents: ["*"],
      scripts: { postinstall: "node setup.js" },
    };
    const manifest = parseManifest(pkg, "/fake/path");
    assert.strictEqual(manifest.hasPostInstall, true);
    assert.strictEqual(manifest.scripts.postinstall, "node setup.js");
  });

  it("handles empty/missing fields gracefully", () => {
    const pkg = {};
    const manifest = parseManifest(pkg, "/fake/path");
    assert.strictEqual(manifest.name, "unknown");
    assert.strictEqual(manifest.version, "0.0.0");
    assert.deepStrictEqual(manifest.activationEvents, []);
    assert.deepStrictEqual(manifest.dependencies, {});
    assert.deepStrictEqual(manifest.devDependencies, {});
  });
});
