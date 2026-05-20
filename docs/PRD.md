# PRD: extaudit

Status: in-progress

## Summary

ExtAudit is a local-first TypeScript CLI that audits VSCode/Cursor extension manifests for suspicious permissions, network access patterns, and security anomalies. It scans installed `package.json` manifests, checks activation events, detected network permissions, and known risky APIs to produce a risk-scored report with actionable findings.

Built for developers and agentic workflows that install third-party extensions and want deterministic, offline verification before trusting them with workspace access.

## Inspiration

- GitHub confirmed breach of 3,800+ repos via malicious VSCode extension (BleepingComputer, May 2026).
- `CloakBrowser` (17k stars) shows demand for extension-level security tooling.
- Existing tools are web-based or heavy; no local-first CLI for extension audit.

Reframed: rather than replicating web scanners, extaudit is a fast local scanner that works offline, produces JSON/Markdown reports, and can run in CI on fresh machines.

## Scorecard

Total: 84/100
Band: build now

| Criterion | Points | Notes |
|---|---:|---|
| Problem pain | 17/20 | Extension supply-chain attacks are rising; developers install dozens of extensions blind. |
| Demand signal | 17/20 | GitHub breach headlines prove urgency; VSCode marketplace has no mandatory security review. |
| V1 buildability | 19/20 | JSON parsing of package.json is straightforward; risk rules are pattern-based; fixtures are trivial. |
| Differentiation | 12/15 | Differentiates through local-first, offline, CI-ready, JSON reports, and focus on agentic IDE extensions (Cursor, Claude Code, Cline). |
| Agentic workflow leverage | 12/15 | Agents install extensions; agents should audit them too. CI integration for automated gate. |
| Distribution potential | 7/10 | `extaudit` is short, memorable, searchable. Niche but high-value. |

## MVP

- Scan `~/.vscode/extensions` and `~/.cursor/extensions` directories
- Parse `package.json` for each extension
- Detect: `postinstall` scripts, `fetch`/`https`/`net` imports, `activationEvents` breadth, unknown publishers
- Risk scoring with configurable rules
- Output: JSON report, human-readable summary
- CLI: `extaudit scan [dir]`, `extaudit rules`, `extaudit report`

## Tech stack

TypeScript, Node.js CLI, no external dependencies for core scanning

## Non-goals

- No malware disassembly or bytecode analysis
- No remote reputation check by default (opt-in)
- No extension uninstallation or modification
