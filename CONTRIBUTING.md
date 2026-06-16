# Contributing

Thanks for improving `extaudit`.

## Local Setup

```bash
npm install
npm run release:check
```

For the full repository validation path, run:

```bash
bash scripts/validate.sh
```

## Pull Requests

- Keep scanner and scoring changes focused.
- Add fixtures for new extension-risk patterns.
- Update README rule counts and examples when rules change.
- Run `npm run release:check` before opening a PR.

## Safety Expectations

`extaudit` should remain local-first. Do not add telemetry, remote manifest submission, or credential collection to scanning paths.
