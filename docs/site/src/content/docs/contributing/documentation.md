---
title: Documentation
description: How this site works and how to change it.
sidebar:
  order: 7
---

This site is [Astro Starlight](https://starlight.astro.build/) in `docs/site/`. It's written in English, in Markdown, under `src/content/docs/`.

## Preview it

```bash
cd docs/site
npm ci
npm run dev
```

`npm run dev` reloads as you edit, but search needs the built site:

```bash
npm run build
npm run preview
```

The build fails on a broken internal link, or if a page or API operation is missing from the output.

## What goes where

| Page is for | Goes in |
|---|---|
| People using the product | `guide/` |
| Whoever runs an instance | `instance/` |
| Contributors | `contributing/` |
| How the code is built, for maintainers | `docs/`, outside this site |

## Generated content

- **The API reference** comes from `schemas/openapi.json`, exported from the routes.
- **The glossary** comes from the application's own, in `frontend/src/locales/en.json`, at build time.

## Writing

- Lead with what the reader needs to do.
- Use the interface's own labels, in bold.
- Spell out role names in descriptive text: Exercise Planner, Exercise Program Manager.
- Check every statement against the code.
- Don't describe planned work as if it were built.
