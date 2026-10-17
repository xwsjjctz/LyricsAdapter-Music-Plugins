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
// Older LyricsAdapter versions read catalog.json and reject any id other than qq/netease, so it keeps only those.
await writeFile(path.join(output, 'catalog.json'), JSON.stringify({ apiVersion: 1, plugins }, null, 2) + '\n');

// catalog.v2.json adds a type to every entry and lists official plugins published from other
// repositories (external-plugins.json). Hosts check each package against its pinned SHA-256.
const KINDS = ['music.source', 'lyrics.translation'];
const external = JSON.parse(await readFile(path.join(root, 'external-plugins.json'), 'utf8')).plugins;
if (!Array.isArray(external)) throw new Error('external-plugins.json must contain a plugins array');
const ids = new Set(plugins.map(plugin => plugin.id));
for (const plugin of external) {
  const url = new URL(plugin.url);
  const parts = url.pathname.split('/');
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(plugin.id) || ids.has(plugin.id) || typeof plugin.name !== 'string' || !plugin.name.trim()
    || !KINDS.includes(plugin.kind) || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(plugin.version) || !/^[a-f0-9]{64}$/.test(plugin.sha256)
    || url.origin !== 'https://github.com' || parts.length !== 7 || parts[1] !== 'xwsjjctz' || parts[3] !== 'releases' || parts[4] !== 'download'
    || parts[6] !== `${plugin.id}.laplugin` || (plugin.description !== undefined && typeof plugin.description !== 'string')) {
    throw new Error(`Invalid external plugin entry: ${plugin.id}`);
  }
  ids.add(plugin.id);
}
const v2 = [...plugins.map(plugin => ({ ...plugin, kind: 'music.source' })), ...external];
await writeFile(path.join(output, 'catalog.v2.json'), JSON.stringify({ apiVersion: 2, plugins: v2 }, null, 2) + '\n');
