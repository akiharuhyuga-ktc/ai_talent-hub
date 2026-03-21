'use client'

import { useState, useRef, useEffect } from 'react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { clsx } from 'clsx'
import type { ChatMessage } from '@/lib/types'
import type { PolicyWizardState } from '../PolicyWizard'

const MAX_ROUNDS = 5

interface PolicyStep6RefineProps {
  state: PolicyWizardState
  onContentUpdate: (content: string) => void
  onNext: (finalContent: string) => void
  onBack: () => void
}

export function PolicyStep6Refine({ state, onContentUpdate, onNext, onBack }: PolicyStep6RefineProps) {
  const [editorContent, setEditorContent] = useState(state.currentDraft)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [roundCount, setRoundCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleEditorChange = (value: string) => {
    setEditorContent(value)
    onContentUpdate(value)
  }

  const handleSend = async () => {
    if (!input.trim() || loading || roundCount >= MAX_ROUNDS) return

    const userMessage: ChatMessage = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/docs/policy/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentContent: editorContent,
          messages: newMessages,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '壁打ちに失敗しました')
      }

      const data = await res.json()

      const assistantMessage: ChatMessage = { role: 'assistant', content: data.reply }
      setMessages(prev => [...prev, assistantMessage])
      setRoundCount(prev => prev + 1)

      if (data.updatedPolicy) {
        setEditorContent(data.updatedPolicy)
        onContentUpdate(data.updatedPolicy)
      }
    } catch {
      setError('通信に失敗しました。再度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-3">壁打ち</h2>
      <p className="text-xl text-gray-500 mb-2">
        左側のエディタで方針を直接編集し、右側のチャットでAIにフィードバックを求められます
      </p>
      <p className="text-lg text-gray-400 mb-6">
        <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
          壁打ち: {roundCount}/{MAX_ROUNDS}回
        </span>
      </p>

      {/* Split layout */}
      <div className="flex gap-6 h-[600px]">
        {/* LEFT: Markdown editor (60%) */}
        <div className="w-[60%] flex flex-col">
          <label className="text-xl font-medium text-gray-700 mb-2">
            {state.targetYear}年度 組織方針（Markdown）
          </label>
          <textarea
            value={editorContent}
            onChange={e => handleEditorChange(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-5 py-4 text-xl font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
            spellCheck={false}
          />
        </div>

        {/* RIGHT: Chat panel (40%) */}
        <div className="w-[40%] flex flex-col border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
          {/* Chat header */}
          <div className="px-5 py-3 border-b border-gray-200 bg-white">
            <span className="text-xl font-medium text-gray-700">AI壁打ち</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <p className="text-lg text-gray-400 text-center mt-8">
                方針についてAIに質問やフィードバックを求めましょう
              </p>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={clsx(
                  'flex',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div className={clsx(
                  'max-w-[90%] rounded-xl px-4 py-3 text-lg',
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-900'
                )}>
                  {msg.role === 'user' ? (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  ) : (
                    <MarkdownRenderer content={msg.content} className="prose-lg" />
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" />
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-lg">
                {error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat input */}
          <div className="p-4 border-t border-gray-200 bg-white">
            {roundCount >= MAX_ROUNDS ? (
              <p className="text-lg text-amber-600 text-center py-2">
                壁打ち回数の上限に達しました
              </p>
            ) : (
              <>
                <div className="flex gap-2">
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="AIへのフィードバックを入力..."
                    rows={2}
                    className="flex-1 resize-none rounded-lg border border-gray-200 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    disabled={loading}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || loading}
                    className="px-4 py-3 bg-indigo-600 text-white rounded-lg text-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed self-end"
                  >
                    送信
                  </button>
                </div>
                <p className="text-sm text-gray-400 mt-1">Shift+Enter で送信</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-3 mt-8">
        <button
          onClick={onBack}
          className="flex-1 py-4 text-xl border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          戻る
        </button>
        <button
          onClick={() => onNext(editorContent)}
          className="flex-1 py-4 text-xl bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
        >
          この内容で確定する
        </button>
      </div>
    </div>
  )
}
