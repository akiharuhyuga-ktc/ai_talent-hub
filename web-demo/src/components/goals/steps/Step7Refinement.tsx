'use client'

import { useState, useRef } from 'react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import type { GoalWizardState, WizardContextData, ChatMessage } from '@/lib/types'

interface Props {
  state: GoalWizardState
  context: WizardContextData
  onAddRefinement: (messages: ChatMessage[], newGoals: string, count: number) => void
  onConfirm: (goals: string) => void
  onBack: () => void
}

export function Step7Refinement({ state, context, onAddRefinement, onConfirm, onBack }: Props) {
  const [feedback, setFeedback] = useState('')
  const [currentGoals, setCurrentGoals] = useState(state.generatedGoals || '')
  const [isStreaming, setIsStreaming] = useState(false)
  const [count, setCount] = useState(state.refinementCount)
  const [messages, setMessages] = useState<ChatMessage[]>(state.refinementMessages)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const handleSendFeedback = async () => {
    if (!feedback.trim() || isStreaming) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsStreaming(true)

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'assistant' as const, content: currentGoals },
      { role: 'user' as const, content: feedback },
    ]

    try {
      const res = await fetch(`/api/members/${encodeURIComponent(context.memberName)}/goals/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberContext: context.memberProfile,
          managerInput: state.managerInput,
          memberInput: state.memberInput,
          previousPeriod: state.previousPeriod.previousGoals ? state.previousPeriod : undefined,
          diagnosis: state.diagnosis,
          refinementMessages: newMessages,
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream')) {
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
              setCurrentGoals(fullText)
            }
          } catch {}
        }
      }

      if (fullText) {
        const newCount = count + 1
        setMessages(newMessages)
        setCount(newCount)
        setFeedback('')
        onAddRefinement(newMessages, fullText, newCount)
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }

  const handleConfirm = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch(`/api/members/${encodeURIComponent(context.memberName)}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: currentGoals, period: context.targetPeriod }),
      })
      if (!res.ok) throw new Error('保存に失敗しました')
      setSaved(true)
      onConfirm(currentGoals)
    } catch {
      setSaveError('目標の保存に失敗しました。再度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-3">壁打ち・精緻化</h2>
      <p className="text-xl text-gray-500 mb-5">
        目標案に対してフィードバックを入力すると、AIが再生成します。
        <span className="ml-2 text-lg bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
          フィードバック: {count}/2回目
        </span>
      </p>

      <div className="bg-white border border-gray-200 rounded-lg p-8 mb-8 max-h-[400px] overflow-y-auto">
        <MarkdownRenderer content={currentGoals} />
        {isStreaming && (
          <span className="inline-block w-2 h-5 bg-indigo-500 animate-pulse ml-1" />
        )}
      </div>

      {saveError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {saveError}
        </div>
      )}

      {saved ? (
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 text-xl text-green-600 bg-green-50 border border-green-200 rounded-lg px-8 py-4 font-semibold">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            目標として保存しました
          </div>
          <p className="text-lg text-gray-400 mt-4">「目標」タブに反映されています。ウィザードを閉じてください。</p>
        </div>
      ) : (
        <>
          {count < 2 && (
            <div className="mb-8">
              <label className="block text-xl font-medium text-gray-700 mb-2">フィードバック</label>
              <div className="flex gap-3">
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  rows={3}
                  placeholder="修正してほしい点やもっと具体的にしたい部分を入力してください"
                  className="flex-1 border border-gray-300 rounded-lg px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                />
                <button
                  onClick={handleSendFeedback}
                  disabled={!feedback.trim() || isStreaming}
                  className="self-end px-6 py-4 text-xl bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isStreaming ? '再生成中...' : '再生成'}
                </button>
              </div>
            </div>
          )}
          {count >= 2 && (
            <p className="text-lg text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-5 py-3 mb-8">
              推奨回数の2回に達しました。この目標で確定することをお勧めします。
            </p>
          )}

          <div className="flex gap-3">
            <button onClick={onBack} className="flex-1 py-4 text-xl border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors">
              戻る
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving || isStreaming}
              className="flex-1 py-4 text-xl bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saving ? '保存中...' : 'この目標で確定する'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
