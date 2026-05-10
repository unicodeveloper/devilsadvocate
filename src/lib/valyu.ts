import { Valyu } from "valyu-js";

let _valyu: Valyu | null = null;

export function getValyu(): Valyu {
  if (_valyu) return _valyu;
  const apiKey = process.env.VALYU_API_KEY;
  if (!apiKey) {
    throw new Error("VALYU_API_KEY is required to call Valyu APIs");
  }
  _valyu = new Valyu(apiKey);
  return _valyu;
}

export type ValyuFile = {
  data: string;
  filename: string;
  mediaType: string;
  context?: string;
};

export async function fileToValyuAttachment(
  file: File,
  context?: string,
): Promise<ValyuFile> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    data: buffer.toString("base64"),
    filename: file.name,
    mediaType: file.type || "application/octet-stream",
    context,
  };
}

