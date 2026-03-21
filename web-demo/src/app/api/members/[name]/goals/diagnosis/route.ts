import { NextRequest, NextResponse } from 'next/server'
import { callClaude, hasApiKey } from '@/lib/ai/call-claude'
import { loadSharedDocs } from '@/lib/fs/shared-docs'
import { buildDiagnosisSystemPrompt, buildDiagnosisUserMessage } from '@/lib/prompts/diagnosis'

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
    const systemPrompt = buildDiagnosisSystemPrompt()
    const userMessage = buildDiagnosisUserMessage({
      memberName: decodeURIComponent(params.name),
      memberProfile: body.memberContext || '',
      departmentPolicy: shared.policy,
      evaluationCriteria: shared.criteria,
      managerInput: body.managerInput,
      memberInput: body.memberInput,
      previousPeriod: body.previousPeriod,
    })

    const result = await callClaude({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 1024,
    })

    return NextResponse.json({ diagnosis: result.content, mode: 'live' })
  } catch (error) {
    console.error('Diagnosis API error:', error)
    return NextResponse.json({ error: 'Failed to generate diagnosis' }, { status: 500 })
  }
}
