---
title: How to contribute
description: Licence, sign-off and what a pull request needs.
sidebar:
  order: 1
---

Bug reports, ideas, translations, scenarios and code are all welcome.

## Licence

TTX-Zone is released under the GNU AGPL v3.0 or later, with the additional terms in `NOTICE`. By contributing, you agree that your contribution is licensed under those same terms.

Every commit must be signed off under the [Developer Certificate of Origin](https://developercertificate.org/), a statement that you wrote the change or have the right to submit it:

```bash
git commit -s -m "fix(msel): keep the inject order after a renumber"
```

Pull requests with unsigned commits can't be merged.

## Before you open a pull request

- Open an issue first for anything larger than a small fix, so we can agree on the approach.
- Write code, comments and commit messages in technical English. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).
- Put every user-facing string into both `frontend/src/locales/en.json` and `es.json`. Spanish uses *tú*.
- Run [the same checks as CI](/contributing/development/#checks).
- If users can see the change, update its page in the [documentation](/contributing/documentation/) in the same pull request.

## Security issues

Don't report vulnerabilities in public issues. `SECURITY.md` explains how to report them privately.

## Where to go next

- [Development setup](/contributing/development/)
- [Architecture](/contributing/architecture/)
- [Scenario format](/contributing/scenarios/)
- [Inject catalog](/contributing/inject-catalog/)
- [Knowledge base](/contributing/knowledge-base/)
- [Documentation](/contributing/documentation/)
