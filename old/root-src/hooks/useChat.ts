'use client'

import { useState, useCallback } from 'react'
import type { ChatMessage } from '@/lib/types'

interface UseChatOptions {
  memberName?: string
  memberContext?: string
}

export function useChat({ memberName, memberContext }: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<'mock' | 'live' | null>(null)

  const sendMessage = useCallback(async (content: string) => {
    const userMessage: ChatMessage = { role: 'user', content }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages,
          memberName,
          memberContext,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setMode(data.mode)
      setMessages(prev => [...prev, { role: 'assistant', content: data.content }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'エラーが発生しました。しばらくしてから再度お試しください。',
      }])
    } finally {
      setIsLoading(false)
    }
  }, [messages, memberName, memberContext])

  const reset = useCallback(() => {
    setMessages([])
    setMode(null)
  }, [])

  return { messages, isLoading, mode, sendMessage, reset }
}
