#!/usr/bin/env node
/* Build the GitHub Pages site: docs/index.html = drill.html inside a full document.
   drill.html stays a fragment because the claude.ai Artifact host adds its own skeleton.
   Run after any change to drill.html:  node scripts/build-site.mjs */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const body = await readFile(join(ROOT, 'drill.html'), 'utf8');
const page = '<!doctype html>\n<html lang="en-GB">\n<head>\n<meta charset="utf-8">\n'
  + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
  + '<meta name="description" content="Quick Maths: a daily five-minute no-calculator drill for TMUA, A-level, Further Maths and STEP.">\n'
  + '</head>\n<body>\n' + body + '\n</body>\n</html>\n';
await writeFile(join(ROOT, 'docs', 'index.html'), page);
console.log(`docs/index.html written (${page.length} bytes)`);
