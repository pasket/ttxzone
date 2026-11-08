---
title: Knowledge base
description: Write entries for the AI assistant's knowledge base.
sidebar:
  order: 6
---

The knowledge base is what the [AI assistant](/guide/ai-assistant/) grounds its answers in: threat trends, real incidents turned into archetypes, artifact templates, frameworks, objectives and glossary terms. Entries are in English.

Each entry is a file at `backend/app/data/knowledge/<kind>/<id>.kb.md`, loaded by `app/data/knowledge_catalog.py`. A broken entry fails `tests/test_knowledge_catalog.py`, never a request.

## Format

A front matter of `key: <JSON value>` lines, then a fixed list of `##` sections.

| Field | Meaning |
|---|---|
| `id` | `KB-TRD-NNN`, `KB-CAS-NNN`, `KB-ART-NNN`, `KB-FRM-NNN`, `KB-OBJ-NNN` or `KB-GLS-NNN`. Never reused |
| `kind`, `title`, `summary` | `summary` is one or two sentences, the first thing the assistant reads |
| `sectors`, `families`, `capabilities` | Retrieval filters |
| `attack_version`, `attack_techniques`, `attack_groups` | ATT&CK references in the pinned release |
| `related` | Other entries' ids |
| `frameworks`, `requirements` | Ids from the regulatory catalog |
| `source_class`, `period`, `reviewed` | Generic provenance |

## Sections per kind

Exactly these, in this order. Each section is one retrieval chunk, so it must read on its own.

| Kind | Sections |
|---|---|
| Trend | Overview, Indicative figures, Typical attack chain, Realistic timings, Exercise hooks |
| Case | Archetype, Relative timeline, Decision points, Impacts, Lessons, Inject ideas |
| Artifact | Purpose, Template, Variants, Realism notes |
| Framework | Scope, What it expects from exercises, Notification duties, Evidence to keep, Exercise hooks |
| Objective | Objective, Success criterion, Evidence, Regulatory mapping, Common pitfalls |
| Glossary | Definition, In an exercise, Common confusions |

## Authoring rules

The inject catalog's [anonymization rules](/contributing/inject-catalog/#anonymization) apply, and on top of them:

- **Synthesize, never copy.** Facts and figures can be reused, the source's wording can't.
- **No source is named:** no report, publisher, vendor or product.
- **No victim is named**, nor the country of an incident.
- **Actors** only as the ATT&CK groups listed in `attack_groups`, by their ATT&CK name.
- **Figures** as ranges or orders of magnitude for the stated period.
- **Timelines** are relative.

The tests enforce the format, references, fictitious addresses, the lack of absolute dates, and a list of publishers and vendors.
