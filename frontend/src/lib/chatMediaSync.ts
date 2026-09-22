/** Durable chat Library blobs (images/videos/files) in IndexedDB. Meta stays in chat/threads. */

import { storageScope } from "./memoriesSync";

export type ChatMediaEntry = {
  id: string;
  kind: "image" | "video" | "file";
  name: string;
  mime: string;
  data: string;
  createdAt: number;
};

type Attachable = {
  kind: string;
  name?: string;
  mime?: string;
  data?: string;
  mediaId?: string;
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
    if (!e.data || (e.kind !== "image" && e.kind !== "video" && e.kind !== "file")) continue;
    out[id] = {
      id,
      kind: e.kind,
      name: e.name || "file",
      mime:
        e.mime ||
        (e.kind === "video" ? "video/mp4" : e.kind === "file" ? "application/octet-stream" : "image/jpeg"),
      data: e.data,
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
      if (!att.data || !att.mediaId) continue;
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
        data: att.data,
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
): Promise<{ map: Record<string, ChatMediaEntry>; pruned: number }> {
  const prev = await loadChatMediaMap(token);
  if (!entries.length && Object.keys(prev).length <= limit) {
    return { map: prev, pruned: 0 };
  }
  const merged = { ...prev };
  for (const e of entries) {
    const existing = merged[e.id];
    merged[e.id] = {
      ...e,
      createdAt: existing?.createdAt ?? e.createdAt,
    };
  }
  const before = Object.keys(merged).length;
  const next = pruneChatMediaMap(merged, Math.max(0, limit));
  const pruned = Math.max(0, before - Object.keys(next).length);
  await saveChatMediaMap(token, next);
  return { map: next, pruned };
}

export async function removeChatMediaIds(token: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const map = await loadChatMediaMap(token);
  let changed = false;
  for (const id of ids) {
    if (map[id]) {
      delete map[id];
      changed = true;
    }
  }
  if (changed) await saveChatMediaMap(token, map);
}
