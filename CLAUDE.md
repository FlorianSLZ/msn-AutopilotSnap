# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

AutopilotSnap (msnugget brand): a client-only static web app. It scans the Windows Autopilot Device Preparation OOBE QR code (`devicelink:/1/?sn=…&data=…`), shows the device(s), builds a CSV in the browser and hands it to the user via the Web Share API (fallback: download + `mailto:`). Live at https://autopilotsnap.msnugget.com/. Pushes to `main` are built and deployed by Cloudflare (`wrangler.toml`, `npm run build`, assets from `dist/`).

## Commands

```bash
npm run dev                          # Vite dev server
npm run typecheck                    # tsc --noEmit (strict)
npm test                             # vitest run (node env, src/**/*.test.ts only)
npx vitest run src/lib/csv.test.ts   # single test file
npx vitest run -t "name"             # single test by name
npm run build                        # typecheck + vite build -> dist/
```

There is no linter configured. Tests cover `src/lib` only; there are no component or browser tests.

## Releases

Every push to `main` is versioned by `.github/workflows/release.yml` running `scripts/release.mjs`: it assigns a calendar version `YYYY.MM.DD.N` (UTC date, N = release number of that day), prepends `CHANGELOG.md`, writes `version.json`, tags and creates a GitHub release. The footer shows the version via the Vite `__APP_VERSION__` define (from the `version.json` file; `package.json` keeps its own placeholder version). The bot commit (`chore(release): vX`, no `[skip ci]` so Cloudflare rebuilds with the new version) lands on `main`, so `git pull` before your next push. Preview with `node scripts/release.mjs --dry-run`. Conventional prefixes (`feat:`, `fix:`, `docs:`) only decide the changelog section, not the version number; do not edit CHANGELOG.md by hand.

## Hard constraints (do not break)

- No backend, no Graph/Entra/Intune auth, no analytics/telemetry/cookies. Device data lives in React state only.
- Never log or display raw QR payloads. `DeviceLinkError` and `ScanError` carry codes and fixed messages, never payload text.
- The only persisted browser value is the theme (`localStorage` key `theme`). Wrap storage access in try/catch.
- Tests and fixtures use obviously synthetic data (`src/lib/fixtures.ts`). Never commit real QR payloads or device exports.
- `base: "./"` and hash routing (`#/`, `#/faq`) are deliberate so any static host or sub-path works without rewrites. Asset URLs in `index.html`, the manifest and components stay relative (the `og:image`/`og:url` tags are the only absolute URLs).
- The Windows QR layout was learned from Simsen/AutopilotQR (MIT). Credit lives in the README, FAQ and footer; keep it. No code from that project's Graph/sign-in flow is used.

## Architecture

The app is a single React tree in `src/App.tsx` (no router library, no state library). `App` owns `step` (`scan` | `review`), the in-memory `devices: DeviceLink[]`, and the dialogs (send-to-mobile, confirm-discard). `ScanView` and `ReviewView` are components in the same file. `Faq.tsx` and `HowTo.tsx` are static content; the how-to renders only on the scan step.

All logic that matters is in `src/lib` and is DOM-light so it can be tested in node:

- `devicelink.ts`: `parseDeviceLink(text)` turns the QR text into a `DeviceLink`. The payload is `base64(gzip(JSON))` with short keys (`ver`, `dlict`, `di{man,mod,sn,li,…}`), inflated with `DecompressionStream`. Query parsing is manual because `URLSearchParams` would turn `+` into a space. Guards: 4096 chars for the QR, 16 KB inflated, and the serial must match the URL `sn`.
- `scanner.ts`: zxing-wasm (`readBarcodes`, QRCode only) for both the camera frame loop and image files. The WASM is bundled locally via `?url` + `prepareZXingModule` `locateFile`, so there is no CDN fetch. Image decode retries at 1600 px and 1000 px.
- `csv.ts`: the CSV is the Intune corporate-identifier format, `Manufacturer,Model,Serial`, one line per device, no header, CRLF, no BOM. It is not the signed Device association file. Fields are RFC 4180 escaped, formula-injection is neutralised (leading `'`), duplicate serials are written once.
- `share.ts`: `sendFile` tries `navigator.canShare({files})` + `navigator.share` (AbortError = cancelled), otherwise downloads the file and opens `mailto:`. `mailto:` cannot attach files, so the UI tells the user to attach it manually in that case.
- `qr.ts`: QR generation (qrcode-generator) for the send-to-mobile dialog; `appUrl()` strips hash and query.
- `feedback.ts`: beep + vibrate on scan success, with no audio assets.

Batch mode: `onFiles` decodes many images, `mergeDevices` dedupes by serial, and one CSV is produced for all devices.

## Styling

Plain CSS, no framework. `src/styles.css` holds the msnugget design tokens (dark default, `data-theme="light"`, Signal Green `#39a751` as the only accent, pill controls, 16px cards, system fonts). `src/polish.css` layers animations and refinements on top. The theme is set by an inline script in `index.html` before first paint. Keep header and footer consistent with `C:\GitHub\msnugget\msn-query-collection`. Respect `prefers-reduced-motion`; a hidden start state for an animation must live inside a `no-preference` media query.

## Gotchas

- Public assets (logo, how-to screenshots, manifest) live in `public/` and are referenced as `./…`.
- Unverified against real use: the live camera scan, the real share sheet, and whether Intune accepts multi-line CSVs (the only sample had one line).
- On Windows, git warns about LF→CRLF; this is expected and harmless.
