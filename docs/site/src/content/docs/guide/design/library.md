---
title: Library
description: Reuse actors, injects, tags and whole scenarios.
sidebar:
  order: 7
---

The **Library** holds simulated actors, threat actors, injects, tags and scenarios, on three levels:

| Level | Holds | Who changes it |
|---|---|---|
| **TTX-Zone** | A read-only catalog that comes with the product | Nobody |
| **Organization** | The organization's own items | Exercise Program Managers |
| **This exercise** | The exercise's own copies | Its Exercise Planners |

Every use is a copy, so editing or deleting a library item never changes an exercise. A copy remembers where it came from. Deleting an organization item that's in use disables it instead.

## Scenarios

A scenario is a whole exercise packaged for reuse: its needs analysis, MSEL and library, with images. It never carries people, approvals or dates, so you add those after copying: the needs analysis starts as a draft, and the MSEL stays read-only until you approve it.

TTX-Zone includes scenarios such as ransomware, an executive tabletop, insider threat, supply chain and sector demos.

You can:

- **Start a new exercise** from a scenario or a file.
- **Import a file** onto an existing exercise.
- **Export** an exercise as a `.ttx.md` file to share it with another team.

Exercise Program Managers can keep the organization's own scenarios, created from TTX-Zone's, from one of its exercises or from a file.
