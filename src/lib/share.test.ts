import { describe, expect, it } from "vitest";
import { buildMailto, canShareFile } from "./share";

const file = new File(["x"], "a.csv", { type: "text/csv" });

describe("canShareFile", () => {
  it("is false without a navigator or share API", () => {
    expect(canShareFile(file, undefined as never)).toBe(false);
    expect(canShareFile(file, {})).toBe(false);
    expect(canShareFile(file, { share: async () => {} })).toBe(false);
  });
  it("follows canShare", () => {
    expect(canShareFile(file, { share: async () => {}, canShare: () => true })).toBe(true);
    expect(canShareFile(file, { share: async () => {}, canShare: () => false })).toBe(false);
  });
  it("is false if canShare throws", () => {
    expect(canShareFile(file, { share: async () => {}, canShare: () => { throw new Error("x"); } })).toBe(false);
  });
});

describe("buildMailto", () => {
  it("encodes subject and body", () => {
    const url = buildMailto({ to: "it@example.com", subject: "A & B", body: "Line1\nLine2" });
    expect(url).toBe("mailto:it%40example.com?subject=A%20%26%20B&body=Line1%0ALine2");
  });
});
