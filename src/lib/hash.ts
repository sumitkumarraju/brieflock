export function normalizeBrief(input: string): string {
  return input.replace(/\r\n/g, "\n").trim();
}

export async function sha256Hex(
  input: string | ArrayBuffer | Uint8Array,
): Promise<string> {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input);

  const ownedBytes = new Uint8Array(bytes.byteLength);
  ownedBytes.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", ownedBytes.buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function shortHash(hash: string, visible = 8): string {
  if (hash.length <= visible * 2 + 1) return hash;
  return `${hash.slice(0, visible)}…${hash.slice(-visible)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}
