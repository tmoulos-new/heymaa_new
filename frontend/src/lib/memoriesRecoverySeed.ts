import type { SyncMemory } from "./memoriesSync";

/**
 * Optional bundled recovery seed for memories.
 * Kept empty here so deploys don't depend on gitignored JSON under src/data/.
 * Ops can replace this with a real seed when needed, or drop
 * recovered-memories-export.json into frontend/public/ for fetch fallback.
 */
export function getBundledMemoriesSeed(): SyncMemory[] {
  return [];
}
