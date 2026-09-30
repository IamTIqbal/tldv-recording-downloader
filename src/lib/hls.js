// HLS playlist parsing, plus undoing tl;dv's segment-URL obfuscation.
//
// tl;dv's secured playlist carries a custom header line
//   #TLDVCONF:<ttl-seconds>,<shift>,<base-url>
// and every URI line below it is Caesar-shifted by <shift>. Shifting the
// letters back and prefixing <base-url> gives plain, presigned URLs.

export const TLDV_CONF_PREFIX = '#TLDVCONF:';

export function rot(text, shift) {
  let out = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code >= 97 && code <= 122) {
      out += String.fromCharCode(((code - 97 + shift) % 26 + 26) % 26 + 97);
    } else if (code >= 65 && code <= 90) {
      out += String.fromCharCode(((code - 65 + shift) % 26 + 26) % 26 + 65);
    } else {
      out += char;
    }
  }
  return out;
}

export function parseTldvConf(line) {
  const parts = line.slice(TLDV_CONF_PREFIX.length).split(',');
  const ttl = Number(parts[0]);
  const shift = Number(parts[1]);
  const baseUrl = parts.slice(2).join(',');
  if (!Number.isInteger(ttl) || !Number.isInteger(shift) || parts.length < 3) {
    throw new Error(`Malformed ${TLDV_CONF_PREFIX} header: ${line}`);
  }
  return { ttl, shift, baseUrl };
}

// Returns the playlist with plain URI lines. A playlist without a
// #TLDVCONF header is returned unchanged.
export function decodeTldvPlaylist(text) {
  const lines = text.split(/\r?\n/);
  const confLine = lines.find((line) => line.startsWith(TLDV_CONF_PREFIX));
  if (!confLine) return { text, conf: null };

  const conf = parseTldvConf(confLine);
  let seenConf = false;
  const out = [];
  for (const line of lines) {
    if (line.startsWith(TLDV_CONF_PREFIX)) {
      seenConf = true;
      continue;
    }
    if (line.startsWith('#') || !line.trim()) {
      out.push(line);
      continue;
    }
    if (!seenConf) {
      throw new Error(`URI line before the ${TLDV_CONF_PREFIX} header; playlist format changed?`);
    }
    out.push(conf.baseUrl + rot(line.trim(), conf.shift));
  }
  return { text: out.join('\n'), conf };
}

// Parses `KEY=value,KEY2="quoted, value"` attribute lists.
export function parseAttributes(input) {
  const attrs = {};
  const re = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g;
  let match;
  while ((match = re.exec(input))) {
    let value = match[2];
    if (value.startsWith('"')) value = value.slice(1, -1);
    attrs[match[1]] = value;
  }
  return attrs;
}

function hexToBytes(hex) {
  const clean = hex.replace(/^0x/i, '').padStart(32, '0');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

// Parses a master or media playlist. Relative URIs are resolved against
// playlistUrl.
export function parsePlaylist(text, playlistUrl) {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  if (lines[0] !== '#EXTM3U') throw new Error('Not an HLS playlist (missing #EXTM3U)');
  const resolve = (uri) => new URL(uri, playlistUrl).href;

  if (lines.some((line) => line.startsWith('#EXT-X-STREAM-INF:'))) {
    const variants = [];
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith('#EXT-X-STREAM-INF:')) continue;
      const attrs = parseAttributes(lines[i].slice('#EXT-X-STREAM-INF:'.length));
      const uri = lines.slice(i + 1).find((line) => line && !line.startsWith('#'));
      if (!uri) continue;
      variants.push({
        bandwidth: Number(attrs.BANDWIDTH) || 0,
        resolution: attrs.RESOLUTION || null,
        url: resolve(uri),
      });
    }
    return { type: 'master', variants };
  }

  let sequence = 0;
  let duration = null;
  let key = null;
  const segments = [];
  for (const line of lines) {
    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
      sequence = Number(line.split(':')[1]) || 0;
    } else if (line.startsWith('#EXT-X-MAP:')) {
      throw new Error('This recording uses fMP4 HLS segments, which are not supported yet');
    } else if (line.startsWith('#EXT-X-KEY:')) {
      const attrs = parseAttributes(line.slice('#EXT-X-KEY:'.length));
      if (attrs.METHOD === 'NONE') {
        key = null;
      } else if (attrs.METHOD === 'AES-128') {
        key = { method: 'AES-128', uri: resolve(attrs.URI), iv: attrs.IV ? hexToBytes(attrs.IV) : null };
      } else {
        throw new Error(`Unsupported encryption method ${attrs.METHOD}; this recording cannot be downloaded`);
      }
    } else if (line.startsWith('#EXTINF:')) {
      duration = parseFloat(line.slice('#EXTINF:'.length));
    } else if (line && !line.startsWith('#')) {
      segments.push({ url: resolve(line), duration, sequence, key });
      sequence += 1;
      duration = null;
    }
  }
  if (!segments.length) throw new Error('Playlist contains no segments');
  return { type: 'media', segments };
}

export function pickBestVariant(variants) {
  if (!variants.length) throw new Error('Master playlist has no variants');
  return variants.reduce((best, v) => (v.bandwidth > best.bandwidth ? v : best));
}

// IV for a segment without an explicit IV: its media sequence number as a
// 16-byte big-endian integer (RFC 8216 §5.2).
export function sequenceIv(sequence) {
  const iv = new Uint8Array(16);
  new DataView(iv.buffer).setUint32(12, sequence);
  return iv;
}
