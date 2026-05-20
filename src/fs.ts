// extaudit - Filesystem utilities for extension scanning
import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

/**
 * Default directories where VSCode/Cursor extensions are installed.
 * These are expanded from user home (~) at runtime.
 */
export const DEFAULT_SCAN_DIRS = [
  "~/.vscode/extensions",
  "~/.cursor/extensions",
];

/**
 * Resolve a path that may contain ~ to the user's home directory.
 */
export function resolveHomePath(p: string): string {
  if (p.startsWith("~/")) {
    return join(process.env.HOME ?? "", p.slice(2));
  }
  return p;
}

/**
 * Scan a single directory and return subdirectory names that look like extensions.
 * An extension directory contains a package.json file.
 */
export async function findExtensionDirs(dir: string): Promise<string[]> {
  const resolved = resolve(resolveHomePath(dir));
  let entries: string[];
  try {
    entries = await readdir(resolved);
  } catch {
    return [];
  }

  const extensionDirs: string[] = [];
  for (const entry of entries) {
    const entryPath = join(resolved, entry);
    const pkgPath = join(entryPath, "package.json");
    try {
      const s = await stat(pkgPath);
      if (s.isFile()) {
        extensionDirs.push(entryPath);
      }
    } catch {
      // Not an extension directory, skip
    }
  }
  return extensionDirs.sort();
}

/**
 * Resolve and filter scan directories to only those that exist on disk.
 */
export async function resolveScanDirs(dirs?: string[]): Promise<string[]> {
  const input = dirs ?? DEFAULT_SCAN_DIRS;
  const results: string[] = [];
  for (const dir of input) {
    const resolved = resolveHomePath(dir);
    try {
      const s = await stat(resolved);
      if (s.isDirectory()) {
        results.push(resolved);
      }
    } catch {
      // Directory does not exist, skip
    }
  }
  return results;
}
