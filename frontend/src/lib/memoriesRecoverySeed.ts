import type { SyncMemory } from "./memoriesSync";
import seed from "../data/recovered-memories-export.json";

/** Memories bundled into the JS build — works on Vercel even if static JSON fetch is rewritten to SPA. */
export function getBundledMemoriesSeed(): SyncMemory[] {
  const memories = (seed as { memories?: SyncMemory[] })?.memories;
  return Array.isArray(memories) ? memories : [];
}
