// extaudit - Scan command implementation
import { findExtensionDirs, resolveScanDirs } from "../fs.js";
import { readPackageJson, isExtensionManifest, parseManifest } from "../parser.js";
import { RuleEngine } from "../rules/engine.js";
import { loadConfig } from "../config.js";
import { generateJsonReport } from "../report/json.js";
import { generateMarkdownReport } from "../report/markdown.js";
import { computeSummary } from "../report/summary.js";
import type { ExtensionManifest, ExtensionRisk } from "../types.js";

export async function scanCommand(
  dirs?: string[],
  options: { json?: boolean; markdown?: boolean } = {}
): Promise<void> {
  const config = await loadConfig();

  // If no dirs provided on CLI, try config scan dirs then defaults
  let scanDirs: string[];
  if (dirs && dirs.length > 0) {
    scanDirs = dirs;
  } else if (config.scanDirs && config.scanDirs.length > 0) {
    scanDirs = config.scanDirs;
  } else {
    // Try to find installed extensions
    scanDirs = await resolveScanDirs();
  }

  if (scanDirs.length === 0) {
    console.log("No extension directories found to scan.");
    console.log("Usage: extaudit scan <path/to/extensions>");
    return;
  }

  // Collect all extension directories
  const allExtDirs: string[] = [];
  const resolvedDirs: string[] = [];
  for (const dir of scanDirs) {
    const found = await findExtensionDirs(dir);
    if (found.length > 0) {
      resolvedDirs.push(dir);
      allExtDirs.push(...found);
    }
  }

  if (allExtDirs.length === 0) {
    console.log(`No extensions found in: ${scanDirs.join(", ")}`);
    return;
  }

  // Parse manifests
  const manifests: ExtensionManifest[] = [];
  for (const extDir of allExtDirs) {
    const pkg = await readPackageJson(extDir);
    if (pkg) {
      manifests.push(parseManifest(pkg, extDir));
    }
  }

  // Run rules engine
  const engine = new RuleEngine(
    undefined,
    config.disabledRules ?? [],
    config.enabledRules ?? []
  );
  const risks: ExtensionRisk[] = engine.evaluateAll(manifests);

  const summary = computeSummary(risks);
  const appliedRules = engine.getAppliedRuleIds();

  // Output
  const useJson = options.json ?? false;
  const useMarkdown = options.markdown ?? false;
  const version = "0.1.0";

  if (useJson) {
    console.log(generateJsonReport({ version, scannedDirectories: resolvedDirs, extensions: risks, appliedRules }));
  } else if (useMarkdown) {
    console.log(generateMarkdownReport({ version, scannedDirectories: resolvedDirs, extensions: risks, appliedRules, summary }));
  } else {
    // Default human-readable output
    const dirsLabel = resolvedDirs.length > 0 ? resolvedDirs.join(", ") : "(no resolved dirs)";
    console.log(`extaudit v${version} - Extension Security Audit`);
    console.log(`Scanned: ${dirsLabel}`);
    console.log(`Extensions found: ${manifests.length}`);
    console.log("");

    for (const risk of risks) {
      const icon = getSeverityIcon(risk.label);
      console.log(`${icon} ${risk.extensionName} [${risk.label}] score: ${risk.score}/100`);
      for (const f of risk.findings) {
        console.log(`  [${f.severity.toUpperCase()}] ${f.description}`);
        for (const e of f.evidence) {
          console.log(`    - ${e}`);
        }
      }
    }

    console.log("");
    console.log("Summary:");
    console.log(`  Critical: ${summary.critical}  High: ${summary.high}  Medium: ${summary.medium}  Low: ${summary.low}  Info: ${summary.info}`);
    console.log(`  Max score: ${summary.maxScore}/100  Average: ${summary.averageScore}/100`);
  }

  // Exit based on threshold
  const threshold = config.failThreshold ?? 50;
  if (summary.maxScore >= threshold) {
    process.exit(1);
  }
}

function getSeverityIcon(label: string): string {
  switch (label) {
    case "critical": return "\ud83d\udd34";
    case "high": return "\ud83d\udfe0";
    case "medium": return "\ud83d\udfe1";
    case "low": return "\ud83d\udfe2";
    default: return "\u26aa";
  }
}
