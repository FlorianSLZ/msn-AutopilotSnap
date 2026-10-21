import { describe, expect, it } from "vitest";
import { appUrl, createQr } from "./qr";

describe("createQr", () => {
  it("creates a square matrix with dark modules", () => {
    const qr = createQr("https://example.com/app/");
    expect(qr.size).toBeGreaterThanOrEqual(21);
    expect(qr.path.startsWith("M")).toBe(true);
  });

  it("is deterministic", () => {
    expect(createQr("https://example.com/").path).toBe(createQr("https://example.com/").path);
  });
});

describe("appUrl", () => {
  it("drops hash and query", () => {
    expect(appUrl({ origin: "https://snap.example.com", pathname: "/" })).toBe("https://snap.example.com/");
    expect(appUrl({ origin: "https://x.github.io", pathname: "/snap/" })).toBe("https://x.github.io/snap/");
  });
});
