// extaudit - Package.json parser for extension manifests
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionManifest } from "./types.js";

/**
 * Read and parse a package.json file from the given directory.
 * Returns null if the file doesn't exist or is invalid JSON.
 */
export async function readPackageJson(dir: string): Promise<Record<string, unknown> | null> {
  const pkgPath = join(dir, "package.json");
  try {
    const content = await readFile(pkgPath, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Check if a parsed package.json looks like a VSCode/Cursor extension.
 * Extensions typically have "engines.vscode" or "activationEvents" fields.
 */
export function isExtensionManifest(pkg: Record<string, unknown>): boolean {
  if (pkg.engines) {
    const engines = pkg.engines as Record<string, unknown>;
    if (engines.vscode) return true;
  }
  if (Array.isArray(pkg.activationEvents)) return true;
  // Some extensions may only have a "contributes" field
  if (pkg.contributes) return true;
  return false;
}

/**
 * Parse a raw package.json into a structured ExtensionManifest.
 */
export function parseManifest(pkg: Record<string, unknown>, extensionPath: string): ExtensionManifest {
  const scripts = (pkg.scripts as Record<string, string>) ?? {};
  const hasPostInstall = "postinstall" in scripts && typeof scripts.postinstall === "string" && scripts.postinstall.length > 0;

  return {
    name: (pkg.name as string) ?? "unknown",
    version: (pkg.version as string) ?? "0.0.0",
    displayName: pkg.displayName as string | undefined,
    description: pkg.description as string | undefined,
    publisher: typeof pkg.publisher === "string"
      ? pkg.publisher
      : (pkg.publisher as Record<string, unknown> | undefined)?.name as string | undefined,
    activationEvents: safeStringArray(pkg.activationEvents),
    dependencies: (pkg.dependencies as Record<string, string>) ?? {},
    devDependencies: (pkg.devDependencies as Record<string, string>) ?? {},
    scripts,
    extensionPath,
    hasPostInstall,
    raw: pkg,
  };
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}
