import { NextRequest, NextResponse } from 'next/server'
import { callClaudeStream, createSSEResponse, hasApiKey } from '@/lib/ai/call-claude'
import {
  buildContinuousDirectionSystemPrompt,
  buildContinuousDirectionUserMessage,
  buildInitialDirectionSystemPrompt,
  buildInitialDirectionUserMessage,
} from '@/lib/prompts/policy-direction'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const t0 = Date.now()
    console.log(`[PERF] docs/policy/direction 開始`)

    if (!hasApiKey()) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 503 })
    }

    const body = await req.json()
    const { mode } = body

    if (mode !== 'continuous' && mode !== 'initial') {
      return NextResponse.json({ error: 'mode must be "continuous" or "initial"' }, { status: 400 })
    }

    let systemPrompt: string
    let userMessage: string

    if (mode === 'continuous') {
      systemPrompt = buildContinuousDirectionSystemPrompt()
      userMessage = buildContinuousDirectionUserMessage({
        prevContent: body.prevContent || '',
        whatWorked: body.whatWorked || '',
        whatDidntWork: body.whatDidntWork || '',
        leftBehind: body.leftBehind || '',
        envChanges: body.envChanges || '',
        techChanges: body.techChanges || '',
        focusThemes: body.focusThemes || '',
      })
    } else {
      systemPrompt = buildInitialDirectionSystemPrompt()
      userMessage = buildInitialDirectionUserMessage({
        teamInfo: body.teamInfo || '',
        techDomains: body.techDomains || '',
        challenges: body.challenges || '',
        strengths: body.strengths || '',
        mission: body.mission || '',
        themes: body.themes || '',
        upperOrgPolicy: body.upperOrgPolicy || '',
      })
    }
    console.log(`[PERF] docs/policy/direction プロンプト構築完了: ${Date.now() - t0}ms`)

    const stream = callClaudeStream({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 2048,
      signal: req.signal,
    })

    console.log(`[PERF] docs/policy/direction ストリーミング開始: ${Date.now() - t0}ms`)
    return createSSEResponse(stream)
  } catch (error) {
    console.error('Policy direction API error:', error)
    return NextResponse.json({ error: 'Failed to generate direction' }, { status: 500 })
  }
}
