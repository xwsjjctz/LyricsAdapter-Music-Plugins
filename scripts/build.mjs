import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const out = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'dist');
for (const [id, name, requiresCookie] of [['qq', 'QQ 音乐', true], ['netease', '网易云音乐', false]]) {
  const dir = path.join(out, id);
  await mkdir(dir, { recursive: true });
  await build({ entryPoints: [path.join(root, `src/${id}/index.ts`)], bundle: true, platform: 'node', format: 'cjs', target: 'node22', outfile: path.join(dir, 'index.cjs') });
  await writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ id, name, version, apiVersion: 1, main: 'index.cjs', requiresCookie, capabilities: ['search', 'playlists', 'lyrics', 'stream', 'qr-login'], homepage: 'https://github.com/xwsjjctz/LyricsAdapter-Music-Plugins' }, null, 2));
}
