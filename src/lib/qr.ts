import qrcode from "qrcode-generator";

export interface QrCode {
  /** SVG path data; one 1x1 square per dark module. */
  path: string;
  /** Modules per side, excluding the quiet zone. */
  size: number;
}

/** Encode text as a QR code, entirely in the browser. */
export function createQr(text: string): QrCode {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  let path = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (qr.isDark(y, x)) path += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { path, size };
}

/** The address of this app without hash or query, so a phone opens the scan page. */
export function appUrl(loc: Pick<Location, "origin" | "pathname"> = window.location): string {
  return `${loc.origin}${loc.pathname}`;
}
