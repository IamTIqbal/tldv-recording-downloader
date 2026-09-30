# Privacy Policy

_Recording Downloader for tl;dv. Last updated 30 September 2026._

Recording Downloader for tl;dv is an unofficial browser extension that downloads meeting recordings
you can already open in your own tl;dv account. It does not collect, sell or share any personal data.

## What the extension handles

- **Your tl;dv login token.** When the tl;dv web app talks to its own servers (`gw.tldv.io`,
  `gaia.tldv.io`), the extension reads the `Authorization` header so it can make the same requests
  for you. The token is kept in the browser's session storage, which is cleared when the browser
  closes. It is sent only to tl;dv's own servers.
- **The recording.** Video pieces are downloaded from tl;dv (or the storage host tl;dv points to)
  into browser memory, joined, and saved to your computer through the browser's normal download
  dialog. They are not uploaded anywhere.

## What the extension does not do

- No analytics, tracking, advertising or telemetry.
- No servers of our own. Nothing is sent to the developer or any third party.
- No access to websites other than tl;dv, except a video storage host you approve on a
  one-time permission prompt.

## Contact

Questions: open an issue at https://github.com/IamTIqbal/tldv-recording-downloader/issues or email
hello@tamimiqbal.com.
