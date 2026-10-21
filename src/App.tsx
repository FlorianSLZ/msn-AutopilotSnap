import { useCallback, useEffect, useRef, useState } from "react";
import { DeviceLinkError, looksLikeDeviceLink, parseDeviceLink, type DeviceLink } from "./lib/devicelink";
import { createAutopilotCsv, csvFilename } from "./lib/csv";
import { canShareFile, downloadFile, openMailClient, sendFile, type MailContent } from "./lib/share";
import { decodeImageFile, ScanError, startCameraScan, type CameraSession } from "./lib/scanner";
import { isValidEmail, loadRecipient, saveRecipient } from "./lib/settings";

type Step = "scan" | "review";

function toggleTheme() {
  const root = document.documentElement;
  const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
  if (next === "light") root.setAttribute("data-theme", "light");
  else root.removeAttribute("data-theme");
  try {
    localStorage.setItem("theme", next);
  } catch {
    /* storage unavailable – theme still applies for this session */
  }
}

function errorMessage(e: unknown): string {
  if (e instanceof DeviceLinkError || e instanceof ScanError) return e.message;
  return "Something went wrong. Please try again.";
}

function mailFor(device: DeviceLink, to: string): MailContent {
  return {
    to,
    subject: `Autopilot device association - ${device.serialNumber}`,
    body: [
      "Hello,",
      "",
      "Attached is the Autopilot device information for:",
      "",
      `Serial number: ${device.serialNumber}`,
      `Manufacturer: ${device.manufacturer}`,
      `Model: ${device.model}`,
      "",
      "Generated using AutopilotSnap.",
    ].join("\n"),
  };
}

export function App() {
  const [step, setStep] = useState<Step>("scan");
  const [device, setDevice] = useState<DeviceLink | null>(null);
  const [recipient, setRecipient] = useState(loadRecipient);
  const [showSettings, setShowSettings] = useState(false);

  const reset = useCallback(() => {
    setDevice(null);
    setStep("scan");
  }, []);

  const onDevice = useCallback((d: DeviceLink) => {
    setDevice(d);
    setStep("review");
  }, []);

  const steps: Array<[Step, string]> = [
    ["scan", "1 · Scan"],
    ["review", "2 · Review"],
  ];

  return (
    <div className="shell">
      <header className="top">
        <a className="nav-logo" href="https://msnugget.com" target="_blank" rel="noopener" aria-label="msnugget.com">
          <span className="logo-msn">msnugget</span>
          <span className="logo-dot">·</span>
          <span className="logo-rest">autopilotsnap</span>
        </a>
        <div className="tools">
          <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle light/dark theme" title="Toggle theme">
            ◐
          </button>
          <button className="icon-btn" onClick={() => setShowSettings(true)} aria-label="Settings" title="Settings">
            ⚙
          </button>
        </div>
      </header>

      <div className="intro">
        <h1>Scan. Send. Deploy.</h1>
      </div>

      <ol className="steps" aria-label="Progress">
        {steps.map(([key, label]) => (
          <li key={key} aria-current={step === key ? "step" : undefined} className={step === key ? "on" : ""}>
            {label}
          </li>
        ))}
        <li>3 · Send</li>
      </ol>

      <main>
        {step === "scan" && <ScanView onDevice={onDevice} />}
        {step === "review" && device && (
          <ReviewView device={device} recipient={recipient} onNeedRecipient={() => setShowSettings(true)} onReset={reset} />
        )}
      </main>

      <footer>
        <p>Everything happens in your browser. Nothing is uploaded.</p>
        <p>
          Independent community project – not an official Microsoft product.{" "}
          <a href="https://github.com/FlorianSLZ/msn-AutopilotSnap" target="_blank" rel="noopener">
            GitHub
          </a>
        </p>
      </footer>

      {showSettings && (
        <SettingsDialog
          value={recipient}
          onClose={() => setShowSettings(false)}
          onSave={(v) => {
            saveRecipient(v);
            setRecipient(v);
            setShowSettings(false);
          }}
        />
      )}
    </div>
  );
}

function ScanView({ onDevice }: { onDevice: (d: DeviceLink) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<CameraSession | null>(null);
  const handlingRef = useRef(false);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setActive(false);
  }, []);

  useEffect(() => stop, [stop]);

  const handleText = useCallback(
    async (text: string, fromCamera: boolean) => {
      if (handlingRef.current) return;
      if (fromCamera && !looksLikeDeviceLink(text)) {
        setHint("A QR code was found, but it is not a Windows Autopilot code. Keep scanning…");
        return;
      }
      handlingRef.current = true;
      try {
        const d = await parseDeviceLink(text);
        stop();
        onDevice(d);
      } catch (e) {
        if (fromCamera) stop();
        setError(errorMessage(e));
        handlingRef.current = false;
      }
    },
    [onDevice, stop],
  );

  const start = async () => {
    setError(null);
    setHint(null);
    handlingRef.current = false;
    setActive(true);
    await new Promise((r) => requestAnimationFrame(r));
    try {
      if (!videoRef.current) throw new ScanError("camera-unavailable");
      sessionRef.current = await startCameraScan(videoRef.current, (t) => void handleText(t, true));
    } catch (e) {
      setActive(false);
      setError(errorMessage(e));
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setHint(null);
    handlingRef.current = false;
    try {
      await handleText(await decodeImageFile(file), false);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <section className="card hero">
      <p className="lead">
        Send Windows Autopilot device information to your IT team. No admin credentials required.
      </p>

      <div className={`viewfinder ${active ? "live" : ""}`}>
        <video ref={videoRef} muted playsInline />
        {!active && <span className="vf-hint">Point the camera at the QR code on the Windows setup screen</span>}
        {active && <span className="reticle" aria-hidden />}
      </div>

      {hint && !error && <p className="note">{hint}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {active ? (
        <button className="btn secondary" onClick={stop}>
          Stop camera
        </button>
      ) : (
        <button className="btn primary" onClick={() => void start()}>
          Scan QR Code
        </button>
      )}

      <label className="link">
        or upload QR image
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
    </section>
  );
}

function ReviewView({
  device,
  recipient,
  onNeedRecipient,
  onReset,
}: {
  device: DeviceLink;
  recipient: string;
  onNeedRecipient: () => void;
  onReset: () => void;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [manualAttach, setManualAttach] = useState(false);

  const makeFile = () => new File([createAutopilotCsv(device)], csvFilename(device.serialNumber), { type: "text/csv" });
  const shareSupported = canShareFile(new File([""], "x.csv", { type: "text/csv" }));

  const send = async () => {
    if (!isValidEmail(recipient)) {
      onNeedRecipient();
      return;
    }
    const outcome = await sendFile(makeFile(), mailFor(device, recipient));
    if (outcome === "fallback") {
      setManualAttach(true);
      setStatus(null);
    } else if (outcome === "shared") {
      setManualAttach(false);
      setStatus("Shared.");
    }
  };

  return (
    <section className="card">
      <p className="ok">✓ Device detected</p>
      <dl className="facts">
        <div>
          <dt>Serial number</dt>
          <dd className="serial">{device.serialNumber}</dd>
        </div>
        <div>
          <dt>Manufacturer</dt>
          <dd>{device.manufacturer}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{device.model}</dd>
        </div>
      </dl>

      <p className="muted">
        {recipient ? (
          <>
            Sending to <strong>{recipient}</strong>
          </>
        ) : (
          "Set your IT recipient address to send."
        )}{" "}
        <button className="textbtn" onClick={onNeedRecipient}>
          {recipient ? "Change" : "Set"}
        </button>
      </p>

      <button className="btn primary" onClick={() => void send()}>
        Send to IT
      </button>
      <button
        className="btn secondary"
        onClick={() => {
          downloadFile(makeFile());
          setStatus("CSV downloaded.");
        }}
      >
        Download CSV
      </button>

      {!shareSupported && !manualAttach && (
        <p className="note">
          This browser can’t attach files automatically. “Send to IT” will download the CSV and open your email app – attach the file manually.
        </p>
      )}
      {manualAttach && (
        <p className="note strong" role="status">
          CSV downloaded. Your email app should open – <strong>attach {csvFilename(device.serialNumber)}</strong> from your Downloads before sending.{" "}
          <button className="textbtn" onClick={() => openMailClient(mailFor(device, recipient))}>
            Reopen email
          </button>
        </p>
      )}
      {status && <p className="note" role="status">{status}</p>}

      <button className="link" onClick={onReset}>
        Scan another device
      </button>
    </section>
  );
}

function SettingsDialog({ value, onSave, onClose }: { value: string; onSave: (v: string) => void; onClose: () => void }) {
  const [v, setV] = useState(value);
  const valid = v.trim() === "" || isValidEmail(v);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={onClose}>
      <form
        className="card dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSave(v);
        }}
      >
        <h2 id="settings-title">Settings</h2>
        <label>
          IT recipient email address
          <input type="email" autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="intune-admin@example.com" autoComplete="off" />
        </label>
        <p className="muted">Stored only in this browser. Never sent anywhere automatically.</p>
        {!valid && <p className="error">Enter a valid email address.</p>}
        <div className="row">
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={!valid}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
