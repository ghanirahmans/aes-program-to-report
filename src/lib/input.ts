import iconv from "iconv-lite";

export type ParsedAesInput = {
  text: string;
  hex: string;
};

export function sanitizeFilename(value: string): string {
  const safeValue = value.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[._-]+|[._-]+$/g, "");
  return safeValue || "output";
}

export function parseAesBlockInput(rawValue: string, label: string, encoding = "windows-1252"): ParsedAesInput {
  const value = rawValue.trim();
  if (/^[0-9A-Fa-f]{32}$/.test(value)) {
    const blockBytes = Buffer.from(value, "hex");
    return {
      text: iconv.decode(blockBytes, encoding),
      hex: blockBytes.toString("hex"),
    };
  }

  const blockBytes = iconv.encode(value, encoding);
  if (blockBytes.length !== 16) {
    throw new Error(`${label} harus tepat 16 byte: teks 16 karakter ASCII atau hex 32 digit`);
  }

  return {
    text: value,
    hex: blockBytes.toString("hex"),
  };
}

export function hexToBytes(hex: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(Number.parseInt(hex.slice(i, i + 2), 16));
  }
  return bytes;
}

export function bytesToHex(bytes: Iterable<number>): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function byteToHex(byte: number): string {
  return byte.toString(16).padStart(2, "0").toUpperCase();
}

export function byteToBin(byte: number): string {
  return byte.toString(2).padStart(8, "0");
}
