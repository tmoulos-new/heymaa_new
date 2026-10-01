import { useCallback, useState } from 'react'

/** Locked-by-default forms: fields stay read-only until Edit is pressed. */
export function useEditLock(initial = false) {
  const [editing, setEditing] = useState(initial)

  const startEdit = useCallback(() => setEditing(true), [])
  const finishEdit = useCallback(() => setEditing(false), [])
  const cancelEdit = useCallback((reset?: () => void) => {
    reset?.()
    setEditing(false)
  }, [])

  return { editing, startEdit, finishEdit, cancelEdit, setEditing }
}
