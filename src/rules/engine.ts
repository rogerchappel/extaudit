// extaudit - Rule engine that applies rules to extension manifests
import type { ExtensionManifest, ExtensionRisk, Finding, RiskRule } from "../types.js";
import createDefaultRules from "./defaultRules.js";

export class RuleEngine {
  private rules: RiskRule[];

  constructor(rules?: RiskRule[], disabledRuleIds?: string[], enabledRuleIds?: string[]) {
    this.rules = rules ?? createDefaultRules();
    this.applyConfig(disabledRuleIds ?? [], enabledRuleIds ?? []);
  }

  /**
   * Apply configuration to enable/disable specific rules.
   */
  private applyConfig(disabledRuleIds: string[], enabledRuleIds: string[]): void {
    const disableSet = new Set(disabledRuleIds);
    const enableSet = new Set(enabledRuleIds);

    for (const rule of this.rules) {
      // Enable rules override disabled rules
      if (enableSet.has(rule.id)) {
        rule.enabled = true;
      } else if (disableSet.has(rule.id)) {
        rule.enabled = false;
      }
    }
  }

  /**
   * Enable a rule by ID.
   */
  enableRule(ruleId: string): void {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (rule) rule.enabled = true;
  }

  /**
   * Disable a rule by ID.
   */
  disableRule(ruleId: string): void {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (rule) rule.enabled = false;
  }

  /**
   * Evaluate all enabled rules against a manifest.
   */
  evaluate(manifest: ExtensionManifest): ExtensionRisk {
    const findings: Finding[] = [];
    let totalScore = 0;

    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      const finding = rule.evaluate(manifest);
      if (finding) {
        findings.push(finding);
        totalScore += rule.weight;
      }
    }

    // Cap score at 100
    const score = Math.min(totalScore, 100);
    const label = this.scoreToLabel(score);

    return {
      extensionName: manifest.name,
      extensionPath: manifest.extensionPath,
      score,
      label,
      findings,
    };
  }

  /**
   * Evaluate rules against multiple manifests.
   */
  evaluateAll(manifests: ExtensionManifest[]): ExtensionRisk[] {
    return manifests.map((m) => this.evaluate(m));
  }

  /**
   * Get all rules (including disabled ones).
   */
  getRules(): RiskRule[] {
    return this.rules;
  }

  /**
   * Get only enabled rules.
   */
  getEnabledRules(): RiskRule[] {
    return this.rules.filter((r) => r.enabled);
  }

  /**
   * Get IDs of applied (enabled) rules.
   */
  getAppliedRuleIds(): string[] {
    return this.rules.filter((r) => r.enabled).map((r) => r.id);
  }

  private scoreToLabel(score: number): import("../types.js").Severity {
    if (score >= 75) return "critical";
    if (score >= 50) return "high";
    if (score >= 25) return "medium";
    if (score > 0) return "low";
    return "info";
  }
}
