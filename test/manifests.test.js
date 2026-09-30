import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { manifestFor, FIREFOX_ID, FIREFOX_UPDATE_URL } from '../scripts/manifests.mjs';

const base = JSON.parse(readFileSync(new URL('../src/manifest.json', import.meta.url)));

test('chrome and edge get the source manifest unchanged', () => {
  assert.deepEqual(manifestFor(base, 'chrome'), base);
  assert.deepEqual(manifestFor(base, 'edge'), base);
});

test('firefox gets a background script, an add-on id and no data collection', () => {
  const ff = manifestFor(base, 'firefox');
  assert.deepEqual(ff.background, { scripts: ['background.js'], type: 'module' });
  assert.equal(ff.version_name, undefined);
  assert.deepEqual(ff.browser_specific_settings.gecko, {
    id: FIREFOX_ID,
    strict_min_version: '140.0',
    update_url: FIREFOX_UPDATE_URL,
    data_collection_permissions: { required: ['none'] },
  });
  assert.equal(ff.version, base.version);
  assert.deepEqual(ff.permissions, base.permissions);
});

test('firefox manifest does not modify the source object', () => {
  const copy = structuredClone(base);
  manifestFor(base, 'firefox');
  assert.deepEqual(base, copy);
});

test('unknown targets are rejected', () => {
  assert.throws(() => manifestFor(base, 'safari'), /Unknown target/);
});
