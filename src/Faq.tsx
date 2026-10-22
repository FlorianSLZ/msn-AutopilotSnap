const FAQ: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: "What is AutopilotSnap?",
    a: "A small browser tool for technicians who prepare Windows devices. You scan the QR code that Windows shows during setup (OOBE), check the detected device and send a ready-made CSV to your IT team. The IT team uploads it to Intune.",
  },
  {
    q: "Do I need Intune, Entra or any admin credentials?",
    a: "No. AutopilotSnap never signs in anywhere and never talks to Microsoft Entra ID, Microsoft Graph or Intune. The person with the device only needs a phone or laptop with a camera.",
  },
  {
    q: "How do I show the QR code on the Windows device?",
    a: "Turn the device on and stop at the first OOBE screen (region selection). Press the Windows key five times quickly to open the Autopilot menu and choose “Scan QR code”. The QR code appears on the screen. Availability depends on your Windows version.",
  },
  {
    q: "Where does my data go?",
    a: "Nowhere. The QR code is decoded in your browser, the CSV is created in your browser, and nothing is uploaded to AutopilotSnap or any other server. There is no backend, no analytics and no cookies. The only thing stored in your browser is your light/dark choice. Device data lives in memory only and disappears when you reload the page or tap “Start over”.",
  },
  {
    q: "How does the email work? Is the CSV attached automatically?",
    a: "AutopilotSnap cannot send email itself. On phones and browsers that support file sharing, “Send” opens your share sheet with the CSV already attached, and you pick your mail app. Otherwise the CSV is downloaded and your default mail app opens with subject and text filled in. In that case you must attach the downloaded file yourself, because a mailto: link cannot attach files.",
  },
  {
    q: "What is in the CSV and what does the admin do with it?",
    a: "One line per device in the format Manufacturer,Model,Serial number, for example “Microsoft Corporation,Surface Laptop Studio,0F00NFU231300C”, with no header row. In the Intune admin center the admin adds it as a corporate device identifier (Devices → Enrollment → Corporate device identifiers → Add → Upload a CSV file → Manufacturer, model and serial number). Menu names can change; check Microsoft’s documentation.",
  },
  {
    q: "Is this the same as Device association?",
    a: "No. Intune’s Device association needs the signed file exported from the Windows OOBE menu. AutopilotSnap creates the simpler corporate-identifier CSV from the device’s manufacturer, model and serial number. It marks the device as corporate-owned for Autopilot device preparation but does not perform a device association.",
  },
  {
    q: "Can I send several devices at once?",
    a: "Yes. Upload or drop several QR images at once, or tap “Add another device” after a scan. Everything ends up in one CSV with one line per device. Duplicate serial numbers are only added once.",
  },
  {
    q: "The camera does not start. What can I do?",
    a: "Allow camera access when the browser asks, and make sure the page is opened over HTTPS. If the camera is used by another app, close that app. You can always take a photo or screenshot of the QR code and upload or drop it instead.",
  },
  {
    q: "The QR code is not recognised.",
    a: "Hold the phone steady, fill the frame with the code, avoid glare and moire from the screen, and raise the screen brightness. AutopilotSnap only accepts Windows Autopilot device links (they start with “devicelink:”). Other QR codes are ignored.",
  },
  {
    q: "Is it an official Microsoft product?",
    a: "No. AutopilotSnap is an independent, open-source community project (MIT licence) by msnugget. It is not affiliated with or endorsed by Microsoft. The initial version of the idea comes from Simon’s open-source AutopilotQR project. If you want to upload straight to Intune with a sign-in, use his solution. AutopilotSnap is for when you need an option without authentication.",
  },
];

export function Faq({ embedded = false }: { embedded?: boolean }) {
  return (
    <section className="faq" aria-labelledby="faq-title">
      <h2 id="faq-title">Frequently asked questions</h2>
      <div className="faq-list">
        {FAQ.map(({ q, a }) => (
          <details key={q} className="faq-item">
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
      {!embedded && (
        <a className="btn secondary back" href="#/">
          Back to scanner
        </a>
      )}
    </section>
  );
}
