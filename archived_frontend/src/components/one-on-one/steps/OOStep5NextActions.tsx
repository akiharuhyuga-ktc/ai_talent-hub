'use client'

import { useState, useEffect } from 'react'
import type { ActionItem, OneOnOneWizardState, OneOnOneWizardContextData } from '@/lib/types'

const ASSIGNEE_OPTIONS = [
  { value: 'member', label: 'メンバー' },
  { value: 'manager', label: 'マネージャー' },
  { value: 'both', label: '両方' },
]

function emptyAction(): ActionItem {
  return { content: '', assignee: 'member', deadline: '' }
}

interface Props {
  onComplete: (actions: ActionItem[]) => void
  onBack: () => void
  prefetchedNextActions: ActionItem[] | null
  state: OneOnOneWizardState
  context: OneOnOneWizardContextData
}

export function OOStep5NextActions({ onComplete, onBack, prefetchedNextActions, state, context }: Props) {
  const [actions, setActions] = useState<ActionItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    if (prefetchedNextActions !== null) {
      setActions(prefetchedNextActions)
      return
    }

    const controller = new AbortController()
    const fetchActions = async () => {
      setIsLoading(true)
      setFetchError(false)
      try {
        const res = await fetch(
          `/api/members/${encodeURIComponent(context.memberName)}/one-on-one/next-actions`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              goalProgress: state.goalProgress.map(g => ({ goalLabel: g.goalLabel, status: g.status, progressComment: g.progressComment })),
              actionReviews: state.actionReviews.map(a => ({ content: a.content, status: a.status, comment: a.comment })),
              condition: state.condition,
              hearingMemos: state.hearingQuestions.map(q => ({ question: q.question, memo: q.memo })),
              previousSummary: context.previousSummary,
            }),
          }
        )
        if (controller.signal.aborted) return
        const data = await res.json()
        if (controller.signal.aborted) return
        if (data.actions && Array.isArray(data.actions)) {
          setActions(data.actions)
        } else {
          setFetchError(true)
          setActions([emptyAction()])
        }
      } catch {
        if (controller.signal.aborted) return
        setFetchError(true)
        setActions([emptyAction()])
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    fetchActions()
    return () => controller.abort()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateAction = (index: number, field: keyof ActionItem, value: string) => {
    const updated = [...actions]
    updated[index] = { ...updated[index], [field]: value }
    setActions(updated)
  }

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index))
  }

  const addManualAction = () => {
    setActions([...actions, emptyAction()])
  }

  const validActions = actions.filter(a => a.content.trim() !== '' && a.deadline !== '')
  const isValid = actions.length === 0 || validActions.length > 0

  if (isLoading) {
    return (
      <div>
        <h2 className="text-4xl font-bold text-gray-800 mb-3">アクション設定</h2>
        <div className="flex items-center justify-center gap-3 py-16 text-gray-500 text-xl">
          <div className="animate-spin w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full" />
          AIがアクション案を生成中...
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-3">アクション設定</h2>
      <p className="text-xl text-gray-500 mb-8">
        {fetchError
          ? 'AI提案を取得できませんでした。手動でアクションを入力してください。'
          : 'AIが提案したアクションを確認・編集してください。不要なものは × で削除できます。'}
      </p>

      <div className="space-y-6 mb-8">
        {actions.map((action, i) => (
          <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-medium text-gray-700">アクション {i + 1}</h3>
              <button
                onClick={() => removeAction(i)}
                className="text-gray-400 hover:text-red-500 transition-colors text-2xl leading-none"
                title="削除"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xl font-medium text-gray-700 mb-2">
                  内容 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={action.content}
                  onChange={e => updateAction(i, 'content', e.target.value)}
                  placeholder="具体的なアクションを入力してください"
                  className="w-full border border-gray-200 rounded-xl bg-[#fafbfc] px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>

              {action.reason && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-base text-blue-700">
                  <span className="font-medium">根拠：</span>{action.reason}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xl font-medium text-gray-700 mb-2">
                    担当 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={action.assignee}
                    onChange={e => updateAction(i, 'assignee', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-brand-400 bg-[#fafbfc]"
                  >
                    {ASSIGNEE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xl font-medium text-gray-700 mb-2">
                    期限 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={action.deadline}
                    onChange={e => updateAction(i, 'deadline', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl bg-[#fafbfc] px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-10">
        <button
          onClick={addManualAction}
          className="w-full py-3 text-xl border-2 border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-brand-400 hover:text-brand-600 transition-colors"
        >
          + アクションを追加
        </button>
      </div>

      <div className="flex justify-end gap-4">
        <button
          onClick={onBack}
          className="px-10 py-3.5 text-xl border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
        >
          戻る
        </button>
        <button
          onClick={() => onComplete(validActions)}
          disabled={!isValid}
          className="px-10 py-3.5 text-xl bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-glow disabled:opacity-40 disabled:cursor-not-allowed"
        >
          完了する
        </button>
      </div>
    </div>
  )
}
