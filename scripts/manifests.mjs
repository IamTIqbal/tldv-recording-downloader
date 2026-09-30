// Per-browser manifests. src/manifest.json is the Chrome/Edge manifest; Firefox
// needs a background script instead of a service worker, plus an add-on id.

export const FIREFOX_ID = 'tldv-recording-downloader@iamtiqbal.github.io';
// Served by GitHub Pages from docs/. Lets Firefox update the self-hosted add-on.
export const PAGES_URL = 'https://iamtiqbal.github.io/tldv-recording-downloader';
export const FIREFOX_UPDATE_URL = `${PAGES_URL}/firefox/updates.json`;

export const TARGETS = ['chrome', 'edge', 'firefox'];

export function manifestFor(base, target) {
  if (!TARGETS.includes(target)) throw new Error(`Unknown target: ${target}`);
  const manifest = structuredClone(base);
  if (target !== 'firefox') return manifest;

  delete manifest.version_name; // Chrome-only key
  manifest.background = { scripts: [base.background.service_worker], type: 'module' };
  manifest.browser_specific_settings = {
    gecko: {
      id: FIREFOX_ID,
      strict_min_version: '140.0',
      update_url: FIREFOX_UPDATE_URL,
      data_collection_permissions: { required: ['none'] },
    },
  };
  return manifest;
}
