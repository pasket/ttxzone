# Documentation strategy

Where the product's documentation lives, in what form, how it gets published and how it stays current. The site is in `docs/site/`.

## Where it lives

| Place | Holds |
|---|---|
| This repository | All product documentation: user, instance administration, API, contributors |
| A separate website | Marketing only, linking to the documentation. Guides may link to its videos |
| GitHub | README, CONTRIBUTING, SECURITY and CHANGELOG. No wiki |

Documentation changes in the same commit as the code, and each tag carries its own. That matters for a self-hosted product, where every operator may run a different version, and lets the community correct it by pull request. A wiki would be a separate repository with no review and no version per tag.

The boundary: **the site explains how to use the product; `docs/` explains how it's built.** `docs/` is the internal reference for whoever changes the code (component names, implementation traps) and isn't published on the site. It is cited by path from the `CLAUDE.md` files, the README, the code and the tests, so it stays where it is.

One exception to writing a fact once: `docs/deployment.md`, `docs/architecture/backup-and-restore.md`, `docs/architecture/email.md` and `docs/architecture/sso.md` stay whole, because code, configuration files and tests cite them by path and section, and they hold the detail the instance administration section leaves out. A change to what an operator does updates both.

## Format

Markdown source, HTML generated; MDX only on a page that needs a component. English only.

## Structure

One site, by audience. Tutorial, how-to, reference and explanation (Diátaxis) guide what each page is, without forcing four folders into every section.

| Section | Audience | Content | Source |
|---|---|---|---|
| User guide (`guide/`) | The exercise's roles | A first exercise end to end, tasks per role, concepts, glossary | Its own pages |
| Instance administration (`instance/`) | Whoever deploys it | Deployment models, installation, configuration, network and ports, backups, email, single sign-on, tenancy, logs, upgrades | Adapted from `docs/deployment.md`, `docs/architecture/backup-and-restore.md`, `docs/architecture/email.md`, `docs/architecture/sso.md`, `docs/architecture/logging.md` |
| API reference | Integrators | Generated from OpenAPI | Automatic |
| Contributing | The community | Architecture overview, the `.ttx.md` and `.kb.md` formats, the inject catalog | Adapted from `docs/features/scenarios.md`, `docs/features/knowledge-base.md`, `docs/features/inject-catalog-authoring.md` |

The user guide follows the exercise's cycle (design, conduct, evaluate, improve), with a short page per role linking to its tasks, and starts from a first exercise end to end. Screenshots only of key screens, in both themes, and a few diagrams where a picture explains the flow.

The API reference publishes every operation, with a notice that the API may change while the product is 0.x.

## Tool

Astro Starlight, with starlight-openapi and starlight-links-validator, versions pinned exactly (Starlight is pre-1.0 and removes options between versions).

- Static search with no external service, so it also works on an isolated network. The API pages are left out of the index (`src/routeData.ts`), so a search for a role finds the guide, not endpoints.
- Node, like the frontend and its CI; Astro needs a recent Node 22.
- `docsLoader` needs `src/content.config.ts`, or Markdown pages are skipped without an error and the link check passes on nothing.
- `npm audit`: an `overrides` entry for `form-data` keeps starlight-openapi's dependency chain clean for the blocking `security` job.

## Publishing

- **Before a release:** nothing public. The site builds locally (`npm run build && npm run preview` in `docs/site/`) and in CI, where the run keeps it for 7 days as the `documentation-site` artifact.
- **On a release:** a static site on GitHub Pages at `docs.ttxzone.com`. `.github/workflows/docs.yml` publishes from a release tag; it does nothing on a tag with a suffix or while the repository is private. Requirements, step by step in `docs/repository-settings.md` §5: Settings → Pages → Source: GitHub Actions, the custom domain there, a `v*.*.*` tag rule on the `github-pages` environment, a `CNAME` from `docs` to `pasket.github.io`, then Enforce HTTPS. Without a custom domain the site would need Astro's `base` for its `/ttx-zone/` path.
- **Versions:** the latest only while the product is 0.x; each tag keeps its source in git.

## Keeping it current

- The `docs` CI job builds the site and checks internal links; `npm audit` also covers `docs/site/`.
- The OpenAPI description is exported and checked for drift in CI, in the manner of `alembic check`; a test requires every operation to have a description (`backend/tests/test_openapi_description.py`).
- A change users can see updates its guide page in the same commit (a root `CLAUDE.md` invariant).
- `npm run docs:screenshots` in `frontend/` regenerates the screenshots in both themes with Playwright over `scripts.seed_demo` (demo exercise in English, `SEED_DEMO_LOCALE`), never by hand. Diagrams are inline SVG in `docs/site/src/components/diagrams/`, with real text and the site's colours.
- The glossary is generated from `frontend/src/locales/en.json` at build time.
- The project's rules apply to the site: long role names in descriptive copy, the external doctrine never named. There's no automatic check for the doctrine, since one would have to spell the term in this repository, so it's searched for by hand before a release.
- The documentation is under the repository's licence.
