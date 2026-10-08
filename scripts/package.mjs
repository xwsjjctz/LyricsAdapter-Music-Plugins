import './build.mjs';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'packages');
await mkdir(output, { recursive: true });
const plugins = [];
for (const id of ['qq', 'netease']) {
  const manifest = JSON.parse(await readFile(path.join(root, 'dist', id, 'manifest.json'), 'utf8'));
  const code = await readFile(path.join(root, 'dist', id, manifest.main), 'utf8');
  const file = `${id}.laplugin`;
  const bytes = JSON.stringify({ manifest, code, sha256: createHash('sha256').update(code).digest('hex') });
  await writeFile(path.join(output, file), bytes);
  plugins.push({ id, name: manifest.name, version: manifest.version, file, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await writeFile(path.join(output, 'catalog.json'), JSON.stringify({ apiVersion: 1, plugins }, null, 2) + '\n');
