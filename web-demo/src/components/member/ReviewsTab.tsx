'use client'

import { useState } from 'react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { EmptyState } from '@/components/ui/EmptyState'
import type { ReviewData } from '@/lib/types'

interface ReviewsTabProps {
  reviews: ReviewData[]
}

const evalColorMap: Record<string, { bg: string; text: string; border: string }> = {
  S: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' },
  A: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  B: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-300' },
  C: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-300' },
}

function EvalBadge({ value, label }: { value: string; label: string }) {
  const colors = evalColorMap[value] || evalColorMap['B']
  return (
    <div className="text-center">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <span className={`inline-flex items-center justify-center w-12 h-12 rounded-xl text-2xl font-bold border-2 ${colors.bg} ${colors.text} ${colors.border}`}>
        {value}
      </span>
    </div>
  )
}

function CommentSection({ comment }: { comment: { label: string; evaluator: string; content: string } }) {
  const [isOpen, setIsOpen] = useState(false)

  const labelColors: Record<string, string> = {
    '本人コメント': 'bg-green-100 text-green-700',
    'プレ一次評価': 'bg-purple-100 text-purple-700',
    '一次評価': 'bg-blue-100 text-blue-700',
    '二次評価': 'bg-indigo-100 text-indigo-700',
    '三次評価': 'bg-gray-100 text-gray-700',
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${labelColors[comment.label] || 'bg-gray-100 text-gray-600'}`}>
            {comment.label}
          </span>
          {comment.evaluator && (
            <span className="text-sm text-gray-500">{comment.evaluator}</span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-5 py-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          {comment.content}
        </div>
      )}
    </div>
  )
}

function ReviewCard({ review }: { review: ReviewData }) {
  return (
    <div>
      {/* Header with evaluation badges */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-800">{review.period}</h3>
            <div className="flex items-center gap-3 mt-2">
              {review.grade && (
                <span className="text-sm text-gray-500">等級 {review.grade}</span>
              )}
              {review.roleName && (
                <span className="text-sm text-gray-500">{review.roleName}</span>
              )}
              {review.promotion && (
                <span className="text-sm font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  昇格
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <EvalBadge value={review.h2Eval} label="下期評価" />
            <EvalBadge value={review.annualEval} label="年間評価" />
          </div>
        </div>
      </div>

      {/* Feedback section */}
      {(review.feedbackPoints || review.feedbackExpectations) && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">フィードバック</h4>
          {review.feedbackPoints && (
            <div className="mb-5">
              <h5 className="text-sm font-medium text-gray-500 mb-2">評価のポイント</h5>
              <div className="text-sm text-gray-700 leading-relaxed">
                <MarkdownRenderer content={review.feedbackPoints} />
              </div>
            </div>
          )}
          {review.feedbackExpectations && (
            <div>
              <h5 className="text-sm font-medium text-gray-500 mb-2">今後の期待</h5>
              <div className="text-sm text-gray-700 leading-relaxed">
                <MarkdownRenderer content={review.feedbackExpectations} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Evaluator comments (collapsible) */}
      {review.evaluatorComments.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">各評価者コメント</h4>
          <div className="space-y-2">
            {review.evaluatorComments.map((comment, i) => (
              <CommentSection key={i} comment={comment} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const REVIEW_PASSWORD = 'akiharu0901!'
const SESSION_KEY = 'reviews_unlocked'

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === REVIEW_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1')
      onUnlock()
    } else {
      setError(true)
      setPassword('')
    }
  }

  return (
    <div className="flex items-center justify-center py-20">
      <div className="bg-white border border-gray-200 rounded-xl p-8 w-full max-w-sm text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">評価データは保護されています</h3>
        <p className="text-sm text-gray-500 mb-6">閲覧するにはパスワードを入力してください</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false) }}
            placeholder="パスワード"
            className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${error ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            autoFocus
          />
          {error && (
            <p className="text-xs text-red-500 mt-2">パスワードが正しくありません</p>
          )}
          <button
            type="submit"
            className="w-full mt-4 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            解除する
          </button>
        </form>
      </div>
    </div>
  )
}

export function ReviewsTab({ reviews }: ReviewsTabProps) {
  const [unlocked, setUnlocked] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(SESSION_KEY) === '1'
    }
    return false
  })

  if (reviews.length === 0) {
    return (
      <EmptyState
        title="評価データがありません"
        description="reviews/ フォルダに評価ファイルがまだ作成されていません"
        icon="📊"
      />
    )
  }

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />
  }

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-3xl font-semibold text-gray-800">評価・振り返り</h3>
      </div>
      <div className="space-y-8">
        {reviews.map((review, i) => (
          <ReviewCard key={i} review={review} />
        ))}
      </div>
    </div>
  )
}
