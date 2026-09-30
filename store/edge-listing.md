# Microsoft Edge Add-ons submission

Everything to paste into [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview).
Registering as an Edge extension developer is free.

## Package

Upload `dist/recording-downloader-<version>-edge.zip` (build it with `npm run build`).

## Availability

- Visibility: **Public**
- Markets: all

## Properties

- Category: **Productivity**
- Privacy policy: required (the extension reads the tl;dv login token). URL:
  `https://github.com/IamTIqbal/tldv-recording-downloader/blob/main/PRIVACY.md`
- Website: `https://github.com/IamTIqbal/tldv-recording-downloader`
- Support contact: `https://github.com/IamTIqbal/tldv-recording-downloader/issues`
- Mature content: No

## Store listing (English)

**Display name:** Recording Downloader for tl;dv

**Short description** (max 250 characters):

> Unofficial. Download your own tl;dv meeting recordings as MP4 or the original .ts file. No
> re-encoding, no quality loss, audio kept. Uses your existing tl;dv login; files go straight to
> your computer.

**Description:**

> Recording Downloader for tl;dv adds a toolbar button that downloads the tl;dv meeting recording
> you have open.
>
> • Save as MP4, or as the untouched original .ts file
> • Nothing is re-encoded, so there is no quality loss and the audio is kept
> • Downloads pieces in parallel and retries failed ones
> • Uses your existing tl;dv login in the browser; files are saved straight to your computer
> • No tracking, no analytics, no servers of our own
>
> How to use: open one of your recordings on tldv.io, click the extension icon, then
> "Download recording". When the download finishes, choose "Save as MP4" or "Save original (.ts)".
>
> Works only for recordings your tl;dv account can already open. It does not bypass login or DRM.
>
> This is an independent, open-source project. It is not affiliated with or endorsed by tl;dv.
> Source code: https://github.com/IamTIqbal/tldv-recording-downloader

**Store logo:** `src/icons/icon-128.png` (128×128 is the accepted minimum; 300×300 is recommended).

**Screenshots** (1280×800 or 640×400): take two in Edge.
1. The popup on a tl;dv recording page, showing "Download recording".
2. The downloader tab after download, showing "Save as MP4" / "Save original (.ts)".

Hide meeting titles and other people's names before taking them.

## Notes for certification

Paste this in the "Notes for certification" box so the reviewer can test it:

> This extension downloads recordings from the user's own tl;dv account (https://tldv.io).
> To test: create a free tl;dv account, record or upload a short test meeting (or use the sample
> meeting in a new account), open it at tldv.io/app/meetings/<id>, click the extension icon, then
> "Download recording". If the popup asks, reload the page once so the extension can read the
> login the tl;dv web app uses. When the download completes, click "Save as MP4".
>
> Permissions:
> - webRequest + host access to *.tldv.io: read the Authorization header the tl;dv web app sends to
>   its own API, so the extension can request the same recording. The token stays in session storage.
> - scripting: run the playlist request inside the user's tl;dv tab so it passes tl;dv's CORS checks.
> - downloads: save the finished file.
> - storage: keep the token in session storage (cleared when the browser closes).
> - activeTab: read the meeting id of the open tab.
> - optional host access (https://*/*): requested at runtime, only if tl;dv stores the video on a
>   host outside tldv.io; the user sees the host name and approves it.
>
> No data is collected or sent anywhere except tl;dv's own servers. Privacy policy:
> https://github.com/IamTIqbal/tldv-recording-downloader/blob/main/PRIVACY.md
