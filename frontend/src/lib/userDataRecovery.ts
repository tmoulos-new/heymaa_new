/**
 * Stable storage keys + optional emergency local scan helpers.
 * Durable load/bootstrap is scoped to the signed-in user id so logout → signup
 * cannot resurrect another account's chat/family/memories from the same browser.
 */

import {
  loadMemoriesDurable,
  mergeMemories,
  parseMemoriesJson,
  persistMemoriesDurable,
  pickRicherMemories,
  safeLocalSet,
  storageScope,
  type SyncMemory,
} from "./memoriesSync";
import {
  ensureFamilyMemberIds,
  normalizeFamilyData,
  parseFamilyData,
  parseFamilyDataValue,
  RELATED_TO_SELF,
  type FamilyData,
} from "./familyData";
import { mergeMilestoneChecksMaps } from "./milestoneTimeline";
import type { MilestoneChecksMap } from "./milestoneTimelineTypes";

/** Normalize jsonb values from `/userdata` (already-parsed objects or JSON strings). */
export function parseUserDataJson(raw: unknown): unknown {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }
  return raw;
}

function asArray(raw: unknown): unknown[] | null {
  const parsed = parseUserDataJson(raw);
  return Array.isArray(parsed) ? parsed : null;
}

function asObject(raw: unknown): Record<string, unknown> | null {
  const parsed = parseUserDataJson(raw);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}

export type RecoveredUserData = {
  memories: SyncMemory[];
  family: FamilyData;
  chat: unknown[];
  threads: unknown[];
  docs: unknown[];
  milestones_map: MilestoneChecksMap;
  shopitems: string[] | null;
  superitems: string[] | null;
  ttsused: number | null;
  profile: unknown | null;
};

function parseJsonArray(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function parseJsonObject(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function arrayRicher(a: unknown[], b: unknown[]): unknown[] {
  if (!a.length) return b;
  if (!b.length) return a;
  return b.length >= a.length ? b : a;
}

function docEntryId(d: unknown): string | null {
  if (!d || typeof d !== "object") return null;
  const id = (d as { id?: unknown }).id;
  return id == null || id === "" ? null : String(id);
}

/**
 * Merge document lists without resurrecting intentional deletes.
 * Prefer local when it is a subset of remote (user removed entries) or equal.
 * Only fall back to length-based union when the two sides diverge with unique ids.
 */
export function mergeDocsLists(local: unknown[], remote: unknown[]): unknown[] {
  const a = Array.isArray(local) ? local : [];
  const b = Array.isArray(remote) ? remote : [];
  if (!a.length) return b;
  if (!b.length) return a;

  const aIds = a.map(docEntryId).filter((x): x is string => !!x);
  const bIds = b.map(docEntryId).filter((x): x is string => !!x);
  const aSet = new Set(aIds);
  const bSet = new Set(bIds);

  // Local is remote minus deletes (or identical) → keep local
  if (aIds.length && aIds.every((id) => bSet.has(id)) && a.length <= b.length) {
    return a;
  }
  // Remote is older subset → keep local (has newer adds)
  if (bIds.length && bIds.every((id) => aSet.has(id)) && b.length <= a.length) {
    return a;
  }

  // Divergent adds on both sides: union by id (local wins on conflict)
  const byId = new Map<string, unknown>();
  const noId: unknown[] = [];
  for (const d of b) {
    const id = docEntryId(d);
    if (id) byId.set(id, d);
    else noId.push(d);
  }
  for (const d of a) {
    const id = docEntryId(d);
    if (id) byId.set(id, d);
    else noId.push(d);
  }
  return [...Array.from(byId.values()), ...noId];
}

function familyScore(f: FamilyData): number {
  let s = f.children.length * 3 + f.members.length * 3;
  if (f.selfPhoto) s += 5;
  f.members.forEach((m) => {
    if (m.photo) s += 5;
    if (m.email || m.phone || m.note) s += 1;
  });
  f.children.forEach((c) => {
    if (c.photo) s += 5;
    if (c.birthDate) s += 1;
  });
  return s;
}

type FamilyMember = FamilyData["members"][0];

function memberIdentityKey(m: FamilyMember): string {
  return `${m.name.trim().toLowerCase()}|${(m.relationship || "").trim().toLowerCase()}`;
}

/** When merging two records for the same person, prefer the primary (first) side for tree placement. */
function mergeMemberPreferPrimary(primary: FamilyMember, secondary: FamilyMember): FamilyMember {
  return {
    ...secondary,
    ...primary,
    id: primary.id || secondary.id,
    name: primary.name || secondary.name,
    relationship: primary.relationship || secondary.relationship,
    relatedTo:
      primary.relatedTo && primary.relatedTo !== RELATED_TO_SELF
        ? primary.relatedTo
        : secondary.relatedTo,
    photo: primary.photo || secondary.photo,
    photoFrame: primary.photo
      ? primary.photoFrame || secondary.photoFrame
      : secondary.photoFrame || primary.photoFrame,
    email: primary.email || secondary.email,
    phone: primary.phone || secondary.phone,
    birthDate: primary.birthDate || secondary.birthDate,
    note: primary.note || secondary.note,
  };
}

function mergeMembersPreferPrimary(primary: FamilyMember[], secondary: FamilyMember[]): FamilyMember[] {
  const out = [...primary];
  const byId = new Map<string, number>();
  const byIdent = new Map<string, number>();
  out.forEach((m, i) => {
    if (m.id) byId.set(m.id, i);
    byIdent.set(memberIdentityKey(m), i);
  });
  for (const m of secondary) {
    if (m.id && byId.has(m.id)) {
      const i = byId.get(m.id)!;
      out[i] = mergeMemberPreferPrimary(out[i], m);
      continue;
    }
    const ident = memberIdentityKey(m);
    if (byIdent.has(ident)) {
      const i = byIdent.get(ident)!;
      out[i] = mergeMemberPreferPrimary(out[i], m);
      continue;
    }
    const idx = out.length;
    out.push(m);
    if (m.id) byId.set(m.id, idx);
    byIdent.set(ident, idx);
  }
  return out;
}

export function mergeFamily(a: FamilyData, b: FamilyData): FamilyData {
  if (familyScore(a) === 0) return ensureFamilyMemberIds(b);
  if (familyScore(b) === 0) return ensureFamilyMemberIds(a);
  const childrenByName = new Map<string, (typeof a.children)[0]>();
  a.children.forEach((c) => childrenByName.set(c.name.toLowerCase(), c));
  b.children.forEach((c) => {
    const prev = childrenByName.get(c.name.toLowerCase());
    childrenByName.set(c.name.toLowerCase(), prev ? { ...prev, ...c, photo: c.photo || prev.photo, photoFrame: c.photo ? c.photoFrame || prev.photoFrame : prev.photoFrame || c.photoFrame } : c);
  });
  return ensureFamilyMemberIds({
    children: Array.from(childrenByName.values()),
    members: mergeMembersPreferPrimary(a.members, b.members),
    ...(a.selfPhoto || b.selfPhoto ? { selfPhoto: a.selfPhoto || b.selfPhoto } : {}),
    ...(a.selfPhotoFrame || b.selfPhotoFrame
      ? { selfPhotoFrame: a.selfPhoto ? a.selfPhotoFrame || b.selfPhotoFrame : b.selfPhotoFrame || a.selfPhotoFrame }
      : {}),
  });
}

/**
 * On load, cloud family is the source of truth.
 * Keep local only to fill photos / missing fields on matching people —
 * never add stale local children that would overwrite cloud on autosave.
 */
export function preferCloudFamily(cloud: FamilyData, local: FamilyData): FamilyData {
  if (familyScore(cloud) === 0) return ensureFamilyMemberIds(local);
  if (familyScore(local) === 0) return ensureFamilyMemberIds(cloud);

  const localChildrenByName = new Map(
    local.children.map((c) => [c.name.trim().toLowerCase(), c] as const),
  );
  const children = cloud.children.map((c) => {
    const loc = localChildrenByName.get(c.name.trim().toLowerCase());
    if (!loc) return c;
    return {
      ...c,
      photo: c.photo || loc.photo,
      photoFrame: c.photo ? c.photoFrame || loc.photoFrame : loc.photoFrame || c.photoFrame,
      gender: c.gender || loc.gender,
      birthDate: c.birthDate || loc.birthDate,
    };
  });

  const localById = new Map(local.members.filter((m) => m.id).map((m) => [m.id, m] as const));
  const localByIdent = new Map(local.members.map((m) => [memberIdentityKey(m), m] as const));
  const members = cloud.members.map((m) => {
    const loc = (m.id && localById.get(m.id)) || localByIdent.get(memberIdentityKey(m));
    return loc ? mergeMemberPreferPrimary(m, loc) : m;
  });

  return ensureFamilyMemberIds({
    children,
    members,
    ...(cloud.selfPhoto || local.selfPhoto
      ? { selfPhoto: cloud.selfPhoto || local.selfPhoto }
      : {}),
    ...(cloud.selfPhotoFrame || local.selfPhotoFrame
      ? {
          selfPhotoFrame: cloud.selfPhoto
            ? cloud.selfPhotoFrame || local.selfPhotoFrame
            : local.selfPhotoFrame || cloud.selfPhotoFrame,
        }
      : {}),
  });
}

/** Scan legacy hm_family_* keys (JWT-scoped blobs). */
function recoverFamilyFromLegacyScan(): FamilyData {
  const buckets = scanLocalStorageBuckets();
  let family: FamilyData = { children: [], members: [] };
  for (const raw of buckets.family || []) {
    family = mergeFamily(family, parseFamilyData(raw, undefined));
  }
  return ensureFamilyMemberIds(family);
}

/** Prefer the stable user-id key only — never resurrect another account's family. */
export function loadFamilyForToken(token: string): FamilyData {
  try {
    const stableRaw = localStorage.getItem(stableSk(token, "family"));
    if (stableRaw && stableRaw !== "{}" && stableRaw !== "[]") {
      const parsed = parseFamilyData(stableRaw, undefined);
      if (familyScore(parsed) > 0) return ensureFamilyMemberIds(parsed);
    }
  } catch {
    /* ignore */
  }
  return ensureFamilyMemberIds(parseFamilyData("{}", undefined));
}

/** Classify a localStorage key into a data bucket. */
function bucketForKey(key: string): string | null {
  if (!key.startsWith("hm_")) return null;
  if (key.startsWith("hm_memories")) return "memories";
  if (key.startsWith("hm_family_")) return "family";
  if (key.startsWith("hm_chat_")) return "chat";
  if (key.startsWith("hm_threads_")) return "threads";
  if (key.startsWith("hm_docs_")) return "docs";
  if (key.startsWith("hm_milestones_map_")) return "milestones_map";
  if (key.startsWith("hm_shopitems_")) return "shopitems";
  if (key.startsWith("hm_superitems_")) return "superitems";
  if (key.startsWith("hm_ttsused_")) return "ttsused";
  if (key.startsWith("hm_profile_")) return "profile";
  return null;
}

/** Scan every hm_* key in localStorage (all past JWT scopes). */
export function scanLocalStorageBuckets(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const bucket = bucketForKey(key);
      if (!bucket) continue;
      const val = localStorage.getItem(key);
      if (val == null || val === "" || val === "[]" || val === "{}") continue;
      if (!out[bucket]) out[bucket] = [];
      out[bucket].push(val);
    }
  } catch {
    /* ignore */
  }
  return out;
}

/** Cached once per token so React state initializers share one scoped read. */
let _bootScanCache: { scope: string; data: RecoveredUserData } | null = null;

function emptyRecoveredUserData(): RecoveredUserData {
  return {
    memories: [],
    family: ensureFamilyMemberIds(parseFamilyData("{}", undefined)),
    chat: [],
    threads: [],
    docs: [],
    milestones_map: {},
    shopitems: null,
    superitems: null,
    ttsused: null,
    profile: null,
  };
}

/** Load only this account's durable local keys (never other users on the same device). */
export function recoverScopedLocalUserData(token: string): RecoveredUserData {
  const sk = (suffix: string) => stableSk(token, suffix);
  const readArr = (suffix: string) => {
    try {
      return parseJsonArray(localStorage.getItem(sk(suffix)));
    } catch {
      return [];
    }
  };
  let shopitems: string[] | null = null;
  let superitems: string[] | null = null;
  let ttsused: number | null = null;
  let profile: unknown | null = null;
  let milestones_map: Record<string, unknown> = {};
  try {
    const shopRaw = localStorage.getItem(sk("shopitems"));
    if (shopRaw) {
      const arr = parseJsonArray(shopRaw) as string[];
      if (arr.length) shopitems = arr;
    }
  } catch { /* ignore */ }
  try {
    const superRaw = localStorage.getItem(sk("superitems"));
    if (superRaw) {
      const arr = parseJsonArray(superRaw) as string[];
      if (arr.length) superitems = arr;
    }
  } catch { /* ignore */ }
  try {
    const ttsRaw = localStorage.getItem(sk("ttsused"));
    if (ttsRaw != null) {
      const n = parseInt(String(ttsRaw).replace(/^"|"$/g, ""), 10);
      if (!Number.isNaN(n)) ttsused = n;
    }
  } catch { /* ignore */ }
  try {
    const profileRaw = localStorage.getItem(sk("profile"));
    if (profileRaw) {
      const p = JSON.parse(profileRaw);
      if (p && typeof p === "object") profile = p;
    }
  } catch { /* ignore */ }
  try {
    milestones_map = parseJsonObject(localStorage.getItem(sk("milestones_map")));
  } catch { /* ignore */ }

  return {
    memories: parseMemoriesJson(localStorage.getItem(sk("memories_meta")) || localStorage.getItem(sk("memories"))),
    family: loadFamilyForToken(token),
    chat: readArr("chat"),
    threads: readArr("threads"),
    docs: readArr("docs"),
    milestones_map: milestones_map as MilestoneChecksMap,
    shopitems,
    superitems,
    ttsused,
    profile,
  };
}

/** Scoped bootstrap for React initializers — requires the signed-in token. */
export function bootLocalScan(token?: string | null): RecoveredUserData {
  if (!token) return emptyRecoveredUserData();
  const scope = storageScope(token);
  if (_bootScanCache?.scope === scope) return _bootScanCache.data;
  const data = recoverScopedLocalUserData(token);
  _bootScanCache = { scope, data };
  return data;
}
export function clearBootLocalScanCache(): void {
  _bootScanCache = null;
}

/** Keys that may survive permanent account deletion (prefs only — never user content). */
const LOCAL_KEYS_KEEP_ON_ACCOUNT_DELETE = new Set([
  "hm_cookie_consent_v1",
  "hm_pre_lang",
]);

function clearHeymaaIndexedDb(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase("heymaa_v1");
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Wipe all local HeyMaa user content (logout / account deletion).
 * Recovery intentionally scans every hm_* scope — without this wipe, a new
 * signup on the same device would resurrect chat/family/memories.
 */
export async function purgeLocalAppData(): Promise<void> {
  clearBootLocalScanCache();
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("hm_")) continue;
      if (LOCAL_KEYS_KEEP_ON_ACCOUNT_DELETE.has(key)) continue;
      toRemove.push(key);
    }
    for (const key of toRemove) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const sessionKeys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith("hm_")) sessionKeys.push(key);
    }
    for (const key of sessionKeys) sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  await clearHeymaaIndexedDb();
}

export function recoverFromLocalStorageScan(): RecoveredUserData {
  const buckets = scanLocalStorageBuckets();
  let memories: SyncMemory[] = [];
  for (const raw of buckets.memories || []) {
    memories = mergeMemories(memories, parseMemoriesJson(raw));
  }

  let family = recoverFamilyFromLegacyScan();

  let chat: unknown[] = [];
  for (const raw of buckets.chat || []) chat = arrayRicher(chat, parseJsonArray(raw));

  let threads: unknown[] = [];
  for (const raw of buckets.threads || []) threads = arrayRicher(threads, parseJsonArray(raw));

  let docs: unknown[] = [];
  for (const raw of buckets.docs || []) docs = arrayRicher(docs, parseJsonArray(raw));

  let milestones_map: Record<string, unknown> = {};
  for (const raw of buckets.milestones_map || []) {
    const obj = parseJsonObject(raw);
    milestones_map = mergeMilestoneChecksMaps(milestones_map, obj);
  }

  let shopitems: string[] | null = null;
  for (const raw of buckets.shopitems || []) {
    const arr = parseJsonArray(raw) as string[];
    if (arr.length && (!shopitems || arr.length >= shopitems.length)) shopitems = arr;
  }

  let superitems: string[] | null = null;
  for (const raw of buckets.superitems || []) {
    const arr = parseJsonArray(raw) as string[];
    if (arr.length && (!superitems || arr.length >= superitems.length)) superitems = arr;
  }

  let ttsused: number | null = null;
  for (const raw of buckets.ttsused || []) {
    const n = parseInt(raw.replace(/^"|"$/g, ""), 10);
    if (!Number.isNaN(n) && (ttsused == null || n > ttsused)) ttsused = n;
  }

  let profile: unknown | null = null;
  for (const raw of buckets.profile || []) {
    try {
      const p = JSON.parse(raw);
      if (p && typeof p === "object") profile = p;
    } catch {
      /* ignore */
    }
  }

  return {
    memories,
    family: ensureFamilyMemberIds(family),
    chat,
    threads,
    docs,
    milestones_map: milestones_map as MilestoneChecksMap,
    shopitems,
    superitems,
    ttsused,
    profile,
  };
}

/** Stable key: hm_<suffix>_<userId> — survives JWT refresh. */
export function stableSk(token: string, suffix: string): string {
  return `hm_${suffix}_${storageScope(token)}`;
}

/** Re-home recovered data onto stable keys + IndexedDB. */
export async function rehomeRecoveredData(token: string, data: RecoveredUserData): Promise<void> {
  const sk = (suffix: string) => stableSk(token, suffix);
  if (data.memories.length) await persistMemoriesDurable(token, data.memories);
  if (familyScore(data.family) > 0) {
    const key = sk("family");
    const existingRaw = localStorage.getItem(key);
    let existingScore = 0;
    if (existingRaw) {
      try {
        existingScore = familyScore(parseFamilyData(existingRaw, undefined));
      } catch {
        /* ignore */
      }
    }
    if (familyScore(data.family) >= existingScore) {
      safeLocalSet(key, JSON.stringify(normalizeFamilyData(data.family)));
    }
  }
  if (data.chat.length) safeLocalSet(sk("chat"), JSON.stringify(data.chat));
  if (data.threads.length) safeLocalSet(sk("threads"), JSON.stringify(data.threads));
  if (Array.isArray(data.docs)) safeLocalSet(sk("docs"), JSON.stringify(data.docs));
  if (Object.keys(data.milestones_map).length) {
    safeLocalSet(sk("milestones_map"), JSON.stringify(data.milestones_map));
  }
  if (data.shopitems) safeLocalSet(sk("shopitems"), JSON.stringify(data.shopitems));
  if (data.superitems) safeLocalSet(sk("superitems"), JSON.stringify(data.superitems));
  if (data.ttsused != null) safeLocalSet(sk("ttsused"), String(data.ttsused));
  if (data.profile) safeLocalSet(sk("profile"), JSON.stringify(data.profile));
}

export async function loadBundledRecoverySnapshot(): Promise<Partial<RecoveredUserData> | null> {
  try {
    const res = await fetch(`/recovered-userdata.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== "object") return null;
    const family = data.family
      ? ensureFamilyMemberIds(parseFamilyDataValue(data.family, undefined))
      : undefined;
    const memories = Array.isArray(data.memories) ? (data.memories as SyncMemory[]) : undefined;
    const chat = Array.isArray(data.chat) ? data.chat : undefined;
    const threads = Array.isArray(data.threads) ? data.threads : undefined;
    const familyCount = (family?.children.length || 0) + (family?.members.length || 0);
    const memoryCount = memories?.length || 0;
    const chatCount = chat?.length || 0;
    const threadCount = threads?.length || 0;
    if (familyCount === 0 && memoryCount === 0 && chatCount === 0 && threadCount === 0) {
      return null;
    }
    return {
      ...(familyCount > 0 ? { family } : {}),
      ...(memoryCount > 0 ? { memories } : {}),
      ...(chatCount > 0 ? { chat } : {}),
      ...(threadCount > 0 ? { threads } : {}),
      profile: data.profile ?? null,
    };
  } catch {
    return null;
  }
}

/** Booklet HTML export recovery bundle (bundled JS seed + optional static JSON). */
export async function loadBundledMemoriesExport(): Promise<SyncMemory[]> {
  // Prefer in-bundle seed — reliable on Vercel (SPA rewrites can break /recovered-*.json fetch)
  try {
    const { getBundledMemoriesSeed } = await import("./memoriesRecoverySeed");
    const seeded = getBundledMemoriesSeed();
    if (seeded.length) return seeded;
  } catch {
    /* fall through to fetch */
  }
  try {
    const res = await fetch(`/recovered-memories-export.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data || !Array.isArray(data.memories)) return [];
    return data.memories as SyncMemory[];
  } catch {
    return [];
  }
}

export async function recoverAllLocalUserData(token: string): Promise<RecoveredUserData> {
  // Only this account's keys + IndexedDB scope. Cross-account local scans used to
  // paste the previous user's chat/family/memories onto a fresh signup.
  const scoped = recoverScopedLocalUserData(token);
  const fromIdb = await loadMemoriesDurable(token);
  const memories = pickRicherMemories(scoped.memories, fromIdb);
  const merged: RecoveredUserData = { ...scoped, memories };
  await rehomeRecoveredData(token, merged);
  return merged;
}

/** Merge cloud userdata payload into recovered local (never prefer empty remote). */
export function mergeCloudUserData(
  local: RecoveredUserData,
  cloud: Record<string, unknown>
): RecoveredUserData {
  let memories = local.memories;
  if (cloud.memories != null) {
    const remote = asArray(cloud.memories) as SyncMemory[] | null;
    if (remote?.length) {
      memories = pickRicherMemories(memories, remote);
    }
  }

  let family = local.family;
  if (cloud.family != null) {
    const remote = parseFamilyDataValue(cloud.family, undefined);
    if (familyScore(remote) > 0) {
      // Cloud wins on load. Local-only children (e.g. stale Πανος) must not replace cloud.
      family = preferCloudFamily(remote, local.family);
    } else if (familyScore(local.family) > 0) {
      family = local.family;
    }
  }

  let chat = local.chat;
  if (cloud.chat != null) {
    const remote = asArray(cloud.chat);
    if (remote) chat = arrayRicher(chat, remote);
  }

  let threads = local.threads;
  if (cloud.threads != null) {
    const remote = asArray(cloud.threads);
    if (remote) threads = arrayRicher(threads, remote);
  }

  let docs = local.docs;
  if (cloud.docs != null) {
    const remote = asArray(cloud.docs);
    if (remote) docs = mergeDocsLists(docs, remote);
  }

  let milestones_map = mergeMilestoneChecksMaps(
    local.milestones_map as Record<string, unknown>,
    {},
  );
  if (cloud.milestones_map != null) {
    const remote = asObject(cloud.milestones_map);
    if (remote) {
      milestones_map = mergeMilestoneChecksMaps(
        milestones_map,
        remote as Record<string, unknown>,
      );
    }
  }

  let shopitems = local.shopitems;
  if (cloud.shopitems != null) {
    const remote = asArray(cloud.shopitems) as string[] | null;
    if (remote?.length) {
      if (!shopitems || remote.length >= shopitems.length) shopitems = remote;
    }
  }

  let superitems = local.superitems;
  if (cloud.superitems != null) {
    const remote = asArray(cloud.superitems) as string[] | null;
    if (remote?.length) {
      if (!superitems || remote.length >= superitems.length) superitems = remote;
    }
  }

  let ttsused = local.ttsused;
  if (cloud.ttsused != null) {
    const n =
      typeof cloud.ttsused === "number"
        ? cloud.ttsused
        : parseInt(String(parseUserDataJson(cloud.ttsused) ?? cloud.ttsused), 10);
    if (!Number.isNaN(n) && (ttsused == null || n > ttsused)) ttsused = n;
  }

  return {
    memories,
    family: ensureFamilyMemberIds(family),
    chat,
    threads,
    docs,
    milestones_map: milestones_map as MilestoneChecksMap,
    shopitems,
    superitems,
    ttsused,
    profile: local.profile,
  };
}

/** Soft prune: only remove JWT-length memory keys AFTER content was migrated. */
export function pruneOrphanJwtMemoryKeys(token: string): void {
  const scope = storageScope(token);
  const keepPrefix = `hm_memories_meta_${scope}`;
  try {
    const remove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("hm_memories")) continue;
      if (k === keepPrefix) continue;
      // Only drop keys that embed the raw JWT (very long)
      if (k.includes(token) && k.length > 200) remove.push(k);
    }
    remove.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* ignore */
  }
}

/** Drop legacy JWT-scoped family blobs once stable user-id key has data. */
export function pruneOrphanJwtFamilyKeys(token: string): void {
  const keep = stableSk(token, "family");
  try {
    const remove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("hm_family_")) continue;
      if (k === keep) continue;
      // JWT keys are very long; also drop any other non-stable family key for this user scope
      if (k.length > 80 || k.includes(token)) remove.push(k);
    }
    remove.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* ignore */
  }
}
