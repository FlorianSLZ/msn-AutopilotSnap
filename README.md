# AutopilotSnap

**Scan. Send. Deploy.**

Scan the Windows Autopilot Device Preparation QR code on a device sitting at OOBE, review the detected device, and send a ready-made CSV to your IT team. The person preparing the device needs **no** Intune credentials, Graph permissions, tenant access or Entra account.

> AutopilotSnap is an independent community project. It is **not** an official Microsoft product and is not affiliated with or endorsed by Microsoft. Windows, Autopilot, Intune and Entra are trademarks of Microsoft.

## How it works

```
Windows OOBE
      │
      │ QR
      ▼
 AutopilotSnap          (runs entirely in your browser)
      │
      ├── Decode DeviceLink
      ├── Generate CSV
      │
      ▼
 Share / Email client   (Web Share sheet, or download + mailto:)
      │
      ▼
 Intune Administrator   (uploads the CSV)
```

1. At OOBE press the Windows key five times to open the Autopilot menu and show the QR code.
2. Open AutopilotSnap on a phone, tap **Scan QR Code** (or upload a photo of the code).
3. Review serial number, manufacturer and model.
4. Tap **Send to IT**.

### Sending: honest about attachments

A `mailto:` link cannot attach a locally generated file. So:

1. If the browser supports sharing files (`navigator.canShare({ files })` – typical on Android/iOS), the share sheet opens with the CSV, and you can pick your mail app.
2. Otherwise the CSV is downloaded and your default mail client opens with subject and body prefilled. **You must attach the downloaded CSV yourself**; the app tells you so.

There is no SMTP, Graph `Mail.Send`, backend or API key. Set the recipient under ⚙ Settings; it is stored only in your browser's `localStorage`.

## Formats

**QR payload** (`src/lib/devicelink.ts`):

```
devicelink:/1/?sn=<serial>&data=<url-encoded base64( gzip( JSON ) )>
```

The JSON uses short keys (`ver`, `dlict`, `di{man,mod,sn,li,…}`, `dlkd{…}`). AutopilotSnap validates it (version `1.0`, serial in the URL equals the serial in the JSON, 4 KB QR / 16 KB inflated size limits) and extracts manufacturer, model and serial number. Nothing is guessed: missing or malformed values are rejected.

**CSV** (`src/lib/csv.ts`): the Intune *Corporate device identifier* import format "Manufacturer, model and serial number" – no header row, one device per line, CRLF:

```
Microsoft Corporation,Surface Laptop Studio,0F00NFU231300C
```

Admins upload it in the Intune admin center under **Devices → Enrollment → Corporate device identifiers → Add → Upload a CSV file → Manufacturer, model and serial number**. File name: `AutopilotSnap-<SERIAL>.csv`.

> This is the *corporate identifier* route for Autopilot device preparation. It is not the signed OOBE "Export device information" DeviceLink CSV used by *Device association*, and not the hardware-hash CSV of classic Autopilot.

## Privacy

- QR decoding (zxing-wasm, bundled locally), DeviceLink parsing and CSV creation all run in your browser.
- No backend, telemetry, analytics, cookies or third-party requests. Camera frames and images never leave the device.
- Device data is held in memory only, cleared on **Scan another device**, and never written to `localStorage`. Only the recipient address is persisted.
- The raw QR payload is never shown, logged or put in error messages.
- Data leaves your browser only when you explicitly share, download or email the CSV.

## Development

```bash
npm install
npm run dev        # local dev server
npm run typecheck
npm test
npm run build      # static output in dist/
```

Camera access needs HTTPS (or `localhost`). To test on a phone, use a tunnel or deploy a preview; uploading a QR image works anywhere.

The build is fully static (`base: "./"`) and deploys as-is to GitHub Pages, Cloudflare Pages or Azure Static Web Apps.

Tests use obviously synthetic fixtures (`src/lib/fixtures.ts`); never commit real DeviceLink payloads or exports.

## Credits & licence

MIT – see [LICENSE](LICENSE). The DeviceLink QR layout was learned from [Simsen/AutopilotQR](https://github.com/Simsen/AutopilotQR) (MIT). AutopilotSnap is an independent implementation and contains none of its Graph/authentication code.

## Deploying to Cloudflare (build on push)

Same setup as `msn-query-collection`: connect the GitHub repo in Cloudflare (**Workers & Pages → Create → Import a repository**) and use:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |

`wrangler.toml` serves `dist/` as static assets – there is no Worker code and no server-side component. Every push to the production branch builds and deploys; other branches get preview URLs. Cloudflare serves HTTPS, which the camera requires. Because the build is relative (`base: "./"`), GitHub Pages and Azure Static Web Apps work too.
