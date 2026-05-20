// extaudit - Report command implementation
import { readFile, writeFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import { generateJsonReport } from "../report/json.js";
import { generateMarkdownReport } from "../report/markdown.js";
import { computeSummary } from "../report/summary.js";

export interface ReportOptions {
  format?: string;
  output?: string;
}

export async function reportCommand(file: string, options: ReportOptions = {}): Promise<void> {
  try {
    const content = await readFile(file, "utf-8");
    const data = JSON.parse(content);

    const extensions = data.extensions ?? [];
    const summary = computeSummary(extensions);
    const version = data.version ?? "0.1.0";
    const scannedDirectories = data.scannedDirectories ?? [];
    const appliedRules = data.appliedRules ?? [];

    const format = (options.format ?? "json").toLowerCase();

    let output: string;
    if (format === "markdown" || format === "md") {
      output = generateMarkdownReport({
        version,
        scannedDirectories,
        extensions,
        appliedRules,
        summary,
      });
    } else {
      // Re-generate JSON to ensure consistent format
      output = generateJsonReport({
        version,
        scannedDirectories,
        extensions,
        appliedRules,
      });
    }

    if (options.output) {
      await writeFile(options.output, output, "utf-8");
      console.log(`Report written to ${options.output}`);
    } else {
      console.log(output);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.error(`Error: File not found: ${file}`);
      process.exit(1);
    }
    console.error(`Error reading report: ${err}`);
    process.exit(1);
  }
}
