// Builds one package per browser into dist/:
//   dist/<target>/                                    unpacked extension (web-ext and "Load unpacked" use this)
//   dist/recording-downloader-<version>-chrome.zip    for the GitHub release (has a recording-downloader/ folder inside)
//   dist/recording-downloader-<version>-edge.zip      upload to Microsoft Partner Center
//   dist/recording-downloader-<version>-firefox.zip   upload to addons.mozilla.org (or `npm run sign:firefox`)
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { manifestFor, TARGETS } from './manifests.mjs';

const root = new URL('..', import.meta.url).pathname;
const src = join(root, 'src');
const dist = join(root, 'dist');
const base = JSON.parse(readFileSync(join(src, 'manifest.json'), 'utf8'));
const targets = process.argv.slice(2).length ? process.argv.slice(2) : TARGETS;

for (const target of targets) {
  const out = join(dist, target);
  const zip = join(dist, `recording-downloader-${base.version}-${target}.zip`);
  rmSync(out, { recursive: true, force: true });
  rmSync(zip, { force: true });
  // Chrome users unzip and "Load unpacked", so give them a named folder rather than loose files.
  const dir = target === 'chrome' ? join(out, 'recording-downloader') : out;
  mkdirSync(dir, { recursive: true });
  cpSync(src, dir, { recursive: true });
  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(manifestFor(base, target), null, 2)}\n`);

  execFileSync('zip', ['-qrX', zip, '.'], { cwd: out });
  console.log(`built ${zip.slice(root.length)}`);
}
