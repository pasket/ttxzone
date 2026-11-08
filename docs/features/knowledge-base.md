# Knowledge base

TTX-Zone's own cybersecurity background for exercise design: threat trends, real incidents turned into archetypes, and artifact templates an inject can be built from. It's what the AI assistant (roadmap §10) grounds its answers in when it helps a role, above all the Exercise Planner. It isn't browsable on its own: it reaches people only through the assistant.

- **Data**: `backend/app/data/knowledge/<kind>/<id>.kb.md`, one file per entry, read-only, shipped with the code like the inject and ATT&CK catalogs (nothing seeded, nothing downloaded at runtime).
- **Loader**: `app/data/knowledge_catalog.py` (`load_knowledge_catalog`, `parse_entry`), validated on first load. A broken entry fails `tests/test_knowledge_catalog.py`, never a request.
- **Language**: English only. The assistant answers in the person's language.
- **Closed lists in code**: `KnowledgeKind` + `KIND_CODES`, `SECTIONS`, `Sector` and `SourceClass` (`knowledge_catalog.py`). It reuses `InjectFamily`, `InjectStage` and `SYSTEM_VARIABLES` (`inject_catalog.py`), `Capability`, `DeliveryMethod` and the actor slugs.

## Format (`ttx-zone.knowledge`, version 1)
Each file has a front matter of `key: <JSON value>` lines (scalars and arrays; no YAML library), then a Markdown body made of a fixed list of `##` sections.

| Field | Meaning |
|---|---|
| `id` | `KB-TRD-NNN` (trend), `KB-CAS-NNN` (case), `KB-ART-NNN` (artifact), `KB-FRM-NNN` (framework), `KB-OBJ-NNN` (objective), `KB-GLS-NNN` (glossary). Stable: never reused or renumbered. The file is `<kind>/<id>.kb.md`. |
| `kind`, `title`, `summary` | `summary` is one or two sentences, the first thing the assistant reads when it picks entries. |
| `sectors`, `families`, `capabilities` | Retrieval filters. `families` share the inject catalog's vocabulary; up to 3 `capabilities`. |
| `attack_version`, `attack_techniques`, `attack_groups` | `"<domain>:<technique>"` (e.g. `"ics:T0809"`) and `G####` ids, all live in the pinned release. |
| `related` | Other entries' ids. |
| `frameworks`, `requirements` | Ids from the regulatory catalog (`FRAMEWORK_CATALOG`, `REGULATORY_CATALOG`), checked to exist. Required: `frameworks` on a framework entry, `requirements` (and a capability) on an objective. |
| `source_class`, `period`, `reviewed` | Generic provenance: the kind of material (`annual-industry-report`, `sector-incident-report`, `regulatory-text` for frameworks…), the year or span the facts describe, and the date of the last review. |
| `stage`, `delivery_method`, `actor`, `variables`, `variable_defaults` | Artifacts only, aligned with an inject template so the assistant can propose an inject from it. |

Sections per kind (exactly these, in this order). Each section is one retrieval chunk carrying the entry's metadata, so it must read on its own:
- **trend**: Overview · Indicative figures · Typical attack chain · Realistic timings · Exercise hooks.
- **case**: Archetype · Relative timeline · Decision points · Impacts · Lessons · Inject ideas.
- **artifact**: Purpose · Template · Variants · Realism notes.
- **framework**: Scope · What it expects from exercises · Notification duties · Evidence to keep · Exercise hooks.
- **objective**: Objective · Success criterion · Evidence · Regulatory mapping · Common pitfalls.
- **glossary**: Definition · In an exercise · Common confusions.

`families` is required on the threat kinds (trend, case, artifact: `THREAT_KINDS`) and optional on the others. Framework entries may name the regulation they describe (it's public law, like the regulatory catalog) but never an agency that publishes threat reports; objective entries mirror the TTX-Zone objective templates (`app/data/objective_catalog.py`) with the reasoning behind them.

Body text may cite `KB-*` entries and `INJ-*` inject catalog codes. Both are checked to exist.

## Authoring rules
Everything in the inject catalog's [anonymization rules](inject-catalog-authoring.md#anonymization--all-content-is-fictitious) applies (roles, never names; `example.*` domains; documentation IPs; relative times; generic regulators). On top of those:
- **Synthesize, never copy**: write it in your own words. The repository is public. Facts and figures can be reused; the source's wording can't.
- **No source is named**: no report, publisher, vendor or product. The material is described only by `source_class` and `period`.
- **No victim is named**, and neither is the country of an incident: "a European grid operator", "a regional hospital group".
- **Actors**: only as the ATT&CK groups listed in `attack_groups`, by their ATT&CK name. Never a vendor's nickname or an alias. Otherwise use generic wording ("a state-linked actor", "a ransomware affiliate").
- **Figures**: ranges or orders of magnitude for the stated period ("roughly 40 to 70 %"), never attributed to a source.
- **Timelines**: relative (T+0, "4 days before", "day 2").
- **Artifacts**: same variable rules as the inject catalog (system variables in braces, scenario variables with a default, here in English only).

What `tests/test_knowledge_catalog.py` enforces:
- the format, codes, sections, ATT&CK ids, references and variables;
- fictitious emails, URLs and IPs, and no absolute dates;
- a list of report publishers and product vendors;
- vendor actor-naming schemes, and any ATT&CK group name or alias not listed in `attack_groups`.

Tone, accuracy and genuine anonymity remain review work.

## Feeding the Library
The knowledge base and the Library stay separate: the Library holds independent, bilingual, generic objects (variables cover the details), and the knowledge base is one of the sources they're written from, by hand and through review.
- **Artifact → TTX-Zone inject** (`catalog.json`, `docs/features/inject-catalog-authoring.md`): the template becomes the message, the realism notes the facilitator notes, the purpose a key question; families, stage, sender and channel carry over. The catalog's variable names win over the artifact's.
- **Case → TTX-Zone scenario** (`app/data/scenarios/`, `docs/features/scenarios.md`): archetype, timeline, decision points and inject ideas give the description, phases, key questions and injects.
- **Trends** give no Library object; their exercise hooks are a checklist of what to author next.

Every artifact's *Variants* ends with an "In the Library" line naming its TTX-Zone inject (validated like any `INJ-*` citation), so the assistant can propose the ready-made inject when it retrieves the artifact. A case turned into a scenario ends its *Inject ideas* the same way, naming the scenario.

## Refresh cycle
A private map kept outside the repository ties each entry to the documents it was distilled from. When a new edition of a report appears, the entries it fed are reviewed and their `period`/`reviewed` updated. A new ATT&CK release means reviewing every entry, just like the inject catalog: the test pins every entry to the latest shipped release.

## How the assistant uses it
See `docs/features/ai-assistant.md`. The AI client reads the knowledge base through two MCP tools, `search_knowledge` and `get_knowledge_entry`; nothing about it is browsable in the app.
- **Search** (`services/assistant/search.py`): no embeddings and no pgvector. The entries are indexed once per process, in memory (`lru_cache`), and scored with Okapi BM25 over the title (weighted ×3), the summary (×2) and the sections. Accents and plurals are folded. The metadata filters (`kind`, `sector`, `family`, `capability`) apply before scoring. Each hit names the section that matched best.
- **Language**: the entries are in English and the tool asks the client for English keywords; the client (Claude) rewrites the person's question, so a question in Spanish still finds them. The inject and objective catalogs are indexed in both languages.
- **Answers**: the client cites entries by code (`KB-CAS-007`); `get_knowledge_entry` returns the whole entry, sections included.
- **Adding entries**: a new `.kb.md` file is picked up when the backend restarts (the index is built on first use).
- Still open: an instance administrator importing extra packages of `.kb.md` files, validated by the same `parse_entry`.
