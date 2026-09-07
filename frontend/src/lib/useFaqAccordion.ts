import { useCallback, useState } from 'react'

/** Single-expand FAQ accordion — opening one item closes the rest. */
export function useFaqAccordion(initialIndex: number | null = null) {
  const [openIndex, setOpenIndex] = useState<number | null>(initialIndex)

  const toggle = useCallback((index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index))
  }, [])

  return { openIndex, setOpenIndex, toggle }
}

export function toggleFaqAccordionIndex(
  current: number | null,
  index: number,
): number | null {
  return current === index ? null : index
}
