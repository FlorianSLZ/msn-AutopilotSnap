interface Step {
  title: string;
  text: string;
  image?: { src: string; alt: string };
}

const STEPS: Step[] = [
  {
    title: "Show the QR code on the Windows device",
    text: "At the first setup screen (OOBE) press the Windows key five times, then choose “Scan QR code”. Windows shows a QR code.",
  },
  {
    title: "Scan it with your phone or laptop",
    text: "Tap Scan QR Code and point the camera at the screen. No camera? Upload or drop a photo or screenshot of the code.",
    image: { src: "./howto/step-2.png", alt: "AutopilotSnap scan screen with the Scan QR Code button" },
  },
  {
    title: "Check the detected device",
    text: "AutopilotSnap shows serial number, manufacturer and model. Use “Add another device” to collect more devices in one CSV.",
    image: { src: "./howto/step-3.png", alt: "AutopilotSnap showing a detected device" },
  },
  {
    title: "Send it to your IT team",
    text: "Tap Send. Your device’s share sheet opens with the CSV attached – pick your mail app and your IT team’s address. If sharing files isn’t supported, the CSV is downloaded and your mail app opens: attach the file there.",
  },
];

export function HowTo() {
  return (
    <section className="howto" aria-labelledby="howto-title">
      <h2 id="howto-title">How to</h2>
      <ol className="howto-steps">
        {STEPS.map((s) => (
          <li key={s.title}>
            <div className="howto-text">
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
            {s.image && <img src={s.image.src} alt={s.image.alt} loading="lazy" decoding="async" />}
          </li>
        ))}
      </ol>
      <p className="muted">
        Questions? See the <a href="#/faq">FAQ</a>.
      </p>
    </section>
  );
}
