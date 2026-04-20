import { NextRequest, NextResponse } from 'next/server'
import { callClaudeStream, createSSEResponse, hasApiKey } from '@/lib/ai/call-claude'
import { loadSharedDocs } from '@/lib/fs/shared-docs'
import { buildGoalEditSystemPrompt, buildGoalEditUserMessage } from '@/lib/prompts/goal-edit'

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
    const { goal, instruction, memberContext, allGoals } = body

    if (!goal || !instruction) {
      return NextResponse.json({ error: 'goal and instruction are required' }, { status: 400 })
    }

    const shared = loadSharedDocs()
    const systemPrompt = buildGoalEditSystemPrompt()
    const userMessage = buildGoalEditUserMessage({
      goal,
      instruction,
      memberContext: memberContext || '',
      orgPolicy: body.orgPolicy || shared.policy,
      evaluationCriteria: body.evaluationCriteria || shared.criteria,
      allGoals: allGoals || '',
    })

    const stream = callClaudeStream({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 2048,
      signal: req.signal,
    })

    return createSSEResponse(stream)
  } catch (error) {
    console.error('Goal edit API error:', error)
    return NextResponse.json({ error: 'Failed to edit goal' }, { status: 500 })
  }
}
