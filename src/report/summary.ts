// extaudit - Report summary helper
import type { ExtensionRisk, ReportSummary } from "../types.js";

export function computeSummary(extensions: ExtensionRisk[]): ReportSummary {
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
