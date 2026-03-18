import { NextRequest, NextResponse } from 'next/server'
import { getMockResponse } from '@/lib/mock/responses'
import type { ChatRequest } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json()
    const { messages, memberName, memberContext } = body
    const lastUserMessage = messages.filter(m => m.role === 'user').at(-1)?.content ?? ''

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      // Mock mode: return pre-crafted response
      await new Promise(r => setTimeout(r, 700))
      const reply = getMockResponse(lastUserMessage, memberName)
      return NextResponse.json({ content: reply, mode: 'mock' })
    }

    // Live mode: call Claude API
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey })

    const systemPrompt = [
      'あなたはAIタレントマネジメント秘書です。',
      'マネージャーの意思決定を支援することが役割で、評価の最終判断は行いません。',
      '事実ベースで提案し、主観的・推測的な表現は避けます。',
      '出力は日本語で行ってください。',
      memberContext ? `\n## 対象メンバーの情報\n${memberContext}` : '',
    ].filter(Boolean).join('\n')

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    const content = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ content, mode: 'live' })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: 'Failed to get AI response' }, { status: 500 })
  }
}
