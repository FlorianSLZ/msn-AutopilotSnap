import { prepareZXingModule, readBarcodes, type ReaderOptions } from "zxing-wasm/reader";
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

// Serve the WASM from our own bundle instead of the library's default CDN.
prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasmUrl : prefix + path),
  },
});

const OPTIONS: ReaderOptions = { formats: ["QRCode"], tryHarder: true, maxNumberOfSymbols: 1 };

export type ScanErrorCode = "permission-denied" | "no-camera" | "camera-unavailable" | "unsupported" | "no-qr" | "bad-image";

const SCAN_MESSAGES: Record<ScanErrorCode, string> = {
  "permission-denied": "Camera access was denied. Allow camera access in your browser settings, or upload a photo of the QR code instead.",
  "no-camera": "No camera was found on this device. Upload a photo of the QR code instead.",
  "camera-unavailable": "The camera could not be started. It may be in use by another app.",
  unsupported: "Camera access needs a secure (HTTPS) page and a supported browser. Upload a photo of the QR code instead.",
  "no-qr": "No QR code was recognised in that image. Make sure the whole code is visible, sharp and well lit.",
  "bad-image": "That file could not be read as an image.",
};

export class ScanError extends Error {
  readonly code: ScanErrorCode;
  constructor(code: ScanErrorCode) {
    super(SCAN_MESSAGES[code]);
    this.name = "ScanError";
    this.code = code;
  }
}

export function mapCameraError(e: unknown): ScanError {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return new ScanError("permission-denied");
  if (name === "NotFoundError" || name === "OverconstrainedError") return new ScanError("no-camera");
  return new ScanError("camera-unavailable");
}

async function decode(data: ImageData | Blob): Promise<string | null> {
  const results = await readBarcodes(data, OPTIONS);
  const hit = results.find((r) => r.isValid && r.text);
  return hit ? hit.text : null;
}

/** Decode a QR code from an uploaded/captured image file. Runs fully locally. */
export async function decodeImageFile(file: File): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ScanError("bad-image");
  }
  try {
    // Try the full-size image first, then a downscaled copy (large phone photos sometimes decode better).
    for (const maxSide of [Infinity, 1600, 1000]) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new ScanError("bad-image");
      ctx.drawImage(bitmap, 0, 0, w, h);
      const text = await decode(ctx.getImageData(0, 0, w, h));
      if (text) return text;
    }
    throw new ScanError("no-qr");
  } finally {
    bitmap.close();
  }
}

export interface CameraSession {
  stop(): void;
}

/**
 * Start the rear camera in `video` and call `onText` with every decoded QR text.
 * The caller decides when a result is acceptable and calls `stop()`.
 */
export async function startCameraScan(video: HTMLVideoElement, onText: (text: string) => void): Promise<CameraSession> {
  if (!navigator.mediaDevices?.getUserMedia) throw new ScanError("unsupported");
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (e) {
    throw mapCameraError(e);
  }

  video.srcObject = stream;
  video.setAttribute("playsinline", "true");
  video.muted = true;
  try {
    await video.play();
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    throw new ScanError("camera-unavailable");
  }

  let stopped = false;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const loop = async () => {
    while (!stopped) {
      if (ctx && video.videoWidth > 0 && video.readyState >= 2) {
        // Cap the analysed frame size to keep decoding fast on phones.
        const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const text = await decode(ctx.getImageData(0, 0, canvas.width, canvas.height));
          if (text && !stopped) onText(text);
        } catch {
          /* a failed frame is not fatal; try the next one */
        }
      }
      await new Promise((r) => setTimeout(r, 120));
    }
  };
  void loop();

  return {
    stop() {
      stopped = true;
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    },
  };
}
