# Agent / contributor guidelines

## Dependencies

Before adding or bumping any npm package:

1. Prefer the latest published version: install with `@latest` (or pin the exact current latest from `npm view <pkg> version`), never invent a version from memory.
2. Run `/check-dep <name>` (or follow `.cursor/skills/check-dep`) before installing a **new** dependency.
3. Immediately after install or lockfile change, run `npm audit`. CI fails on **critical**; do not leave **high/critical** advisories unaddressed without an explicit decision.
4. Periodically (and before releases) check for outdated direct deps: `npm run deps:outdated` (`npm-check-updates`).

CI runs `npm audit --audit-level=high` on every push and PR (see `.github/workflows/security.yml`). Locally:

```bash
npm run audit
npm run deps:outdated
```

## Secrets

Do not commit credentials, tokens, `.env`, or real `settings.json` with passwords. `gitleaks` scans history and staged changes:

```bash
gitleaks detect --source .
```

Install the shared pre-commit hook once per clone:

```bash
git config core.hooksPath .githooks
```

The hook runs `gitleaks protect --staged` and blocks the commit if secrets are detected.

## Security review

For code changes that touch auth, downloads, IPC, proxy, or Electron window options, run `/security review` (or equivalent) before merge.
