# Contributing to extaudit

Welcome! This guide covers how to contribute to extaudit development.

## Development Setup

### Prerequisites

- Node.js >= 18
- npm (or pnpm/yarn)
- TypeScript 5.x (installed as dev dependency)

### Install Dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

This compiles `src/**/*.ts` → `dist/**/*.js`.

### Run Tests

```bash
# Run test suite
node --test tests/*.test.js

# Or use npm script
npm test
```

### Smoke Test

```bash
npm run smoke
```

This scans the `fixtures/example-extensions/` directory with the built CLI.

## Code Style

- TypeScript strict mode (`strict: true`)
- ESM modules (Node16)
- Single-quoted strings
- Semicolons required
- No type assertions unless necessary

## Making Changes

### Adding a New Rule

1. Add the rule definition to `src/rules/defaultRules.ts`
2. Add test coverage in `tests/rules.test.js`
3. Add a fixture extension in `fixtures/example-extensions/` that triggers the rule
4. Update the rules table in `README.md`

### Adding a New CLI Command

1. Add command handler in `src/commands/<name>.ts`
2. Register command in `src/index.ts` with commander
3. Add integration tests in `tests/cli.test.js`

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Ensure `npm test` passes
4. Ensure `npm run build` succeeds
5. Run `bash scripts/validate.sh`
6. Submit PR with a clear description of changes

## Commit Messages

Follow conventional commits:

- `feat:` new features
- `fix:` bug fixes  
- `test:` test additions/changes
- `docs:` documentation updates
- `chore:` tooling, config, dependencies
- `ci:` CI/CD changes

Keep commit messages concise and informative. Each commit should be atomic.

## Questions?

Open an issue on [GitHub](https://github.com/rogerchappel/extaudit/issues).
