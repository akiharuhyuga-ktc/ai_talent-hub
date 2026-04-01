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
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState('')
  const [roundCount, setRoundCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  const handleEditorChange = (value: string) => {
    setEditorContent(value)
    onContentUpdate(value)
  }

  const handleSend = async () => {
    if (!input.trim() || isStreaming || roundCount >= MAX_ROUNDS) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const userMessage: ChatMessage = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsStreaming(true)
    setError('')

    // アシスタントのプレースホルダーを追加
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/docs/policy/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentContent: editorContent,
          messages: newMessages,
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream')) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '壁打ちに失敗しました')
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
              // 最後のメッセージ（アシスタント）を更新
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: fullText }
                return updated
              })
            }
            // ストリーム完了後にupdatedPolicyイベントが来る
            if (parsed.updatedPolicy) {
              setEditorContent(parsed.updatedPolicy)
              onContentUpdate(parsed.updatedPolicy)
            }
          } catch {}
        }
      }

      setRoundCount(prev => prev + 1)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError('通信に失敗しました。再度お試しください。')
      // プレースホルダーを削除
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setIsStreaming(false)
      abortRef.current = null
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
                    <>
                      <MarkdownRenderer content={msg.content} className="prose-lg" />
                      {isStreaming && i === messages.length - 1 && (
                        <span className="inline-block w-2 h-4 bg-indigo-500 animate-pulse ml-1" />
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

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
                    disabled={isStreaming}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isStreaming}
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
          disabled={isStreaming}
          className="flex-1 py-4 text-xl bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40"
        >
          この内容で確定する
        </button>
      </div>
    </div>
  )
}
