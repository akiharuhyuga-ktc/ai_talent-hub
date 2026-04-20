import { NextRequest, NextResponse } from 'next/server'
import { callClaudeStream, createSSEResponse, hasApiKey } from '@/lib/ai/call-claude'
import { buildSummarySystemPrompt, buildSummaryUserMessage } from '@/lib/prompts/one-on-one-summary'
import { loadSharedDocs } from '@/lib/fs/shared-docs'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const t0 = Date.now()
    console.log(`[PERF] one-on-one/summary 開始`)

    if (!hasApiKey()) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 503 })
    }

    const body = await req.json()
    const shared = loadSharedDocs()
    const baseSystemPrompt = buildSummarySystemPrompt()
    const systemPrompt = shared.orgPolicy
      ? `${baseSystemPrompt}\n\n## 参考：組織方針（要点のみ参照）\n${shared.orgPolicy.slice(0, 1000)}`
      : baseSystemPrompt
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
    console.log(`[PERF] one-on-one/summary プロンプト構築完了: ${Date.now() - t0}ms`)

    const stream = callClaudeStream({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 1024,
      signal: req.signal,
    })

    console.log(`[PERF] one-on-one/summary ストリーミング開始: ${Date.now() - t0}ms`)
    return createSSEResponse(stream)
  } catch (error) {
    console.error('Summary API error:', error)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
