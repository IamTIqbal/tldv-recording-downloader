import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rot, decodeTldvPlaylist, parsePlaylist, pickBestVariant, sequenceIv, parseAttributes,
} from '../src/lib/hls.js';

test('rot shifts letters only and round-trips', () => {
  assert.equal(rot('abcXYZ-019_z.ts', 3), 'defABC-019_c.wv');
  assert.equal(rot(rot('Segment_00012.ts?X-Amz-Signature=ab12', 7), -7), 'Segment_00012.ts?X-Amz-Signature=ab12');
  assert.equal(rot('abc', 26), 'abc');
});

test('decodeTldvPlaylist un-shifts URI lines and prefixes the base URL', () => {
  const shift = 5;
  const plain = 'seg_000.ts?sig=Abc';
  const text = [
    '#EXTM3U',
    '#EXT-X-TARGETDURATION:10',
    `#TLDVCONF:172800,${shift},https://media-files.tldv.io/rec/`,
    '#EXTINF:10.0,',
    rot(plain, -shift),
    '#EXT-X-ENDLIST',
  ].join('\n');
  const { text: out, conf } = decodeTldvPlaylist(text);
  assert.deepEqual(conf, { ttl: 172800, shift, baseUrl: 'https://media-files.tldv.io/rec/' });
  assert.ok(!out.includes('#TLDVCONF'));
  assert.ok(out.includes(`https://media-files.tldv.io/rec/${plain}`));
});

test('decodeTldvPlaylist leaves plain playlists alone', () => {
  const text = '#EXTM3U\n#EXTINF:4,\nseg0.ts\n';
  assert.deepEqual(decodeTldvPlaylist(text), { text, conf: null });
});

test('decodeTldvPlaylist rejects URI lines before the header', () => {
  assert.throws(() => decodeTldvPlaylist('#EXTM3U\nseg0.ts\n#TLDVCONF:1,1,https://x/\n'), /before/);
});

test('parseAttributes handles quoted commas', () => {
  assert.deepEqual(parseAttributes('METHOD=AES-128,URI="https://k/a,b",IV=0x01'),
    { METHOD: 'AES-128', URI: 'https://k/a,b', IV: '0x01' });
});

test('parsePlaylist reads master playlists and pickBestVariant picks top bandwidth', () => {
  const text = [
    '#EXTM3U',
    '#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360',
    'low/index.m3u8',
    '#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720',
    'hd/index.m3u8',
  ].join('\n');
  const parsed = parsePlaylist(text, 'https://cdn.example/rec/master.m3u8');
  assert.equal(parsed.type, 'master');
  assert.equal(pickBestVariant(parsed.variants).url, 'https://cdn.example/rec/hd/index.m3u8');
});

test('parsePlaylist reads media playlists with sequence numbers and keys', () => {
  const text = [
    '#EXTM3U',
    '#EXT-X-MEDIA-SEQUENCE:7',
    '#EXTINF:4.0,',
    'a.ts',
    '#EXT-X-KEY:METHOD=AES-128,URI="key.bin"',
    '#EXTINF:4.0,',
    'https://other.example/b.ts',
    '#EXT-X-KEY:METHOD=NONE',
    '#EXTINF:2.5,',
    'c.ts',
    '#EXT-X-ENDLIST',
  ].join('\n');
  const { type, segments } = parsePlaylist(text, 'https://cdn.example/rec/index.m3u8');
  assert.equal(type, 'media');
  assert.deepEqual(segments.map((s) => [s.url, s.sequence, s.duration]), [
    ['https://cdn.example/rec/a.ts', 7, 4],
    ['https://other.example/b.ts', 8, 4],
    ['https://cdn.example/rec/c.ts', 9, 2.5],
  ]);
  assert.equal(segments[0].key, null);
  assert.equal(segments[1].key.uri, 'https://cdn.example/rec/key.bin');
  assert.equal(segments[1].key.iv, null);
  assert.equal(segments[2].key, null);
});

test('parsePlaylist rejects DRM, fMP4 and non-playlists', () => {
  assert.throws(() => parsePlaylist('#EXTM3U\n#EXT-X-KEY:METHOD=SAMPLE-AES,URI="skd://x"\n#EXTINF:4,\na.ts', 'https://x/'), /Unsupported encryption/);
  assert.throws(() => parsePlaylist('#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:4,\na.m4s', 'https://x/'), /fMP4/);
  assert.throws(() => parsePlaylist('<html>', 'https://x/'), /Not an HLS playlist/);
});

test('sequenceIv is the sequence number, big-endian, in 16 bytes', () => {
  assert.deepEqual([...sequenceIv(258)], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2]);
});
