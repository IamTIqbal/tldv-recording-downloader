// After `web-ext sign` has put a Mozilla-signed .xpi in web-ext-artifacts/,
// copy it to docs/firefox/ (served by GitHub Pages) and point updates.json at it.
// Firefox installs .xpi links from GitHub Pages in one click and checks
// updates.json for new versions.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIREFOX_ID, PAGES_URL } from './manifests.mjs';

const root = new URL('..', import.meta.url).pathname;
const { version } = JSON.parse(readFileSync(join(root, 'src/manifest.json'), 'utf8'));
const artifacts = join(root, 'web-ext-artifacts');
const signed = readdirSync(artifacts)
  .filter((f) => f.endsWith('.xpi') && f.includes(version))
  .map((f) => join(artifacts, f))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
if (!signed) throw new Error(`No signed .xpi for version ${version} in web-ext-artifacts/. Run npm run sign:firefox first.`);

const out = join(root, 'docs/firefox');
const name = `recording-downloader-${version}.xpi`;
mkdirSync(out, { recursive: true });
copyFileSync(signed, join(out, name));
copyFileSync(signed, join(out, 'recording-downloader-latest.xpi'));

const updates = {
  addons: {
    [FIREFOX_ID]: { updates: [{ version, update_link: `${PAGES_URL}/firefox/${name}` }] },
  },
};
writeFileSync(join(out, 'updates.json'), `${JSON.stringify(updates, null, 2)}\n`);
console.log(`docs/firefox/${name} and updates.json ready. Commit and push them to publish.`);
