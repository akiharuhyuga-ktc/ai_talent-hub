'use client'

import { useEffect, useState } from 'react'

export function MainContent({ children }: { children: React.ReactNode }) {
  const [demoMode, setDemoMode] = useState(false)

  useEffect(() => {
    const checkDemoMode = async () => {
      try {
        const res = await fetch('/api/demo-mode', { cache: 'no-store' })
        const data = await res.json()
        setDemoMode(data.enabled)
      } catch {
        // ignore
      }
    }
    checkDemoMode()

    // Listen for demo mode changes via storage event or polling
    const interval = setInterval(checkDemoMode, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ paddingTop: demoMode ? '8.5rem' : '6rem' }}>
      {children}
    </div>
  )
}
