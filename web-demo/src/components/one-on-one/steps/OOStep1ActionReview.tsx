'use client'

import { useState } from 'react'
import type { ActionItemReview } from '@/lib/types'

const STATUS_OPTIONS = [
  { value: '', label: '-- 選択してください --' },
  { value: 'completed', label: '完了' },
  { value: 'incomplete', label: '未完了' },
  { value: 'ongoing', label: '継続中' },
]

const ASSIGNEE_LABEL: Record<string, string> = {
  manager: 'マネージャー',
  member: 'メンバー',
  both: '両方',
}

interface Props {
  actionReviews: ActionItemReview[]
  isFirstTime: boolean
  priorityMessage: string | null
  onNext: (reviews: ActionItemReview[]) => void
}

export function OOStep1ActionReview({ actionReviews, isFirstTime, priorityMessage, onNext }: Props) {
  const [reviews, setReviews] = useState<ActionItemReview[]>(actionReviews)

  if (isFirstTime) {
    return (
      <div>
        <h2 className="text-4xl font-bold text-gray-800 mb-3">アクション振り返り</h2>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 mb-8">
          <p className="text-xl text-blue-700">
            初回の1on1です。前回のアクションはありません。次のステップに進んでください。
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onNext([])}
            className="flex-1 py-4 text-xl bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
          >
            次へ進む
          </button>
        </div>
      </div>
    )
  }

  const updateReview = (index: number, field: keyof ActionItemReview, value: string) => {
    const updated = [...reviews]
    updated[index] = { ...updated[index], [field]: value }
    setReviews(updated)
  }

  const allStatusSelected = reviews.length === 0 || reviews.every(r => r.status !== '')

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-3">アクション振り返り</h2>
      <p className="text-xl text-gray-500 mb-8">前回のアクションの進捗を確認してください。</p>

      {priorityMessage && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-5 mb-8">
          <p className="text-xl text-amber-700">{priorityMessage}</p>
        </div>
      )}

      <div className="space-y-6 mb-10">
        {reviews.map((review, i) => (
          <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <div className="mb-4">
              <p className="text-xl font-medium text-gray-800 mb-1">{review.content}</p>
              <span className="text-lg text-gray-500">担当：{ASSIGNEE_LABEL[review.assignee] || review.assignee}</span>
            </div>

            <div className="mb-4">
              <label className="block text-xl font-medium text-gray-700 mb-2">
                ステータス <span className="text-red-500">*</span>
              </label>
              <select
                value={review.status}
                onChange={e => updateReview(i, 'status', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xl font-medium text-gray-700 mb-2">コメント（任意）</label>
              <textarea
                value={review.comment}
                onChange={e => updateReview(i, 'comment', e.target.value)}
                rows={2}
                placeholder="補足があれば入力してください"
                className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
            </div>
          </div>
        ))}

        {reviews.length === 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8">
            <p className="text-xl text-gray-500">前回のアクションが見つかりません。次へ進んでください。</p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => onNext(reviews)}
          disabled={!allStatusSelected}
          className="flex-1 py-4 text-xl bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          次へ進む
        </button>
      </div>
    </div>
  )
}
