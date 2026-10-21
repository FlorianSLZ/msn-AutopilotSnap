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

export function createAutopilotCsvText(device: CsvDevice): string {
  const fields = [device.manufacturer, device.model, device.serialNumber].map((v) => escapeCsvField(neutralise(v.trim())));
  return `${fields.join(",")}\r\n`;
}

export function createAutopilotCsv(device: CsvDevice): Blob {
  return new Blob([createAutopilotCsvText(device)], { type: "text/csv;charset=utf-8" });
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
