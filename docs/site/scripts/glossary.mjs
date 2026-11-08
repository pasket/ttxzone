// Writes the glossary page from the application's own glossary, so the two
// can't disagree. The page isn't committed.
import { readFileSync, writeFileSync } from 'node:fs';

const locale = JSON.parse(readFileSync('../../frontend/src/locales/en.json', 'utf8'));
const terms = Object.entries(locale.glossary.terms).sort(([a], [b]) => a.localeCompare(b));

const rows = terms.map(
  ([term, { expansion, description }]) => `| **${term}** | ${expansion} | ${description} |`,
);

writeFileSync(
  'src/content/docs/guide/glossary.md',
  `---
title: Glossary
description: The acronyms TTX-Zone uses.
---

The same glossary is available in the application's header.

| Term | Stands for | Meaning |
|---|---|---|
${rows.join('\n')}
`,
);
