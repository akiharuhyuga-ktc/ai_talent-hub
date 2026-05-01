'use client'

import { useState } from 'react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { EmptyState } from '@/components/ui/EmptyState'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { OneOnOneRecord } from '@/lib/types'

interface Section {
  title: string
  content: string
}

function parseSections(rawMarkdown: string): Section[] {
  const lines = rawMarkdown.split('\n')
  const sections: Section[] = []
  let current: Section | null = null

  for (const line of lines) {
    if (line.startsWith('# ') || line.startsWith('- 実施日') || line.startsWith('- メンバー')) continue

    if (line.startsWith('## ')) {
      if (current) sections.push({ ...current, content: current.content.trim() })
      current = { title: line.replace(/^##\s+/, '').trim(), content: '' }
      continue
    }

    if (current) current.content += line + '\n'
  }

  if (current) sections.push({ ...current, content: current.content.trim() })
  return sections.filter(s => s.content.length > 0)
}

function parseCondition(sections: Section[]) {
  const s = sections.find(s => s.title === 'コンディション')
  if (!s) return null
  const num = (label: string) => {
    const m = s.content.match(new RegExp(`${label}[：:]\\s*(\\d)`))
    return m ? parseInt(m[1]) : null
  }
  return { motivation: num('モチベーション'), workload: num('業務負荷'), teamRelations: num('チーム関係性') }
}

function countActions(sections: Section[]) {
  const s = sections.find(s => s.title === 'ネクストアクション' || s.title === '次回アクション')
  if (!s) return 0
  return (s.content.match(/^### アクション/gm) || []).length
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400 text-sm">-</span>
  const cls =
    score >= 4 ? 'bg-green-100 text-green-700' :
    score === 3 ? 'bg-yellow-100 text-yellow-700' :
    'bg-red-100 text-red-700'
  return <span className={`inline-block min-w-[22px] text-center px-1.5 py-0.5 rounded-full text-sm font-semibold ${cls}`}>{score}</span>
}

const SECTION_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  '前回アクション振り返り': { bg: 'bg-orange-50',  text: 'text-orange-800',  border: 'border-orange-100' },
  '目標進捗':               { bg: 'bg-blue-50',    text: 'text-blue-800',    border: 'border-blue-100'   },
  'コンディション':         { bg: 'bg-purple-50',  text: 'text-purple-800',  border: 'border-purple-100' },
  'ヒアリング':             { bg: 'bg-green-50',   text: 'text-green-800',   border: 'border-green-100'  },
  'ネクストアクション':     { bg: 'bg-amber-50',   text: 'text-amber-800',   border: 'border-amber-100'  },
  '追加メモ':               { bg: 'bg-gray-50',    text: 'text-gray-700',    border: 'border-gray-200'   },
  '引き継ぎサマリー':       { bg: 'bg-brand-50',   text: 'text-brand-800',   border: 'border-brand-100'  },
}

function getSectionStyle(title: string) {
  if (SECTION_STYLES[title]) return SECTION_STYLES[title]
  for (const key of Object.keys(SECTION_STYLES)) {
    if (title.startsWith(key)) return SECTION_STYLES[key]
  }
  return { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }
}

interface OneOnOneTabProps {
  oneOnOnes: OneOnOneRecord[]
  onStartWizard?: () => void
}

export function OneOnOneTab({ oneOnOnes, onStartWizard }: OneOnOneTabProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(oneOnOnes.length > 0 ? [oneOnOnes[0].filename] : [])
  )

  const toggle = (filename: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(filename) ? next.delete(filename) : next.add(filename)
      return next
    })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-3xl font-semibold text-gray-800">1on1記録</h3>
        {onStartWizard && (
          <button
            onClick={onStartWizard}
            className="text-lg bg-brand-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand-700 transition-colors"
          >
            1on1ウィザード
          </button>
        )}
      </div>

      {oneOnOnes.length === 0 ? (
        <EmptyState
          title="1on1記録はまだありません"
          description="ウィザードから1on1を開始できます"
          icon="💬"
        />
      ) : (
        <div className="space-y-4">
          {oneOnOnes.map(record => {
            const isOpen = expanded.has(record.filename)
            const sections = parseSections(record.rawMarkdown)
            const condition = parseCondition(sections)
            const actionCount = countActions(sections)

            return (
              <div key={record.filename} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {/* Accordion header */}
                <button
                  onClick={() => toggle(record.filename)}
                  className="w-full flex items-center justify-between px-8 py-5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    {isOpen
                      ? <ChevronDown size={20} className="text-gray-400 shrink-0" />
                      : <ChevronRight size={20} className="text-gray-400 shrink-0" />}
                    <span className="text-2xl font-semibold text-gray-700">{record.date} 実施</span>
                  </div>

                  {/* Collapsed summary badges */}
                  {!isOpen && (
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {condition && (
                        <>
                          <span className="flex items-center gap-1">モチベ <ScoreBadge score={condition.motivation} /></span>
                          <span className="flex items-center gap-1">負荷 <ScoreBadge score={condition.workload} /></span>
                          <span className="flex items-center gap-1">チーム <ScoreBadge score={condition.teamRelations} /></span>
                        </>
                      )}
                      {actionCount > 0 && (
                        <span className="bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full font-medium">
                          {actionCount}件のアクション
                        </span>
                      )}
                    </div>
                  )}
                </button>

                {/* Expanded sections */}
                {isOpen && (
                  <div className="divide-y divide-gray-100">
                    {sections.map((section, i) => {
                      const style = getSectionStyle(section.title)
                      return (
                        <div key={i}>
                          <div className={`px-8 py-3 ${style.bg} border-b ${style.border}`}>
                            <h4 className={`text-base font-semibold ${style.text}`}>{section.title}</h4>
                          </div>
                          <div className="px-8 py-5">
                            <MarkdownRenderer content={section.content} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
