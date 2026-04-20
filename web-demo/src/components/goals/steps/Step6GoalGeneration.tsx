'use client'

import { useState, useEffect, useRef } from 'react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { parseGoalFields } from '@/lib/goals/field-parser'
import type { GoalWizardState, WizardContextData } from '@/lib/types'

interface Props {
  state: GoalWizardState
  context: WizardContextData
  onGenerated: (shortTermGoals: string, capabilityGoals: string) => void
  onBack: () => void
}

export function Step6GoalGeneration({ state, context, onGenerated, onBack }: Props) {
  const [shortTerm, setShortTerm] = useState(state.shortTermGoals || '')
  const [capability, setCapability] = useState(state.capabilityGoals || '')
  const [isStreaming, setIsStreaming] = useState(!state.shortTermGoals)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<'shortTerm' | 'capability' | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (state.shortTermGoals) return

    const controller = new AbortController()
    abortRef.current = controller

    ;(async () => {
      setIsStreaming(true)
      setError('')
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
          }),
          signal: controller.signal,
        })

        if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream')) {
          setError('目標の生成に失敗しました')
          setIsStreaming(false)
          return
        }

        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let accumulated = ''

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
                accumulated += parsed.text
                const fields = parseGoalFields(accumulated)
                setShortTerm(fields.shortTerm)
                setCapability(fields.capability)
              }
            } catch {}
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('目標の生成に失敗しました')
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsStreaming(false)
        }
      }
    })()

    return () => { controller.abort() }
  }, [state.shortTermGoals, state.managerInput, state.memberInput, state.previousPeriod, state.diagnosis, context.memberName, context.memberProfile])

  const handleCopy = async (text: string, field: 'shortTerm' | 'capability') => {
    await navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  if (!shortTerm && isStreaming) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-5" />
        <p className="text-xl text-gray-500">AIが目標を設計しています...</p>
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
      <h2 className="text-4xl font-bold text-gray-800 mb-3">目標案</h2>
      <p className="text-xl text-gray-500 mb-8">
        {isStreaming ? 'AIが目標を生成中...' : '診断サマリーをもとにAIが目標を設計しました。次のステップで壁打ち・精緻化ができます。'}
      </p>

      {/* ① 短期成果評価パネル */}
      <div className="border border-gray-200 rounded-xl mb-6 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 bg-blue-50 border-b border-gray-200">
          <span className="text-lg font-semibold text-blue-800">① 短期成果評価_目標</span>
          <button
            onClick={() => handleCopy(shortTerm, 'shortTerm')}
            disabled={!shortTerm || isStreaming}
            className="px-4 py-1.5 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-40 transition-colors"
          >
            {copied === 'shortTerm' ? 'コピーしました ✓' : 'コピー'}
          </button>
        </div>
        <div className="p-6 bg-white min-h-[120px]">
          <MarkdownRenderer content={shortTerm} />
          {isStreaming && !capability && (
            <span className="inline-block w-2 h-5 bg-brand-500 animate-pulse ml-1" />
          )}
        </div>
      </div>

      {/* ② 発揮能力評価パネル */}
      <div className="border border-gray-200 rounded-xl mb-8 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 bg-green-50 border-b border-gray-200">
          <span className="text-lg font-semibold text-green-800">② 発揮能力評価_目標</span>
          <button
            onClick={() => handleCopy(capability, 'capability')}
            disabled={!capability || isStreaming}
            className="px-4 py-1.5 text-sm border border-green-300 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-40 transition-colors"
          >
            {copied === 'capability' ? 'コピーしました ✓' : 'コピー'}
          </button>
        </div>
        <div className="p-6 bg-white min-h-[120px]">
          <MarkdownRenderer content={capability} />
          {isStreaming && capability && (
            <span className="inline-block w-2 h-5 bg-brand-500 animate-pulse ml-1" />
          )}
        </div>
      </div>

      {!isStreaming && (
        <div className="flex justify-end gap-4">
          <button onClick={onBack} className="px-10 py-3.5 text-xl border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors">
            戻る
          </button>
          <button
            onClick={() => onGenerated(shortTerm, capability)}
            className="px-10 py-3.5 text-xl bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-glow"
          >
            壁打ちへ進む
          </button>
        </div>
      )}
    </div>
  )
}
