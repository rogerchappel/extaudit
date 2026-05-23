export { ExtensionManifest, ExtensionScore, AuditReport, Finding, Severity, RiskRule, RuleCategory, CliConfig, SEVERITY_WEIGHTS } from "./types.js"
export { DEFAULT_RULES, getDefaultRules, loadCustomRules } from "./rules.js"
export { discoverExtensions, parseManifest, looksLikeExtension } from "./manifest.js"
export { scan, scoreExtension, formatJson, formatMarkdown, formatSummary, getRiskLevel } from "./scorer.js"
