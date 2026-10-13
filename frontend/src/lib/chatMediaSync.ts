/** Durable chat Library blobs (images/videos/files) in IndexedDB + Storage refs. Meta stays in chat/threads. */

import { storageScope } from "./memoriesSync";
import {
  deleteUserMedia,
  fetchSignedMediaUrls,
  parseChatMediaIndex,
  uploadUserMedia,
  type ChatMediaIndex,
  type ChatMediaIndexEntry,
} from "./userMedia";
import axios from "axios";
import { API } from "./authApi";

export type ChatMediaEntry = {
  id: string;
  kind: "image" | "video" | "file";
  name: string;
  mime: string;
  /** data URL, or https signed URL after cloud hydrate */
  data: string;
  /** Private Storage object path (user-media bucket). */
  storageKey?: string;
  createdAt: number;
};

type Attachable = {
  kind: string;
  name?: string;
  mime?: string;
  data?: string;
  mediaId?: string;
  storageKey?: string;
};

type MessageLike = { attachments?: Attachable[] };

const IDB_NAME = "heymaa_v1";
const IDB_STORE = "kv";

function idbChatMediaKey(scope: string) {
  return `chat_media:${scope}`;
}

export function newChatMediaId(): string {
  return `cm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
  });
}

async function idbGet(key: string): Promise<unknown> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function asMediaMap(raw: unknown): Record<string, ChatMediaEntry> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, ChatMediaEntry> = {};
  for (const [id, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Partial<ChatMediaEntry>;
    if (e.kind !== "image" && e.kind !== "video" && e.kind !== "file") continue;
    if (!e.data && !e.storageKey) continue;
    out[id] = {
      id,
      kind: e.kind,
      name: e.name || "file",
      mime:
        e.mime ||
        (e.kind === "video" ? "video/mp4" : e.kind === "file" ? "application/octet-stream" : "image/jpeg"),
      data: e.data || "",
      storageKey: typeof e.storageKey === "string" ? e.storageKey : undefined,
      createdAt: typeof e.createdAt === "number" ? e.createdAt : Date.now(),
    };
  }
  return out;
}

export async function loadChatMediaMap(token: string): Promise<Record<string, ChatMediaEntry>> {
  try {
    const raw = await idbGet(idbChatMediaKey(storageScope(token)));
    return asMediaMap(raw);
  } catch (err) {
    console.error("Chat media IDB load failed", err);
    return {};
  }
}

export async function saveChatMediaMap(
  token: string,
  map: Record<string, ChatMediaEntry>,
): Promise<void> {
  try {
    await idbSet(idbChatMediaKey(storageScope(token)), map);
  } catch (err) {
    console.error("Chat media IDB save failed", err);
  }
}

/** Keep newest `limit` entries (by createdAt). */
export function pruneChatMediaMap(
  map: Record<string, ChatMediaEntry>,
  limit: number,
): Record<string, ChatMediaEntry> {
  const entries = Object.values(map).sort((a, b) => b.createdAt - a.createdAt);
  if (limit <= 0) return {};
  if (entries.length <= limit) return map;
  const next: Record<string, ChatMediaEntry> = {};
  for (const e of entries.slice(0, limit)) next[e.id] = e;
  return next;
}

export function hydrateMessageAttachments<T extends MessageLike>(
  messages: T[],
  map: Record<string, ChatMediaEntry>,
): T[] {
  if (!messages.length || !Object.keys(map).length) return messages;
  let changed = false;
  const next = messages.map((m) => {
    if (!m.attachments?.length) return m;
    let attChanged = false;
    const attachments = m.attachments.map((att) => {
      if (att.data || !att.mediaId) return att;
      const stored = map[att.mediaId];
      if (!stored?.data) return att;
      attChanged = true;
      return {
        ...att,
        kind: stored.kind,
        name: stored.name || att.name,
        mime: stored.mime || att.mime,
        data: stored.data,
        storageKey: stored.storageKey || att.storageKey,
      };
    });
    if (!attChanged) return m;
    changed = true;
    return { ...m, attachments };
  });
  return changed ? next : messages;
}

export function collectPersistableMedia(
  messages: MessageLike[],
  allowVideo: boolean,
): ChatMediaEntry[] {
  const out: ChatMediaEntry[] = [];
  const seen = new Set<string>();
  for (const m of messages) {
    for (const att of m.attachments || []) {
      if (att.kind !== "image" && att.kind !== "video" && att.kind !== "file") continue;
      if (att.kind === "video" && !allowVideo) continue;
      if (!att.mediaId) continue;
      if (!att.data && !att.storageKey) continue;
      if (seen.has(att.mediaId)) continue;
      seen.add(att.mediaId);
      out.push({
        id: att.mediaId,
        kind: att.kind as ChatMediaEntry["kind"],
        name: att.name || "file",
        mime:
          att.mime ||
          (att.kind === "video"
            ? "video/mp4"
            : att.kind === "file"
              ? "application/octet-stream"
              : "image/jpeg"),
        data: att.data || "",
        storageKey: att.storageKey,
        createdAt: Date.now(),
      });
    }
  }
  return out;
}

/** Merge fresh entries into the durable map and enforce plan limit. */
export async function persistChatMediaEntries(
  token: string,
  entries: ChatMediaEntry[],
  limit: number,
): Promise<{ map: Record<string, ChatMediaEntry>; pruned: number; prunedEntries: ChatMediaEntry[] }> {
  const prev = await loadChatMediaMap(token);
  if (!entries.length && Object.keys(prev).length <= limit) {
    return { map: prev, pruned: 0, prunedEntries: [] };
  }
  const merged = { ...prev };
  for (const e of entries) {
    const existing = merged[e.id];
    merged[e.id] = {
      ...e,
      storageKey: e.storageKey || existing?.storageKey,
      data: e.data || existing?.data || "",
      createdAt: existing?.createdAt ?? e.createdAt,
    };
  }
  const before = Object.keys(merged).length;
  const next = pruneChatMediaMap(merged, Math.max(0, limit));
  const prunedEntries = Object.values(merged).filter((e) => !next[e.id]);
  const pruned = Math.max(0, before - Object.keys(next).length);
  await saveChatMediaMap(token, next);
  // Best-effort Storage cleanup for plan-pruned blobs
  for (const e of prunedEntries) {
    if (e.storageKey) {
      try {
        await deleteUserMedia(token, e.storageKey);
      } catch {
        /* ignore */
      }
    }
  }
  return { map: next, pruned, prunedEntries };
}

export async function removeChatMediaIds(token: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await removeChatMediaAndStorage(token, ids);
}

/** Remove Library blobs from IDB + Storage + chat_media_index. */
export async function removeChatMediaAndStorage(token: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const map = await loadChatMediaMap(token);
  const storageKeys: string[] = [];
  let changed = false;
  for (const id of ids) {
    const entry = map[id];
    if (entry?.storageKey) storageKeys.push(entry.storageKey);
    if (entry) {
      delete map[id];
      changed = true;
    }
  }
  if (changed) await saveChatMediaMap(token, map);
  for (const key of storageKeys) {
    try {
      await deleteUserMedia(token, key);
    } catch {
      /* ignore */
    }
  }
  // Patch cloud index only when we can read the current value (avoid empty overwrite).
  try {
    const res = await axios.get(`${API}/userdata`, {
      params: { key: "chat_media_index" },
      headers: { "x-token": token },
    });
    const index = parseChatMediaIndex(res.data?.value);
    let indexChanged = false;
    for (const id of ids) {
      if (index[id]) {
        delete index[id];
        indexChanged = true;
      }
    }
    if (indexChanged) {
      await axios.post(
        `${API}/userdata`,
        { key: "chat_media_index", value: index },
        { headers: { "x-token": token } },
      );
    }
  } catch {
    /* offline — Storage delete above still happened */
  }
}

/** Upload local Library blobs to Storage and return userdata index payload. */
export async function syncChatMediaToCloud(
  token: string,
  entries: ChatMediaEntry[],
  prevIndex?: ChatMediaIndex,
): Promise<ChatMediaIndex> {
  const index: ChatMediaIndex = { ...(prevIndex || {}) };
  const map = await loadChatMediaMap(token);
  let mapChanged = false;
  for (const e of entries) {
    if (!e?.id) continue;
    const local = map[e.id] || e;
    if (local.storageKey) {
      index[e.id] = {
        storageKey: local.storageKey,
        kind: local.kind,
        name: local.name,
        mime: local.mime,
        createdAt: local.createdAt,
      };
      continue;
    }
    if (!local.data || local.data.startsWith("http://") || local.data.startsWith("https://")) {
      continue;
    }
    try {
      const uploaded = await uploadUserMedia(token, "chat", local.data, {
        mediaId: local.id,
        mime: local.mime,
        filename: local.name,
      });
      map[e.id] = { ...local, storageKey: uploaded.key };
      mapChanged = true;
      index[e.id] = {
        storageKey: uploaded.key,
        kind: local.kind,
        name: local.name,
        mime: local.mime,
        createdAt: local.createdAt,
      };
    } catch (err) {
      console.warn("Chat media upload failed", e.id, err);
    }
  }
  if (mapChanged) await saveChatMediaMap(token, map);
  return index;
}

/** After logout wipe: restore Library blobs from userdata index via signed URLs. */
export async function hydrateChatMediaFromIndex(
  token: string,
  rawIndex: unknown,
): Promise<Record<string, ChatMediaEntry>> {
  const index = parseChatMediaIndex(rawIndex);
  const ids = Object.keys(index);
  if (!ids.length) return await loadChatMediaMap(token);
  const urls = await fetchSignedMediaUrls(
    token,
    ids.map((id) => index[id].storageKey),
  );
  const map = await loadChatMediaMap(token);
  let changed = false;
  for (const id of ids) {
    const meta: ChatMediaIndexEntry = index[id];
    const url = urls[meta.storageKey];
    if (!url) continue;
    const existing = map[id];
    // Keep local data-URLs; always refresh https signed URLs (they expire).
    if (existing?.data && existing.data.startsWith("data:")) {
      if (!existing.storageKey) {
        map[id] = { ...existing, storageKey: meta.storageKey };
        changed = true;
      }
      continue;
    }
    if (
      existing?.data === url &&
      existing.storageKey === meta.storageKey &&
      existing.kind === meta.kind
    ) {
      continue;
    }
    map[id] = {
      id,
      kind: meta.kind,
      name: meta.name,
      mime: meta.mime,
      data: url,
      storageKey: meta.storageKey,
      createdAt: existing?.createdAt ?? meta.createdAt,
    };
    changed = true;
  }
  if (changed) await saveChatMediaMap(token, map);
  return map;
}
