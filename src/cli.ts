#!/usr/bin/env node
/** CLI entry point for extaudit */
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { CliConfig, Severity } from "./types.js"
import { scan, formatJson, formatMarkdown, formatSummary } from "./scorer.js"
import { getDefaultRules } from "./rules.js"

const VERSION = "0.1.0"
const DEFAULT_SCAN_PATHS = [
  path.join(os.homedir(), ".vscode", "extensions"),
  path.join(os.homedir(), ".cursor", "extensions"),
]

function main(): void {
  const args = process.argv.slice(2)
  if (args.length === 0) { printHelp(); process.exit(0) }
  const command = args[0]
  switch (command) {
    case "scan": handleScan(args.slice(1)); break
    case "rules": handleRules(); break
    case "report": handleReport(args.slice(1)); break
    case "version": case "--version": case "-v": console.log(`extaudit v${VERSION}`); break
    case "help": case "--help": case "-h": printHelp(); break
    default: console.error(`Unknown command: ${command}`); printHelp(); process.exit(1)
  }
}

function handleScan(args: string[]): void {
  const config = parseArgs(args)
  if (!config.scanPaths.length) config.scanPaths = [...DEFAULT_SCAN_PATHS]
  if (config.verbose) {
    console.error(`Scanning: ${config.scanPaths.join(", ")}`)
    console.error(`Format: ${config.outputFormat}  Min severity: ${config.minSeverity}`)
    console.error("")
  }
  const report = scan(config)
  const output = config.outputFormat === "json" ? formatJson(report)
    : config.outputFormat === "markdown" ? formatMarkdown(report)
    : formatSummary(report)
  if (config.outputFile) {
    fs.writeFileSync(config.outputFile, output, "utf-8")
    console.error(`Report → ${config.outputFile}`)
  } else {
    console.log(output)
  }
  if (config.maxScore > 0) {
    const mx = Math.max(0, ...report.extensions.map((e: {score:number}) => e.score))
    if (mx >= config.maxScore) process.exit(2)
  }
}

function parseArgs(args: string[]): CliConfig {
  const c: CliConfig = {
    scanPaths: [], outputFormat: "summary", verbose: false,
    minSeverity: "low", maxScore: 0,
    thresholds: { caution: 10, suspicious: 25, dangerous: 50 },
  }
  let i = 0
  while (i < args.length) {
    const a = args[i]
    switch (a) {
      case "--format": case "-f": i++; c.outputFormat = (args[i]||"summary") as any; break
      case "--output": case "-o": i++; c.outputFile = args[i]; break
      case "--verbose": case "-v": c.verbose = true; break
      case "--min-severity": i++; c.minSeverity = (args[i]||"low") as Severity; break
      case "--rules": i++; c.customRulesPath = args[i]; break
      case "--max-score": i++; c.maxScore = parseInt(args[i]||"0", 10); break
      case "--paths": i++; c.scanPaths = (args[i]||"").split(",").filter(Boolean); break
      default: if (!a.startsWith("-")) c.scanPaths.push(a); else console.error(`Unknown: ${a}`)
    }
    i++
  }
  return c
}

function handleRules(): void {
  const rules = getDefaultRules()
  for (const r of rules) console.log(`[${r.severity.toUpperCase().padEnd(8)}] ${r.id}  ${r.name}\n  ${r.description}\n`)
  console.log(`Total: ${rules.length} rules`)
}

function handleReport(args: string[]): void { handleScan(["--format","markdown",...args]) }

function printHelp(): void {
  console.log(`extaudit v${VERSION} — Extension Manifest Auditor

Local-first CLI for scanning VSCode/Cursor extension manifests for
suspicious permissions, network access, and security anomalies.

USAGE
  extaudit <command> [options]

COMMANDS
  scan [dir...]    Scan extension directories for security risks
  rules            List all built-in risk rules
  report [dir...]  Generate a Markdown report (scan --format markdown)
  version          Show version
  help             Show this help

SCAN OPTIONS
  --format, -f     Output format: summary (default), json, markdown
  --output, -o     Write report to file
  --verbose, -v    Print progress to stderr
  --min-severity   Minimum severity filter: low, medium, high, critical
  --rules          Path to custom rules JSON file
  --max-score      CI gate — exit code 2 if any extension exceeds score
  --paths          Comma-separated list of directories to scan

DEFAULT SCAN PATHS
  ~/.vscode/extensions  ~/.cursor/extensions

EXAMPLES
  extaudit scan                         # scan default dirs, summary
  extaudit scan ./fixtures --format json  # JSON output from fixtures
  extaudit scan ./fixtures --max-score 25 # gate at 25
  extaudit report ./fixtures -o report.md  # Markdown report to file
  extaudit rules                        # list all risk rules

EXIT CODES
  0  Success (no dangerous extensions found)
  1  Error during scan
  2  CI gate trigger (extension score ≥ --max-score)

See https://github.com/rogerchappel/extaudit for docs
`)
}

main()
