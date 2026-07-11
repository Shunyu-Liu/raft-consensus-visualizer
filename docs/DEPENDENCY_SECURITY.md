# Dependency Security

## Release Baseline

Phase 11 validates the project on Node.js 24.14.0.

The previous Vite 5 and Vitest 2 development toolchain reported audit findings in Vite, Vitest, vite-node, @vitest/mocker, @vitest/coverage-v8, and esbuild. Those packages are development tooling for local testing and static builds; they are not shipped as runtime dependencies in the static application bundle.

## Resolution

The development toolchain was upgraded in Phase 11:

- Vite 8.1.4
- Vitest 4.1.10
- @vitest/coverage-v8 4.1.10
- @vitejs/plugin-react 6.0.3
- @types/node 24.x

After the upgrade, `npm audit` and `npm audit --production` reported zero vulnerabilities.

## Current Audit Status

| Scope | Result |
| --- | --- |
| Production dependencies | 0 known audit findings |
| Development dependencies | 0 known audit findings |

## Notes

Do not use `npm audit fix --force` without reviewing the resulting major upgrades. For release work, prefer controlled dependency updates followed by:

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run test:coverage
npm run build
npm run check
```

The production build is a static Vite output. No backend service, server-side runtime, database, account system, telemetry, or secret-bearing API integration is included.
