/** Durable memory sync: IndexedDB for photos, short keys, anti-wipe merge. */

export type SyncMemory = {
  emoji: string;
  text: string;
  date: string;
  img?: string;
  ref?: string;
  createdAt?: string;
};

const IDB_NAME = "heymaa_v1";
const IDB_STORE = "kv";
const META_IMG_MAX = 8_000; // keep tiny thumbs in localStorage meta only if smaller

function memoryRichness(m: SyncMemory): number {
  let score = 1;
  if (m.img) score += 10 + Math.min(4, Math.floor((m.img.length || 0) / 50_000));
  if (m.text && m.text !== "📷") score += 2;
  if (m.createdAt) score += 1;
  if (m.ref) score += 1;
  return score;
}

/** Prefer stable user id from JWT; avoids megabyte-long localStorage keys. */
export function storageScope(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload?.sub && typeof payload.sub === "string") return payload.sub;
  } catch {
    /* fall through */
  }
  return `t_${token.slice(-32)}`;
}

export function memoryKey(m: SyncMemory): string {
  // Same person + same display date → one memory (photo stub vs full photo)
  const ref = (m.ref || "").trim().toLowerCase();
  const date = (m.date || "").trim().toLowerCase();
  if (ref && date) return `rd:${date}|${ref}`;
  if (m.createdAt) return `at:${m.createdAt}`;
  const imgHint = m.img ? m.img.slice(0, 48) : "";
  return `c:${m.date}|${m.text}|${m.ref || ""}|${imgHint}`;
}

export function parseMemoriesJson(raw: string | null | undefined): SyncMemory[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SyncMemory[]) : [];
  } catch {
    return [];
  }
}

export function mergeMemories(...sources: Array<SyncMemory[] | null | undefined>): SyncMemory[] {
  const map = new Map<string, SyncMemory>();
  for (const source of sources) {
    if (!source?.length) continue;
    for (const m of source) {
      if (!m || typeof m !== "object") continue;
      const k = memoryKey(m);
      const prev = map.get(k);
      if (!prev || memoryRichness(m) >= memoryRichness(prev)) {
        map.set(k, {
          ...prev,
          ...m,
          img: m.img || prev?.img,
          text: (m.text && m.text !== "📷") || !prev?.text ? m.text : prev!.text,
          ref: m.ref || prev?.ref,
          createdAt: m.createdAt || prev?.createdAt,
        });
      } else if (prev && !prev.img && m.img) {
        map.set(k, { ...prev, img: m.img });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return tb - ta;
  });
}

export function memoriesScore(list: SyncMemory[]): number {
  return list.reduce((sum, m) => sum + memoryRichness(m), 0);
}

export function memoriesHavePhotos(list: SyncMemory[]): boolean {
  return list.some((m) => !!m.img && m.img.length > 100);
}

/** True when local has photo bytes that remote is missing. */
export function localMemoriesRicherThanCloud(
  local: SyncMemory[],
  cloud: SyncMemory[] | null | undefined
): boolean {
  if (!local.length) return false;
  if (!cloud?.length) return memoriesHavePhotos(local);
  return memoriesScore(local) > memoriesScore(cloud);
}

export function pickRicherMemories(
  local: SyncMemory[],
  remote: SyncMemory[] | null | undefined
): SyncMemory[] {
  if (!remote?.length) return local;
  if (!local.length) return remote;
  return mergeMemories(local, remote);
}

function metaKey(scope: string) {
  return `hm_memories_meta_${scope}`;
}
function idbMemoriesKey(scope: string) {
  return `memories:${scope}`;
}

/** Strip large base64 images for localStorage meta (photos live in IndexedDB). */
export function memoriesWithoutHeavyImages(memories: SyncMemory[]): SyncMemory[] {
  return memories.map((m) => {
    if (!m.img || m.img.length <= META_IMG_MAX) return m;
    const { img: _drop, ...rest } = m;
    return { ...rest, img: undefined, text: rest.text || "📷" };
  });
}

/** Keep compressed photos in cloud userdata (cross-device / Vercel). */
const CLOUD_IMG_MAX = 350_000;

export async function memoriesForCloud(memories: SyncMemory[]): Promise<SyncMemory[]> {
  const out: SyncMemory[] = [];
  for (const m of memories) {
    if (!m.img) {
      out.push(m);
      continue;
    }
    if (m.img.length <= CLOUD_IMG_MAX) {
      out.push(m);
      continue;
    }
    let img = await compressImageDataUrl(m.img, 960, 0.65);
    if (img.length > CLOUD_IMG_MAX) {
      img = await compressImageDataUrl(m.img, 640, 0.55);
    }
    if (img.length <= CLOUD_IMG_MAX) {
      out.push({ ...m, img });
    } else {
      const { img: _drop, ...rest } = m;
      out.push({ ...rest, img: undefined, text: rest.text || "📷" });
    }
  }
  return out;
}

export function safeLocalSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Soft prune only — never delete other sessions' data before recovery scans it. */
export function pruneLegacyMemoryKeys(token: string): void {
  // Intentionally minimal: recovery may still need JWT-keyed blobs.
  // Actual cleanup happens via pruneOrphanJwtMemoryKeys after re-home.
  void token;
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

/** Sync bootstrap — scan ALL hm_memories* keys (every past JWT scope). */
export function loadMemoriesFromLocalStorage(token: string): SyncMemory[] {
  void token;
  try {
    const sources: SyncMemory[][] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("hm_memories")) continue;
      sources.push(parseMemoriesJson(localStorage.getItem(key)));
    }
    return mergeMemories(...sources);
  } catch {
    return [];
  }
}

async function idbGetAllMemoryArrays(): Promise<SyncMemory[]> {
  try {
    const db = await openIdb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const req = store.openCursor();
      const chunks: SyncMemory[][] = [];
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          resolve(mergeMemories(...chunks));
          return;
        }
        const key = String(cursor.key);
        if (key.startsWith("memories:") && Array.isArray(cursor.value)) {
          chunks.push(cursor.value as SyncMemory[]);
        }
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/** Full load: all IndexedDB memory scopes ∪ all localStorage memory keys. */
export async function loadMemoriesDurable(token: string): Promise<SyncMemory[]> {
  const fromLs = loadMemoriesFromLocalStorage(token);
  const fromIdb = await idbGetAllMemoryArrays();
  // Also try current scope explicitly (in case cursor unavailable)
  let scoped: SyncMemory[] = [];
  try {
    const raw = await idbGet(idbMemoriesKey(storageScope(token)));
    if (Array.isArray(raw)) scoped = raw as SyncMemory[];
  } catch {
    /* ignore */
  }
  return mergeMemories(fromLs, fromIdb, scoped);
}

/**
 * Persist immediately: full payload → IndexedDB; light meta → localStorage.
 * Never throws QuotaExceededError to the UI.
 */
export async function persistMemoriesDurable(token: string, memories: SyncMemory[]): Promise<void> {
  const scope = storageScope(token);

  // Never clobber a non-empty IndexedDB store with an empty in-memory list
  if (memories.length === 0) {
    try {
      const existing = await idbGet(idbMemoriesKey(scope));
      if (Array.isArray(existing) && existing.length > 0) return;
    } catch {
      /* continue */
    }
  }

  try {
    await idbSet(idbMemoriesKey(scope), memories);
  } catch (err) {
    console.error("IndexedDB memories write failed", err);
  }

  const meta = memoriesWithoutHeavyImages(memories);
  const raw = JSON.stringify(meta);
  if (!safeLocalSet(metaKey(scope), raw)) {
    const stubs = memories.map(({ emoji, text, date, ref, createdAt }) => ({
      emoji,
      text: text || "📷",
      date,
      ref,
      createdAt,
    }));
    safeLocalSet(metaKey(scope), JSON.stringify(stubs));
  }
}

/** @deprecated sync wrapper — prefer persistMemoriesDurable */
export function persistMemoriesLocal(token: string, memories: SyncMemory[]): void {
  void persistMemoriesDurable(token, memories);
}

/** Compress data-URL photos before storing (keeps cloud + IDB manageable). */
export function compressImageDataUrl(
  dataUrl: string,
  maxEdge = 1280,
  quality = 0.72
): Promise<string> {
  if (!dataUrl.startsWith("data:image")) return Promise.resolve(dataUrl);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, maxEdge / Math.max(width, height));
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      try {
        const out = canvas.toDataURL("image/jpeg", quality);
        resolve(out.length < dataUrl.length ? out : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
