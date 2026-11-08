---
title: Inject catalog
description: Write or extend TTX-Zone's inject catalog.
sidebar:
  order: 5
---

The catalog is `backend/app/data/injects/catalog.json`, the read-only TTX-Zone level of **Library → Injects**. The loader validates every rule it can, and a broken catalog fails `tests/test_inject_catalog.py`, never a request. Tone and anonymization are checked in review.

Closed lists live in code, so use them: `InjectFamily`, `InjectStage`, `InjectAudience` and `SYSTEM_VARIABLES` in `app/data/inject_catalog.py`.

## What a template holds

A template is the reusable content of an inject. Whatever only makes sense inside one exercise is filled in when it's copied: the MSEL code, the offset, the phase, the objectives and the review status.

## Codes

Mandatory injects are `INJ-<FAM>-NN`, contingent ones `INJ-<FAM>-CNN`, where `<FAM>` is the main family's code. Codes are never reused or renumbered.

## Field rules

- **`title`** describes the event, in about 100 characters. **`content`** is the message exactly as the Player receives it, in about 1,200. Both are bilingual.
- **`actor`** is who delivers the message inside the fiction.
- **Recipients**, one to five, are areas or roles that play, never people. Non-playing entities such as the police or the press are actors.
- **Expected actions**, one to eight, are observable tasks starting with a verb. A tabletop discusses rather than executes, so prefer decisions and commitments.
- **`within_minutes`** is scenario time, counted from delivery.
- **`key_question`** is the one open dilemma the Facilitator asks. Required for `executive` and `mixed` injects. Never "What do you do?".
- **Contingent injects** carry `trigger` and `purpose`, and point at a mandatory inject.
- **`attack`** is a technique and one of its tactics, in the catalog's pinned release. Leave it empty if the inject describes no attacker activity.

## Variables

- **System variables**, a closed list in braces such as `{organization}` or `{critical_system}`, anonymize the organization.
- **Scenario variables** are figures that must match across injects, in `snake_case`, each with a bilingual default.

Every variable used is declared, and every one declared is used.

## Anonymization

All content is fictitious.

- **People:** always the role, never a name.
- **Domains:** `example.com`, `example.org`, `example.net`.
- **IP addresses:** `192.0.2.x`, `198.51.100.x`, `203.0.113.x`, `2001:db8::`.
- **Dates:** relative, such as "2 hours ago".
- **Regulators:** the generic actor, and "the competent authority" in text.
- **Threat groups:** a fictitious name, or "the attacker group".
- **Vendors and products:** `{supplier}`, `{critical_system}` or a generic description.

Before delivering, search the whole file for the source organization's name, acronym, domains and people.

## Illustrations

An inject may carry up to three images, only where it arrives as something visual. Each is an HTML mock-up in `app/data/injects/images/src/`, rendered with `backend/scripts/render_inject_images.py`.
