/** Upload / resolve private user-media in Supabase Storage via backend APIs. */

import axios from "axios";
import { API } from "./authApi";

export type UserMediaKind = "chat" | "memory";

export type ChatMediaIndexEntry = {
  storageKey: string;
  kind: "image" | "video" | "file";
  name: string;
  mime: string;
  createdAt: number;
};

export type ChatMediaIndex = Record<string, ChatMediaIndexEntry>;

function dataUrlToBlob(dataUrl: string, fallbackMime = "application/octet-stream"): { blob: Blob; mime: string } {
  const raw = String(dataUrl || "");
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    throw new Error("already_remote");
  }
  if (raw.startsWith("data:")) {
    const comma = raw.indexOf(",");
    const header = comma >= 0 ? raw.slice(5, comma) : "";
    const b64 = comma >= 0 ? raw.slice(comma + 1) : "";
    const mime = (header.split(";")[0] || fallbackMime).trim() || fallbackMime;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { blob: new Blob([bytes], { type: mime }), mime };
  }
  // Raw base64 (e.g. PDF without data: prefix)
  const bin = atob(raw);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { blob: new Blob([bytes], { type: fallbackMime }), mime: fallbackMime };
}

export async function uploadUserMedia(
  token: string,
  kind: UserMediaKind,
  dataUrl: string,
  opts?: { mediaId?: string; mime?: string; filename?: string },
): Promise<{ key: string; url?: string | null; content_type?: string }> {
  const { blob, mime } = dataUrlToBlob(dataUrl, opts?.mime || "application/octet-stream");
  const form = new FormData();
  const filename = opts?.filename || opts?.mediaId || `upload.${mime.split("/")[1] || "bin"}`;
  form.append("file", blob, filename);
  form.append("kind", kind);
  if (opts?.mediaId) form.append("media_id", opts.mediaId);
  const res = await axios.post<{ ok?: boolean; key: string; url?: string | null; content_type?: string }>(
    `${API}/media/upload`,
    form,
    { headers: { "x-token": token } },
  );
  if (!res.data?.key) throw new Error("upload_failed");
  return res.data;
}

export async function fetchSignedMediaUrls(
  token: string,
  keys: string[],
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(keys.map((k) => String(k || "").trim()).filter(Boolean)));
  if (!unique.length) return {};
  const res = await axios.post<{ urls?: Record<string, string> }>(
    `${API}/media/signed-urls`,
    { keys: unique },
    { headers: { "x-token": token } },
  );
  return res.data?.urls || {};
}

export async function deleteUserMedia(token: string, key: string): Promise<void> {
  const cleaned = String(key || "").trim();
  if (!cleaned) return;
  await axios.delete(`${API}/media`, {
    params: { key: cleaned },
    headers: { "x-token": token },
  });
}

export function parseChatMediaIndex(raw: unknown): ChatMediaIndex {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ChatMediaIndex = {};
  for (const [id, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Partial<ChatMediaIndexEntry>;
    if (!e.storageKey || typeof e.storageKey !== "string") continue;
    const kind = e.kind === "video" || e.kind === "file" || e.kind === "image" ? e.kind : "file";
    out[id] = {
      storageKey: e.storageKey,
      kind,
      name: typeof e.name === "string" ? e.name : "file",
      mime: typeof e.mime === "string" ? e.mime : "application/octet-stream",
      createdAt: typeof e.createdAt === "number" ? e.createdAt : Date.now(),
    };
  }
  return out;
}
