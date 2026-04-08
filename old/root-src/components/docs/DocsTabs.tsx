'use client'

import { useState } from 'react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { clsx } from 'clsx'

interface DocsTabsProps {
  docs: {
    policy: string
    criteria: string
    guidelines: string
  }
}

const TABS = [
  { id: 'policy', label: '部方針', icon: '🏢' },
  { id: 'criteria', label: '評価基準', icon: '📊' },
  { id: 'guidelines', label: '運用ガイドライン', icon: '📋' },
] as const

type TabId = typeof TABS[number]['id']

export function DocsTabs({ docs }: DocsTabsProps) {
  const [active, setActive] = useState<TabId>('policy')

  const content: Record<TabId, string> = {
    policy: docs.policy,
    criteria: docs.criteria,
    guidelines: docs.guidelines,
  }

  return (
    <div className="flex gap-8 items-start">
      {/* Left sidebar nav */}
      <aside className="w-80 shrink-0 sticky top-28">
        <nav className="flex flex-col gap-3">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={clsx(
                'flex items-center gap-4 px-6 py-5 rounded-xl text-left text-2xl font-medium transition-colors',
                active === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
              )}
            >
              <span className="text-3xl">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-xl p-12">
        <MarkdownRenderer content={content[active]} />
      </div>
    </div>
  )
}
