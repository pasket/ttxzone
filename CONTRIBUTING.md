# Contributing to TTX-Zone

Thanks for helping improve TTX-Zone. Bug reports, ideas, translations, scenarios and code are all welcome.

## Licence of contributions

TTX-Zone is released under the [GNU AGPL v3.0 or later](./LICENSE) with the additional terms in [`NOTICE`](./NOTICE). By contributing, you agree that your contribution is licensed under those same terms.

Every commit must be signed off under the [Developer Certificate of Origin](https://developercertificate.org/) — a statement that you wrote the change, or otherwise have the right to submit it under the project's licence:

```bash
git commit -s -m "fix(msel): keep the inject order after a renumber"
```

This adds a `Signed-off-by: Your Name <you@example.com>` line matching your git identity. Pull requests with unsigned commits can't be merged.

## Before you open a pull request

- Open an issue first for anything larger than a small fix, so we can agree on the approach.
- Code, comments and commit messages are in technical English; commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat(scope): …`, `fix(scope): …`).
- Every user-facing string goes into both `frontend/src/locales/en.json` and `es.json` (Spanish uses *tú*).
- Run the same checks as CI:

```bash
# backend/
ruff check . && ruff format --check . && pytest

# frontend/
npm run lint && npm run format:check && npm run build && npm test
```

Inside Docker, run the backend tests against the test database only: `docker compose exec -T -e POSTGRES_DB=ttx_zone_test backend pytest -q`.

## Security issues

Don't report vulnerabilities in public issues — see [`SECURITY.md`](./SECURITY.md).
