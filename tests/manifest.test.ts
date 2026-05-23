import { describe, it, expect } from "vitest"
import { looksLikeExtension, parseManifest, discoverExtensions } from "../src/manifest.js"
import * as fs from "fs"
import * as path from "path"

/* ------------------------------------------------------------------ */
/* Fixture helpers                                                    */
/* ------------------------------------------------------------------ */

const FIXTURES = path.resolve(__dirname, "..", "fixtures", "extensions")

/** Create a temp directory structure for testing */
function createTempManifest(
  dirName: string,
  pkgContent: Record<string, unknown>,
): string {
  const dir = path.join("/tmp", "extaudit-test", dirName)
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify(pkgContent, null, 2))
  return dir
}

/* ------------------------------------------------------------------ */
/* looksLikeExtension                                                 */
/* ------------------------------------------------------------------ */

describe("looksLikeExtension", () => {
  it("returns true for valid extension directory", () => {
    const dir = createTempManifest("valid-ext", {
      name: "my-ext",
      version: "1.0.0",
      engines: { vscode: "^1.80.0" },
    })
    expect(looksLikeExtension(dir)).toBe(true)
  })

  it("returns false when no package.json exists", () => {
    const dir = "/tmp/extaudit-test/no-package-json"
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    expect(looksLikeExtension(dir)).toBe(false)
  })

  it("returns false when engines field is missing", () => {
    const dir = createTempManifest("no-engines", {
      name: "not-an-ext",
      version: "1.0.0",
    })
    expect(looksLikeExtension(dir)).toBe(false)
  })

  it("returns false when engines exists but has no vscode key", () => {
    const dir = createTempManifest("no-vscode", {
      name: "not-an-ext",
      version: "1.0.0",
      engines: { node: ">=18" },
    })
    expect(looksLikeExtension(dir)).toBe(false)
  })

  it("returns false when engines is not an object", () => {
    const dir = createTempManifest("string-engines", {
      name: "not-an-ext",
      version: "1.0.0",
      engines: "^1.80.0",
    })
    expect(looksLikeExtension(dir)).toBe(false)
  })

  it("returns false for non-existent directory", () => {
    expect(looksLikeExtension("/tmp/extaudit-test/does-not-exist")).toBe(false)
  })

  it("returns false for invalid JSON in package.json", () => {
    const dir = path.join("/tmp", "extaudit-test", "bad-json")
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, "package.json"), "{ invalid json }")
    expect(looksLikeExtension(dir)).toBe(false)
  })

  it("handles real fixture: clean-linter", () => {
    const dir = path.join(FIXTURES, "safe-extensions", "clean-linter")
    if (fs.existsSync(dir)) {
      expect(looksLikeExtension(dir)).toBe(true)
    }
  })
})

/* ------------------------------------------------------------------ */
/* parseManifest                                                      */
/* ------------------------------------------------------------------ */

describe("parseManifest", () => {
  it("parses a valid package.json with all fields", () => {
    const pkg = {
      name: "full-ext",
      version: "2.1.0",
      publisher: "test-author",
      displayName: "Full Extension",
      description: "A fully specified extension for testing",
      main: "extension.js",
      engines: { vscode: "^1.80.0" },
      homepage: "https://example.com",
      activationEvents: ["onCommand:start", "onCommand:stop"],
      scripts: { build: "tsc", test: "vitest" },
      dependencies: { "lodash": "^4.17.0" },
      devDependencies: { typescript: "^5.0.0" },
      extensionKind: "ui",
      capabilities: { virtualWorkspaces: false },
      repository: { type: "git", url: "https://github.com/x/y" },
    }
    const dir = createTempManifest("full-ext", pkg)
    const pkgPath = path.join(dir, "package.json")
    const m = parseManifest(pkgPath, dir)

    expect(m.name).toBe("full-ext")
    expect(m.version).toBe("2.1.0")
    expect(m.publisher).toBe("test-author")
    expect(m.displayName).toBe("Full Extension")
    expect(m.description).toBe("A fully specified extension for testing")
    expect(m.main).toBe("extension.js")
    expect(m.activationEvents).toEqual(["onCommand:start", "onCommand:stop"])
    expect(m.scripts).toEqual({ build: "tsc", test: "vitest" })
    expect(m.dependencies).toEqual({ lodash: "^4.17.0" })
    expect(m.devDependencies).toEqual({ typescript: "^5.0.0" })
    expect(m.extensionKind).toBe("ui")
    expect(m.capabilities).toEqual({ virtualWorkspaces: false })
    expect(m.path).toBe(pkgPath)
    expect(m.directory).toBe(dir)
    expect(m.raw).toEqual(pkg)
  })

  it("handles string publisher", () => {
    const pkg = { name: "x", version: "1.0.0", publisher: "some-author", engines: { vscode: "^1.80.0" } }
    const dir = createTempManifest("string-pub", pkg)
    const m = parseManifest(path.join(dir, "package.json"), dir)
    expect(m.publisher).toBe("some-author")
  })

  it("handles object publisher with name field", () => {
    const pkg = { name: "x", version: "1.0.0", publisher: { name: "obj-author" }, engines: { vscode: "^1.80.0" } }
    const dir = createTempManifest("obj-pub", pkg)
    const m = parseManifest(path.join(dir, "package.json"), dir)
    expect(m.publisher).toBe("obj-author")
  })

  it("defaults name to 'unknown' when missing", () => {
    const pkg = { version: "1.0.0", engines: { vscode: "^1.80.0" } }
    const dir = createTempManifest("no-name", pkg)
    const m = parseManifest(path.join(dir, "package.json"), dir)
    expect(m.name).toBe("unknown")
  })

  it("defaults version to '0.0.0' when missing", () => {
    const pkg = { name: "x", engines: { vscode: "^1.80.0" } }
    const dir = createTempManifest("no-version", pkg)
    const m = parseManifest(path.join(dir, "package.json"), dir)
    expect(m.version).toBe("0.0.0")
  })

  it("sets undefined for missing optional fields", () => {
    const pkg = { name: "x", version: "1.0.0", engines: { vscode: "^1.80.0" } }
    const dir = createTempManifest("minimal", pkg)
    const m = parseManifest(path.join(dir, "package.json"), dir)
    expect(m.publisher).toBeUndefined()
    expect(m.displayName).toBeUndefined()
    expect(m.description).toBeUndefined()
    expect(m.activationEvents).toBeUndefined()
    expect(m.main).toBeUndefined()
    expect(m.scripts).toBeUndefined()
    expect(m.dependencies).toBeUndefined()
    expect(m.devDependencies).toBeUndefined()
    expect(m.extensionKind).toBeUndefined()
    expect(m.capabilities).toBeUndefined()
  })

  it("handles activationEvents that is not an array", () => {
    const pkg = { name: "x", version: "1.0.0", engines: { vscode: "^1.80.0" }, activationEvents: "onCommand:start" }
    const dir = createTempManifest("bad-events", pkg)
    const m = parseManifest(path.join(dir, "package.json"), dir)
    expect(m.activationEvents).toBeUndefined()
  })

  it("throws on invalid JSON", () => {
    const dir = path.join("/tmp", "extaudit-test", "parse-bad-json")
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, "package.json"), "not json")
    expect(() => parseManifest(path.join(dir, "package.json"), dir)).toThrow()
  })

  it("stores raw package.json content", () => {
    const pkg = { name: "x", version: "1.0.0", engines: { vscode: "^1.80.0" }, customField: "hello" }
    const dir = createTempManifest("raw-check", pkg)
    const m = parseManifest(path.join(dir, "package.json"), dir)
    expect(m.raw.customField).toBe("hello")
    expect(m.raw.name).toBe("x")
  })
})

/* ------------------------------------------------------------------ */
/* discoverExtensions                                                 */
/* ------------------------------------------------------------------ */

describe("discoverExtensions", () => {
  it("finds extensions in fixtures directory", () => {
    const results = discoverExtensions([path.join(FIXTURES, "safe-extensions")])
    expect(results.length).toBeGreaterThan(0)
    for (const r of results) {
      expect(typeof r.directory).toBe("string")
      expect(typeof r.packageJson).toBe("string")
      expect(fs.existsSync(r.packageJson)).toBe(true)
    }
  })

  it("finds the risky extension", () => {
    const results = discoverExtensions([path.join(FIXTURES, "risky-extensions")])
    const exfil = results.find((r) => r.directory.includes("data-exfiltrator"))
    expect(exfil).toBeDefined()
    expect(exfil?.packageJson).toContain("data-exfiltrator")
    expect(fs.existsSync(exfil!.packageJson)).toBe(true)
  })

  it("returns empty array for non-existent path", () => {
    const results = discoverExtensions(["/nonexistent/path"])
    expect(results).toEqual([])
  })

  it("skips hidden directories (dot-prefixed)", () => {
    const hidden = createTempManifest(".hidden-ext", {
      name: "hidden",
      version: "1.0.0",
      engines: { vscode: "^1.80.0" },
    })
    const parent = path.dirname(hidden)
    const results = discoverExtensions([parent])
    const found = results.find((r) => r.directory === hidden)
    expect(found).toBeUndefined()
  })

  it("skips node_modules", () => {
    const dir = createTempManifest("node_modules/my-ext", {
      name: "hidden",
      version: "1.0.0",
      engines: { vscode: "^1.80.0" },
    })
    const parent = path.dirname(path.dirname(dir))
    const results = discoverExtensions([parent])
    const found = results.find((r) => r.directory.includes("node_modules"))
    expect(found).toBeUndefined()
  })

  it("handles multiple root paths", () => {
    const results = discoverExtensions([
      path.join(FIXTURES, "safe-extensions"),
      path.join(FIXTURES, "risky-extensions"),
    ])
    expect(results.length).toBeGreaterThanOrEqual(2)
  })

  it("returns results with consistent shape", () => {
    const results = discoverExtensions([FIXTURES])
    for (const r of results) {
      expect(r).toHaveProperty("directory")
      expect(r).toHaveProperty("packageJson")
      expect(path.extname(r.packageJson)).toBe(".json")
    }
  })
})
