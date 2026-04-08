'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import { TalentHubLogo } from './TalentHubLogo'

const navItems = [
  { href: '/', label: 'ダッシュボード' },
  { href: '/docs', label: '部方針・評価基準' },
]

export function NavBar() {
  const pathname = usePathname()

  return (
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
        <span className="text-xl bg-orange-50 text-orange-600 px-4 py-1.5 rounded-full font-medium border border-orange-200">
          デモ版
        </span>
        <span className="text-xl text-gray-400">2026年上期</span>
      </div>
    </nav>
  )
}
