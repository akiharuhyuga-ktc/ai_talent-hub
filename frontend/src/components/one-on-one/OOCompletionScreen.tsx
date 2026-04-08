'use client'

import { useState, useEffect, useRef } from 'react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { buildOneOnOneMarkdown } from '@/lib/parsers/one-on-one'
import type { OneOnOneWizardState, OneOnOneWizardContextData } from '@/lib/types'

interface Props {
  state: OneOnOneWizardState
  context: OneOnOneWizardContextData
  onClose: () => void
}

export function OOCompletionScreen({ state, context, onClose }: Props) {
  const [summary, setSummary] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(true)
  const [summaryError, setSummaryError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  // Fetch AI summary on mount via streaming
  useEffect(() => {
    const controller = new AbortController()
    abortRef.current = controller

    ;(async () => {
      setIsStreaming(true)
      setSummaryError('')
      try {
        const res = await fetch(`/api/members/${encodeURIComponent(context.memberName)}/one-on-one/summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            yearMonth: state.yearMonth,
            actionReviews: state.actionReviews.map(r => ({
              content: r.content,
              status: r.status,
              comment: r.comment,
            })),
            goalProgress: state.goalProgress.map(g => ({
              goalLabel: g.goalLabel,
              status: g.status,
              progressComment: g.progressComment,
            })),
            condition: state.condition,
            previousCondition: context.previousCondition,
            hearingMemos: state.hearingQuestions
              .filter(q => q.memo)
              .map(q => ({ question: q.question, memo: q.memo })),
            nextActions: state.nextActions,
          }),
          signal: controller.signal,
        })

        if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream')) {
          setSummaryError('サマリーの生成に失敗しました')
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
                setSummary(fullText)
              }
            } catch {}
          }
        }

        if (!fullText) {
          setSummaryError('サマリーの生成に失敗しました')
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setSummaryError('サマリーの生成に失敗しました')
        }
      } finally {
        setIsStreaming(false)
      }
    })()

    return () => { controller.abort() }
  }, [state, context])

  // Save record after summary is available
  useEffect(() => {
    if (!summary || isStreaming || saving || saved) return

    const saveRecord = async () => {
      setSaving(true)
      setSaveError('')
      try {
        const content = buildOneOnOneMarkdown({
          yearMonth: state.yearMonth,
          memberName: context.memberName,
          actionReviews: state.actionReviews.map(r => ({
            content: r.content,
            status: r.status,
            comment: r.comment,
          })),
          goalProgress: state.goalProgress.map(g => ({
            goalLabel: g.goalLabel,
            status: g.status,
            progressComment: g.progressComment,
          })),
          condition: state.condition,
          hearingQuestions: state.hearingQuestions,
          additionalMemo: state.additionalMemo,
          nextActions: state.nextActions,
          aiSummary: summary,
        })

        const res = await fetch(`/api/members/${encodeURIComponent(context.memberName)}/one-on-one`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, yearMonth: state.yearMonth }),
        })

        if (res.ok) {
          setSaved(true)
        } else {
          setSaveError('保存に失敗しました')
        }
      } catch {
        setSaveError('保存に失敗しました')
      } finally {
        setSaving(false)
      }
    }
    saveRecord()
  }, [summary, isStreaming, saving, saved, state, context])

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-3">1on1記録の完了</h2>
      <p className="text-xl text-gray-500 mb-8">AIが引き継ぎサマリーを生成し、記録を保存します。</p>

      {!summary && isStreaming && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-5" />
          <p className="text-xl text-gray-500">AIが引き継ぎサマリーを生成しています...</p>
        </div>
      )}

      {summaryError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-5 mb-8">
          <p className="text-xl text-red-600">{summaryError}</p>
        </div>
      )}

      {summary && (
        <div className="mb-8">
          <h3 className="text-xl font-medium text-gray-700 mb-3">引き継ぎサマリー（AI生成）</h3>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8">
            <MarkdownRenderer content={summary} />
            {isStreaming && (
              <span className="inline-block w-2 h-5 bg-brand-500 animate-pulse ml-1" />
            )}
          </div>
        </div>
      )}

      {saving && (
        <div className="flex items-center gap-3 text-xl text-gray-500 mb-6">
          <div className="w-6 h-6 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          保存中...
        </div>
      )}

      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-5 mb-8">
          <p className="text-xl text-red-600">{saveError}</p>
        </div>
      )}

      {saved && (
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 text-xl text-green-600 bg-green-50 border border-green-200 rounded-lg px-8 py-4 font-semibold">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            保存完了
          </div>
          <p className="text-lg text-gray-400 mt-4">1on1記録が保存されました。</p>
        </div>
      )}

      {(saved || summaryError || saveError) && (
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="px-10 py-3.5 text-xl bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-glow"
          >
            閉じる
          </button>
        </div>
      )}
    </div>
  )
}
