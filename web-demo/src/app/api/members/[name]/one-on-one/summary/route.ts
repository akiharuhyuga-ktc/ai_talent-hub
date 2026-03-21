import { NextRequest, NextResponse } from 'next/server'
import { callClaude, hasApiKey } from '@/lib/ai/call-claude'
import { buildSummarySystemPrompt, buildSummaryUserMessage } from '@/lib/prompts/one-on-one-summary'

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
    const systemPrompt = buildSummarySystemPrompt()
    const userMessage = buildSummaryUserMessage({
      memberName: decodeURIComponent(params.name),
      yearMonth: body.yearMonth || '',
      actionReviews: body.actionReviews || [],
      goalProgress: body.goalProgress || [],
      condition: body.condition || {},
      previousCondition: body.previousCondition || null,
      hearingMemos: body.hearingMemos || [],
      nextActions: body.nextActions || [],
    })

    const result = await callClaude({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 1024,
    })

    return NextResponse.json({ summary: result.content, mode: 'live' })
  } catch (error) {
    console.error('Summary API error:', error)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
