import { useCallback, useEffect, useRef, useState } from "react";
import { DeviceLinkError, looksLikeDeviceLink, parseDeviceLink, type DeviceLink } from "./lib/devicelink";
import { createAutopilotCsv, csvFilenameFor } from "./lib/csv";
import { canShareFile, downloadFile, openMailClient, sendFile, type MailContent } from "./lib/share";
import { decodeImageFile, ScanError, startCameraScan, type CameraSession } from "./lib/scanner";
import "./polish.css";
import { Faq } from "./Faq";
import { HowTo } from "./HowTo";
import { scanFeedback } from "./lib/feedback";
import { appUrl, createQr } from "./lib/qr";

type Step = "scan" | "review";

function useRoute(): "home" | "faq" {
  const get = (): "home" | "faq" => (window.location.hash.startsWith("#/faq") ? "faq" : "home");
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const on = () => {
      setRoute(get());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

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

function mailFor(devices: DeviceLink[]): MailContent {
  const one = devices.length === 1 ? devices[0] : undefined;
  const lines = one
    ? [`Serial number: ${one.serialNumber}`, `Manufacturer: ${one.manufacturer}`, `Model: ${one.model}`]
    : devices.map((d) => `- ${d.serialNumber} (${d.manufacturer} ${d.model})`);
  return {
    to: "",
    subject: one
      ? `Autopilot device association - ${one.serialNumber}`
      : `Autopilot device association - ${devices.length} devices`,
    body: [
      "Hello,",
      "",
      one ? "Attached is the Autopilot device information for:" : `Attached are the Autopilot device details for ${devices.length} devices:`,
      "",
      ...lines,
      "",
      "Generated using AutopilotSnap.",
    ].join("\n"),
  };
}

/** Add devices to the list, skipping serial numbers that are already present. */
function mergeDevices(current: DeviceLink[], added: DeviceLink[]): DeviceLink[] {
  const seen = new Set(current.map((d) => d.serialNumber));
  const out = [...current];
  for (const d of added) {
    if (!seen.has(d.serialNumber)) {
      seen.add(d.serialNumber);
      out.push(d);
    }
  }
  return out;
}

export function App() {
  const [step, setStep] = useState<Step>("scan");
  const [devices, setDevices] = useState<DeviceLink[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [showMobile, setShowMobile] = useState(false);
  const route = useRoute();

  const startOver = useCallback(() => {
    setDevices([]);
    setNotice(null);
    setStep("scan");
  }, []);

  const onDevices = useCallback((added: DeviceLink[], note: string | null) => {
    scanFeedback();
    setDevices((cur) => mergeDevices(cur, added));
    setNotice(note);
    setStep("review");
  }, []);

  const steps: Array<[Step, string]> = [
    ["scan", "1 · Scan"],
    ["review", "2 · Review"],
  ];

  return (
    <>
      <nav className="nav" aria-label="Main navigation">
        <div className="nav-inner container">
          <a className="nav-logo" href="https://msnugget.com" target="_blank" rel="noopener" aria-label="msnugget.com">
            <span className="logo-msn">msnugget</span>
            <span className="logo-dot">·</span>
            <span className="logo-rest">autopilotsnap</span>
          </a>
          <div className="nav-links">
            <a href="#/" className="nav-link" aria-current={route === "home" ? "page" : undefined}>
              Scan
            </a>
            <a href="#/faq" className="nav-link" aria-current={route === "faq" ? "page" : undefined}>
              FAQ
            </a>
          </div>
          <div className="nav-actions">
            <button className="theme-toggle" onClick={() => setShowMobile(true)} aria-label="Send to mobile" title="Send to mobile">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="4.5" y="1.5" width="7" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle light/dark theme" title="Toggle theme">
            <svg className="icon-sun" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M12.95 3.05l-1.06 1.06M4.11 11.89l-1.06 1.06" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <svg className="icon-moon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M13.5 10A6 6 0 016 2.5a6 6 0 100 11 6 6 0 007.5-3.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            </button>
          </div>
        </div>
      </nav>

      <div className="shell">
      {route === "faq" ? (
        <Faq />
      ) : (
        <>
      <div className="intro">
        <h1>
          Scan. Send. <span className="accent">Deploy.</span>
        </h1>
        <p className="subline">From the Windows setup screen to your IT team in under a minute.</p>
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
        {step === "scan" && <ScanView onDevices={onDevices} existing={devices.length} onBack={() => setStep("review")} />}
        {step === "review" && devices.length > 0 && (
          <ReviewView
            devices={devices}
            notice={notice}
            onAdd={() => {
              setNotice(null);
              setStep("scan");
            }}
            onRemove={(sn) => {
              const rest = devices.filter((d) => d.serialNumber !== sn);
              setDevices(rest);
              if (rest.length === 0) setStep("scan");
            }}
            onStartOver={startOver}
          />
        )}
      </main>

      {step === "scan" && <HowTo />}
        </>
      )}
      </div>

      <footer className="footer">
        <div className="container footer-inner">
          <div className="footer-brand">
            <a className="nav-logo" href="https://msnugget.com" target="_blank" rel="noopener" aria-label="msnugget.com">
              <span className="logo-msn">msnugget</span>
              <span className="logo-dot">·</span>
              <span className="logo-rest">autopilotsnap</span>
            </a>
            <p className="footer-tagline">Scan the Autopilot QR code, send it to IT. Everything stays in your browser.</p>
          </div>
          <div className="footer-links">
            <a href="https://github.com/FlorianSLZ/msn-AutopilotSnap" target="_blank" rel="noopener">GitHub</a>
            <a href="https://learn.microsoft.com/en-us/autopilot/device-preparation/overview" target="_blank" rel="noopener">Autopilot Docs</a>
          </div>
        </div>
        <div className="footer-bottom container">
          <p className="disclaimer">
            Built by{" "}
            <a href="https://scloud.work/about-florian/" target="_blank" rel="noopener">Florian Salzmann</a> &amp;{" "}
            <a href="https://jannikreinhard.com/about/" target="_blank" rel="noopener">Jannik Reinhard</a>
          </p>
          <p className="disclaimer">
            Independent community project – not an official Microsoft product. &copy; {new Date().getFullYear()}{" "}
            <a href="https://msnugget.com" target="_blank" rel="noopener">msnugget.com</a>
          </p>
        </div>
      </footer>

      {showMobile && <MobileDialog onClose={() => setShowMobile(false)} />}

    </>
  );
}

function ScanView({ onDevices, existing, onBack }: { onDevices: (d: DeviceLink[], note: string | null) => void; existing: number; onBack: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<CameraSession | null>(null);
  const handlingRef = useRef(false);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setActive(false);
  }, []);

  useEffect(() => stop, [stop]);

  const handleCamera = useCallback(
    async (text: string) => {
      if (handlingRef.current) return;
      if (!looksLikeDeviceLink(text)) {
        setHint("A QR code was found, but it is not a Windows Autopilot code. Keep scanning…");
        return;
      }
      handlingRef.current = true;
      try {
        const d = await parseDeviceLink(text);
        stop();
        onDevices([d], null);
      } catch (e) {
        stop();
        setError(errorMessage(e));
        handlingRef.current = false;
      }
    },
    [onDevices, stop],
  );

  const start = async () => {
    setError(null);
    setHint(null);
    handlingRef.current = false;
    setActive(true);
    await new Promise((r) => requestAnimationFrame(r));
    try {
      if (!videoRef.current) throw new ScanError("camera-unavailable");
      sessionRef.current = await startCameraScan(videoRef.current, (t) => void handleCamera(t));
    } catch (e) {
      setActive(false);
      setError(errorMessage(e));
    }
  };

  /** Decode one or many image files; add every valid device, report the rest. */
  const onFiles = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      setError("Choose or drop image files containing the QR code.");
      return;
    }
    stop();
    setError(null);
    setHint(null);
    const found: DeviceLink[] = [];
    let firstError: string | null = null;
    let failed = 0;
    for (const file of images) {
      try {
        found.push(await parseDeviceLink(await decodeImageFile(file)));
      } catch (e) {
        failed++;
        firstError ??= errorMessage(e);
      }
    }
    if (found.length === 0) {
      setError(images.length > 1 ? `None of the ${images.length} images could be used. ${firstError}` : firstError);
      return;
    }
    onDevices(found, failed > 0 ? `${failed} of ${images.length} images could not be read: ${firstError}` : null);
  };

  return (
    <section
      className={`card hero ${dragging ? "dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <p className="lead">
        Send Windows Autopilot device information to your IT team. No admin credentials required.
      </p>

      <div className={`viewfinder ${active ? "live" : ""}`}>
        <video ref={videoRef} muted playsInline />
        {!active && (
          <span className="vf-hint">
            {dragging ? "Drop the QR images here" : "Point the camera at the QR code on the Windows setup screen"}
          </span>
        )}
        {active && (
          <span className="reticle" aria-hidden>
            <i className="c tl" />
            <i className="c tr" />
            <i className="c bl" />
            <i className="c br" />
            <i className="sweep" />
          </span>
        )}
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
        or upload or drop one or more QR images
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void onFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </label>

      {existing > 0 && (
        <button className="link" onClick={onBack}>
          Back to {existing} detected {existing === 1 ? "device" : "devices"}
        </button>
      )}
    </section>
  );
}

function ReviewView({
  devices,
  notice,
  onAdd,
  onRemove,
  onStartOver,
}: {
  devices: DeviceLink[];
  notice: string | null;
  onAdd: () => void;
  onRemove: (serial: string) => void;
  onStartOver: () => void;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [manualAttach, setManualAttach] = useState(false);
  const [copied, setCopied] = useState(false);
  const many = devices.length > 1;
  const copySerial = async (sn: string) => {
    try {
      await navigator.clipboard.writeText(sn);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  const filename = csvFilenameFor(devices);

  const makeFile = () => new File([createAutopilotCsv(devices)], filename, { type: "text/csv" });
  const shareSupported = canShareFile(new File([""], "x.csv", { type: "text/csv" }));

  const send = async () => {
    const outcome = await sendFile(makeFile(), mailFor(devices));
    if (outcome === "fallback") {
      setManualAttach(true);
      setStatus(null);
    } else if (outcome === "shared") {
      setManualAttach(false);
      setStatus("Shared.");
    }
  };

  const first = devices[0];

  return (
    <section className="card">
      <p className="ok">
        <svg className="check" width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <circle cx="14" cy="14" r="12.5" stroke="currentColor" strokeWidth="2" />
          <path d="M8.5 14.5l3.8 3.8 7.2-8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {many ? `${devices.length} devices detected` : "Device detected"}
      </p>
      {notice && <p className="note">{notice}</p>}

      {!many && first ? (
        <dl className="facts">
          <div>
            <dt>Serial number</dt>
            <dd className="serial">
              {first.serialNumber}
              <button className="textbtn" onClick={() => void copySerial(first.serialNumber)}>
                {copied ? "Copied" : "Copy"}
              </button>
            </dd>
          </div>
          <div>
            <dt>Manufacturer</dt>
            <dd>{first.manufacturer}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>{first.model}</dd>
          </div>
        </dl>
      ) : (
        <ul className="devices">
          {devices.map((d) => (
            <li key={d.serialNumber}>
              <span className="avatar" aria-hidden="true">
                {(d.manufacturer.trim()[0] ?? "?").toUpperCase()}
              </span>
              <div>
                <span className="serial-sm">{d.serialNumber}</span>
                <span className="muted">
                  {d.manufacturer} · {d.model}
                </span>
              </div>
              <button className="textbtn" onClick={() => onRemove(d.serialNumber)} aria-label={`Remove ${d.serialNumber}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <button className="btn primary" onClick={() => void send()}>
        Send
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
      <button className="btn secondary" onClick={onAdd}>
        Add another device
      </button>

      {!shareSupported && !manualAttach && (
        <p className="note">
          This browser can’t attach files automatically. “Send” will download the CSV and open your email app – attach the file manually.
        </p>
      )}
      {manualAttach && (
        <p className="note strong" role="status">
          CSV downloaded. Your email app should open – <strong>attach {filename}</strong> from your Downloads before sending.{" "}
          <button className="textbtn" onClick={() => openMailClient(mailFor(devices))}>
            Reopen email
          </button>
        </p>
      )}
      {status && (
        <p className="note" role="status">
          {status}
        </p>
      )}

      <button className="link" onClick={onStartOver}>
        Start over (clear {many ? "all devices" : "device"})
      </button>
    </section>
  );
}

function MobileDialog({ onClose }: { onClose: () => void }) {
  const url = appUrl();
  const qr = createQr(url);
  const [status, setStatus] = useState<string | null>(null);
  const canShare = typeof navigator.share === "function";
  const quiet = 3;
  const dim = qr.size + quiet * 2;

  const share = async () => {
    try {
      await navigator.share({ title: "AutopilotSnap", text: "Scan the Autopilot QR code and send it to IT:", url });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setStatus("Sharing failed. Copy the link instead.");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied.");
    } catch {
      setStatus("Copy failed. Select the link and copy it manually.");
    }
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="mobile-title" onClick={onClose}>
      <div className="card dialog" onClick={(e) => e.stopPropagation()}>
        <h2 id="mobile-title">Send to mobile</h2>
        <p className="muted">Scan this code with your phone to open AutopilotSnap there, then scan the Windows QR code with its camera.</p>
        <svg className="qr" viewBox={`${-quiet} ${-quiet} ${dim} ${dim}`} role="img" aria-label={`QR code for ${url}`} shapeRendering="crispEdges">
          <rect x={-quiet} y={-quiet} width={dim} height={dim} fill="#fff" />
          <path d={qr.path} fill="#000" />
        </svg>
        <p className="muted qr-url">{url}</p>
        {status && (
          <p className="note" role="status">
            {status}
          </p>
        )}
        {canShare && (
          <button className="btn primary" onClick={() => void share()}>
            Share link
          </button>
        )}
        <button className={`btn ${canShare ? "secondary" : "primary"}`} onClick={() => void copy()}>
          Copy link
        </button>
        <button className="btn secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
