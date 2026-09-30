# Firefox: free signing and self-hosting

Firefox only installs add-ons that Mozilla has signed. Signing is free, and a **self-distributed**
(unlisted) add-on is signed automatically, usually within minutes. It doesn't appear on
addons.mozilla.org. We host the signed `.xpi` on GitHub Pages, where Firefox installs it in one click
and checks it for updates.

## One-time setup

1. Create a free Firefox account and sign in at https://addons.mozilla.org/developers/.
2. Open https://addons.mozilla.org/developers/addon/api/key/ and generate API credentials.
3. In the GitHub repo, go to **Settings → Pages**, choose **Deploy from a branch**, then branch
   `main` and folder `/docs`. The site will be at https://iamtiqbal.github.io/tldv-recording-downloader/.

## Each release

1. Bump `version` in `src/manifest.json`. Mozilla never signs the same version twice.
2. Sign it (keep the keys out of git):

   ```
   WEB_EXT_API_KEY=user:12345:67 WEB_EXT_API_SECRET=... npm run sign:firefox
   ```

   This builds `dist/firefox`, uploads it to Mozilla as unlisted, downloads the signed `.xpi`, copies
   it to `docs/firefox/`, and rewrites `docs/firefox/updates.json`.
3. Commit `docs/firefox/` and push. GitHub Pages then serves the new version, and installed copies
   update themselves within a day.

## If Mozilla asks for source code

The extension ships `src/vendor/mediabunny.min.mjs`, an unmodified build of the open-source
[Mediabunny](https://github.com/Vanilagy/mediabunny) library. If a reviewer asks, reply that it is
the exact `dist/bundles/mediabunny.min.mjs` file from the npm package `mediabunny` at the version in
`package-lock.json`, produced by `npm run vendor`. All other files are hand-written and not minified.
