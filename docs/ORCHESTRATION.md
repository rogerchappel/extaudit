# ExtAudit Orchestration

ExtAudit is small enough to maintain as a single-package Node CLI. Keep work in
focused branches with fixture-backed changes, then run the same release gate
before review:

```sh
npm ci
npm run release:check
```

## Quality Gates

- `npm run check` verifies TypeScript types.
- `npm test` runs the rule, manifest, scorer, and reporter suites.
- `npm run build` emits the distributable CLI.
- `npm run smoke` scans the bundled fixtures and verifies CLI wiring.
- `npm pack --dry-run` confirms package contents before release.

## Release Flow

Releases are reviewed. The release workflow creates a GitHub Release from a tag
after ReleaseBox and the local release checks pass. npm publishing is disabled
unless explicitly enabled for a future release.
