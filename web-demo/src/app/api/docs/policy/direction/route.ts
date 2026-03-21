import { NextRequest, NextResponse } from 'next/server'
import { callClaude, hasApiKey } from '@/lib/ai/call-claude'
import {
  buildContinuousDirectionSystemPrompt,
  buildContinuousDirectionUserMessage,
  buildInitialDirectionSystemPrompt,
  buildInitialDirectionUserMessage,
} from '@/lib/prompts/policy-direction'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
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

    const result = await callClaude({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 2048,
    })

    return NextResponse.json({ direction: result.content, mode: 'live' })
  } catch (error) {
    console.error('Policy direction API error:', error)
    return NextResponse.json({ error: 'Failed to generate direction' }, { status: 500 })
  }
}
