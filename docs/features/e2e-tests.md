# Browser tests

Real browsers playing a real session against the whole stack, with Playwright (`frontend/e2e/`). The backend and frontend suites stop at the API and at components; these check that the pieces work together.

## Running them

```bash
cd frontend
npx playwright install chromium   # first time
npm run e2e                       # starts the stack, seeds, runs
npm run e2e:down                  # stops the stack
```

On a failure, `test-results/` keeps a screenshot and a trace (`npx playwright show-trace <trace.zip>`).

## The production build

The stack below runs the Vite dev server, which has no chunks, no Content-Security-Policy and no compressed assets. `e2e/production-build.build.ts` covers those against the frontend image alone, with the API faked in the browser: assets compressed and cached for good, no policy violation, the sign-in page within its size budget (`SIGN_IN_BUDGET_KB`, which is what notices a module imported statically into the entry chunk), and a chunk gone after a deployment reloading once. CI runs it in the Production images job, on every run.

```bash
docker build --target prod -t ttxzone-frontend:local frontend
docker run --rm -p 127.0.0.1:8080:8080 ttxzone-frontend:local
cd frontend && npm run e2e:build   # BUILD_URL for another address
```

## Against a deployment

The same tests run against `deploy/`, which covers the reverse proxy, TLS, the production images, the worker and the public face. Done by hand before a release, on an instance that can be thrown away (the seed resets the demo organization):

1. Bring up `deploy/` with `--profile public` and self-signed certificates, for example on `ttx.localhost` (ports 80 and 443) and `play.localhost:8443` as `TTX_PUBLIC_SERVER_NAME`, so its addresses carry the port the browser uses.
2. Seed it from the development image (`docker compose images backend` names it), which has what the production one leaves out (the seed and its dependencies). Mount the current source read-only and the deployment's uploads volume, so the demo's images reach the API: `docker run --rm --network <project>_ttx --env-file .env -e POSTGRES_HOST=postgres -e ENVIRONMENT=development --user 10001 -v "$PWD/../backend:/app:ro" -v <project>_uploads:/app/uploads <dev image> python -m scripts.seed_demo --reset --extras > seed.out`, where `<project>` is the deployment's Compose project name (`-p`, or its folder's name).
3. `E2E_BASE_URL=https://ttx.localhost E2E_PLAYER_URL=https://play.localhost:8443 E2E_SEED_OUTPUT=/path/to/seed.out npm run e2e`. Without `E2E_PLAYER_URL` the Players use the internal face too.

`assistant-aar` and `assistant-msel` need the assistant on: `ASSISTANT_ENABLED=true` in `.env`. A session played can't be played again, so seed again before another run.

## The stack

`e2e/docker-compose.yml` is its own Compose project (`ttxzone-e2e`): the development images, a Postgres on `tmpfs`, uploads and logs on `tmpfs`, and only the frontend published, on `127.0.0.1:15173`. It runs beside the development stack and never touches its data.

`e2e/globalSetup.ts` starts it and runs `scripts.seed_demo --reset --extras`, so every run begins from exercises not yet played: one per test, from the scenarios `ransomware`, `poisoned-package` (polls) and `connected-plant` (rooms, with player1 and player2 seated apart and player3 without a room), plus `platform@demo.example.com` as instance administrator. The stack stays up between runs. `backend/tests` is mounted because the seed uses the test suite's payload builders, which no image carries.

Playwright runs on the host, with the browser's language in English: selectors use the English copy, and the exercise's content is the seed's, in Spanish.

## Writing a test

- A file is `*.e2e.ts`, a name Vitest doesn't pick up.
- `atTheTable(browser, exercise, players)` opens the Controller and each Player in a browser of their own, on the seed's exercise of that key, with the Players' live stream open.
- A session played can't be played again: a new test needs an exercise of its own (`EXTRA_EXERCISES` in `scripts/seed_demo.py`). One worker, since tests share accounts.
- A TOTP code works once, so an account signs in once per run; `signedIn` keeps its session in `e2e/.auth/` and reuses it.
- Select by role and accessible name; never wait a fixed time. What another browser should see goes through `LIVE`, a timeout below the page's 30 s safety fetch.
- Keep to the paths that cross the whole stack. Permissions and validation belong in the backend suite.

## When they run

Not in CI's regular runs. `.github/workflows/e2e.yml` runs on demand (`gh workflow run e2e.yml`) and from `images.yml` on a release tag, where a failure stops the publication.

## What they cover

| Test | Path |
|---|---|
| `session.e2e.ts` | Controller (with TOTP) and Player: the stream opens, start, an inject released, a decision recorded, the session ended, the feedback form answered |
| `polls.e2e.ts` | Two Players vote on a poll of the MSEL: they see how many voted and never the tally, the Controller reads it, closes the vote and shows the result, the consequence arrives with it, and the impact meters reach the Players when the Controller shows them |
| `rooms.e2e.ts` | Two Players in separate rooms: each told where they are, each room gets only its inject, everyone to the main room, an inject projected, everyone back |
| `rooms-polls.e2e.ts` | A poll played in rooms: one vote per room, each counting its own and settling on its own consequence, and another in the main room once projected |
| `rooms-seats.e2e.ts` | One Player brought to the main room and sent back while the others stay, and a late Player seated mid-session who then gets their room's injects |
| `rooms-evaluation.e2e.ts` | A key question put in one room reaches only its Players and stays to be asked in the other, and an Evaluator's rating in one room leaves the other unrated |
| `assistant-aar.e2e.ts` | The AI assistant on the after-action report: a session played, the report started, a client reading the session through the real MCP endpoint and proposing with evidence, the person accepting on the page, the text saved |
| `assistant-msel.e2e.ts` | The AI assistant on the MSEL: a client proposes, through the real MCP endpoint, a change to an inject (ATT&CK techniques in both domains, objectives) and a new inject; the Planner accepts each on the page (confirming the edit of a ready MSEL), they leave the panel once saved, stay gone after a reload and read as accepted on the server; the panel scanned with axe |
| `a11y.e2e.ts` | Accessibility (below) |

Not covered: how things look.

## Accessibility

Two checks with axe, for WCAG 2.2 A and AA:

- `e2e/a11y.e2e.ts` scans real screens in both themes (`check` in `e2e/axe.ts`): the signed-out pages, the live session for every role (a poll open, the dialog closing it, the result, the Projector), the Creator's sections, the Library, Preferences, Admin and Platform (every section, an account's page and two of its dialogs, as the seed's instance administrator). Only a browser can judge colours. It also enforces one top-level `main` and an `h1` per page, which a screen reader moves around with. `label-content-name-mismatch` stays off: it's experimental and takes decorative glyphs marked `aria-hidden` for visible text.
- `tests/accessibility.test.tsx`, in the regular suite and so in CI: names, roles and structure of shared pieces, in jsdom, which can't see colours.

The same file checks that no screen scrolls sideways at phone width, which axe doesn't look at, and `rooms-evaluation` that a Player's stage keeps its controls apart there.

Axe finds part of what's wrong; keyboard order and screen reader announcements are also checked by hand before a release.
