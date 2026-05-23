# ExtAudit — Product Requirements Document

## Overview

ExtAudit is a local-first TypeScript CLI that audits VSCode/Cursor extension manifests
for suspicious permissions, network access patterns, and security anomalies.

It scans installed `package.json` manifests, checks activation events, detected network
permissions, and known risky APIs to produce a risk-scored report with actionable findings.

## Goals

1. **Security-first**: Catch extensions that exfiltrate data, access the filesystem broadly,
   or execute arbitrary code — before the user even runs them.
2. **Local-first**: Zero network calls during scanning. All rules are deterministic and
   offline-capable.
3. **Actionable**: Every finding includes a severity, explanation, and remediation guidance.
4. **Transparent**: Anyone can inspect the rules that drive the audit engine.

## Architecture

```
src/
├── types.ts           # Core type definitions
├── rules/             # Individual security rules
│   ├── registry.ts    # Rule registry and loading
│   └── *.ts           # Individual rule implementations
├── scanner.ts         # Extension directory scanner
├── scorer.ts          # Risk scoring engine
├── reporter.ts        # Report generation (markdown/JSON)
├── cli.ts             # CLI entry point
└── index.ts           # Library exports
```

## Commands

| Command | Description |
|---------|-------------|
| `extaudit scan [dir]` | Scan extension manifests in a directory |
| `extaudit report` | Show last scan report with risk scores |
| `extaudit rules` | List all security rules being applied |
| `extaudit doctor` | Health check / verify installation |

## Risk Categories

| Category | Score Range | Meaning |
|----------|-------------|--------|
| Safe | 0-9 | No concerning patterns |
| Low | 10-24 | Minor concerns, usually benign |
| Medium | 25-49 | Worth investigating |
| High | 50-74 | Significant risk, review carefully |
| Critical | 75-100 | Very dangerous, avoid or audit thoroughly |

## Security Rules

1. Network access (fetch, http, https in activation events)
2. Filesystem broad access (** workspace patterns)
3. Telemetry (known tracking packages)
4. Shell execution (cp.spawn, exec, child_process)
5. Keylogger risk (keyboard, input, onDidChangeTextDocument)
6. Environment access (process.env)
7. Native modules (node-gyp, prebuild)
8. Obfuscated code (bundled dist, no source maps)
9. Unusual permissions (clipboard, notifications, webview)
10. Dependency chain (known vulns, suspicious names)

## Non-Goals

- Not a VSCode extension itself — it's a post-install audit tool.
- Not a replacement for manual code review.
- Not a runtime sandbox or protection layer.
- Does not phone home or require an internet connection.
