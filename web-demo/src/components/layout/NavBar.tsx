'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { TalentHubLogo } from './TalentHubLogo'
import { useEffect, useState, useCallback } from 'react'

const navItems = [
  { href: '/', label: 'ダッシュボード' },
  { href: '/docs', label: '部方針・評価基準' },
]

export function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [demoMode, setDemoMode] = useState(false)
  const [toggling, setToggling] = useState(false)

  const fetchDemoMode = useCallback(async () => {
    try {
      const res = await fetch('/api/demo-mode', { cache: 'no-store' })
      const data = await res.json()
      setDemoMode(data.enabled)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchDemoMode()
  }, [fetchDemoMode])

  const toggleDemoMode = async () => {
    if (toggling) return
    setToggling(true)
    try {
      const res = await fetch('/api/demo-mode', { method: 'POST' })
      const data = await res.json()
      setDemoMode(data.enabled)
      router.refresh()
      // Navigate to dashboard when toggling to avoid stale member pages
      if (pathname !== '/') {
        router.push('/')
      }
    } catch {
      // ignore
    } finally {
      setToggling(false)
    }
  }

  return (
    <>
      <nav className="fixed top-0 inset-x-0 h-24 bg-white border-b border-gray-200 z-50 flex items-center px-10 gap-10">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 whitespace-nowrap group">
          <TalentHubLogo size={26} />
          <span className="font-bold text-gray-900 text-4xl tracking-tight group-hover:text-indigo-700 transition-colors">
            KTC TalentHub
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex gap-8 items-center">
          {navItems.map(item => {
            const isActive = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'text-2xl font-medium transition-colors',
                  isActive
                    ? 'text-indigo-600 border-b-2 border-indigo-600 pb-0.5'
                    : 'text-gray-500 hover:text-gray-900'
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-4">
          {/* Demo mode toggle */}
          <button
            onClick={toggleDemoMode}
            disabled={toggling}
            className={clsx(
              'flex items-center gap-2 text-xl px-4 py-1.5 rounded-full font-medium border transition-colors cursor-pointer',
              demoMode
                ? 'bg-orange-50 text-orange-600 border-orange-300 hover:bg-orange-100'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
            )}
          >
            {/* Toggle switch */}
            <span className={clsx(
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
              demoMode ? 'bg-orange-500' : 'bg-gray-300'
            )}>
              <span
                className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                style={{ transform: demoMode ? 'translateX(1.125rem)' : 'translateX(0.125rem)' }}
              />
            </span>
            <span>デモモード</span>
          </button>

          {demoMode && (
            <span className="text-xl bg-orange-50 text-orange-600 px-4 py-1.5 rounded-full font-medium border border-orange-200">
              デモ版
            </span>
          )}
          <span className="text-xl text-gray-400">2026年上期</span>
        </div>
      </nav>

      {/* Demo banner */}
      {demoMode && (
        <div className="fixed top-24 inset-x-0 z-40 bg-amber-50 border-b border-amber-300 px-10 py-2 text-center">
          <span className="text-xl text-amber-800 font-medium">
            デモデータを表示中です。実際のメンバー情報ではありません。
          </span>
        </div>
      )}
    </>
  )
}
