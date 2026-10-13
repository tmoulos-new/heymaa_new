/** Durable memory sync: IndexedDB for photos, Storage for videos/large media, anti-wipe merge. */

export type SyncMemory = {
  emoji: string;
  text: string;
  date: string;
  img?: string;
  video?: string;
  /** Private Storage object path for photo (user-media). */
  imgKey?: string;
  /** Private Storage object path for video (user-media). */
  videoKey?: string;
  ref?: string;
  createdAt?: string;
  description?: string;
  source?: "manual" | "chat" | "milestone";
  isMilestone?: boolean;
  milestoneKey?: string;
};

const IDB_NAME = "heymaa_v1";
const IDB_STORE = "kv";
const META_IMG_MAX = 8_000; // keep tiny thumbs in localStorage meta only if smaller

function memoryRichness(m: SyncMemory): number {
  let score = 1;
  if (m.img) score += 10 + Math.min(4, Math.floor((m.img.length || 0) / 50_000));
  if (m.video) score += 12 + Math.min(4, Math.floor((m.video.length || 0) / 50_000));
  if (m.imgKey) score += 8;
  if (m.videoKey) score += 10;
  if (m.text && m.text !== "📷" && m.text !== "🎬") score += 2;
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
          video: m.video || prev?.video,
          imgKey: m.imgKey || prev?.imgKey,
          videoKey: m.videoKey || prev?.videoKey,
          text: (m.text && m.text !== "📷" && m.text !== "🎬") || !prev?.text ? m.text : prev!.text,
          ref: m.ref || prev?.ref,
          createdAt: m.createdAt || prev?.createdAt,
        });
      } else if (prev && !prev.img && m.img) {
        map.set(k, { ...prev, img: m.img });
      } else if (prev && !prev.video && m.video) {
        map.set(k, { ...prev, video: m.video });
      } else if (prev && !prev.imgKey && m.imgKey) {
        map.set(k, { ...prev, imgKey: m.imgKey });
      } else if (prev && !prev.videoKey && m.videoKey) {
        map.set(k, { ...prev, videoKey: m.videoKey });
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
  return list.some(
    (m) =>
      (!!m.img && m.img.length > 100) ||
      (!!m.video && m.video.length > 100) ||
      !!m.imgKey ||
      !!m.videoKey,
  );
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

/** Strip large base64 images/videos for localStorage meta (media lives in IndexedDB). */
export function memoriesWithoutHeavyImages(memories: SyncMemory[]): SyncMemory[] {
  return memories.map((m) => {
    let next: SyncMemory = m;
    if (next.img && next.img.length > META_IMG_MAX) {
      const { img: _drop, ...rest } = next;
      next = { ...rest, img: undefined, text: rest.text || "📷" };
    }
    if (next.video && next.video.length > META_IMG_MAX) {
      const { video: _drop, ...rest } = next;
      next = { ...rest, video: undefined, text: rest.text || "🎬" };
    }
    return next;
  });
}

/** Keep compressed photos in cloud userdata; large media goes to Storage keys. */
const CLOUD_IMG_MAX = 350_000;

export async function memoriesForCloud(
  memories: SyncMemory[],
  opts?: { token?: string },
): Promise<SyncMemory[]> {
  const token = opts?.token;
  let uploadUserMedia: typeof import("./userMedia").uploadUserMedia | null = null;
  if (token) {
    try {
      uploadUserMedia = (await import("./userMedia")).uploadUserMedia;
    } catch {
      uploadUserMedia = null;
    }
  }
  const out: SyncMemory[] = [];
  for (const m of memories) {
    let next: SyncMemory = { ...m };

    // Prefer Storage for videos (and keep videoKey in userdata).
    if (next.video && next.video.startsWith("data:") && token && uploadUserMedia) {
      try {
        const mediaId = `memvid_${(next.createdAt || next.date || "x").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24)}`;
        const uploaded = await uploadUserMedia(token, "memory", next.video, {
          mediaId,
          mime: "video/mp4",
          filename: `${mediaId}.mp4`,
        });
        next = { ...next, video: undefined, videoKey: uploaded.key, text: next.text || "🎬" };
      } catch (err) {
        console.warn("Memory video upload failed", err);
        const { video: _drop, ...rest } = next;
        next = { ...rest, video: undefined, text: rest.text || "🎬" };
      }
    } else if (next.video && next.video.length > META_IMG_MAX) {
      const { video: _drop, ...rest } = next;
      next = { ...rest, video: undefined, text: rest.text || "🎬" };
    } else if (next.video && (next.video.startsWith("http://") || next.video.startsWith("https://"))) {
      // Signed URL is session-local — don't persist it in userdata.
      const { video: _drop, ...rest } = next;
      next = { ...rest, video: undefined };
    }

    if (!next.img) {
      out.push(next);
      continue;
    }
    if (next.img.startsWith("http://") || next.img.startsWith("https://")) {
      const { img: _drop, ...rest } = next;
      out.push({ ...rest, img: undefined });
      continue;
    }
    if (next.img.length <= CLOUD_IMG_MAX) {
      out.push(next);
      continue;
    }
    // Too large for jsonb — upload original (or compressed) to Storage.
    if (token && uploadUserMedia) {
      try {
        let img = await compressImageDataUrl(next.img, 1280, 0.72);
        if (img.length > CLOUD_IMG_MAX * 4) {
          img = await compressImageDataUrl(next.img, 960, 0.6);
        }
        const mediaId = `memimg_${(next.createdAt || next.date || "x").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24)}`;
        const uploaded = await uploadUserMedia(token, "memory", img, {
          mediaId,
          mime: "image/jpeg",
          filename: `${mediaId}.jpg`,
        });
        const { img: _drop, ...rest } = next;
        out.push({ ...rest, img: undefined, imgKey: uploaded.key, text: rest.text || "📷" });
        continue;
      } catch (err) {
        console.warn("Memory image upload failed", err);
      }
    }
    let img = await compressImageDataUrl(next.img, 960, 0.65);
    if (img.length > CLOUD_IMG_MAX) {
      img = await compressImageDataUrl(next.img, 640, 0.55);
    }
    if (img.length <= CLOUD_IMG_MAX) {
      out.push({ ...next, img });
    } else {
      const { img: _drop, ...rest } = next;
      out.push({ ...rest, img: undefined, text: rest.text || "📷" });
    }
  }
  return out;
}

/** Resolve Storage keys to signed URLs for display after login / refresh. */
export async function hydrateMemoryMediaUrls(
  token: string,
  memories: SyncMemory[],
): Promise<SyncMemory[]> {
  const keys: string[] = [];
  for (const m of memories) {
    if (m.imgKey && (!m.img || m.img.startsWith("http://") || m.img.startsWith("https://"))) {
      keys.push(m.imgKey);
    }
    if (m.videoKey && (!m.video || m.video.startsWith("http://") || m.video.startsWith("https://"))) {
      keys.push(m.videoKey);
    }
  }
  if (!keys.length) return memories;
  try {
    const { fetchSignedMediaUrls } = await import("./userMedia");
    const urls = await fetchSignedMediaUrls(token, keys);
    return memories.map((m) => {
      let next = m;
      if (m.imgKey && urls[m.imgKey] && (!m.img || m.img.startsWith("http"))) {
        next = { ...next, img: urls[m.imgKey] };
      }
      if (m.videoKey && urls[m.videoKey] && (!m.video || m.video.startsWith("http"))) {
        next = { ...next, video: urls[m.videoKey] };
      }
      return next;
    });
  } catch (err) {
    console.warn("Memory media hydrate failed", err);
    return memories;
  }
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

/** Sync bootstrap — current user scope only (never other accounts left on this device). */
export function loadMemoriesFromLocalStorage(token: string): SyncMemory[] {
  try {
    return parseMemoriesJson(localStorage.getItem(metaKey(storageScope(token))));
  } catch {
    return [];
  }
}

/** Full load for this account only (localStorage meta ∪ IndexedDB scope). */
export async function loadMemoriesDurable(token: string): Promise<SyncMemory[]> {
  const fromLs = loadMemoriesFromLocalStorage(token);
  let scoped: SyncMemory[] = [];
  try {
    const raw = await idbGet(idbMemoriesKey(storageScope(token)));
    if (Array.isArray(raw)) scoped = raw as SyncMemory[];
  } catch {
    /* ignore */
  }
  return mergeMemories(fromLs, scoped);
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
