'use client'

import { useState, useRef } from 'react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { parseGoalFields, assembleGoalMarkdown } from '@/lib/goals/field-parser'
import type { GoalWizardState, WizardContextData, ChatMessage, RefinementTarget } from '@/lib/types'

interface Props {
  state: GoalWizardState
  context: WizardContextData
  onAddRefinement: (
    messages: ChatMessage[],
    shortTermGoals: string,
    capabilityGoals: string,
    count: number,
  ) => void
  onConfirm: (goals: string) => void
  onBack: () => void
}

export function Step7Refinement({ state, context, onAddRefinement, onConfirm, onBack }: Props) {
  const [currentShortTerm, setCurrentShortTerm] = useState(state.shortTermGoals || '')
  const [currentCapability, setCurrentCapability] = useState(state.capabilityGoals || '')
  const [targetField, setTargetField] = useState<RefinementTarget>('both')
  const [feedback, setFeedback] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [count, setCount] = useState(state.refinementCount)
  const [messages, setMessages] = useState<ChatMessage[]>(state.refinementMessages)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [copied, setCopied] = useState<'shortTerm' | 'capability' | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleCopy = async (text: string, field: 'shortTerm' | 'capability') => {
    await navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleSendFeedback = async () => {
    if (!feedback.trim() || isStreaming) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const userMessage: ChatMessage = { role: 'user', content: feedback }
    const updatedMessages = [...messages, userMessage]

    setIsStreaming(true)
    setFeedback('')

    try {
      const res = await fetch(
        `/api/members/${encodeURIComponent(context.memberName)}/goals/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            memberContext: context.memberProfile,
            managerInput: state.managerInput,
            memberInput: state.memberInput,
            previousPeriod: state.previousPeriod.previousGoals ? state.previousPeriod : undefined,
            diagnosis: state.diagnosis,
            refinementMessages: updatedMessages,
            targetField,
            shortTermGoals: currentShortTerm,
            capabilityGoals: currentCapability,
          }),
        },
      )

      if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream')) {
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
              if (targetField === 'shortTerm' || targetField === 'both') {
                if (fields.shortTerm) setCurrentShortTerm(fields.shortTerm)
              }
              if (targetField === 'capability' || targetField === 'both') {
                if (fields.capability) setCurrentCapability(fields.capability)
              }
            }
          } catch {}
        }
      }

      // Use final parsed values (not stale React state from closure)
      const finalFields = parseGoalFields(accumulated)
      const newShortTerm = (targetField === 'shortTerm' || targetField === 'both') && finalFields.shortTerm
        ? finalFields.shortTerm
        : currentShortTerm
      const newCapability = (targetField === 'capability' || targetField === 'both') && finalFields.capability
        ? finalFields.capability
        : currentCapability

      setCurrentShortTerm(newShortTerm)
      setCurrentCapability(newCapability)

      const assistantMessage: ChatMessage = { role: 'assistant', content: accumulated }
      const finalMessages = [...updatedMessages, assistantMessage]
      const newCount = count + 1

      setMessages(finalMessages)
      setCount(newCount)
      onAddRefinement(finalMessages, newShortTerm, newCapability, newCount)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
    } finally {
      if (!controller.signal.aborted) {
        setIsStreaming(false)
      }
      abortRef.current = null
    }
  }

  const handleConfirm = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const fullMarkdown = assembleGoalMarkdown(currentShortTerm, currentCapability)
      const res = await fetch(
        `/api/members/${encodeURIComponent(context.memberName)}/goals`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: fullMarkdown,
            period: context.targetPeriod,
          }),
        },
      )
      if (!res.ok) throw new Error('save failed')
      setSaved(true)
      onConfirm(fullMarkdown)
    } catch {
      setSaveError('保存に失敗しました。もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-3">壁打ち・精緻化</h2>
      <p className="text-xl text-gray-500 mb-8">
        内容を確認し、修正が必要な場合はフィードバックを送ってください。（推奨 {count}/2回）
      </p>

      {/* ① 短期成果評価パネル */}
      <div className="border border-gray-200 rounded-xl mb-6 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 bg-blue-50 border-b border-gray-200">
          <span className="text-lg font-semibold text-blue-800">① 短期成果評価_目標</span>
          <button
            onClick={() => handleCopy(currentShortTerm, 'shortTerm')}
            disabled={!currentShortTerm}
            className="px-4 py-1.5 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-40 transition-colors"
          >
            {copied === 'shortTerm' ? 'コピーしました ✓' : 'コピー'}
          </button>
        </div>
        <div className="p-6 bg-white min-h-[100px]">
          <MarkdownRenderer content={currentShortTerm} />
          {isStreaming && (targetField === 'shortTerm' || targetField === 'both') && (
            <span className="inline-block w-2 h-5 bg-brand-500 animate-pulse ml-1" />
          )}
        </div>
      </div>

      {/* ② 発揮能力評価パネル */}
      <div className="border border-gray-200 rounded-xl mb-8 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 bg-green-50 border-b border-gray-200">
          <span className="text-lg font-semibold text-green-800">② 発揮能力評価_目標</span>
          <button
            onClick={() => handleCopy(currentCapability, 'capability')}
            disabled={!currentCapability}
            className="px-4 py-1.5 text-sm border border-green-300 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-40 transition-colors"
          >
            {copied === 'capability' ? 'コピーしました ✓' : 'コピー'}
          </button>
        </div>
        <div className="p-6 bg-white min-h-[100px]">
          <MarkdownRenderer content={currentCapability} />
          {isStreaming && (targetField === 'capability' || targetField === 'both') && (
            <span className="inline-block w-2 h-5 bg-brand-500 animate-pulse ml-1" />
          )}
        </div>
      </div>

      {/* フィードバックエリア */}
      {count < 2 && !saved && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-6">
          <p className="text-lg font-medium text-gray-700 mb-4">修正するフィールドを選んでください</p>
          <div className="flex gap-4 mb-5">
            {(['both', 'shortTerm', 'capability'] as RefinementTarget[]).map((field) => (
              <button
                key={field}
                onClick={() => setTargetField(field)}
                className={`px-5 py-2.5 text-base rounded-xl border transition-colors ${
                  targetField === field
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {field === 'both' ? '両方' : field === 'shortTerm' ? '① 短期成果' : '② 発揮能力'}
              </button>
            ))}
          </div>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="修正の方向性や具体的な要望を入力してください..."
            rows={3}
            className="w-full border border-gray-200 rounded-xl bg-white px-5 py-3 text-xl focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none mb-4"
          />
          <div className="flex justify-end">
            <button
              onClick={handleSendFeedback}
              disabled={!feedback.trim() || isStreaming}
              className="px-10 py-3 text-xl bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {isStreaming ? '再生成中...' : '再生成する'}
            </button>
          </div>
        </div>
      )}

      {count >= 2 && !saved && (
        <p className="text-base text-amber-600 mb-6 text-center">
          推奨回数（2回）に達しました。内容を確認して確定してください。
        </p>
      )}

      {saveError && <p className="text-red-500 text-center mb-4">{saveError}</p>}

      {!saved && (
        <div className="flex justify-end gap-4">
          <button onClick={onBack} className="px-10 py-3.5 text-xl border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors">
            戻る
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || !currentShortTerm || !currentCapability}
            className="px-10 py-3.5 text-xl bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-glow"
          >
            {saving ? '保存中...' : '確定・保存する'}
          </button>
        </div>
      )}

      {saved && (
        <div className="text-center py-10">
          <p className="text-3xl text-green-600 font-bold mb-3">目標を保存しました</p>
          <p className="text-xl text-gray-500">カオナビへのコピーが完了したらウィザードを閉じてください。</p>
        </div>
      )}
    </div>
  )
}
