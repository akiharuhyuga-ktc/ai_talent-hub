'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@/hooks/useChat'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { clsx } from 'clsx'

interface ChatSidebarProps {
  memberName?: string
  memberContext?: string
}

const QUICK_ACTIONS = [
  '目標設定を提案して',
  '1on1の準備をして',
  '評価ドラフトを作って',
  'チーム全体を俯瞰して',
]

export function ChatSidebar({ memberName, memberContext }: ChatSidebarProps) {
  const [input, setInput] = useState('')
  const { messages, isLoading, mode, sendMessage, reset } = useChat({ memberName, memberContext })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    const msg = input.trim()
    setInput('')
    await sendMessage(msg)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-2xl font-semibold text-gray-900">AIアシスタント</span>
          {mode === 'mock' && (
            <span className="text-lg bg-orange-100 text-orange-600 px-3 py-1 rounded-full border border-orange-200">
              デモモード
            </span>
          )}
          {mode === 'live' && (
            <span className="text-lg bg-green-100 text-green-700 px-3 py-1 rounded-full border border-green-200">
              Claude API 接続中
            </span>
          )}
          {mode === null && (
            <span className="text-lg bg-orange-100 text-orange-600 px-3 py-1 rounded-full border border-orange-200">
              デモモード
            </span>
          )}
        </div>
        {messages.length > 0 && (
          <button
            onClick={reset}
            className="text-xl text-gray-400 hover:text-gray-600 transition-colors"
          >
            クリア
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {messages.length === 0 && (
          <div>
            <p className="text-xl text-gray-400 text-center mb-5">
              {memberName ? `${memberName}さんについて` : 'チームについて'}AIに相談できます
            </p>
            <div className="space-y-3">
              {QUICK_ACTIONS.map(action => (
                <button
                  key={action}
                  onClick={() => sendMessage(action)}
                  disabled={isLoading}
                  className="w-full text-left text-xl text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl px-5 py-4 transition-colors border border-indigo-100 font-medium"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
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
              'max-w-[90%] rounded-xl px-5 py-4 text-xl',
              msg.role === 'user'
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-900'
            )}>
              {msg.role === 'user' ? (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              ) : (
                <MarkdownRenderer content={msg.content} />
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
              <div className="flex gap-2">
                <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-6 border-t border-gray-200">
        <div className="flex gap-3">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="AIに依頼する内容を入力..."
            rows={3}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed self-end"
          >
            送信
          </button>
        </div>
        <p className="text-lg text-gray-400 mt-2">Enter で送信 / Shift+Enter で改行</p>
      </div>
    </div>
  )
}
