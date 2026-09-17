/** Saved memories-album recipes (title, dates, cover) — photos stay in memories. */

import { useCallback, useState } from 'react'
import type { AlbumPhotoFrame } from './memoriesBooklet'

export type SavedMemoryAlbum = {
  id: string
  title: string
  subtitle?: string
  fromDate: string
  toDate: string
  coverMemoryKey?: string
  memoryKeys?: string[]
  photoFrames?: Record<string, AlbumPhotoFrame>
  journalName: string
  createdAt: string
}

const STORAGE_KEY = 'hm_memory_albums'

function parseAlbums(raw: string | null): SavedMemoryAlbum[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (a): a is SavedMemoryAlbum =>
        a &&
        typeof a === 'object' &&
        typeof a.id === 'string' &&
        typeof a.title === 'string' &&
        typeof a.fromDate === 'string' &&
        typeof a.toDate === 'string' &&
        typeof a.journalName === 'string',
    )
  } catch {
    return []
  }
}

export function loadSavedMemoryAlbums(): SavedMemoryAlbum[] {
  try {
    return parseAlbums(localStorage.getItem(STORAGE_KEY))
  } catch {
    return []
  }
}

export function persistSavedMemoryAlbums(albums: SavedMemoryAlbum[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(albums))
  } catch {
    /* quota / private mode */
  }
}

export function upsertSavedMemoryAlbum(
  albums: SavedMemoryAlbum[],
  next: Omit<SavedMemoryAlbum, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
): SavedMemoryAlbum[] {
  const match =
    (next.id ? albums.find((a) => a.id === next.id) : undefined) ||
    albums.find(
      (a) =>
        a.journalName === next.journalName &&
        a.fromDate === next.fromDate &&
        a.toDate === next.toDate &&
        a.title === next.title,
    )
  const saved: SavedMemoryAlbum = {
    id: next.id || match?.id || `alb_${Date.now()}`,
    createdAt: next.createdAt || match?.createdAt || new Date().toISOString(),
    title: next.title,
    subtitle: next.subtitle,
    fromDate: next.fromDate,
    toDate: next.toDate,
    coverMemoryKey: next.coverMemoryKey,
    memoryKeys: next.memoryKeys,
    photoFrames: next.photoFrames,
    journalName: next.journalName,
  }
  if (match) {
    return albums.map((a) => (a.id === match.id ? saved : a))
  }
  return [saved, ...albums]
}

export function useSavedMemoryAlbums() {
  const [albums, setAlbums] = useState<SavedMemoryAlbum[]>(loadSavedMemoryAlbums)
  const replace = useCallback((next: SavedMemoryAlbum[]) => {
    setAlbums(next)
    persistSavedMemoryAlbums(next)
  }, [])
  return [albums, replace] as const
}
