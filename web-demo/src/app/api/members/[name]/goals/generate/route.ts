import { NextRequest, NextResponse } from 'next/server'
import { callClaude, hasApiKey } from '@/lib/ai/call-claude'
import { loadSharedDocs } from '@/lib/fs/shared-docs'
import { buildGoalGenerationSystemPrompt, buildGoalGenerationUserMessage } from '@/lib/prompts/goal-generation'
import type { ChatMessage } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    if (!hasApiKey()) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 503 })
    }

    const body = await req.json()
    const shared = loadSharedDocs()
    const systemPrompt = buildGoalGenerationSystemPrompt()

    const baseMessage = buildGoalGenerationUserMessage({
      memberName: decodeURIComponent(params.name),
      memberProfile: body.memberContext || '',
      orgPolicy: shared.policy,
      evaluationCriteria: shared.criteria,
      managerInput: body.managerInput,
      memberInput: body.memberInput,
      previousPeriod: body.previousPeriod,
      diagnosis: body.diagnosis,
    })

    const messages: ChatMessage[] = [{ role: 'user', content: baseMessage }]

    if (body.refinementMessages && body.refinementMessages.length > 0) {
      for (const msg of body.refinementMessages) {
        messages.push({ role: msg.role, content: msg.content })
      }
    }

    const result = await callClaude({
      systemPrompt,
      messages,
      maxTokens: 4096,
    })

    return NextResponse.json({ goals: result.content, mode: 'live' })
  } catch (error) {
    console.error('Goal generation API error:', error)
    return NextResponse.json({ error: 'Failed to generate goals' }, { status: 500 })
  }
}
