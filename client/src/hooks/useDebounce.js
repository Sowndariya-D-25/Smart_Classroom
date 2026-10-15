import { useEffect, useState } from 'react'

// Delays updating the returned value until `value` stops changing for
// `delayMs` — used so search inputs don't fire an API request on every
// keystroke.
export function useDebounce(value, delayMs = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}
