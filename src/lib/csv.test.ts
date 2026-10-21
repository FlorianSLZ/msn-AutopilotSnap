import { describe, expect, it } from "vitest";
import { createAutopilotCsv, createAutopilotCsvText, csvFilename, escapeCsvField } from "./csv";

const dev = { manufacturer: "Contoso Test Corp", model: "Test Laptop 1", serialNumber: "TEST-SN-0001" };

describe("csv", () => {
  it("creates a headerless Manufacturer,Model,Serial row with CRLF", () => {
    expect(createAutopilotCsvText(dev)).toBe("Contoso Test Corp,Test Laptop 1,TEST-SN-0001\r\n");
  });

  it("returns a CSV blob", async () => {
    const b = createAutopilotCsv(dev);
    expect(b.type).toContain("text/csv");
    expect(await b.text()).toBe(createAutopilotCsvText(dev));
  });

  it("escapes commas, quotes and newlines", () => {
    expect(escapeCsvField('a,"b"')).toBe('"a,""b"""');
    expect(escapeCsvField("a\nb")).toBe('"a\nb"');
    expect(createAutopilotCsvText({ ...dev, model: 'Pro, "X"' })).toBe('Contoso Test Corp,"Pro, ""X""",TEST-SN-0001\r\n');
  });

  it("defuses spreadsheet formulas", () => {
    expect(createAutopilotCsvText({ ...dev, model: "=1+1" })).toContain(",'=1+1,");
  });

  it("builds a safe filename", () => {
    expect(csvFilename("TEST-SN-0001")).toBe("AutopilotSnap-TEST-SN-0001.csv");
    expect(csvFilename("a/b:c d")).toBe("AutopilotSnap-a_b_c_d.csv");
    expect(csvFilename("  ")).toBe("AutopilotSnap-device.csv");
  });
});
