// Repackages an MPEG-TS recording into a regular MP4 with Mediabunny.
// Every track is stream-copied (no re-encoding, no quality loss). If a track
// cannot be carried over, conversion fails instead of silently dropping it.

const MAX_CHUNK = 16 * 1024 * 1024;

// Collects the MP4 writer's output as Blobs. Writes are sequential except for
// the few bytes of header Mediabunny patches once the file is finalized.
function blobCollector() {
  const chunks = []; // { position, blob }
  let end = 0;

  async function patch(position, data) {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkEnd = chunk.position + chunk.blob.size;
      if (position >= chunkEnd || position + data.byteLength <= chunk.position) continue;
      const bytes = new Uint8Array(await chunk.blob.arrayBuffer());
      const from = Math.max(position, chunk.position);
      const to = Math.min(position + data.byteLength, chunkEnd);
      bytes.set(data.subarray(from - position, to - position), from - chunk.position);
      chunks[i] = { position: chunk.position, blob: new Blob([bytes]) };
    }
  }

  const writable = new WritableStream({
    async write({ data, position }) {
      if (position === end) {
        chunks.push({ position, blob: new Blob([data]) });
        end += data.byteLength;
        return;
      }
      const overlap = Math.min(data.byteLength, Math.max(0, end - position));
      await patch(position, data.subarray(0, overlap));
      if (overlap < data.byteLength) {
        if (position + overlap !== end) throw new Error('MP4 writer skipped bytes');
        chunks.push({ position: end, blob: new Blob([data.subarray(overlap)]) });
        end += data.byteLength - overlap;
      }
    },
  });

  return { writable, toBlob: () => new Blob(chunks.map((c) => c.blob), { type: 'video/mp4' }) };
}

function openTs(tsBlob, mb) {
  return new mb.Input({ source: new mb.BlobSource(tsBlob), formats: [mb.MPEG_TS] });
}

// Short summary of the tracks in a recording, e.g. "Video: avc · Audio: mp3".
export async function describeTracks(tsBlob, mb) {
  const tracks = await openTs(tsBlob, mb).getTracks();
  return tracks.map((t) => `${t.type === 'video' ? 'Video' : 'Audio'}: ${t.codec || 'unknown'}`).join(' · ');
}

// onProgress receives a fraction between 0 and 1.
export async function remuxToMp4(tsBlob, mb, onProgress = () => {}) {
  const collector = blobCollector();
  const output = new mb.Output({
    format: new mb.Mp4OutputFormat({ fastStart: false }),
    target: new mb.StreamTarget(collector.writable, { chunked: true, chunkSize: MAX_CHUNK }),
  });

  const conversion = await mb.Conversion.init({
    input: openTs(tsBlob, mb),
    output,
    // Asking for each track's own codec means "copy it as-is".
    video: (track) => ({ codec: track.codec }),
    audio: (track) => ({ codec: track.codec }),
    showWarnings: false,
  });

  const lost = conversion.discardedTracks;
  if (!conversion.isValid || lost.length) {
    const detail = lost.map((d) => `${d.track.type} ${d.track.codec || 'unknown codec'}: ${d.reason}`).join(', ');
    throw new Error(`MP4 can't carry every track of this recording${detail ? ` (${detail})` : ''}. Save the .ts file instead.`);
  }

  conversion.onProgress = (progress) => onProgress(progress);
  await conversion.execute();
  return collector.toBlob();
}
