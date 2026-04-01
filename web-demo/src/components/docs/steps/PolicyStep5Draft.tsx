'use client'

import { useState, useEffect, useRef } from 'react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import type { PolicyWizardState } from '../PolicyWizard'

interface PolicyStep5DraftProps {
  state: PolicyWizardState
  onDraftGenerated: (draft: string) => void
  onBack: () => void
}

export function PolicyStep5Draft({ state, onDraftGenerated, onBack }: PolicyStep5DraftProps) {
  const [draft, setDraft] = useState(state.aiDraft || '')
  const [isStreaming, setIsStreaming] = useState(!state.aiDraft)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (state.aiDraft) return

    const controller = new AbortController()
    abortRef.current = controller

    ;(async () => {
      setIsStreaming(true)
      setError('')
      try {
        const body: Record<string, unknown> = {
          mode: state.flowMode,
          targetYear: state.targetYear,
          confirmedDirection: state.direction,
        }

        if (state.flowMode === 'continuous') {
          body.prevContent = state.baseContent
          body.allInputs = [
            `【うまくいったこと】\n${state.review.whatWorked}`,
            `【うまくいかなかったこと】\n${state.review.whatDidntWork}`,
            state.review.leftBehind ? `【やり残したこと】\n${state.review.leftBehind}` : '',
            `【事業環境の変化】\n${state.continuousThemes.envChanges}`,
            `【技術トレンドの変化】\n${state.continuousThemes.techChanges}`,
            `【来期の注力テーマ】\n${state.continuousThemes.focusThemes}`,
          ].filter(Boolean).join('\n\n')
        } else {
          body.orgInfo = [
            `【チーム構成・規模】\n${state.currentState.teamInfo}`,
            `【技術領域・担当プロダクト】\n${state.currentState.techDomains}`,
            `【現在の課題】\n${state.currentState.challenges}`,
            `【組織の強み】\n${state.currentState.strengths}`,
            `【ミッション・役割】\n${state.currentState.mission}`,
            state.currentState.themes ? `【注力テーマ】\n${state.currentState.themes}` : '',
            state.upperPolicy ? `【上位組織の方針】\n${state.upperPolicy}` : '',
          ].filter(Boolean).join('\n\n')
        }

        const res = await fetch('/api/docs/policy/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        })

        if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream')) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'AI草案の生成に失敗しました')
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
                setDraft(fullText)
              }
            } catch {}
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError(err instanceof Error ? err.message : 'AI草案の生成に失敗しました')
        }
      } finally {
        setIsStreaming(false)
      }
    })()

    return () => { controller.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-3">AI草案</h2>
      <p className="text-xl text-gray-500 mb-8">
        {isStreaming
          ? `AIが${state.targetYear}年度の草案を生成中...`
          : `${state.targetYear}年度の組織方針草案をAIが生成しました`}
      </p>

      {!draft && isStreaming && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-6" />
          <p className="text-xl text-gray-500">AIが{state.targetYear}年度の草案を生成中...</p>
          <p className="text-lg text-gray-400 mt-2">確定した方向性をもとに作成しています</p>
        </div>
      )}

      {error && !isStreaming && (
        <div className="text-center py-12">
          <p className="text-xl text-red-600 bg-red-50 border border-red-200 rounded-lg px-5 py-4 mb-6">
            {error}
          </p>
          <button
            onClick={onBack}
            className="px-8 py-4 text-xl border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            戻る
          </button>
        </div>
      )}

      {draft && (
        <>
          <div className="bg-white border border-gray-200 rounded-lg p-8 mb-8 max-h-[500px] overflow-y-auto">
            <MarkdownRenderer content={draft} />
            {isStreaming && (
              <span className="inline-block w-2 h-5 bg-indigo-500 animate-pulse ml-1" />
            )}
          </div>

          {!isStreaming && (
            <div className="flex gap-3">
              <button
                onClick={onBack}
                className="flex-1 py-4 text-xl border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                戻る
              </button>
              <button
                onClick={() => onDraftGenerated(draft)}
                className="flex-1 py-4 text-xl bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
              >
                壁打ちへ進む
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
