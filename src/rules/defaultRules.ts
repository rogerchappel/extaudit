// extaudit - Default risk rules
import type { ExtensionManifest, Finding, RiskRule } from "../types.js";

/**
 * All default risk rules available in extaudit.
 * Each rule evaluates a manifest and returns a Finding if triggered.
 */
function createRules(): RiskRule[] {
  return [
    {
      id: "dangerous-permissions-filesystem",
      name: "Dangerous Filesystem Permissions",
      description: "Extension requests filesystem write capabilities beyond read-only",
      category: "permissions",
      severity: "high",
      weight: 25,
      enabled: true,
      evaluate: (m: ExtensionManifest): Finding | null => {
        const raw = m.raw;
        const capabilities = (raw.capabilities as Record<string, unknown>) ?? {};
        const workspace = (capabilities.workspace as Record<string, boolean>) ?? {};
        if (String(workspace.support) === "full" || workspace.support === true || String(workspace.support) === "trust") {
          return {
            ruleId: "dangerous-permissions-filesystem",
            description: "Extension has full workspace access capability",
            severity: "high",
            extensionName: m.name,
            extensionPath: m.extensionPath,
            evidence: ["capabilities.workspace.support = full"],
          };
        }
        return null;
      },
    },
    {
      id: "dangerous-permissions-net",
      name: "Dangerous Network Permissions",
      description: "Extension declares network-related permissions",
      category: "permissions",
      severity: "medium",
      weight: 15,
      enabled: true,
      evaluate: (m: ExtensionManifest): Finding | null => {
        const raw = m.raw;
        const capabilities = (raw.capabilities as Record<string, unknown>) ?? {};
        const virtualWorkspaces = capabilities.virtualWorkspaces;
        if (virtualWorkspaces) {
          const supported = (virtualWorkspaces as Record<string, boolean>).supported;
          if (supported === true || supported === undefined) {
            return {
              ruleId: "dangerous-permissions-net",
              description: "Extension has virtual workspace support (network implications)",
              severity: "medium",
              extensionName: m.name,
              extensionPath: m.extensionPath,
              evidence: ["capabilities.virtualWorkspaces present"],
            };
          }
        }
        // Check activationEvents for remote patterns
        const remoteEvents = m.activationEvents.filter(
          (e: string) => e.includes("remote") || e.includes("remoteAuthority")
        );
        if (remoteEvents.length > 0) {
          return {
            ruleId: "dangerous-permissions-net",
            description: "Extension activates on remote events",
            severity: "medium",
            extensionName: m.name,
            extensionPath: m.extensionPath,
            evidence: remoteEvents,
          };
        }
        return null;
      },
    },
    {
      id: "network-fetch-import",
      name: "Fetch/HTTP Import Detected",
      description: "Extension dependencies or scripts reference fetch/https",
      category: "network",
      severity: "medium",
      weight: 20,
      enabled: true,
      evaluate: (m: ExtensionManifest): Finding | null => {
        const patterns: RegExp[] = [
          /\.fetch\(/i,
          /https?:\/\//i,
          /\bhttps\b/i,
          /\bhttp\b/i,
          /undici/i,
          /axios/i,
          /node-fetch/i,
          /got\b/i,
          /bent\b/i,
        ];
        const allDeps = new Set([
          ...Object.keys(m.dependencies),
          ...Object.keys(m.devDependencies),
        ]);
        const matches: string[] = [];
        for (const dep of allDeps) {
          if (/undici|axios|node-fetch|got\b|bent\b/i.test(dep)) {
            matches.push(`dependency: ${dep}`);
          }
        }
        // Check scripts for URLs
        for (const [name, script] of Object.entries(m.scripts)) {
          const scriptStr = String(script);
          if (patterns.some((p) => p.test(scriptStr))) {
            matches.push(`script.${name}: ${scriptStr}`);
          }
        }
        if (matches.length > 0) {
          return {
            ruleId: "network-fetch-import",
            description: "Network-related imports or scripts detected",
            severity: "medium",
            extensionName: m.name,
            extensionPath: m.extensionPath,
            evidence: matches,
          };
        }
        return null;
      },
    },
    {
      id: "network-activation-on-startup",
      name: "Activation on Startup",
      description: "Extension activates on * (all startup), potential for silent execution",
      category: "network",
      severity: "high",
      weight: 20,
      enabled: true,
      evaluate: (m: ExtensionManifest): Finding | null => {
        if (m.activationEvents.includes("*")) {
          return {
            ruleId: "network-activation-on-startup",
            description: "Extension activates on all startup events (*)",
            severity: "high",
            extensionName: m.name,
            extensionPath: m.extensionPath,
            evidence: ['activationEvents includes "*"'],
          };
        }
        return null;
      },
    },
    {
      id: "scripts-postinstall",
      name: "Postinstall Script Detected",
      description: "Extension has a postinstall script that runs on npm install",
      category: "scripts",
      severity: "critical",
      weight: 35,
      enabled: true,
      evaluate: (m: ExtensionManifest): Finding | null => {
        if (m.hasPostInstall) {
          return {
            ruleId: "scripts-postinstall",
            description: "Extension has a postinstall script",
            severity: "critical",
            extensionName: m.name,
            extensionPath: m.extensionPath,
            evidence: [`postinstall: ${m.scripts.postinstall}`],
          };
        }
        return null;
      },
    },
    {
      id: "scripts-preinstall",
      name: "Preinstall Script Detected",
      description: "Extension has a preinstall script that runs before npm install",
      category: "scripts",
      severity: "high",
      weight: 25,
      enabled: true,
      evaluate: (m: ExtensionManifest): Finding | null => {
        if (m.scripts.preinstall && m.scripts.preinstall.length > 0) {
          return {
            ruleId: "scripts-preinstall",
            description: "Extension has a preinstall script",
            severity: "high",
            extensionName: m.name,
            extensionPath: m.extensionPath,
            evidence: [`preinstall: ${m.scripts.preinstall}`],
          };
        }
        return null;
      },
    },
    {
      id: "scripts-install",
      name: "Install Script Detected",
      description: "Extension has a custom install script",
      category: "scripts",
      severity: "high",
      weight: 20,
      enabled: true,
      evaluate: (m: ExtensionManifest): Finding | null => {
        if (m.scripts.install && m.scripts.install.length > 0) {
          return {
            ruleId: "scripts-install",
            description: "Extension has a custom install script",
            severity: "high",
            extensionName: m.name,
            extensionPath: m.extensionPath,
            evidence: [`install: ${m.scripts.install}`],
          };
        }
        return null;
      },
    },
    {
      id: "publisher-unknown",
      name: "Unknown/Empty Publisher",
      description: "Extension has no publisher information",
      category: "publisher",
      severity: "low",
      weight: 10,
      enabled: true,
      evaluate: (m: ExtensionManifest): Finding | null => {
        if (!m.publisher || m.publisher.length === 0) {
          return {
            ruleId: "publisher-unknown",
            description: "Extension has no publisher field",
            severity: "low",
            extensionName: m.name,
            extensionPath: m.extensionPath,
            evidence: ["publisher field is missing or empty"],
          };
        }
        return null;
      },
    },
    {
      id: "publisher-unverified",
      name: "Publisher Not Verified",
      description: "Extension publisher does not have a verifiedCreator field",
      category: "publisher",
      severity: "medium",
      weight: 15,
      enabled: true,
      evaluate: (m: ExtensionManifest): Finding | null => {
        const raw = m.raw;
        if (raw.verifiedCreator) return null;
        if (m.publisher) {
          return {
            ruleId: "publisher-unverified",
            description: "Extension publisher is not verified",
            severity: "medium",
            extensionName: m.name,
            extensionPath: m.extensionPath,
            evidence: [`publisher: ${m.publisher} (not verified)`],
          };
        }
        return null;
      },
    },
  ];
}

export default createRules;
