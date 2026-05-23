/** Unit tests for manifest parsing, rules, scoring + E2E audit flow */

import assert from "node:assert/strict"
import { describe, it } from "node:test"
import * as path from "node:path"
import * as url from "node:url"

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const dist = path.resolve(__dirname, "../dist")

const { parseManifest, looksLikeExtension, discoverExtensions } = await import(path.join(dist, "manifest.js"))
const { scoreExtension, getRiskLevel } = await import(path.join(dist, "scorer.js"))
const { getDefaultRules } = await import(path.join(dist, "rules.js"))
const { scan, formatJson, formatMarkdown, formatSummary } = await import(path.join(dist, "scorer.js"))
const FIXTURES = path.resolve(__dirname, "../fixtures")

/* ── looksLikeExtension ────────────────────────────── */

describe("looksLikeExtension", () => {
  it("returns true for valid vscode extension dir", () => {
    assert.strictEqual(looksLikeExtension(path.join(FIXTURES, "safe", "clean-linter")), true)
  })
  it("returns true for risky extension", () => {
    assert.strictEqual(looksLikeExtension(path.join(FIXTURES, "risky", "data-exfiltrator")), true)
  })
  it("returns false for non-extension dir", () => {
    assert.strictEqual(looksLikeExtension(FIXTURES), false)
  })
  it("returns false for nonexistent path", () => {
    assert.strictEqual(looksLikeExtension("/tmp/nonexistent-extaudit-xyz"), false)
  })
})

/* ── parseManifest ─────────────────────────────────── */

describe("parseManifest", () => {
  it("parses clean extension correctly", () => {
    const m = parseManifest(
      path.join(FIXTURES, "safe", "clean-linter", "package.json"),
      path.join(FIXTURES, "safe", "clean-linter"),
    )
    assert.strictEqual(m.name, "clean-linter")
    assert.strictEqual(m.version, "2.4.1")
    assert.strictEqual(m.publisher, "trusted-dev")
    assert.strictEqual(m.displayName, "Clean Linter")
    assert.ok(m.scripts)
    assert.strictEqual(m.scripts.postinstall, undefined) // no postinstall
    assert.deepStrictEqual(m.activationEvents, ["onLanguage:typescript"])
  })
  it("parses risky extension correctly", () => {
    const m = parseManifest(
      path.join(FIXTURES, "risky", "data-exfiltrator", "package.json"),
      path.join(FIXTURES, "risky", "data-exfiltrator"),
    )
    assert.strictEqual(m.name, "data-exfiltrator")
    assert.strictEqual(m.version, "1.0.0")
    assert.strictEqual(m.publisher, undefined)
    assert.ok(m.scripts.postinstall.includes("curl"))
    assert.ok(m.activationEvents.includes("*"))
    assert.strictEqual(m.extensionKind, "ui")
  })
})

/* ── discoverExtensions ────────────────────────────── */

describe("discoverExtensions", () => {
  it("discovers all fixture extensions", () => {
    const found = discoverExtensions([FIXTURES])
    assert.ok(found.length >= 2, `expected ≥ 2, got ${found.length}`)
    const names = found.map(f => path.basename(f.directory))
    assert.ok(names.includes("clean-linter"))
    assert.ok(names.includes("data-exfiltrator"))
  })
  it("returns empty for nonexistent root", () => {
    assert.deepStrictEqual(discoverExtensions(["/tmp/nonexistent-extaudit-xyz"]), [])
  })
})

/* ── scoreExtension ────────────────────────────────── */

describe("scoreExtension", () => {
  const rules = getDefaultRules()

  it("clean extension scores safe", () => {
    const m = parseManifest(
      path.join(FIXTURES, "safe", "clean-linter", "package.json"),
      path.join(FIXTURES, "safe", "clean-linter"),
    )
    const s = scoreExtension(m, rules)
    assert.strictEqual(s.riskLevel, "safe")
  })

  it("risky extension scores high", () => {
    const m = parseManifest(
      path.join(FIXTURES, "risky", "data-exfiltrator", "package.json"),
      path.join(FIXTURES, "risky", "data-exfiltrator"),
    )
    const s = scoreExtension(m, rules)
    assert.ok(s.score > 0, "should have nonzero score")
    assert.ok(s.riskLevel !== "safe", `should not be safe: ${s.riskLevel}`)
    assert.ok(s.findings.length > 0, "should have findings")
    const cats = s.findings.map(f => f.category)
    assert.ok(cats.includes("scripts"))
    assert.ok(cats.includes("network"))
    assert.ok(cats.includes("dependencies"))
  })

  it("detects missing publisher", () => {
    const m = parseManifest(
      path.join(FIXTURES, "risky", "data-exfiltrator", "package.json"),
      path.join(FIXTURES, "risky", "data-exfiltrator"),
    )
    const s = scoreExtension(m, rules)
    assert.ok(s.findings.find(f => f.ruleId === "PUB-001"))
  })

  it("detects postinstall with curl as critical", () => {
    const m = parseManifest(
      path.join(FIXTURES, "risky", "data-exfiltrator", "package.json"),
      path.join(FIXTURES, "risky", "data-exfiltrator"),
    )
    const s = scoreExtension(m, rules)
    const f = s.findings.find(f => f.ruleId === "SCR-001")
    assert.ok(f, "should detect postinstall")
    assert.strictEqual(f.severity, "critical")
  })

  it("detects suspicious dependencies", () => {
    const m = parseManifest(
      path.join(FIXTURES, "risky", "data-exfiltrator", "package.json"),
      path.join(FIXTURES, "risky", "data-exfiltrator"),
    )
    const s = scoreExtension(m, rules)
    assert.ok(s.findings.find(f => f.ruleId === "DEP-003"))
  })

  it("detects network dependencies", () => {
    const m = parseManifest(
      path.join(FIXTURES, "risky", "data-exfiltrator", "package.json"),
      path.join(FIXTURES, "risky", "data-exfiltrator"),
    )
    const s = scoreExtension(m, rules)
    assert.ok(s.findings.find(f => f.ruleId === "NET-002"))
  })
})

/* ── getRiskLevel ──────────────────────────────────── */

describe("getRiskLevel", () => {
  it("safe for 0", () => assert.strictEqual(getRiskLevel(0), "safe"))
  it("caution for 10", () => assert.strictEqual(getRiskLevel(10), "caution"))
  it("suspicious for 30", () => assert.strictEqual(getRiskLevel(30), "suspicious"))
  it("dangerous for 60", () => assert.strictEqual(getRiskLevel(60), "dangerous"))
})

/* ── E2E audit flow ───────────────────────────────── */

describe("end-to-end", () => {
  it("scans fixtures and produces valid report", () => {
    const r = scan({
      scanPaths: [FIXTURES], outputFormat: "json", verbose: false,
      minSeverity: "low", maxScore: 0, thresholds: { caution: 10, suspicious: 25, dangerous: 50 },
    })
    assert.ok(r.timestamp)
    assert.ok(r.extensionsScanned >= 2, `expected ≥ 2 extensions scanned, got ${r.extensionsScanned}`)
    assert.strictEqual(r.extensionsFailed, 0)
    assert.ok(r.totalFindings > 0)
    const clean = r.extensions.find(e => e.manifest.name === "clean-linter")
    assert.ok(clean, "should find clean-linter")
    assert.ok(clean.riskLevel === "safe" || clean.score < 5, `clean should be safe, got ${clean.riskLevel}/${clean.score}`)
    const risky = r.extensions.find(e => e.manifest.name === "data-exfiltrator")
    assert.ok(risky, "should find data-exfiltrator")
    assert.ok(risky.score > 20, `risky should score > 20, got ${risky.score}`)
    assert.ok(risky.riskLevel === "dangerous" || risky.riskLevel === "suspicious",
      `risky should be dangerous/suspicious, got ${risky.riskLevel}`)
    const totalSev = r.severityCounts.low + r.severityCounts.medium + r.severityCounts.high + r.severityCounts.critical
    assert.strictEqual(totalSev, r.totalFindings)
  })

  it("formatJson round-trips", () => {
    const r = scan({
      scanPaths: [FIXTURES], outputFormat: "json", verbose: false,
      minSeverity: "low", maxScore: 0, thresholds: { caution: 10, suspicious: 25, dangerous: 50 },
    })
    const parsed = JSON.parse(formatJson(r))
    assert.ok(parsed.extensionsScanned >= 2)
    assert.ok(parsed.totalFindings > 0)
  })

  it("formatMarkdown contains expected content", () => {
    const r = scan({
      scanPaths: [FIXTURES], outputFormat: "markdown", verbose: false,
      minSeverity: "low", maxScore: 0, thresholds: { caution: 10, suspicious: 25, dangerous: 50 },
    })
    const md = formatMarkdown(r)
    assert.ok(md.includes("# ExtAudit Report"))
    assert.ok(md.includes("clean-linter"))
    assert.ok(md.includes("data-exfiltrator"))
    assert.ok(md.includes("| Severity |"))
  })

  it("formatSummary contains expected content", () => {
    const r = scan({
      scanPaths: [FIXTURES], outputFormat: "summary", verbose: false,
      minSeverity: "low", maxScore: 0, thresholds: { caution: 10, suspicious: 25, dangerous: 50 },
    })
    const s = formatSummary(r)
    assert.ok(s.includes("extaudit"))
    // Data exfiltrator should always appear (it's risky)
    assert.ok(s.includes("data-exfiltrator") || s.includes("Code Helper Plus"))
    // Summary should list scanned count
    assert.ok(s.includes("Scanned:"))
    assert.ok(s.includes("Severity summary:"))
  })

  it("respects min-severity filter", () => {
    const rLow = scan({
      scanPaths: [FIXTURES], outputFormat: "json", verbose: false,
      minSeverity: "low", maxScore: 0, thresholds: { caution: 10, suspicious: 25, dangerous: 50 },
    })
    const rHigh = scan({
      scanPaths: [FIXTURES], outputFormat: "json", verbose: false,
      minSeverity: "high", maxScore: 0, thresholds: { caution: 10, suspicious: 25, dangerous: 50 },
    })
    assert.ok(rLow.totalFindings > rHigh.totalFindings,
      `low(${rLow.totalFindings}) > high(${rHigh.totalFindings})`)
  })
});
