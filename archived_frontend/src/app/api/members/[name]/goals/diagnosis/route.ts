import { NextRequest, NextResponse } from 'next/server'
import { callClaudeStream, createSSEResponse, hasApiKey } from '@/lib/ai/call-claude'
import { loadSharedDocs } from '@/lib/fs/shared-docs'
import { buildDiagnosisSystemPrompt, buildDiagnosisUserMessage } from '@/lib/prompts/diagnosis'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const t0 = Date.now()
    console.log(`[PERF] goals/diagnosis 開始`)

    if (!hasApiKey()) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 503 })
    }

    const body = await req.json()
    const shared = loadSharedDocs()
    const systemPrompt = buildDiagnosisSystemPrompt()
    const userMessage = buildDiagnosisUserMessage({
      memberName: decodeURIComponent(params.name),
      memberProfile: body.memberContext || '',
      orgPolicy: shared.policy,
      evaluationCriteria: shared.criteria,
      managerInput: body.managerInput,
      memberInput: body.memberInput,
      previousPeriod: body.previousPeriod,
    })
    console.log(`[PERF] goals/diagnosis プロンプト構築完了: ${Date.now() - t0}ms`)

    const stream = callClaudeStream({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 1024,
      signal: req.signal,
    })

    console.log(`[PERF] goals/diagnosis ストリーミング開始: ${Date.now() - t0}ms`)
    return createSSEResponse(stream)
  } catch (error) {
    console.error('Diagnosis API error:', error)
    return NextResponse.json({ error: 'Failed to generate diagnosis' }, { status: 500 })
  }
}
