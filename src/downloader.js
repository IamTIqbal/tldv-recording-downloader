import { decodeTldvPlaylist, parsePlaylist, pickBestVariant } from './lib/hls.js';
import { downloadSegments } from './lib/segments.js';
import * as mediabunny from './vendor/mediabunny.min.mjs';
import { remuxToMp4, describeTracks } from './lib/remux.js';
import {
  WATCH_PAGE_URL, PLAYLIST_URL, CLIENT_HEADER, parseWatchPage, buildFilename, formatDate, formatDuration,
} from './lib/tldv.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const meetingId = params.get('meeting');
const tabId = Number(params.get('tab')) || null;

class AuthError extends Error {}

const mb = (bytes) => (bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`);

// ---- view helpers -------------------------------------------------------

let currentStep = 'find';

function setStep(name, state, detail) {
  const step = $(`step-${name}`);
  step.dataset.state = state;
  if (detail !== undefined) $(`${name}-detail`).textContent = detail;
  if (state === 'active' || state === 'waiting') currentStep = name;
}

function setBar(id, fraction) {
  $(id).hidden = false;
  $(id).firstElementChild.style.width = `${Math.round(fraction * 100)}%`;
}

function showBanner(kind, text) {
  $('banner').hidden = false;
  $('banner').className = `banner ${kind}`;
  $('banner-text').textContent = text;
}

function addChip(text, kind = '') {
  if (!text) return;
  const chip = document.createElement('span');
  chip.className = `chip ${kind}`.trim();
  chip.textContent = text;
  $('chips').append(chip);
}

function keepOpen(on) {
  $('keep-open').hidden = !on;
  window.onbeforeunload = on ? () => true : null;
}

function errorMessage(err) {
  if (err instanceof AuthError) return 'Your tl;dv login has expired. Reload the tl;dv tab, then click the extension again.';
  return err.message || String(err);
}

// ---- tl;dv requests -----------------------------------------------------

// Runs inside the tl;dv tab, so the request comes from the same origin as
// the web player and passes the same CORS checks.
async function pageFetch(url, headers) {
  try {
    const res = await fetch(url, { headers, credentials: 'include' });
    return { ok: res.ok, status: res.status, url: res.url, text: await res.text() };
  } catch (err) {
    return { error: String(err) };
  }
}

async function tldvFetch(url, token) {
  const headers = token ? { Authorization: token, ...CLIENT_HEADER, Accept: '*/*' } : {};
  let res = null;
  if (tabId) {
    try {
      const [injection] = await chrome.scripting.executeScript({ target: { tabId }, func: pageFetch, args: [url, headers] });
      res = injection && injection.result;
    } catch {
      // The tl;dv tab was closed or navigated away; fetch from here instead.
    }
  }
  if (!res || res.error) res = await pageFetch(url, headers);
  if (res.error) throw new Error(`Network error fetching ${new URL(url).host}: ${res.error}`);
  if (res.status === 401) throw new AuthError('401');
  return res;
}

async function loadMeta(token) {
  try {
    const res = await tldvFetch(WATCH_PAGE_URL(meetingId), token);
    return res.ok ? parseWatchPage(JSON.parse(res.text)) : parseWatchPage(null);
  } catch (err) {
    if (err instanceof AuthError) throw err;
    return parseWatchPage(null);
  }
}

async function loadSegments(token) {
  const res = await tldvFetch(PLAYLIST_URL(meetingId), token);
  if (!res.ok) throw new Error(`tl;dv refused the playlist (HTTP ${res.status}). Is this your recording?`);
  let playlist = parsePlaylist(decodeTldvPlaylist(res.text).text, res.url);
  if (playlist.type === 'master') {
    // Variant URLs are presigned; sending the bearer token too would upset the storage host.
    const variant = pickBestVariant(playlist.variants);
    const variantRes = await tldvFetch(variant.url, null);
    if (!variantRes.ok) throw new Error(`Could not load the video playlist (HTTP ${variantRes.status})`);
    playlist = parsePlaylist(decodeTldvPlaylist(variantRes.text).text, variantRes.url);
  }
  return playlist.segments;
}

// Segment hosts outside *.tldv.io need a one-time permission grant.
async function ensureHostAccess(segments) {
  const origins = [...new Set(segments.flatMap((s) => [s.url, s.key && s.key.uri].filter(Boolean))
    .map((url) => `${new URL(url).origin}/*`))];
  if (await chrome.permissions.contains({ origins })) return;

  const hosts = origins.map((o) => new URL(o.slice(0, -2)).host).join(', ');
  showBanner('info', `The video is stored on ${hosts}. Allow the extension to download from there.`);
  $('grant').hidden = false;
  await new Promise((resolve, reject) => {
    $('grant').onclick = async () => {
      const granted = await chrome.permissions.request({ origins });
      $('grant').hidden = true;
      $('banner').hidden = true;
      granted ? resolve() : reject(new Error('Access to the video host was not allowed.'));
    };
  });
}

async function save(blob, filename) {
  const url = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({ url, filename, saveAs: true });
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

// ---- flow ---------------------------------------------------------------

async function main() {
  if (!meetingId) throw new Error('No meeting given. Open this from the extension button on a tl;dv recording.');
  const { authToken } = await chrome.storage.session.get('authToken');
  if (!authToken) throw new AuthError('no token');

  setStep('find', 'active', 'Asking tl;dv for the video…');
  const meta = await loadMeta(authToken);
  $('title').textContent = meta.name || 'tl;dv recording';
  document.title = `${meta.name || 'Recording'} · Recording Downloader`;
  addChip(formatDate(meta.createdAt));

  const segments = await loadSegments(authToken);
  await ensureHostAccess(segments);
  addChip(formatDuration(segments.reduce((sum, s) => sum + (s.duration || 0), 0)));
  setStep('find', 'done', '');

  setStep('download', 'active', `0 of ${segments.length} pieces`);
  setBar('download-bar', 0);
  keepOpen(true);
  const blobs = await downloadSegments(segments, {
    onProgress: ({ done, total, bytes }) => {
      setBar('download-bar', done / total);
      $('download-detail').textContent = `${Math.round((done / total) * 100)}% · ${done} of ${total} pieces · ${mb(bytes)}`;
    },
  });
  const merged = new Blob(blobs, { type: 'video/mp2t' });
  $('download-bar').hidden = true;
  setStep('download', 'done', mb(merged.size));

  const tracks = await describeTracks(merged, mediabunny).catch(() => '');
  if (tracks) addChip(/Audio:/.test(tracks) ? 'Video + audio' : 'No audio track', /Audio:/.test(tracks) ? 'ok' : 'warn');
  $('chips').lastElementChild?.setAttribute('title', tracks);

  setStep('save', 'waiting', 'Choose a format below.');
  $('actions').hidden = false;
  const buttons = [$('save-mp4'), $('save-ts')];

  $('save-ts').onclick = async () => {
    try {
      await save(merged, buildFilename(meta, 'ts'));
      setStep('save', 'done', 'Saved the original .ts file.');
      keepOpen(false);
      showBanner('ok', `Saved ${buildFilename(meta, 'ts')} (${mb(merged.size)}).`);
    } catch (err) {
      showBanner('error', errorMessage(err));
    }
  };
  $('save-mp4').onclick = async () => {
    buttons.forEach((b) => { b.disabled = true; });
    $('banner').hidden = true;
    setStep('save', 'active', 'Converting to MP4 (no quality loss)…');
    setBar('convert-bar', 0);
    try {
      const mp4 = await remuxToMp4(merged, mediabunny, (fraction) => {
        setBar('convert-bar', fraction);
        $('save-detail').textContent = `Converting to MP4… ${Math.round(fraction * 100)}%`;
      });
      $('convert-bar').hidden = true;
      await save(mp4, buildFilename(meta, 'mp4'));
      setStep('save', 'done', 'Saved as MP4.');
      keepOpen(false);
      showBanner('ok', `Saved ${buildFilename(meta, 'mp4')} (${mb(mp4.size)}).`);
    } catch (err) {
      $('convert-bar').hidden = true;
      setStep('save', 'error', 'MP4 conversion failed.');
      showBanner('error', `${errorMessage(err)}\nYou can still save the original .ts file, which VLC plays directly.`);
    } finally {
      buttons.forEach((b) => { b.disabled = false; });
    }
  };
}

main().catch((err) => {
  console.error(err);
  keepOpen(false);
  if (err instanceof AuthError) chrome.storage.session.remove('authToken');
  $('download-bar').hidden = true;
  setStep(currentStep, 'error', '');
  if ($('title').textContent === 'Loading recording…') $('title').textContent = 'Could not download';
  showBanner('error', errorMessage(err));
  $('retry').hidden = false;
  $('retry').onclick = () => location.reload();
});
