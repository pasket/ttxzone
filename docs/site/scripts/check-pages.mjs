// Fails when pages are missing from the build. Astro skips Markdown silently
// without its content collection, and the link check then passes on nothing.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const content = 'src/content/docs';
const missing = [];

for (const entry of readdirSync(content, { recursive: true })) {
  if (!/\.mdx?$/.test(entry)) continue;
  const route = entry.replace(/\.mdx?$/, '').replace(/(^|\/)index$/, '');
  const page = join('dist', route, 'index.html');
  if (!existsSync(page)) missing.push(relative('.', page));
}

const spec = JSON.parse(readFileSync('schemas/openapi.json', 'utf8'));
const methods = new Set(['get', 'put', 'post', 'delete', 'patch', 'options', 'head', 'trace']);
const expected = Object.values(spec.paths).flatMap((path) => Object.keys(path).filter((key) => methods.has(key))).length;
// `tags` holds each group's overview page.
const built = readdirSync('dist/api/operations').filter((entry) => entry !== 'tags').length;
if (built !== expected) missing.push(`dist/api/operations: ${built} of ${expected} operations`);

if (missing.length) {
  console.error(`Missing from the build:\n${missing.join('\n')}`);
  process.exit(1);
}
console.log(`Pages checked: the guides and ${built} API operations are in the build.`);
