// Downloads HLS segments in parallel, with retries and AES-128 decryption.
import { sequenceIv } from './hls.js';

async function fetchBytes(fetchImpl, url, signal) {
  const res = await fetchImpl(url, { signal });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} for ${new URL(url).host}${new URL(url).pathname}`);
    err.status = res.status;
    throw err;
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function withRetries(fn, retries, retryDelayMs) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      // 4xx (other than 429) won't get better by retrying.
      const permanent = err.status && err.status >= 400 && err.status < 500 && err.status !== 429;
      if (permanent || err.name === 'AbortError' || attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, retryDelayMs * 2 ** attempt));
    }
  }
}

// Returns one Blob per segment, in playlist order.
export async function downloadSegments(segments, {
  fetchImpl = fetch,
  concurrency = 6,
  retries = 3,
  retryDelayMs = 1000,
  onProgress = () => {},
  signal,
} = {}) {
  const keys = new Map();
  const getKey = (uri) => {
    if (!keys.has(uri)) {
      keys.set(uri, withRetries(() => fetchBytes(fetchImpl, uri, signal), retries, retryDelayMs)
        .then((raw) => crypto.subtle.importKey('raw', raw, 'AES-CBC', false, ['decrypt'])));
    }
    return keys.get(uri);
  };

  const results = new Array(segments.length);
  let next = 0;
  let done = 0;
  let bytes = 0;

  async function worker() {
    while (next < segments.length) {
      const index = next++;
      const seg = segments[index];
      let data = await withRetries(() => fetchBytes(fetchImpl, seg.url, signal), retries, retryDelayMs);
      if (seg.key) {
        const iv = seg.key.iv || sequenceIv(seg.sequence);
        const key = await getKey(seg.key.uri);
        data = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, data));
      }
      results[index] = new Blob([data], { type: 'video/mp2t' });
      done += 1;
      bytes += data.byteLength;
      onProgress({ done, total: segments.length, bytes });
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, segments.length) }, worker));
  return results;
}
