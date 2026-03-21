import { NextRequest, NextResponse } from 'next/server'
import { callClaude, hasApiKey } from '@/lib/ai/call-claude'
import { buildPolicyRefineSystemPrompt } from '@/lib/prompts/policy-refine'
import type { ChatMessage } from '@/lib/types'

export const dynamic = 'force-dynamic'

function extractMarkdownBlock(text: string): string | null {
  const match = text.match(/```markdown\n([\s\S]*?)```/)
  return match ? match[1].trim() : null
}

export async function POST(req: NextRequest) {
  try {
    if (!hasApiKey()) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 503 })
    }

    const { currentContent, messages } = await req.json()
    if (!currentContent || !messages) {
      return NextResponse.json({ error: 'currentContent and messages are required' }, { status: 400 })
    }

    const systemPrompt = buildPolicyRefineSystemPrompt(currentContent)

    const result = await callClaude({
      systemPrompt,
      messages: messages as ChatMessage[],
      maxTokens: 4096,
    })

    const updatedPolicy = extractMarkdownBlock(result.content)

    return NextResponse.json({
      reply: result.content,
      updatedPolicy,
      mode: 'live',
    })
  } catch (error) {
    console.error('Policy refine API error:', error)
    return NextResponse.json({ error: 'Failed to refine policy' }, { status: 500 })
  }
}
