import { describe, expect, it } from "vitest";
import { DeviceLinkError, looksLikeDeviceLink, parseDeviceLink } from "./devicelink";
import { gzipBase64, syntheticLink } from "./fixtures";

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof DeviceLinkError) return e.code;
  }
  return "no-error";
}

describe("parseDeviceLink", () => {
  it("parses a valid synthetic link", async () => {
    const d = await parseDeviceLink(await syntheticLink());
    expect(d.serialNumber).toBe("TEST-SN-0001");
    expect(d.manufacturer).toBe("Contoso Test Corp");
    expect(d.model).toBe("Test Laptop 1");
    expect(d.linkId).toBe("00000000-0000-0000-0000-000000000001");
    expect(d.linkVersion).toBe(1);
  });

  it("tolerates surrounding whitespace", async () => {
    expect((await parseDeviceLink(`  ${await syntheticLink()}\n`)).serialNumber).toBe("TEST-SN-0001");
  });

  it("rejects non-DeviceLink text", async () => {
    expect(await codeOf(parseDeviceLink("https://example.com"))).toBe("not-devicelink");
    expect(looksLikeDeviceLink("https://example.com")).toBe(false);
    expect(looksLikeDeviceLink("devicelink:/1/?x")).toBe(true);
  });

  it("rejects unsupported link and payload versions", async () => {
    expect(await codeOf(parseDeviceLink("devicelink:/2/?sn=A&data=AAAA"))).toBe("unsupported-version");
    expect(await codeOf(parseDeviceLink(await syntheticLink({ ver: "2.0" })))).toBe("unsupported-version");
  });

  it("rejects a missing serial number", async () => {
    const data = encodeURIComponent(await gzipBase64("{}"));
    expect(await codeOf(parseDeviceLink(`devicelink:/1/?data=${data}`))).toBe("missing-serial");
    expect(await codeOf(parseDeviceLink("devicelink:/1/?sn=A"))).toBe("missing-data");
  });

  it("rejects a serial that differs from the encoded one", async () => {
    expect(await codeOf(parseDeviceLink(await syntheticLink({ sn: "AAA", snInJson: "BBB" })))).toBe("invalid-payload");
  });

  it("rejects malformed encodings", async () => {
    expect(await codeOf(parseDeviceLink("devicelink:/1/?sn=A&data=%E0%A4%A"))).toBe("bad-encoding");
    expect(await codeOf(parseDeviceLink("devicelink:/1/?sn=A&data=not base64!"))).toBe("bad-base64");
    expect(await codeOf(parseDeviceLink("devicelink:/1/?sn=A&data=AAAAAAAA"))).toBe("bad-compression");
    const notJson = encodeURIComponent(await gzipBase64("not json"));
    expect(await codeOf(parseDeviceLink(`devicelink:/1/?sn=A&data=${notJson}`))).toBe("bad-json");
  });

  it("rejects oversized input and invalid fields", async () => {
    expect(await codeOf(parseDeviceLink("devicelink:/1/?sn=A&data=" + "A".repeat(5000)))).toBe("too-large");
    expect(await codeOf(parseDeviceLink(await syntheticLink({ li: "xyz" })))).toBe("invalid-payload");
  });

  it("never puts payload content in error messages", async () => {
    try {
      await parseDeviceLink(await syntheticLink({ sn: "SECRET-1", snInJson: "SECRET-2" }));
    } catch (e) {
      expect((e as Error).message).not.toMatch(/SECRET|devicelink:/);
    }
  });
});
