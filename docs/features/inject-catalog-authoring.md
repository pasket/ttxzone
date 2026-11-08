# Authoring the TTX-Zone inject catalog

How to write or extend `backend/app/data/injects/catalog.json`, the read-only TTX-Zone level of Library → Injects. The loader (`app/data/inject_catalog.py`) validates every rule it can; a broken catalog fails `tests/test_inject_catalog.py`, never a request. The rules it *can't* check (tone, anonymization, realism) are below.

Closed value lists live in code — use them, don't copy them here: `InjectFamily` + `FAMILY_CODES`, `InjectStage`, `InjectAudience`, `SYSTEM_VARIABLES` (`app/data/inject_catalog.py`); `Capability` (`app/models/ttx_needs_form.py`); actor slugs (`app/data/actor_catalog.py`); framework ids (`FRAMEWORK_CATALOG`, `app/data/regulatory_catalog.py`); `DeliveryMethod`.

## What a template holds, and what it doesn't
A template is the reusable content of an inject. Anything that only makes sense inside one exercise is filled in when it's copied into an MSEL, never stored in the template:
- **Code** in the MSEL (`INJ-NN`) — assigned by each MSEL.
- **Offset** (T+) — depends on each session's length. The template stores `stage`, which proposes the phase.
- **Phase** — phases exist only in an MSEL.
- **Objectives** — come from each exercise's needs analysis. The template stores `capabilities`; the copy proposes the objective with that capability.
- **Review status / validator** — every copy starts as a draft.

## Codes
- Mandatory `INJ-<FAM>-NN`, contingent `INJ-<FAM>-CNN`. `<FAM>` is the code of the inject's first (main) family; a contingent takes its mandatory inject's family and prefix.
- Numbered by stage and story order; a new inject takes its family's next free number. Codes are stable: never reused, never renumbered.
- `regulatory` and `generic` are transversal families (serve any scenario): `regulatory` holds authority notifications, deadlines and requests, so `INJ-REG-NN` means something; `generic` holds press, management, insurer. `ot_ics` is a cyber incident in an industrial environment; a physical threat to a plant is `physical_hybrid` (both families if there's also a cyber component; the usual framework for physical is `CER`).

## Field rules
- `title` ≤ ~100 chars, describes the event (never "Inject 3"). `content` ≤ ~1,200 chars, the message exactly as the player receives it. Both bilingual `{es, en}`.
- **Sender (`actor`)** is who delivers the message *inside the fiction*: if the text says "the digital monitoring service detects…", the actor is that service, not the attacker. No `other` senders in the catalog — add a generic actor to the actor catalog instead. `insider` ("Employee") covers anyone in the organization who isn't playing.
- **Recipients** (1–5) are areas or roles **that play** ("Legal", "Communications", "CISO", "Crisis committee"), never people. Non-playing entities (police, insurer, regulator, press, supplier) are actors, never recipients.
- **Expected actions** (1–8) are observable tasks starting with a verb ("Notifies…", "Isolates…", "Decides…"), never "The situation is assessed". A tabletop discusses rather than executes: prefer decisions and commitments ("Decides…", "Authorizes…", "Approves…", "Appoints…") over analyst tasks, above all for `executive`/`mixed` audiences. Each may carry a responsible role and `within_minutes`.
- **`within_minutes` is scenario time**, not session time, counted from delivery: "convene the crisis committee within 60" means one hour in the story whether the session lasts 2 h or 6 h — the MSEL maps it through `time_compression`. Long deadlines (240 = 4 h, 1440 = 1 day, up to 20160 = 2 weeks) are fine when realistic. `null` when there's no meaningful deadline to evaluate.
- **`key_question`** — required for `executive`/`mixed`, optional for `technical`: the one open question or dilemma the facilitator asks on delivery, with real tension ("Do we pay?", "Who authorizes disconnecting…?", "What do we say, and when?"). Never "What do you do?".
- **`capabilities`**: 1–2. **`families`**: only those the inject actually describes; a contingent carries the same families as its mandatory inject.
- **Contingent injects** carry `trigger` (the condition that fires it, e.g. "if nobody has escalated to management in 30 min") and `purpose` (the expected action it tries to provoke), and point at a mandatory inject.
- **`attack`**: technique + one of *its* tactics in the matrix (T1005 is Collection TA0009; T1657 is Impact TA0040), in the catalog's pinned release. Empty when the inject describes no attacker activity (press, regulator…).
- **`frameworks`**: only when the inject depends on that regulation (e.g. a notification deadline).

## Variables
Both kinds are filled once per exercise so every inject tells the same story; templates are never substituted.
- **System variables** (`SYSTEM_VARIABLES`, closed list, in braces: `{organization}`, `{sector}`, `{critical_service}`, `{critical_system}`, `{data_type}`, `{supplier}`, `{customer}`, `{product}`, `{location}`…) anonymize the organization. No default. Need another one? Raise it in review — don't invent it.
- **Scenario variables**: figures and facts that depend on the organization or must match across injects (amounts, volumes, recovery times, IPs, the attacker group's name). `snake_case`, English, 2–32 chars, each with a bilingual default in `variable_defaults`. Reuse an existing name when it means the same (`ransom_amount`, `ransom_deadline`, `attacker_group`, `stolen_data_volume`, `restore_time`, `downtime_cost`, `c2_ip`, `fraud_amount`, `ddos_volume`).
- Stay literal: legal deadlines (24 h, 72 h), story times ("3 hours ago"), details that only matter in that inject.
- Every variable used in a text is declared, every declared variable is used, every scenario variable has a default and there are no extra defaults.

## Anonymization — all content is fictitious
- **People**: always the role ("the CFO"), never a name, not even an invented one.
- **Domains/emails** `example.com|org|net`; **IPs** `192.0.2.x`, `198.51.100.x`, `203.0.113.x`, IPv6 `2001:db8::`; phone numbers, IBANs, ticket numbers, hashes and wallets plausible but fake (`bc1qexample…`, `SHA256: 0000…`); absolute dates/times become relative ("2 hours ago", "day 2").
- **Regulators and CSIRTs**: the generic actor (`competent-authority`, `data-protection-authority`…) and "the competent authority" in text — never a real agency's name.
- **Real threat groups**: a fictitious name (the catalog's ransomware group is "Nébula") or "the attacker group", so templates don't age or attribute anything to anyone. MITRE groups belong to the Threat actors library, not to inject text.
- **Vendors and products**: `{supplier}`, `{critical_system}` or a generic description ("the perimeter firewall"); a technology may be named only when essential to the technique ("SSL VPN").
- Figures may stay when they don't identify the organization.
- Before delivering: search the whole file for the source organization's name, acronym, domains and people — zero matches.

## Illustrations (a few injects only)
An inject may carry `images` (≤ 3): `[{file: {es, en}, caption: {es, en}}]`, a PNG per language under `app/data/injects/images/`. Only where the inject arrives as something visual (a console, a ransom note, a web page, a message, an HMI screen) or a picture explains what the text can't (the shape of an attack, the scale of a chart) — never on calls, briefings, regulatory requests or board questions, nor when the text already *is* the artefact (a transcribed email or chat, a situation report). Today 13 injects have one, as a demo.
- **Source and rendering**: each image is an HTML mock-up in `images/src/<name>.html` (shared `base.css`; Spanish text in `data-es`, filled by `i18n.js` for `?lang=es`; size in `<meta name="size" content="WxH">`), rendered on a workstation with Chrome by `python backend/scripts/render_inject_images.py [name …]` into `<name>-en.png` / `<name>-es.png`. Edit the HTML and re-render; never edit a PNG by hand.
- **The anonymization rules above apply to the pixels too**: no person's name (a role, an account number, "not in your contacts"), `example.*` domains and invented `.onion` addresses, no real product, brand or logo (describe the tool: "Endpoint protection console", "SIEM", "Anti-DDoS service"), no fake secret in a realistic format (secret scanners). Each image carries the "Fictitious · exercise material" stamp, and its caption says it's fictitious.
- **No variables in an image**: `{organization}`, `{ransom_amount}` and the like can't be filled into pixels — redact the victim or leave it out, and keep specific figures in the text.
- `test_inject_catalog.py` checks every file decodes, is a PNG ≤ 2000 px, is used, has its HTML source, and that the captions say "fictitious" in both languages.

## Regulatory deadlines used in the catalog
NIS2: early warning 24 h, notification 72 h, final report 1 month. GDPR: 72 h, plus communication to data subjects. DORA: initial notification 4 h after classification and at most 24 h after detection. Physical-threat injects cite `CER`.

## Coverage the catalog should keep
Knowledge base artifacts are a source for new injects (`docs/features/knowledge-base.md#feeding-the-library`). Among those drawn from them: supplier remote access, safety systems at a plant, coerced staff, forged documents, clinical environments, workforce representatives, sector meetings and proof of integrity.

Beyond what exists, the catalog should cover: a full ransomware arc (detection, ransom note, affected backups, attacker contact with a deadline, double extortion, payment decision); regulatory notification with deadlines (NIS2, GDPR, DORA, with the matching authority actors); the cyber insurer (claim notice, conditions, imposed response provider); DDoS and online-service outage; recovery (restore vs preserve evidence, return to normal, closing communication); and at least one `executive` inject with a management dilemma per main family.
