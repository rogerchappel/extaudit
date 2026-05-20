// extaudit - Scanner tests
import { describe, it } from "node:test";
import assert from "node:assert";
import { findExtensionDirs, resolveHomePath, resolveScanDirs } from "../dist/fs.js";
import { join } from "node:path";

const fixturesDir = join(process.cwd(), "fixtures/example-extensions");

describe("ExtensionScanner", () => {
  it("finds extension directories with package.json", async () => {
    const dirs = await findExtensionDirs(fixturesDir);
    assert.ok(dirs.length >= 4, `Expected at least 4 extension dirs, got ${dirs.length}`);
    assert.ok(dirs.some((d) => d.includes("benign-ext")));
    assert.ok(dirs.some((d) => d.includes("suspicious-ext")));
    assert.ok(dirs.some((d) => d.includes("network-ext")));
    assert.ok(dirs.some((d) => d.includes("postinstall-ext")));
  });

  it("returns empty array for non-existent directory", async () => {
    const dirs = await findExtensionDirs("/nonexistent/path/that/does/not/exist");
    assert.deepStrictEqual(dirs, []);
  });

  it("resolves ~ paths to home directory", () => {
    const resolved = resolveHomePath("~/.vscode/extensions");
    assert.ok(resolved.startsWith(process.env.HOME ?? ""));
    assert.ok(!resolved.includes("~"));
  });

  it("leaves absolute paths unchanged", () => {
    const resolved = resolveHomePath("/some/absolute/path");
    assert.strictEqual(resolved, "/some/absolute/path");
  });

  it("resolveScanDirs filters to existing directories", async () => {
    const dirs = await resolveScanDirs([fixturesDir, "/nonexistent/dir"]);
    assert.ok(dirs.length >= 1);
    assert.ok(dirs.some((d) => d.includes("example-extensions")));
    assert.ok(!dirs.some((d) => d.includes("nonexistent")));
  });

  it("returns sorted extension directories", async () => {
    const dirs = await findExtensionDirs(fixturesDir);
    const sorted = [...dirs].sort();
    assert.deepStrictEqual(dirs, sorted);
  });
});
