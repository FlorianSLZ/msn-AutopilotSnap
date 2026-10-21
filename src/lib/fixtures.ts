/** Synthetic test fixtures only. Nothing here is a real device or a real QR payload. */
export interface FixtureOptions {
  sn?: string;
  snInJson?: string;
  ver?: string;
  man?: string;
  mod?: string;
  li?: string;
}

export async function gzipBase64(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function syntheticJson(o: FixtureOptions = {}): string {
  return JSON.stringify({
    ver: o.ver ?? "1.0",
    dlict: 1_800_000_000,
    di: {
      man: o.man ?? "Contoso Test Corp",
      mod: o.mod ?? "Test Laptop 1",
      sn: o.snInJson ?? o.sn ?? "TEST-SN-0001",
      li: o.li ?? "00000000000000000000000000000001",
    },
  });
}

export async function syntheticLink(o: FixtureOptions = {}): Promise<string> {
  const data = await gzipBase64(syntheticJson(o));
  return `devicelink:/1/?sn=${encodeURIComponent(o.sn ?? "TEST-SN-0001")}&data=${encodeURIComponent(data)}`;
}
