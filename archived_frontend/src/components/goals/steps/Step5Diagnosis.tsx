'use client'

import { useState, useEffect, useRef } from 'react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import type { GoalWizardState, WizardContextData } from '@/lib/types'

interface Props {
  state: GoalWizardState
  context: WizardContextData
  onConfirm: (diagnosis: string) => void
  onBack: () => void
}

export function Step5Diagnosis({ state, context, onConfirm, onBack }: Props) {
  const [diagnosis, setDiagnosis] = useState(state.diagnosis || '')
  const [isStreaming, setIsStreaming] = useState(!state.diagnosis)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (state.diagnosis) return

    const controller = new AbortController()
    abortRef.current = controller

    ;(async () => {
      setIsStreaming(true)
      setError('')
      try {
        const res = await fetch(`/api/members/${encodeURIComponent(context.memberName)}/goals/diagnosis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberContext: context.memberProfile,
            managerInput: state.managerInput,
            memberInput: state.memberInput,
            previousPeriod: state.previousPeriod.previousGoals ? state.previousPeriod : undefined,
          }),
          signal: controller.signal,
        })

        if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream')) {
          setError('診断の生成に失敗しました')
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
                setDiagnosis(fullText)
              }
            } catch {}
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('診断の生成に失敗しました')
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsStreaming(false)
        }
      }
    })()

    return () => { controller.abort() }
  }, [state.diagnosis, state.managerInput, state.memberInput, state.previousPeriod, context.memberName, context.memberProfile])

  if (!diagnosis && isStreaming) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-5" />
        <p className="text-xl text-gray-500">AIが診断サマリーを生成しています...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-xl text-red-500 mb-5">{error}</p>
        <button onClick={onBack} className="px-8 py-3 text-xl border border-gray-200 rounded-xl hover:bg-gray-50">戻る</button>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-3">診断サマリー</h2>
      <p className="text-xl text-gray-500 mb-8">
        {isStreaming ? 'AIが診断を生成中...' : 'インプット情報をもとにAIが診断を行いました。内容を確認してください。'}
      </p>

      {editing ? (
        <textarea
          value={diagnosis}
          onChange={e => setDiagnosis(e.target.value)}
          rows={12}
          className="w-full border border-gray-200 rounded-xl bg-[#fafbfc] px-5 py-4 text-xl font-mono focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none mb-8"
        />
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 mb-8">
          <MarkdownRenderer content={diagnosis} />
          {isStreaming && (
            <span className="inline-block w-2 h-5 bg-brand-500 animate-pulse ml-1" />
          )}
        </div>
      )}

      {!isStreaming && (
        <div className="flex justify-end gap-4">
          <button onClick={onBack} className="px-10 py-3.5 text-xl border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors">
            戻る
          </button>
          <button
            onClick={() => setEditing(!editing)}
            className="px-8 py-3.5 text-xl border border-amber-300 text-amber-700 bg-amber-50 rounded-xl font-medium hover:bg-amber-100 transition-colors"
          >
            {editing ? 'プレビュー' : '修正する'}
          </button>
          <button
            onClick={() => onConfirm(diagnosis)}
            className="px-10 py-3.5 text-xl bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-glow"
          >
            この診断で進む
          </button>
        </div>
      )}
    </div>
  )
}
