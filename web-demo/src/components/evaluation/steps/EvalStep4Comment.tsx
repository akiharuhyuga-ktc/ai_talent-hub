'use client'

import { useState, useEffect, useRef } from 'react'
import type { EvaluationWizardState, EvaluationWizardContextData } from '@/lib/types'

interface Props {
  state: EvaluationWizardState
  context: EvaluationWizardContextData
  onComplete: (comment: string) => void
  onBack: () => void
}

export function EvalStep4Comment({ state, context, onComplete, onBack }: Props) {
  const [isStreaming, setIsStreaming] = useState(true)
  const [error, setError] = useState('')
  const [comment, setComment] = useState(state.evaluatorComment || '')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (state.aiCommentDraft) {
      setComment(state.aiCommentDraft)
      setIsStreaming(false)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    ;(async () => {
      setIsStreaming(true)
      setError('')
      try {
        const res = await fetch(`/api/members/${encodeURIComponent(context.memberName)}/reviews/comment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goalEvaluations: state.confirmedDraft?.goalEvaluations ?? [],
            overallGrade: state.confirmedDraft?.overallGrade ?? '',
            overallRationale: state.confirmedDraft?.overallRationale ?? '',
            selfEvalGap: state.confirmedDraft?.selfEvalGap ?? '',
            selfEvaluation: state.selfEvaluation,
          }),
          signal: controller.signal,
        })

        if (res.status === 503) {
          setError('API未設定のためコメント生成ができません。手動で入力してください。')
          setComment('')
          setIsStreaming(false)
          return
        }

        if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream')) {
          setError('コメントの生成に失敗しました。手動で入力してください。')
          setComment('')
          setIsStreaming(false)
          return
        }

        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let fullText = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.text) {
                fullText += parsed.text
                setComment(fullText)
              }
            } catch {}
          }
        }

        if (!fullText) {
          setError('コメントの生成に失敗しました。手動で入力してください。')
          setComment('')
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('コメントの生成に失敗しました。ネットワーク接続を確認してください。')
          setComment('')
        }
      } finally {
        setIsStreaming(false)
      }
    })()

    return () => { controller.abort() }
  }, [state.aiCommentDraft, state.confirmedDraft, state.selfEvaluation, context])

  const charCount = comment.length
  const charCountColor = charCount >= 200 && charCount <= 300
    ? 'text-green-600'
    : charCount > 300
      ? 'text-amber-600'
      : 'text-gray-400'

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-3">評価者コメント作成</h2>
      <p className="text-xl text-gray-500 mb-8">メンバーに伝える評価コメントを作成してください。</p>

      {!comment && isStreaming && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-5" />
          <p className="text-xl text-gray-500">AIがコメントを生成しています...</p>
        </div>
      )}

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 mb-8">
          <p className="text-xl text-amber-700">{error}</p>
        </div>
      )}

      {(comment || !isStreaming) && (
        <div className="mb-10">
          <div className="mb-4">
            <label className="block text-xl font-medium text-gray-700 mb-2">評価者コメント</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={8}
              placeholder="メンバーへの評価コメントを入力してください"
              className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
              disabled={isStreaming}
            />
          </div>
          <div className="flex justify-between items-center">
            <p className="text-lg text-gray-400">目安：200〜300文字</p>
            <p className={`text-lg font-medium ${charCountColor}`}>{charCount}文字</p>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-4 text-xl border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          戻る
        </button>
        {!isStreaming && (
          <button
            onClick={() => onComplete(comment)}
            disabled={comment.trim() === ''}
            className="flex-1 py-4 text-xl bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            この内容で完了する
          </button>
        )}
      </div>
    </div>
  )
}
