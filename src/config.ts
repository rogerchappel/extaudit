// extaudit - Configuration loader for .extaudit.json
import { readFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { ExtAuditConfig } from "./types.js";

const DEFAULT_CONFIG: ExtAuditConfig = {
  scanDirs: [],
  disabledRules: [],
  enabledRules: [],
  failThreshold: 50,
  outputDir: undefined,
};

/**
 * Try to load config from multiple locations (first that exists wins).
 * Search order: cwd/.extaudit.json, then up the tree, then home dir.
 */
export async function loadConfig(startDir: string = process.cwd()): Promise<ExtAuditConfig> {
  const dirs: string[] = [process.cwd()];

  // Also try the home directory
  if (process.env.HOME) {
    dirs.push(process.env.HOME);
  }

  for (const dir of dirs) {
    const configPath = join(dir, ".extaudit.json");
    try {
      await access(configPath);
      const content = await readFile(configPath, "utf-8");
      const parsed = JSON.parse(content) as ExtAuditConfig;
      return { ...DEFAULT_CONFIG, ...parsed };
    } catch {
      // File doesn't exist or is unreadable, try next location
    }
  }

  return { ...DEFAULT_CONFIG };
}
