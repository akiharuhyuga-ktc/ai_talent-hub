'use client'

import { useState, useRef, useEffect } from 'react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { clsx } from 'clsx'
import { MessageCircle, Send } from 'lucide-react'
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
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: fullText }
                return updated
              })
            }
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
    <div className="h-full flex flex-col">
      {/* Split layout — full width */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT: Editor pane */}
        <div className="w-[55%] flex flex-col min-h-0 p-8 bg-white">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-2xl font-semibold text-gray-900">組織方針（編集中）</h2>
            <button
              onClick={() => onNext(editorContent)}
              disabled={isStreaming}
              className="px-6 py-2.5 bg-brand-600 text-white rounded-xl text-lg font-semibold hover:bg-brand-700 transition-colors disabled:opacity-40 shadow-glow"
            >
              この内容で確定する
            </button>
          </div>
          <textarea
            value={editorContent}
            onChange={e => handleEditorChange(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl bg-surface-alt px-6 py-5 text-xl font-mono resize-none focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-400"
            spellCheck={false}
          />
        </div>

        {/* RIGHT: Chat pane */}
        <div className="w-[45%] flex flex-col bg-surface border-l border-gray-200">
          {/* Chat header */}
          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-gray-200">
            <MessageCircle size={18} className="text-brand-600" />
            <span className="text-xl font-semibold text-gray-900">AIと壁打ち</span>
            <span className="ml-auto text-lg bg-brand-50 text-brand-600 px-3 py-1 rounded-full font-medium">
              {roundCount}/{MAX_ROUNDS}回
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.length === 0 && (
              <p className="text-lg text-gray-400 text-center mt-12">
                方針についてAIに質問やフィードバックを求めましょう
              </p>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={clsx(
                  'flex',
                  msg.role === 'user' ? 'justify-end' : 'justify-start gap-2.5'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-300 to-brand-600 flex items-center justify-center shrink-0 mt-1">
                    <span className="text-white text-xs font-bold">AI</span>
                  </div>
                )}
                <div className={clsx(
                  'max-w-[85%] px-4 py-3 text-lg',
                  msg.role === 'user'
                    ? 'bg-brand-600 text-white rounded-2xl rounded-br-sm'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-tl-sm'
                )}>
                  {msg.role === 'user' ? (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  ) : (
                    <>
                      <MarkdownRenderer content={msg.content} className="prose-lg" />
                      {isStreaming && i === messages.length - 1 && (
                        <span className="inline-block w-2 h-5 bg-brand-500 animate-pulse ml-1" />
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-lg">
                {error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat input */}
          <div className="p-4 border-t border-gray-200">
            {roundCount >= MAX_ROUNDS ? (
              <p className="text-lg text-amber-600 text-center py-2">
                壁打ち回数の上限に達しました
              </p>
            ) : (
              <div className="flex gap-3 items-end">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="修正の指示を入力..."
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
                  disabled={isStreaming}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                  className="w-11 h-11 bg-brand-600 text-white rounded-xl flex items-center justify-center hover:bg-brand-700 transition-colors disabled:opacity-40 shrink-0"
                >
                  <Send size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-3 px-8 py-4 border-t border-gray-200 shrink-0">
        <button
          onClick={onBack}
          className="px-8 py-3 text-lg border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
        >
          戻る
        </button>
      </div>
    </div>
  )
}
