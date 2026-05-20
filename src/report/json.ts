// extaudit - JSON report generator
import type { AuditReport, ExtensionRisk, ReportSummary } from "../types.js";

/**
 * Generate a JSON-formatted audit report from extension risks.
 */
export function generateJsonReport(args: {
  version: string;
  scannedDirectories: string[];
  extensions: ExtensionRisk[];
  appliedRules: string[];
}): string {
  const summary = computeSummary(args.extensions);
  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    version: args.version,
    scannedDirectories: args.scannedDirectories,
    totalExtensions: args.extensions.length,
    extensions: args.extensions,
    summary,
    appliedRules: args.appliedRules,
  };
  return JSON.stringify(report, null, 2);
}

function computeSummary(extensions: ExtensionRisk[]): ReportSummary {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  let maxScore = 0;
  let totalScore = 0;

  for (const ext of extensions) {
    counts[ext.label]++;
    maxScore = Math.max(maxScore, ext.score);
    totalScore += ext.score;
  }

  return {
    ...counts,
    maxScore,
    averageScore: extensions.length > 0 ? Math.round(totalScore / extensions.length) : 0,
  };
}
