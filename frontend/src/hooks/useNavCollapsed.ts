import { useCallback, useState } from 'react'

import { persistNavCollapsed, readNavCollapsed } from '../lib/navCollapse'

/** The Primary Menu's folded state, remembered on this device. */
export function useNavCollapsed() {
  const [collapsed, setCollapsed] = useState(readNavCollapsed)
  const toggle = useCallback(() => {
    setCollapsed((current) => {
      persistNavCollapsed(!current)
      return !current
    })
  }, [])
  return { collapsed, toggle }
}
