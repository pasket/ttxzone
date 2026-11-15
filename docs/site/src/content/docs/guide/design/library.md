---
title: Library
description: Reuse actors, injects, tags and whole exercises as templates.
sidebar:
  order: 7
---

The **Library** holds simulated actors, threat actors, injects, tags and exercise templates, on three levels:

| Level | Holds | Who changes it |
|---|---|---|
| **TTX-Zone** | A read-only catalog that comes with the product | Nobody |
| **My organization** | The organization's own items | Exercise Program Managers |
| **This exercise** | The exercise's own copies | Its Exercise Planners |

Every use is a copy, so editing or deleting a library item never changes an exercise. A copy remembers where it came from. Deleting an organization item that's in use disables it instead.

## Exercise templates

An exercise template is a whole exercise packaged for reuse: its needs analysis, MSEL and library, with images. (The *scenario* is something else: the story the exercise tells, written in the MSEL.) It never carries people, approvals or dates, so you add those after copying: the needs analysis starts as a draft, and the MSEL stays read-only until you approve it.

TTX-Zone includes templates such as ransomware, an executive tabletop, insider threat, supply chain, business continuity when a critical provider goes down, and sector demos.

You can:

- **Start a new exercise** from a template or a file, here or from the **New exercise** page.
- **Import a file** onto an existing exercise.
- **Export** an exercise as a `.ttx.md` file to share it with another team.

Exercise Program Managers can keep the organization's own exercise templates, created from TTX-Zone's, from one of its exercises or from a file.
