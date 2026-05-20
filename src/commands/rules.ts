// extaudit - Rules command implementation
import { RuleEngine } from "../rules/engine.js";

export interface RulesOptions {
  list?: boolean;
  enable?: string;
  disable?: string;
}

export async function rulesCommand(options: RulesOptions = {}): Promise<void> {
  const engine = new RuleEngine();
  const rules = engine.getRules();

  // --list is the default behavior
  console.log("extaudit Security Rules");
  console.log("========================");
  console.log("");

  // Group by category
  const categories = new Map<string, typeof rules>();
  for (const rule of rules) {
    const group = categories.get(rule.category) ?? [];
    group.push(rule);
    categories.set(rule.category, group);
  }

  for (const [category, catRules] of categories) {
    console.log(`## ${category}`);
    console.log("");
    for (const rule of catRules) {
      const status = rule.enabled ? "✅" : "❌";
      console.log(
        `  ${status} ${rule.id} [${rule.severity}] weight: ${rule.weight}`
      );
      console.log(`     ${rule.description}`);
    }
    console.log("");
  }
}
