# Recording Downloader for tl;dv

<img src="src/icons/icon-128.png" width="64" alt="">


An unofficial browser extension (Edge, Firefox, Chrome) that downloads **your own** tl;dv meeting recordings. It saves the
recording as an `.mp4` or as the original `.ts` file. Nothing is re-encoded, so there is no quality loss.
Not affiliated with or endorsed by tl;dv.

## Install

**Easiest: open the [install page](https://iamtiqbal.github.io/tldv-recording-downloader/)**. It
picks the right option for your browser.

| Browser | How | Effort |
|---|---|---|
| **Microsoft Edge** | [Edge Add-ons store](https://iamtiqbal.github.io/tldv-recording-downloader/#edge), reviewed by Microsoft | One click |
| **Firefox** | [Add to Firefox](https://iamtiqbal.github.io/tldv-recording-downloader/#firefox), signed by Mozilla, updates itself | One click |
| **Chrome** | Developer mode (steps below) | About a minute |

### Chrome

Chrome only allows one-click installs from its paid Chrome Web Store, so this extension is
installed manually:

1. Download `recording-downloader-<version>-chrome.zip` from the
   [latest release](https://github.com/IamTIqbal/tldv-recording-downloader/releases/latest) and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the unzipped `recording-downloader` folder.
4. Pin the extension (puzzle-piece icon → pin) so it's always in the toolbar.

Keep the unzipped folder: Chrome loads the extension from it. To update, replace the folder's
contents with a newer release and click the reload arrow on the extension in `chrome://extensions`.

## Use

1. Open one of your recordings on tldv.io (`tldv.io/app/meetings/<id>`).
2. Click the extension icon. If it asks, reload the page once so it can use your tl;dv login.
3. Click **Download this recording**. A downloader tab opens and downloads all the video pieces.
4. Click **Save as MP4**, or **Save original (.ts)** for the untouched file (VLC plays it).

Keep the downloader tab open until the file is saved.

## How it works

- `background.js` records the `Authorization` header that the tl;dv web app sends to its own API
  (`gw.tldv.io`, `gaia.tldv.io`). The token is kept in `chrome.storage.session`, which is cleared
  when the browser closes and never sent anywhere except tl;dv.
- The downloader asks `gaia.tldv.io/v1/meetings/<id>/playlist.m3u8` for the player's playlist.
  This request runs inside your tl;dv tab, so it passes the same checks as the web player.
- tl;dv scrambles the segment URLs with a letter-shift (Caesar) cipher, described in a
  `#TLDVCONF:<ttl>,<shift>,<base-url>` header. `lib/hls.js` reverses it.
- `lib/segments.js` downloads the pieces 6 at a time, retries failed pieces, and decrypts
  AES-128 if the playlist uses it.
- `lib/remux.js` converts to a regular MP4 with [Mediabunny](https://mediabunny.dev), copying every
  track as-is (H.264/HEVC video; AAC, MP3, AC-3, Opus audio). If a track can't be carried over it
  fails with a clear error instead of silently dropping it.

If the video is stored on a host outside `*.tldv.io`, the downloader asks once for permission to
download from that host.

## Limits

- Only recordings your tl;dv account can already open. It does not get around login or DRM:
  DRM-protected (SAMPLE-AES) and fMP4 playlists are rejected with a clear message.
- The whole recording is held in browser memory. Typical meetings are fine; very long
  recordings (3+ hours) may run short on memory.
- The MP4 is a regular (non-fragmented) MP4 that plays in VLC, QuickTime, Windows and most editors.
- tl;dv's API is undocumented. If tl;dv changes it, the downloader shows the HTTP error.

## Credits

- Video conversion: [Mediabunny](https://mediabunny.dev) (MPL-2.0), bundled unmodified in `src/vendor/`.
- Fonts: Sora and IBM Plex Sans (SIL Open Font License 1.1), bundled in `src/fonts/` with their licences.

## Develop

```
npm install
npm test          # unit tests + a real .ts -> .mp4 conversion check using ffmpeg-static
npm run vendor    # refresh src/vendor/mediabunny.min.mjs from node_modules
npm run build     # dist/ zips for Chrome (GitHub release), Edge (store upload) and Firefox
npm run lint:firefox
npm run sign:firefox   # needs WEB_EXT_API_KEY / WEB_EXT_API_SECRET, see store/firefox-signing.md
```

`src/manifest.json` is the Chrome/Edge manifest; `scripts/manifests.mjs` derives the Firefox one.
Loading `src/` unpacked in Chrome still works for development. Store and signing steps:
[store/edge-listing.md](store/edge-listing.md), [store/firefox-signing.md](store/firefox-signing.md).
The install page is `docs/index.html`, served by GitHub Pages.

The API details come from the MIT-licensed
[Cramraika/tldv_downloader](https://github.com/Cramraika/tldv_downloader) project's documentation.
