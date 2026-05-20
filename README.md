# extaudit - VSCode/Cursor Extension Security Auditor [![CI](https://github.com/rogerchappel/extaudit/actions/workflows/ci.yml/badge.svg)](https://github.com/rogerchappel/extaudit/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/extaudit)](https://www.npmjs.com/package/extaudit)

> 🔍 Your extensions are talking to the internet. Make sure they're saying the right things.

After the [GitHub breach of 3,800+ repos via malicious VSCode extensions](https://www.bleepingcomputer.com/news/security/microsoft-confirms-supply-chain-attack-via-malicious-vscodium-extensions/) (May 2026), the question isn't *if* your extensions are safe — it's *how do you know?*

**extaudit** is a local-first, offline-capable CLI that audits VSCode/Cursor extension manifests for suspicious permissions, network access patterns, and security anomalies. No telemetry. No remote calls. Just fast, deterministic scanning you can run anywhere — including CI.

## Why?

- VSCode extensions have access to your entire workspace, file system, and can run arbitrary code
- The VSCode Marketplace has **no mandatory security review**
- Supply-chain attacks via extensions are rising (see GitHub breach, CloakBrowser)
- Existing tools are web-based or require heavy analysis — extaudit is a lightweight local scanner

## Quick Start

```bash
npm install -g extaudit
# or
npx extaudit scan ~/.vscode/extensions
```

## Commands

### `extaudit scan <dirs...>`
Scan extension directories for security risks.

```bash
# Scan VSCode extensions
extaudit scan ~/.vscode/extensions

# Scan multiple directories
extaudit scan ~/.vscode/extensions ~/.cursor/extensions

# Output as JSON (for CI/automation)
extaudit scan ~/.vscode/extensions --json

# Output as Markdown report
extaudit scan ~/.vscode/extensions --markdown

# Scan example fixtures
extaudit scan fixtures/example-extensions/
```

### `extaudit rules`
List all available security rules with status.

```bash
extaudit rules
```

### `extaudit report <file>`
Generate a reformatted report from a saved JSON scan result.

```bash
extaudit report scan-results.json --format markdown
```

## Risk Scoring

Each extension gets a score from 0-100 based on applicable rules:

| Score | Severity | Meaning |
|:-----:|:--------:|---------|
| 0     | Info     | No findings — extension looks clean |
| 1-24  | Low      | Minor concerns (unverified publisher) |
| 25-49 | Medium   | Network access, remote activation |
| 50-74 | High     | Suspicious scripts, broad permissions |
| 75-100| Critical | Postinstall scripts, multiple red flags |

## Configurable Rules

All rules can be enabled/disabled via `.extaudit.json`:

```json
{
  "scanDirs": ["~/.vscode/extensions", "~/.cursor/extensions"],
  "disabledRules": ["publisher-unverified"],
  "failThreshold": 50
}
```

### Built-in Rules

| Rule ID | Category | Severity | Description |
|---------|----------|----------|-------------|
| `dangerous-permissions-filesystem` | permissions | High | Extension has full workspace access |
| `dangerous-permissions-net` | permissions | Medium | Network-related permissions detected |
| `network-fetch-import` | network | Medium | Fetch/HTTP imports detected |
| `network-activation-on-startup` | network | High | Activates on all startup (*) |
| `scripts-postinstall` | scripts | Critical | Postinstall script found |
| `scripts-preinstall` | scripts | High | Preinstall script found |
| `scripts-install` | scripts | High | Custom install script found |
| `publisher-unknown` | publisher | Low | No publisher field |
| `publisher-unverified` | publisher | Medium | Publisher not verified |

## Safety Notes

⚠️ **extaudit is a static analyzer, not a malware scanner.** It:
- ✅ Reads `package.json` manifests only
- ✅ Never executes extension code
- ✅ Never sends data to remote servers by default
- ✅ Works fully offline
- ❌ Does not analyze binary blobs or bytecode
- ❌ Does not guarantee an extension is safe (only flags known patterns)

## CI/CD Integration

```yaml
- name: Audit VSCode extensions
  run: npx extaudit scan ~/.vscode/extensions --json | jq '.extensions[] | select(.score >= 50)'
```

Non-zero exit code when max risk score exceeds `failThreshold` (default: 50).

## License

MIT
