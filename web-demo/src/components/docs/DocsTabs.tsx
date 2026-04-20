'use client'

import { useState } from 'react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { PolicyWizard } from '@/components/docs/PolicyWizard'
import { clsx } from 'clsx'

interface DocsTabsProps {
  orgPolicy: string
  policyYear: number | null
  availableYears: number[]
  criteria: string
  guidelines: string
}

const TABS = [
  { id: 'policy', label: '組織方針', icon: '🏢' },
  { id: 'criteria', label: '評価基準', icon: '📊' },
  { id: 'guidelines', label: '運用ガイドライン', icon: '📋' },
] as const

type TabId = typeof TABS[number]['id']

export function DocsTabs({ orgPolicy, policyYear, availableYears, criteria, guidelines }: DocsTabsProps) {
  const [active, setActive] = useState<TabId>('policy')
  const [selectedYear, setSelectedYear] = useState(policyYear)
  const [policyContent, setPolicyContent] = useState(orgPolicy)
  const [loadingYear, setLoadingYear] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [currentAvailableYears, setCurrentAvailableYears] = useState(availableYears)

  const handleYearChange = async (year: number) => {
    setSelectedYear(year)
    setLoadingYear(true)
    try {
      const res = await fetch(`/api/docs?year=${year}`)
      const data = await res.json()
      if (data.orgPolicy) {
        setPolicyContent(data.orgPolicy)
      }
    } catch {
      // keep current content on error
    } finally {
      setLoadingYear(false)
    }
  }

  const content: Record<TabId, string> = {
    policy: policyContent,
    criteria,
    guidelines,
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
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-300 hover:text-brand-600'
              )}
            >
              <span className="text-3xl">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Year selector for policy tab */}
        {active === 'policy' && (
          <div className="flex items-center gap-4 mb-6">
            {currentAvailableYears.length > 0 && (
              <select
                value={selectedYear ?? ''}
                onChange={e => handleYearChange(Number(e.target.value))}
                className="text-xl border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {currentAvailableYears.map(y => (
                  <option key={y} value={y}>{y}年度</option>
                ))}
              </select>
            )}
            {loadingYear && <span className="text-lg text-gray-400">読み込み中...</span>}
            <button
              onClick={() => setWizardOpen(true)}
              className="text-lg bg-brand-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand-700 transition-colors"
            >
              新年度方針を作成
            </button>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-12">
          <MarkdownRenderer content={content[active]} />
        </div>
      </div>

      {wizardOpen && (
        <PolicyWizard
          availableYears={currentAvailableYears}
          criteria={criteria}
          guidelines={guidelines}
          onClose={async () => {
            setWizardOpen(false)
            // Refresh policy data after wizard closes
            try {
              const res = await fetch('/api/docs')
              const data = await res.json()
              if (data.orgPolicy) {
                setPolicyContent(data.orgPolicy)
                setSelectedYear(data.policyYear)
                setCurrentAvailableYears(data.availableYears || [])
              }
            } catch { /* ignore */ }
          }}
        />
      )}
    </div>
  )
}
