// tl;dv API endpoints and small helpers around them.

export const WATCH_PAGE_URL = (id) => `https://gw.tldv.io/v1/meetings/${id}/watch-page?noTranscript=true`;
// The player's secured playlist. Lives on gaia, not the gw gateway.
export const PLAYLIST_URL = (id) => `https://gaia.tldv.io/v1/meetings/${id}/playlist.m3u8`;
// The web app sends "tldv-webapp/<version>"; only its presence is checked.
export const CLIENT_HEADER = { 'X-Tldv-Client': 'tldv-webapp/1.0.0' };

export function meetingIdFromUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)tldv\.io$/.test(parsed.hostname)) return null;
  const match = parsed.pathname.match(/\/meetings\/([A-Za-z0-9_-]{10,})/);
  return match ? match[1] : null;
}

export function parseWatchPage(json) {
  const meeting = (json && json.meeting) || {};
  return { name: meeting.name || null, createdAt: meeting.createdAt || null };
}

export function sanitizeFilename(name) {
  const clean = String(name || '')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 120);
  return clean || 'tldv-meeting';
}

export function buildFilename({ name, createdAt }, ext) {
  const date = createdAt && !Number.isNaN(Date.parse(createdAt))
    ? new Date(createdAt).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  return `${date}_${sanitizeFilename(name)}.${ext}`;
}

// "Weekly Sync | tl;dv" -> "Weekly Sync". Generic app titles give null.
export function titleFromTab(title) {
  const clean = String(title || '').replace(/\s*[|·–-]\s*tl;?dv.*$/i, '').trim();
  return clean && !/^tl;?dv$/i.test(clean) ? clean : null;
}

export function formatDuration(seconds) {
  if (!seconds) return null;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h) return `${h} h ${m} min`;
  return m ? `${m} min` : `${total} s`;
}

export function formatDate(iso, locale) {
  if (!iso || Number.isNaN(Date.parse(iso))) return null;
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}
