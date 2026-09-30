// End-to-end check of the .ts -> .mp4 path on real video made by ffmpeg.
// (This ffmpeg build crashes when *reading* MPEG-TS, so each clip is encoded
// once to MKV as the reference and the HLS segments are cut from that.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import * as mb from 'mediabunny';
import { remuxToMp4, describeTracks } from '../src/lib/remux.js';
import { parsePlaylist } from '../src/lib/hls.js';

const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');

function makeRecording(audioArgs, seconds = 12) {
  const dir = mkdtempSync(join(tmpdir(), 'tldv-remux-'));
  const ref = join(dir, 'ref.mkv');
  execFileSync(ffmpeg, [
    '-v', 'error',
    '-f', 'lavfi', '-i', `testsrc2=size=640x360:rate=25:duration=${seconds}`,
    '-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}`,
    '-c:v', 'libx264', '-g', '50', '-bf', '2', ...audioArgs, '-shortest', ref,
  ]);
  execFileSync(ffmpeg, [
    '-v', 'error', '-i', ref, '-c', 'copy',
    '-f', 'hls', '-hls_time', '4', '-hls_list_size', '0',
    '-hls_segment_filename', join(dir, 'seg%03d.ts'), join(dir, 'index.m3u8'),
  ]);
  const { segments } = parsePlaylist(readFileSync(join(dir, 'index.m3u8'), 'utf8'), `file://${dir}/index.m3u8`);
  const ts = new Blob(segments.map((s) => readFileSync(new URL(s.url))));
  return { dir, ref, ts, segmentCount: segments.length };
}

const decodedMd5 = (file, stream) => execFileSync(ffmpeg,
  ['-v', 'error', '-i', file, '-map', `0:${stream}`, '-f', 'md5', '-'], { encoding: 'utf8' }).trim();
const info = (file) => spawnSync(ffmpeg, ['-hide_banner', '-i', file], { encoding: 'utf8' }).stderr;

for (const [label, audioArgs, codec] of [
  ['AAC', ['-c:a', 'aac'], 'aac'],
  ['MP3', ['-c:a', 'libmp3lame'], 'mp3'],
  ['AC-3', ['-c:a', 'ac3'], 'ac3'],
]) {
  test(`H.264 + ${label}: MP4 keeps the audio and every video frame, unchanged`, async () => {
    const { dir, ref, ts, segmentCount } = makeRecording(audioArgs);
    assert.ok(segmentCount >= 3);
    assert.equal(await describeTracks(ts, mb), `Video: avc · Audio: ${codec}`);

    const progress = [];
    const mp4 = await remuxToMp4(ts, mb, (p) => progress.push(p));
    const out = join(dir, 'out.mp4');
    writeFileSync(out, new Uint8Array(await mp4.arrayBuffer()));

    assert.equal(progress.at(-1), 1);
    assert.match(info(out), /Video: h264/);
    assert.match(info(out), new RegExp(`Audio: ${codec}`));
    assert.equal(decodedMd5(out, 'v'), decodedMd5(ref, 'v'), 'decoded video differs from the original');
    if (codec !== 'mp3') {
      // MP3 keeps the encoder's trailing padding (~11 ms), so its hash differs by design.
      assert.equal(decodedMd5(out, 'a'), decodedMd5(ref, 'a'), 'decoded audio differs from the original');
    }
  });
}

test('fails loudly when the input is not MPEG-TS', async () => {
  await assert.rejects(remuxToMp4(new Blob([new Uint8Array(1000)]), mb));
});
