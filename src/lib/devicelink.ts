/**
 * Windows Autopilot Device Preparation – OOBE "Scan QR code" payload.
 *
 *   devicelink:/1/?sn=<serial>&data=<url-encoded base64( gzip( JSON ) )>
 *
 * The QR JSON uses short keys (ver, dlict, di{man,mod,sn,li,...}, dlkd{...}). Only manufacturer,
 * model and serial number are needed for the corporate-identifier CSV. The key layout was
 * learned from the MIT-licensed AutopilotQR project (https://github.com/Simsen/AutopilotQR);
 * this is an independent implementation.
 *
 * Errors carry a code and a generic message only – never any payload content.
 */

export type DeviceLinkErrorCode =
  | "not-devicelink"
  | "too-large"
  | "unsupported-version"
  | "missing-serial"
  | "missing-data"
  | "bad-encoding"
  | "bad-base64"
  | "bad-compression"
  | "bad-json"
  | "invalid-payload";

const MESSAGES: Record<DeviceLinkErrorCode, string> = {
  "not-devicelink": "This QR code is not a Windows Autopilot device link. Scan the QR code from the Windows Autopilot menu in OOBE.",
  "too-large": "This QR code is too large to be a Windows Autopilot device link.",
  "unsupported-version": "This device link version is not supported.",
  "missing-serial": "The device link has no serial number.",
  "missing-data": "The device link has no device data.",
  "bad-encoding": "The device link is malformed (invalid URL encoding).",
  "bad-base64": "The device link is malformed (invalid data encoding).",
  "bad-compression": "The device link is malformed (data could not be decompressed).",
  "bad-json": "The device link is malformed (data is not valid JSON).",
  "invalid-payload": "The device link contents are incomplete or invalid.",
};

export class DeviceLinkError extends Error {
  readonly code: DeviceLinkErrorCode;
  constructor(code: DeviceLinkErrorCode) {
    super(MESSAGES[code]);
    this.name = "DeviceLinkError";
    this.code = code;
  }
}

interface QrPayload {
  ver: string;
  dlict: string | number;
  di: { man: string; mod: string; sn: string; li: string };
}

/** Typed, validated result. */
export interface DeviceLink {
  /** Link scheme version from the URI path (`/1/`). */
  linkVersion: 1;
  payloadVersion: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  /** DeviceLinkId as an upper-case GUID. */
  linkId: string;
  createdAt: Date;
}

const SCHEME = /^devicelink:\/(\d+)\/\?/i;
const HEX32 = /^[0-9a-fA-F]{32}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const MAX_QR_CHARS = 4096;
const MAX_JSON_BYTES = 16 * 1024;

/** Cheap check for the scanner loop: ignore unrelated QR codes without throwing. */
export function looksLikeDeviceLink(text: string): boolean {
  return /^devicelink:\//i.test(text.trim());
}

export async function parseDeviceLink(text: string): Promise<DeviceLink> {
  const raw = text.trim();
  if (raw.length > MAX_QR_CHARS) throw new DeviceLinkError("too-large");
  const m = SCHEME.exec(raw);
  if (!m) throw new DeviceLinkError("not-devicelink");
  if (m[1] !== "1") throw new DeviceLinkError("unsupported-version");

  // Manual query parsing: URLSearchParams would turn a literal "+" (base64) into a space.
  const params = new Map<string, string>();
  for (const part of raw.slice(m[0].length).split("&")) {
    const i = part.indexOf("=");
    if (i <= 0) continue;
    try {
      params.set(part.slice(0, i), decodeURIComponent(part.slice(i + 1)));
    } catch {
      throw new DeviceLinkError("bad-encoding");
    }
  }
  const sn = params.get("sn");
  const data = params.get("data");
  if (!sn) throw new DeviceLinkError("missing-serial");
  if (!data) throw new DeviceLinkError("missing-data");
  if (!BASE64.test(data)) throw new DeviceLinkError("bad-base64");

  let json: string;
  try {
    json = await gunzipToString(base64ToBytes(data));
  } catch (e) {
    if (e instanceof DeviceLinkError) throw e;
    throw new DeviceLinkError("bad-compression");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    throw new DeviceLinkError("bad-json");
  }

  const p = validate(payload, sn);
  return {
    linkVersion: 1,
    payloadVersion: p.ver,
    serialNumber: p.di.sn,
    manufacturer: p.di.man,
    model: p.di.mod,
    linkId: toGuid(p.di.li),
    createdAt: new Date(Number(p.dlict) * 1000),
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validate(v: unknown, serialFromUrl: string): QrPayload {
  const bad = (): never => {
    throw new DeviceLinkError("invalid-payload");
  };
  if (!isObj(v)) return bad();
  if (v.ver !== "1.0") throw new DeviceLinkError("unsupported-version");
  const di = v.di;
  if (!isObj(di)) return bad();
  for (const f of ["man", "mod", "sn"]) if (typeof di[f] !== "string" || !di[f]) return bad();
  if (di.sn !== serialFromUrl) return bad();
  if (typeof di.li !== "string" || !HEX32.test(di.li)) return bad();
  if (!isUnixSeconds(v.dlict)) return bad();
  return v as unknown as QrPayload;
}

export function toGuid(hex: string): string {
  const h = hex.toUpperCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function isUnixSeconds(v: unknown): boolean {
  const n = Number(v);
  return Number.isInteger(n) && n > 1_500_000_000 && n < 4_000_000_000;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function gunzipToString(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_JSON_BYTES) {
      await reader.cancel();
      throw new DeviceLinkError("too-large");
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.length;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(all);
}
