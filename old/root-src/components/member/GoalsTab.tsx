import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { EmptyState } from '@/components/ui/EmptyState'
import type { GoalsData } from '@/lib/types'

interface GoalsTabProps {
  goals: GoalsData | null
}

export function GoalsTab({ goals }: GoalsTabProps) {
  if (!goals) {
    return (
      <EmptyState
        title="目標設定ファイルが見つかりません"
        description="goals/2026-h1.md がまだ作成されていません"
        icon="🎯"
      />
    )
  }

  const isEmpty = !goals.rawMarkdown.includes('目標内容') ||
    goals.rawMarkdown.split('\n').filter(l => l.startsWith('- 目標内容：') && l.replace('- 目標内容：', '').trim()).length === 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-3xl font-semibold text-gray-800">半期目標</h3>
          <p className="text-2xl text-gray-500 mt-1">{goals.period}</p>
        </div>
        {isEmpty && (
          <span className="text-xl bg-amber-50 text-amber-600 px-5 py-2 rounded-full border border-amber-200 font-medium">
            未記入
          </span>
        )}
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-10">
        <MarkdownRenderer content={goals.rawMarkdown} />
      </div>
    </div>
  )
}
