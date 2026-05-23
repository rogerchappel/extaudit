/** Severity levels for individual findings */
export type Severity = "low" | "medium" | "high" | "critical"

/** Risk rule category */
export type RuleCategory =
  | "scripts"
  | "network"
  | "permissions"
  | "activation"
  | "dependencies"
  | "publisher"
  | "metadata"

/** A single risk rule used by the scanner */
export interface RiskRule {
  id: string
  name: string
  category: RuleCategory
  severity: Severity
  description: string
  check: (manifest: ExtensionManifest) => Finding | null
}

/** A finding produced by a rule check */
export interface Finding {
  ruleId: string
  ruleName: string
  category: RuleCategory
  severity: Severity
  message: string
  evidence?: string
}

/** Parsed extension manifest metadata */
export interface ExtensionManifest {
  raw: Record<string, unknown>
  path: string
  name: string
  version: string
  publisher?: string
  displayName?: string
  description?: string
  activationEvents?: string[]
  main?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  extensionKind?: string | string[]
  capabilities?: Record<string, unknown>
  directory: string
}

/** Severity weights for score calculation */
export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  low: 1,
  medium: 3,
  high: 7,
  critical: 12,
}

/** Risk score for a single extension */
export interface ExtensionScore {
  manifest: ExtensionManifest
  score: number
  riskLevel: "safe" | "caution" | "suspicious" | "dangerous"
  findings: Finding[]
}

/** Full audit report */
export interface AuditReport {
  timestamp: string
  target: string
  extensionsScanned: number
  extensionsFailed: number
  totalFindings: number
  severityCounts: Record<Severity, number>
  overallScore: number
  overallRisk: string
  extensions: ExtensionScore[]
  errors: string[]
}

/** CLI configuration */
export interface CliConfig {
  scanPaths: string[]
  outputFormat: "json" | "markdown" | "summary"
  outputFile?: string
  verbose: boolean
  minSeverity: Severity
  customRulesPath?: string
  maxScore: number
  thresholds: { caution: number; suspicious: number; dangerous: number }
}
