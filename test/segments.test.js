import { test } from 'node:test';
import assert from 'node:assert/strict';
import { downloadSegments } from '../src/lib/segments.js';
import { sequenceIv } from '../src/lib/hls.js';

const bytesOf = async (blob) => [...new Uint8Array(await blob.arrayBuffer())];

function fakeFetch(routes, calls = []) {
  return async (url) => {
    calls.push(url);
    const route = routes[url];
    const result = typeof route === 'function' ? route() : route;
    if (result === undefined) return new Response('missing', { status: 404 });
    if (result instanceof Response) return result;
    return new Response(result);
  };
}

test('downloads segments in playlist order with limited concurrency', async () => {
  let active = 0;
  let maxActive = 0;
  const fetchImpl = async (url) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((r) => setTimeout(r, Math.random() * 10));
    active -= 1;
    return new Response(new Uint8Array([Number(url.split('/').pop())]));
  };
  const segments = Array.from({ length: 10 }, (_, i) => ({ url: `https://x/${i}`, sequence: i, key: null }));
  const progress = [];
  const blobs = await downloadSegments(segments, { fetchImpl, concurrency: 3, onProgress: (p) => progress.push(p) });
  assert.deepEqual(await Promise.all(blobs.map(bytesOf)), segments.map((_, i) => [i]));
  assert.ok(maxActive <= 3);
  assert.deepEqual(progress.at(-1), { done: 10, total: 10, bytes: 10 });
});

test('retries transient failures but not 403s', async () => {
  let attempts = 0;
  const flaky = () => (++attempts < 3 ? new Response('busy', { status: 503 }) : new Uint8Array([9]));
  const blobs = await downloadSegments([{ url: 'https://x/a', sequence: 0, key: null }],
    { fetchImpl: fakeFetch({ 'https://x/a': flaky }), retryDelayMs: 1 });
  assert.deepEqual(await bytesOf(blobs[0]), [9]);
  assert.equal(attempts, 3);

  const calls = [];
  const forbidden = fakeFetch({ 'https://x/b': () => new Response('no', { status: 403 }) }, calls);
  await assert.rejects(downloadSegments([{ url: 'https://x/b', sequence: 0, key: null }],
    { fetchImpl: forbidden, retryDelayMs: 1 }), /HTTP 403/);
  assert.equal(calls.length, 1);
});

test('decrypts AES-128 segments with explicit and sequence-derived IVs, fetching the key once', async () => {
  const rawKey = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-CBC', false, ['encrypt']);
  const explicitIv = crypto.getRandomValues(new Uint8Array(16));
  const encrypt = async (data, iv) => new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, data));

  const calls = [];
  const fetchImpl = fakeFetch({
    'https://x/key': rawKey,
    'https://x/0.ts': await encrypt(new Uint8Array([1, 2, 3]), explicitIv),
    'https://x/1.ts': await encrypt(new Uint8Array([4, 5]), sequenceIv(42)),
  }, calls);
  const blobs = await downloadSegments([
    { url: 'https://x/0.ts', sequence: 41, key: { method: 'AES-128', uri: 'https://x/key', iv: explicitIv } },
    { url: 'https://x/1.ts', sequence: 42, key: { method: 'AES-128', uri: 'https://x/key', iv: null } },
  ], { fetchImpl });
  assert.deepEqual(await bytesOf(blobs[0]), [1, 2, 3]);
  assert.deepEqual(await bytesOf(blobs[1]), [4, 5]);
  assert.equal(calls.filter((u) => u === 'https://x/key').length, 1);
});
