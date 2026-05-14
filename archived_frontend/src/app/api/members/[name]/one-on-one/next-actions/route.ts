import { NextRequest, NextResponse } from 'next/server'
import { callClaude, hasApiKey } from '@/lib/ai/call-claude'
import { buildNextActionsSystemPrompt, buildNextActionsUserMessage } from '@/lib/prompts/one-on-one-next-actions'

export const dynamic = 'force-dynamic'

function extractJsonArray(text: string): unknown[] | null {
  try { return JSON.parse(text) } catch {}
  const match = text.match(/\[[\s\S]*\]/)
  if (match) { try { return JSON.parse(match[0]) } catch {} }
  return null
}

export async function POST(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const t0 = Date.now()
    console.log(`[PERF] one-on-one/next-actions 開始`)

    if (!hasApiKey()) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 503 })
    }

    const body = await req.json()
    const today = new Date().toISOString().split('T')[0]
    const systemPrompt = buildNextActionsSystemPrompt()
    const userMessage = buildNextActionsUserMessage({
      memberName: decodeURIComponent(params.name),
      today,
      goalProgress: body.goalProgress || [],
      actionReviews: body.actionReviews || [],
      condition: body.condition || {},
      hearingMemos: body.hearingMemos || [],
      previousSummary: body.previousSummary || '',
    })
    console.log(`[PERF] one-on-one/next-actions プロンプト構築完了: ${Date.now() - t0}ms`)

    const result = await callClaude({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 1024,
    })
    console.log(`[PERF] one-on-one/next-actions Claude応答完了: ${Date.now() - t0}ms`)

    const parsed = extractJsonArray(result.content)
    if (parsed && Array.isArray(parsed)) {
      console.log(`[PERF] one-on-one/next-actions 処理完了: ${Date.now() - t0}ms`)
      return NextResponse.json({ actions: parsed, mode: 'live' })
    }

    return NextResponse.json({ actions: [], mode: 'live' })
  } catch (error) {
    console.error('Next actions API error:', error)
    return NextResponse.json({ error: 'Failed to generate next actions' }, { status: 500 })
  }
}
