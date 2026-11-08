---
title: Scenario format
description: The .ttx.md file a scenario travels in.
sidebar:
  order: 4
---

A scenario is a whole exercise packaged for reuse: its definition, needs analysis, MSEL and own library, with images and files. It never carries people, approvals or dates.

## The file

A `<name>.ttx.md` file is Markdown, so it reads anywhere, with the data carried losslessly:

````
---
format: "ttx-zone.scenario"
format_version: 8
language: "en"
title: "…"
exported_at: "…"
generator: "ttx-zone"
attack_version: "19.2"
---
# Title
…a readable summary: objectives, phases and injects…

```json ttx-zone-scenario
{ … }
```
````

- `language` is the language of the content.
- The front matter is restricted to `key: <JSON scalar>` lines. It must agree with the data block on `format` and `format_version`.
- Only the front matter and the block fenced as `json ttx-zone-scenario` are read back. The readable body is regenerated on export and ignored on import, so edit the data and not the prose.
- Every model forbids unknown fields, so a newer file fails loudly instead of losing data.
- Rows refer to each other by their codes, such as `NEED-01`, `OBJ-01`, `PH-01` and `INJ-01`.
- Images are embedded as base64. Inject files are embedded byte for byte with their SHA-256, checked on import.
- A file is at most 200 MB by default.

The JSON Schema of the data block is published per version at `GET /api/v1/scenario-format/{version}/schema.json`, for anyone writing or checking files outside TTX-Zone.

## Versions

`format_version` names the data's shape. A file from a newer TTX-Zone is refused. An older one is upgraded step by step before validation.

To change the shape, add a new `ScenarioDocumentV{n}` in `backend/app/schemas/scenario.py` and its upgrader in `scenario_document.UPGRADERS`.

## Placeholders

Text may use `{placeholders}`, such as `{organization}`, `{company_1}` or `{supplier}`. Applying the scenario lists them with how often each is used, and asks for a value.

## Checking

Importing is checked first, as a dry run: duplicate codes, references that don't resolve, and an ATT&CK release the build doesn't ship. The dry run performs the same writes and rolls them back, so a database error shows up there too.

## Adding to the catalog

TTX-Zone's own scenarios are in `backend/app/data/scenarios/<id>.<language>.ttx.md`, one file per language. A broken file fails `test_the_catalog_is_valid_and_bilingual`, never a request. Each must reach ready once people and dates are added. Follow the [anonymization rules](/contributing/inject-catalog/#anonymization).
