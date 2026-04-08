import { NextRequest, NextResponse } from 'next/server'
import { callClaudeStream, createSSEResponse, hasApiKey } from '@/lib/ai/call-claude'
import {
  buildContinuousDraftSystemPrompt,
  buildContinuousDraftUserMessage,
  buildInitialDraftSystemPrompt,
  buildInitialDraftUserMessage,
} from '@/lib/prompts/policy-draft'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const t0 = Date.now()
    console.log(`[PERF] docs/policy/draft 開始`)

    if (!hasApiKey()) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 503 })
    }

    const body = await req.json()
    const { mode, targetYear, confirmedDirection } = body

    if (!mode || !targetYear || !confirmedDirection) {
      return NextResponse.json({ error: 'mode, targetYear, confirmedDirection are required' }, { status: 400 })
    }

    let systemPrompt: string
    let userMessage: string

    if (mode === 'continuous') {
      systemPrompt = buildContinuousDraftSystemPrompt()
      userMessage = buildContinuousDraftUserMessage({
        targetYear,
        prevContent: body.prevContent || '',
        confirmedDirection,
        allInputs: body.allInputs || '',
      })
    } else {
      systemPrompt = buildInitialDraftSystemPrompt()
      userMessage = buildInitialDraftUserMessage({
        targetYear,
        confirmedDirection,
        orgInfo: body.orgInfo || '',
      })
    }
    console.log(`[PERF] docs/policy/draft プロンプト構築完了: ${Date.now() - t0}ms`)

    const stream = callClaudeStream({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 8192,
      signal: req.signal,
    })

    console.log(`[PERF] docs/policy/draft ストリーミング開始: ${Date.now() - t0}ms`)
    return createSSEResponse(stream)
  } catch (error) {
    console.error('Policy draft API error:', error)
    return NextResponse.json({ error: 'Failed to generate policy draft' }, { status: 500 })
  }
}
