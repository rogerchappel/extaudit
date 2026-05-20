# extaudit - TASKS.md

## Wave 0: Scaffold & Baseline
- [x] Initialize git repo, package.json, tsconfig
- [x] Create project structure (src/, tests/, fixtures/
- [x] Set up CLI entry point with `src/index.ts`
- [x] Configure releasebox, CI workflows, validate script

## Wave 1: Core Scanning Engine
- [ ] Implement ExtensionScanner: scan directories, parse package.json
- [ ] Implement FileSystem: resolve extension dirs, handle cross-platform paths
- [ ] Implement Parser: extract activation events, dependencies, scripts
- [ ] Unit tests for scanner with fixtures
- [ ] CLI `extaudit scan [dir...]` command

## Wave 2: Risk Rules Engine
- [ ] Define risk rule schema: patterns, severity, match strategy
- [ ] Implement default rules: dangerous permissions, network access, postinstall, unknown publishers
- [ ] Implement Rule Engine: apply rules to parsed extension data, produce findings
- [ ] Unit tests for each rule category with fixtures
- [ ] CLI `extaudit rules [list|enable|disable]` command
- [ ] Configurable rules via `.extaudit.json`

## Wave 3: Reporting & Output
- [ ] Implement JSON report generation with findings, scores, metadata
- [ ] Implement human-readable report (summary, findings by severity)
- [ ] CLI `extaudit report` command with format selection
- [ ] Exit codes based on risk thresholds
- [ ] Integration tests with multi-extension fixtures

## Wave 4: CI & Polish
- [ ] CI workflow: lint, test, build, validate
- [ ] README with personality, examples, safety notes
- [ ] Contributing guide, code of conduct
- [ ] Package metadata: description, keywords, repository, homepage
- [ ] Smoke tests: real fixture scans, report generation
- [ ] ReleaseBox config for tag-gated releases
