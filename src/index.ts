#!/usr/bin/env node
// extaudit - CLI entry point
// Usage: extaudit <command> [options]

import { Command } from "commander";
import { scanCommand } from "./commands/scan.js";
import { rulesCommand } from "./commands/rules.js";
import { reportCommand } from "./commands/report.js";

const program = new Command();

const cliVersion = "0.1.0";

program
  .name("extaudit")
  .description("Audit VSCode/Cursor extension manifests for security risks")
  .version(cliVersion);

// Scan command
program
  .command("scan <dirs...>")
  .description("Scan extension directories for security risks")
  .option("-j, --json", "Output results as JSON", false)
  .option("-m, --markdown", "Output results as Markdown", false)
  .action(async (dirs: string[], options: { json: boolean; markdown: boolean }) => {
    try {
      await scanCommand(dirs, options);
    } catch (err: unknown) {
      console.error(`Scan failed: ${err}`);
      process.exit(2);
    }
  });

// Rules command
program
  .command("rules")
  .description("List, enable, or disable security rules")
  .action(async () => {
    await rulesCommand();
  });

// Report command
program
  .command("report <file>")
  .description("Generate a report from a JSON scan result file")
  .option("-f, --format <format>", "Output format: json or markdown (default: json)", "json")
  .option("-o, --output <path>", "Write output to file instead of stdout")
  .action(async (file: string, options: { format?: string; output?: string }) => {
    await reportCommand(file, options);
  });

// Handle no-command: show help
if (process.argv.length <= 2) {
  program.help();
}

program.parse(process.argv);
