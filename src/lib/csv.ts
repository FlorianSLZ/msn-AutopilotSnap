import type { DeviceLink } from "./devicelink";

/**
 * Intune "Corporate device identifiers" CSV (Manufacturer, model and serial number).
 * Format confirmed against a sample accepted by Intune: no header row, one device per line,
 * CRLF line endings, no BOM:
 *
 *   Microsoft Corporation,Surface Laptop Studio,0F00NFU231300C
 */
export type CsvDevice = Pick<DeviceLink, "manufacturer" | "model" | "serialNumber">;

/** RFC 4180 field escaping. */
export function escapeCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Defuse spreadsheet formula injection when an admin opens the file in Excel. */
function neutralise(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** One line per device; duplicates (same serial) are written once. */
export function createAutopilotCsvText(devices: CsvDevice | CsvDevice[]): string {
  const list = Array.isArray(devices) ? devices : [devices];
  const seen = new Set<string>();
  let out = "";
  for (const d of list) {
    if (seen.has(d.serialNumber)) continue;
    seen.add(d.serialNumber);
    out += [d.manufacturer, d.model, d.serialNumber].map((v) => escapeCsvField(neutralise(v.trim()))).join(",") + "\r\n";
  }
  return out;
}

export function createAutopilotCsv(devices: CsvDevice | CsvDevice[]): Blob {
  return new Blob([createAutopilotCsvText(devices)], { type: "text/csv;charset=utf-8" });
}

/** `AutopilotSnap-<SERIAL>.csv`, with characters unsafe in file names replaced. */
export function csvFilename(serialNumber: string): string {
  const safe = serialNumber
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^[._]+|[._]+$/g, "")
    .slice(0, 64);
  return `AutopilotSnap-${safe || "device"}.csv`;
}

/** Single device: `AutopilotSnap-<SERIAL>.csv`; several: `AutopilotSnap-<N>-devices.csv`. */
export function csvFilenameFor(devices: CsvDevice[]): string {
  const first = devices[0];
  return devices.length === 1 && first ? csvFilename(first.serialNumber) : `AutopilotSnap-${devices.length}-devices.csv`;
}
