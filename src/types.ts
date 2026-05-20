// extaudit - Core type definitions

/** A parsed extension manifest with extracted metadata */
export interface ExtensionManifest {
  /** Extension name from package.json */
  name: string;
  /** Extension version */
  version: string;
  /** Extension display name */
  displayName?: string;
  /** Extension description */
  description?: string;
  /** Publisher identifier (e.g., "publisher.name") */
  publisher?: string;
  /** Activation events from package.json */
  activationEvents: string[];
  /** All dependencies from package.json */
  dependencies: Record<string, string>;
  /** Dev dependencies from package.json */
  devDependencies: Record<string, string>;
  /** NPM scripts from package.json */
  scripts: Record<string, string>;
  /** Extension path on disk */
  extensionPath: string;
  /** Whether the extension has a postinstall script */
  hasPostInstall: boolean;
  /** Raw package.json content */
  raw: Record<string, unknown>;
}

/** Severity level for a finding */
export type Severity = "critical" | "high" | "medium" | "low" | "info";

/** A single finding from a rule evaluation */
export interface Finding {
  /** Rule identifier that triggered this finding */
  ruleId: string;
  /** Human-readable description of the finding */
  description: string;
  /** Severity level */
  severity: Severity;
  /** Extension name that triggered the finding */
  extensionName: string;
  /** Extension path */
  extensionPath: string;
  /** Supporting evidence (matched patterns, values, etc.) */
  evidence: string[];
}

/** Risk score for an extension */
export interface ExtensionRisk {
  /** Extension name */
  extensionName: string;
  /** Extension path */
  extensionPath: string;
  /** Overall risk score (0-100) */
  score: number;
  /** Severity label based on score */
  label: Severity;
  /** All findings for this extension */
  findings: Finding[];
}

/** Full audit report */
export interface AuditReport {
  /** Report generation timestamp */
  timestamp: string;
  /** Version of extaudit that generated this report */
  version: string;
  /** Directories scanned */
  scannedDirectories: string[];
  /** Total extensions found */
  totalExtensions: number;
  /** Per-extension risk assessments */
  extensions: ExtensionRisk[];
  /** Summary statistics */
  summary: ReportSummary;
  /** Rules that were applied */
  appliedRules: string[];
}

/** Summary statistics for a report */
export interface ReportSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  maxScore: number;
  averageScore: number;
}

/** A single risk rule */
export interface RiskRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Risk category */
  category: RuleCategory;
  /** Severity if the rule matches */
  severity: Severity;
  /** Score weight (points added when rule fires) */
  weight: number;
  /** Whether the rule is enabled */
  enabled: boolean;
  /** Evaluate the rule against a manifest */
  evaluate: (manifest: ExtensionManifest) => Finding | null;
}

/** Rule categories */
export type RuleCategory = "permissions" | "network" | "scripts" | "publisher";

/** User configuration loaded from .extaudit.json */
export interface ExtAuditConfig {
  /** Directories to scan */
  scanDirs?: string[];
  /** Rules to disable by ID */
  disabledRules?: string[];
  /** Rules to enable by ID (overrides disabled if listed in both) */
  enabledRules?: string[];
  /** Risk score threshold for exit code 1 */
  failThreshold?: number;
  /** Custom output directory for reports */
  outputDir?: string;
}
