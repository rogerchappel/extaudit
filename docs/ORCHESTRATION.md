# diffscope - ORCHESTRATION.md

## Sub-agent build plan

This project follows the standard StackForge OSS CLI build pattern:

1. Wave 0 (done by scaffold): Baseline project structure
2. Wave 1: Diff parser and scanner implementation with unit tests
3. Wave 2: Risk classification engine with fixtures and categorization
4. Wave 3: Reporting engine and output commands
5. Wave 4: Polish, README, smoke tests, CI

## Verification commands

```bash
npm test          # Unit tests
npm run build     # TypeScript compilation
bash scripts/validate.sh  # Full validation pipeline
diffscope from-diff fixtures/basic.patch  # Real smoke test
```

## Commit target

~30-50 atomic commits. Split by: scaffold, parser, classifier, rules, tests, reporting, docs, CLI commands, fixtures.
