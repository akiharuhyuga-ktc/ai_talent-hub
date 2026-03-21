'use client'

import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { EmptyState } from '@/components/ui/EmptyState'
import type { GoalsData } from '@/lib/types'

interface GoalsTabProps {
  goals: GoalsData | null
  onStartWizard?: () => void
}

export function GoalsTab({ goals, onStartWizard }: GoalsTabProps) {
  const isEmpty = !goals || !goals.rawMarkdown.includes('目標内容') &&
    !goals.rawMarkdown.includes('目標①')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-3xl font-semibold text-gray-800">半期目標</h3>
          {goals && <p className="text-2xl text-gray-500 mt-1">{goals.period}</p>}
        </div>
        <div className="flex items-center gap-3">
          {isEmpty && (
            <span className="text-xl bg-amber-50 text-amber-600 px-5 py-2 rounded-full border border-amber-200 font-medium">
              未記入
            </span>
          )}
          {onStartWizard && (
            <button
              onClick={onStartWizard}
              className="text-lg bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
            >
              目標設定ウィザード
            </button>
          )}
        </div>
      </div>
      {goals ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10">
          <MarkdownRenderer content={goals.rawMarkdown} />
        </div>
      ) : (
        <EmptyState
          title="目標設定ファイルが見つかりません"
          description="ウィザードから目標を作成できます"
          icon="🎯"
        />
      )}
    </div>
  )
}
