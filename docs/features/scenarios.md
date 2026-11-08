# Scenarios (Library → Scenarios)

A **scenario** is a whole exercise packaged for reuse and sharing between teams: its definition (name, description), needs analysis, MSEL and the exercise's own library — cast, threat actors, injects (with their images) and tags. It never carries people, approvals or dates; those are left blank to fill in after copying.

Files: `schemas/scenario.py` (the format), `services/scenario_document.py` (the `.ttx.md` file), `services/scenario_service.py` (export, checks, apply), `services/organization_scenario_service.py` (the organization's library), `data/scenario_catalog.py` + `data/scenarios/` (TTX-Zone's), `endpoints/scenario_library.py`; frontend `components/templates/ScenarioLibrary.tsx`, `ScenarioDialogs.tsx`, `lib/scenarios.ts`. Tests `test_scenario_library.py`, `ScenarioLibrary.test.tsx`.

## Levels and who does what
Same three levels and permission matrix as every library kind (`docs/features/library.md`):
- **TTX-Zone** — `app/data/scenarios/<id>.<language>.ttx.md`, one file per language, loaded and validated once (`scenario_catalog`, `lru_cache`; a broken file fails `test_the_catalog_is_valid_and_bilingual`, never a request). Served in the reader's language (`GET /scenario-catalog[/{id}]`), with the languages it exists in in `languages` (what the "Available in" column shows; an organization scenario has its one). A copy never follows the profile on its own: to the organization, `language` comes from the `DuplicateMenu` entry picked (one per language); onto an exercise, `ScenarioApplyDialog` asks, proposing the exercise's `content_language` (the server's default too; the reader's only when the exercise has none). Never imported or exported through the API: they're the product's own.
- **Organization** — `OrganizationScenario` (the document stored as JSONB, plus its own editable `name`/`description` and cached `counts`). Program Managers, in Admin: create from a TTX-Zone scenario (`_copy` suffix, opens for editing), from another of theirs (duplicate), from one of the organization's exercises ("From an exercise"), or by importing a file; export, rename, delete / disable / re-enable. Exercise Planners list and view them, and copy them onto their exercise.
- **This exercise** (Creator, exercise in context) — Exercise Planners export it, or import a file onto it.

A scenario reaches an exercise in two ways, both checked first. **A new exercise** (`POST /organizations/{organization_id}/exercises/from-scenario` or `/exercises/import`, `require_planner`; `organization_scenario_service.create_exercise`) touches nothing else: the exercise and the scenario are written in one transaction, so errors or `dry_run` leave none behind, and its creator is on the team; `ScenarioCheck.ttx_id` says which it is. **Replace this exercise** overwrites the one in context and needs its name typed (see below). An exercise that has been played -- any run, live or archived -- takes no scenario (`SCENARIO_EXERCISE_PLAYED`, from the dry run on): each run plays snapshots that hang off the MSEL and the session plan the copy would delete. Deleting the only run's data (Restart → delete) frees it; otherwise copy the scenario onto a new exercise.

## The file: `<name>.ttx.md`
Markdown so it reads anywhere (a repository, a chat), with the data carried losslessly:

````
---
format: "ttx-zone.scenario"
format_version: 1
language: "en"
title: "…"
exported_at: "…"
generator: "ttx-zone"
attack_version: "19.2"
---
# Title
…a readable summary: objectives, phases and injects…

```json ttx-zone-scenario
{ …ScenarioDocumentV6… }
```
````

- `language` is the language of the content: exporting takes the exercise's `content_language` (else the exporter's language), and copying a scenario onto an exercise sets the exercise's `content_language` to it.
- The front matter is YAML restricted to `key: <JSON scalar>` lines (parsed without a YAML library). It must agree with the data block on `format`/`format_version`.
- Only the front matter and the one block fenced as `json ttx-zone-scenario` are read back. The readable body is regenerated on every export and ignored on import — edit the data, not the prose.
- The data block is `ScenarioDocument` (currently `ScenarioDocumentV6`). Every model forbids unknown fields (a newer file fails loudly instead of silently losing data). Rows refer to each other by their codes (`NEED-01`, `OBJ-01`, `PH-01`, `INJ-01`, `INJ-01-A1`, `ACT-01`, `THR-01`, rooms `RM-01`, images `IMG-01`, files `FILE-01`), never database ids; codes and counters are kept on import.
- Images are embedded (base64) and re-encoded on import like any upload. Inject files are embedded byte for byte with their SHA-256, checked on import (`SCENARIO_BAD_FILE`). A scenario file is at most `SCENARIO_MAX_BYTES` (200 MB); an export whose images and files would pass it is refused (413 `SCENARIO_EXPORT_TOO_LARGE`).
- The JSON Schema of the data block is published per version at `GET /scenario-format/{version}/schema.json`, from 1 to the current one, for anyone writing or checking files outside TTX-Zone.

### Versioning
`format_version` names the data's shape. A file from a newer TTX-Zone is refused (`SCENARIO_NEWER_FORMAT`). An older one goes through `scenario_document.UPGRADERS` — one function per version, `{1: upgrade_1_to_2, …}` — before validation. Changing the shape: add `ScenarioDocumentV{n}` (subclassing the previous models, so the old version's schema stays published unchanged), point `ScenarioDocument` at it, bump `SCENARIO_FORMAT_VERSION`, write the upgrader from the previous version, and keep the old catalog files loading through it. Stored organization scenarios go through the same upgrade when read (`organization_document` → `validate_data`).
- **Version 2**: a phase's optional `headline` (`ScenarioPhaseV2`, ≤ 80). `upgrade_1_to_2` is a no-op.
- **Version 3**: rooms (`docs/features/rooms.md`) — `uses_rooms`, `rooms[{code, name, description}]` (`ScenarioRoom`; the Players' seats are left out), `next_room_number`, each inject's `room_codes` (`ScenarioInjectV3`; empty: all rooms; an unknown code is `SCENARIO_UNKNOWN_REFERENCE`). `upgrade_2_to_3` is a no-op (none: one table). Applying matches rooms by code: a room with the same code keeps its Players, an extra one goes (its Players unseated).
- **Version 4**: inject files (`docs/features/msel.md` → Inject files) — `files[{key, name, sha256, data}]` (`ScenarioFile`, base64) and each inject's `files[{file, description}]` (`ScenarioInjectV4`; an unknown key is `SCENARIO_UNKNOWN_REFERENCE`). `upgrade_3_to_4` is a no-op (none: images only).
- **Version 5**: rendered artifacts (`docs/features/msel.md` → Rendered artifacts) — each inject's optional `artifact` (`ScenarioInjectV5`, the same `InjectArtifact` as the MSEL). `upgrade_4_to_5` is a no-op (none: plain text).
- **Version 6**: inject formats and polls (`docs/features/msel.md`) — each inject's `format` (`inject`, `discussion`, `poll`) replaces `scored`, plus `poll_question` and `poll_options` (`ScenarioInjectV6`). `upgrade_5_to_6` turns `scored: false` into `format: discussion`; the shipped catalog files before `poisoned-package` are still older versions and are upgraded as they load.
- **Version 7**: poll outcomes (`docs/features/playground.md`) — each inject's `poll_outcomes`, by option (`ScenarioInjectV7`). `upgrade_6_to_7` is a no-op (none: nothing follows). The catalog's polls moved their consequences here from the facilitator notes.
- **Version 8**: impact meters (`docs/features/msel.md`) — the MSEL's `meters[{key, name}]` (`ScenarioMeter`) and each inject's `poll_impacts` (`ScenarioInjectV8`). `upgrade_7_to_8` is a no-op (none: no meters). The catalog's polls moved each option's pressure line here from the facilitator notes.

### What's left out
Needs analysis: document date, design lead, sponsor (name, role, motivation), findings owner and commitment, report recipients, date window, participants' availability, every approval and its evidence; risk owners. MSEL: session and incident start times and the scene's date (`incident_date`), status/version, who marked it ready, snapshots; inject review status and validator; actor `played_by`. The session plan, the team, invitations and tag assignments to people or invitations. Tags applied to the exercise itself are kept (`applied`).

## Checking and applying (`scenario_service`)
1. `check_document` finds every problem the document has on its own, without the database: duplicate codes, references that don't resolve (objective → need, phase → objective, inject → phase/sender/threat actor/branch/action/images, action → objective), an ATT&CK release this build doesn't ship (`SCENARIO_ATTACK_VERSION`) or ids not in it, images that don't decode. A TTX-Zone actor/tag id this build doesn't know is a *warning*: the copy is kept as the exercise's own.
2. `apply_document(…, dry_run)` locks the exercise, clears what it designed (`delete_conduct_preps_for_ttx`, `delete_msels_for_ttx`, the needs form's children and approvals, `delete_tags_for_ttx`) and writes the document level by level. The needs-form row stays (reset to a DRAFT, `version` 1, `revision` bumped, people and dates blank); the MSEL is recreated as a DRAFT (its `revision` past the old one, so an open page goes stale) and stays read-only until the needs analysis is approved again. The exercise keeps its code, team, invitations and access requests; its name and description come from the scenario; `TTX.scenario_origin*` records a library origin (a file has none).
3. With `dry_run` the transaction is rolled back at the end — the very same writes run, so a database error shows up there too — and no image file is written. A real run writes the image files, then commits (unlinking them if the commit fails).

The answer is always a `ScenarioCheck` (`ok`, `errors[{path, code, message}]`, `warnings`, `counts`, `replaces` = what the exercise holds now). Issue messages come in the client's language like API errors (`ScenarioIssue.params` + `scenario_service.localize_check`, catalog in `app/locales/es.json`); a schema violation's own text (Pydantic's) stays English. `ok: false` means nothing changed. The real run of `/ttx/{ttx_id}/scenario/apply|import` needs no step-up and, when it applies, is recorded as `exercise.scenario_applied`; the dry run isn't recorded.

UI (`ScenarioApplyDialog`, `ttxId` to replace, none for a new exercise): the dry run runs first (on open for a library scenario, on file pick for a file); errors are listed with their paths and stop there; otherwise the report names the scenario and its language. Replacing, it shows *This exercise now* vs *After the copy*, the overwrite warning (what's lost, what's kept; name, description and language become the scenario's) and a typed-name confirmation enabling **Replace exercise**; a new exercise only needs **Create exercise**. Afterwards the auth snapshot is refreshed and the page goes to Creator → Exercise, of the new exercise when there is one.

Library → Scenarios → This exercise (`exerciseTab`) names the exercise, shows what it holds, and separates what leaves it unchanged (**Take a copy**: export the file; a Program Manager, **Save to my organization**) from what brings a scenario in (**In a new exercise**; **In this exercise**, disabled with its reason when `GET /ttx/{ttx_id}/scenario` says `played`). In a library row, the Duplicate menu offers *To a new exercise* and *Replace this exercise…*. Admin's `ScenarioImportDialog` is the same check, then **Add to the library**.

## Placeholders
A scenario's text may use `{placeholders}` (`{group_name}`, `{company_1}`, `{country_1}`, `{supplier}`…), the same convention as catalog injects. The dry run lists them (`ScenarioCheck.variables`, name + count, from `scenario_service.document_variables`, which scans every free-text field and never codes, ids or enums). The copy onto an exercise takes values: `variables` in the apply body, or a `variables` form field (JSON object) on the file import. `fill_variables` replaces each placeholder that has a non-blank value and leaves the rest as `{name}` to complete later; a value that makes a field too long is a `SCENARIO_INVALID` issue (nothing is written). Organization-library imports and exports keep the placeholders.

UI: after the check, `ScenarioApplyDialog` shows one field per placeholder (`VariableFields`, shared with `InjectCopyDialog`) with its usage count, most used first (the exercise's core; ties alphabetically) -- the hint says so; `{group_name}`, `{organization}` and `{organization_short}` are proposed from the organization in context.

## Usage and delete
`library_usage_service` treats `scenario` as a library kind: its uses are the organization's exercises whose `scenario_origin` is that scenario. In use, delete disables it (it can't be copied again, `LIBRARY_ITEM_DISABLED`); free, it's deleted for good (recorded as `library.item_delete`). The organization cascade deletes its scenarios.

## Endpoints
- `GET /scenario-format/{version}/schema.json`, `GET /scenario-catalog`, `GET /scenario-catalog/{id}` — any authenticated user.
- `GET /organizations/{organization_id}/scenarios[/{id}]` — `require_library_reader`.
- `POST /organizations/{organization_id}/scenarios` (`system_id` | `organization_scenario_id` | `ttx_id`), `POST …/scenarios/import?dry_run=` (multipart), `PATCH`/`DELETE …/scenarios/{id}`, `GET …/{id}/usage`, `POST …/{id}/enable`, `GET …/{id}/export` — `require_library_manager` (Program Managers).
- `GET /ttx/{ttx_id}/scenario` (counts), `GET /ttx/{ttx_id}/scenario/export`, `POST /ttx/{ttx_id}/scenario/apply?dry_run=` (`{source: system|organization, id}`), `POST /ttx/{ttx_id}/scenario/import?dry_run=` (multipart) — Planner-gated (`DESIGN_ENDPOINTS`); `dry_run` defaults to true.

## Authoring a TTX-Zone scenario
The catalog ships `ransomware`, `executive-tabletop` and one scenario per knowledge base case (`ot-wiper`, `data-extortion`, `deepfake-fraud`, `insider-fake-hire`, `saas-token-breach`, `retail-helpdesk`, `manufacturing-standstill`, `nationwide-blackout`, `pathology-lab`, `town-hall`; see `docs/features/knowledge-base.md#feeding-the-library`), five by theme (`insider-departure`, `supply-chain-update`, `ddos-sales-peak`, `bec-invoice-fraud`, `cloud-data-exposure`, format version 5, some injects drawn as artifacts) `poisoned-package`, the demo of polls (format version 6): a financial entity under DORA and GDPR, a decision put to the vote in each of five rounds, one embedded image and six placeholders. Polls don't branch, so its injects read true whichever option wins; each option's consequence and its pressure on five axes are in the poll's facilitator notes. Three sector demos follow, also version 6: `connected-plant` (automotive; the only one played in rooms: two teams on separate incidents, brought to the main room when they converge), `food-traceability` (contingent injects fire when containment or communication slips) and `hospital-network` (strategic level, three crisis meetings as discussion injects). A scenario image's source is `app/data/scenarios/images/src/<name>.html`, rendered by `scripts/render_inject_images.py` under the rules of `docs/features/inject-catalog-authoring.md#illustrations-a-few-injects-only`; the PNG is then embedded in the file's `images`. Build it in an exercise and export it, or write the data block by hand; save it as `app/data/scenarios/<id>.<language>.ttx.md` for both `en` and `es` (the file's `language` must match its name). It must pass `check_document` and the needs form's limits (at most 4 capabilities and 5 objectives): references resolve, ATT&CK ids exist in its `attack_version` (one this build ships), TTX-Zone actor and tag ids exist. Run `test_scenario_library.py`.
