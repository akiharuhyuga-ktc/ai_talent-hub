'use client'

import { useState, useEffect } from 'react'
import type { OneOnOneWizardState, OneOnOneWizardContextData, HearingQuestion } from '@/lib/types'

interface Props {
  state: OneOnOneWizardState
  context: OneOnOneWizardContextData
  onNext: (questions: HearingQuestion[], additionalMemo: string) => void
  onBack: () => void
  prefetchedQuestions: HearingQuestion[] | null
}

export function OOStep4Hearing({ state, context, onNext, onBack, prefetchedQuestions }: Props) {
  const [questions, setQuestions] = useState<HearingQuestion[]>(
    state.hearingQuestions.length > 0 ? state.hearingQuestions : []
  )
  const [additionalMemo, setAdditionalMemo] = useState(state.additionalMemo)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (questions.length > 0) return

    if (prefetchedQuestions) {
      setQuestions(prefetchedQuestions)
      return
    }

    const fetchQuestions = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/members/${encodeURIComponent(context.memberName)}/one-on-one/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goalProgress: state.goalProgress,
            actionReviews: state.actionReviews,
            condition: state.condition,
            previousCondition: context.previousCondition,
            previousSummary: context.previousSummary,
            orgPolicy: context.orgPolicy,
          }),
        })
        const data = await res.json()
        if (data.questions && Array.isArray(data.questions)) {
          setQuestions(data.questions.map((q: { question: string; intent: string }) => ({
            question: q.question,
            intent: q.intent,
            memo: '',
          })))
        } else {
          setError('ヒアリング質問の生成に失敗しました')
        }
      } catch {
        setError('ヒアリング質問の生成に失敗しました')
      } finally {
        setLoading(false)
      }
    }
    fetchQuestions()
  }, [questions.length, prefetchedQuestions, state, context])

  const updateMemo = (index: number, memo: string) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], memo }
    setQuestions(updated)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-5" />
        <p className="text-xl text-gray-500">AIがヒアリング質問を生成しています...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-xl text-red-500 mb-5">{error}</p>
        <button onClick={onBack} className="px-8 py-3 text-xl border border-gray-300 rounded-lg hover:bg-gray-50">戻る</button>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-3">ヒアリング</h2>
      <p className="text-xl text-gray-500 mb-8">AIが生成した質問をもとにメンバーにヒアリングし、メモを残してください。</p>

      <div className="space-y-6 mb-8">
        {questions.map((q, i) => (
          <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <div className="mb-4">
              <p className="text-xl font-medium text-gray-800 mb-2">Q{i + 1}. {q.question}</p>
              <p className="text-lg text-indigo-600 bg-indigo-50 rounded px-3 py-1 inline-block">
                意図：{q.intent}
              </p>
            </div>
            <div>
              <label className="block text-xl font-medium text-gray-700 mb-2">メモ（任意）</label>
              <textarea
                value={q.memo}
                onChange={e => updateMemo(i, e.target.value)}
                rows={3}
                placeholder="メンバーの回答や気づきをメモしてください"
                className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mb-10">
        <label className="block text-xl font-medium text-gray-700 mb-2">追加メモ（任意）</label>
        <textarea
          value={additionalMemo}
          onChange={e => setAdditionalMemo(e.target.value)}
          rows={4}
          placeholder="ヒアリングで気づいたことや追加の記録があれば入力してください"
          className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
        />
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-4 text-xl border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors">
          戻る
        </button>
        <button
          onClick={() => onNext(questions, additionalMemo)}
          className="flex-1 py-4 text-xl bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
        >
          次へ進む
        </button>
      </div>
    </div>
  )
}
