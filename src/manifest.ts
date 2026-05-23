import * as fs from "fs"
import * as path from "path"
import { ExtensionManifest } from "./types.js"

export function looksLikeExtension(dir: string): boolean {
  const pkgPath = path.join(dir, "package.json")
  try {
    if (!fs.statSync(pkgPath).isFile()) return false
    const raw = JSON.parse(fs.readFileSync(pkgPath, "utf-8"))
    return (
      typeof raw === "object" &&
      raw !== null &&
      "engines" in raw &&
      typeof raw.engines === "object" &&
      raw.engines !== null &&
      "vscode" in (raw.engines as Record<string, unknown>)
    )
  } catch {
    return false
  }
}

export function parseManifest(pkgJsonPath: string, baseDir: string): ExtensionManifest {
  const raw = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8")) as Record<string, unknown>

  let publisher: string | undefined
  if (typeof raw.publisher === "string") publisher = raw.publisher
  else if (typeof raw.publisher === "object" && raw.publisher !== null && typeof (raw.publisher as any).name === "string")
    publisher = (raw.publisher as any).name

  return {
    raw, path: pkgJsonPath,
    name: (raw.name as string) || "unknown", version: (raw.version as string) || "0.0.0",
    publisher, displayName: raw.displayName as string | undefined,
    description: raw.description as string | undefined,
    activationEvents: Array.isArray(raw.activationEvents) ? raw.activationEvents as string[] : undefined,
    main: raw.main as string | undefined,
    scripts: isMap(raw.scripts) ? raw.scripts as Record<string, string> : undefined,
    dependencies: isMap(raw.dependencies) ? raw.dependencies as Record<string, string> : undefined,
    devDependencies: isMap(raw.devDependencies) ? raw.devDependencies as Record<string, string> : undefined,
    extensionKind: raw.extensionKind as string | string[] | undefined,
    capabilities: isMap(raw.capabilities) ? raw.capabilities as Record<string, unknown> : undefined,
    directory: baseDir,
  }
}

export function discoverExtensions(roots: string[]): Array<{ directory: string; packageJson: string }> {
  const results: Array<{ directory: string; packageJson: string }> = []
  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    scanDir(root, results)
  }
  return results
}

const SKIP = new Set(["vscode", "ms-vscode", "typescript-language-features", "markdown-language-features",
  "git", "git-ui", "json-language-features", "html-language-features", "css-language-features",
  "emmet", "debug-auto-launch", "merge-conflict", "search-result", "theme-defaults",
  "configuration-editing", "extension-editing", "npm", "npm-intellisense", "typescript",
  "javascript", "log", "references-view", "github", "github-authentication", "media-preview",
  "simple-browser", "ipynb", "python", "ruby", "clojure", "coffeescript", "dart", "go", "rust", "yaml"])

function scanDir(dir: string, results: Array<{ directory: string; packageJson: string }>, depth: number = 0) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return
  if (depth > 3) return // prevent runaway recursion
  if (looksLikeExtension(dir)) {
    results.push({ directory: dir, packageJson: path.join(dir, "package.json") })
    return
  }
  try {
    for (const entry of fs.readdirSync(dir)) {
      if (entry.startsWith(".") || entry === "node_modules" || SKIP.has(entry.toLowerCase())) continue
      const cp = path.join(dir, entry)
      try {
        if (!fs.statSync(cp).isDirectory()) continue
      } catch { continue }
      if (looksLikeExtension(cp)) {
        results.push({ directory: cp, packageJson: path.join(cp, "package.json") })
      } else if (depth < 2) {
        // recurse into subdirectories for nested fixture trees
        scanDir(cp, results, depth + 1)
      }
    }
  } catch { /* ignore */ }
}

function isMap(v: unknown): boolean {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}
