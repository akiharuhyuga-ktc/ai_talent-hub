import { NextRequest, NextResponse } from 'next/server'
import { callClaude, hasApiKey } from '@/lib/ai/call-claude'
import { loadSharedDocs } from '@/lib/fs/shared-docs'
import type { ChatRequest } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    if (!hasApiKey()) {
      return NextResponse.json({ error: 'API key not configured. Set ANTHROPIC_FOUNDRY_API_KEY or ANTHROPIC_API_KEY in .env.local' }, { status: 503 })
    }

    const body: ChatRequest = await req.json()
    const { messages, memberContext } = body

    const shared = loadSharedDocs()
    const systemPrompt = [
      'あなたはAIタレントマネジメント秘書です。',
      'マネージャーの意思決定を支援することが役割で、評価の最終判断は行いません。',
      '事実ベースで提案し、主観的・推測的な表現は避けます。',
      '出力は日本語で行ってください。',
      shared.guidelines ? `\n## 運用ガイドライン（必ず遵守）\n${shared.guidelines}` : '',
      memberContext ? `\n## 対象メンバーの情報\n${memberContext}` : '',
    ].filter(Boolean).join('\n')

    const result = await callClaude({
      systemPrompt,
      messages,
      maxTokens: 1024,
    })

    return NextResponse.json({ content: result.content, mode: 'live' })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: 'Failed to get AI response' }, { status: 500 })
  }
}
