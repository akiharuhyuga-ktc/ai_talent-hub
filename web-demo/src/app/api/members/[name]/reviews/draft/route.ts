import { NextRequest, NextResponse } from 'next/server'
import { callClaude, hasApiKey } from '@/lib/ai/call-claude'
import { loadSharedDocs } from '@/lib/fs/shared-docs'
import { buildEvaluationDraftSystemPrompt, buildEvaluationDraftUserMessage } from '@/lib/prompts/evaluation-draft'

export const dynamic = 'force-dynamic'

function extractJson(text: string): unknown | null {
  try { return JSON.parse(text) } catch {}
  const match = text.match(/\{[\s\S]*\}/)
  if (match) { try { return JSON.parse(match[0]) } catch {} }
  return null
}

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
    const systemPrompt = buildEvaluationDraftSystemPrompt()
    const userMessage = buildEvaluationDraftUserMessage({
      memberName: decodeURIComponent(params.name),
      memberProfile: body.memberProfile || '',
      evaluationCriteria: shared.criteria,
      goalsRawMarkdown: body.goalsRawMarkdown || '',
      oneOnOneSummaries: body.oneOnOneSummaries || '',
      selfEvaluation: body.selfEvaluation || { score: '', achievementComment: '', reflectionComment: '' },
      managerSupplementary: body.managerSupplementary || { notableEpisodes: '', environmentChanges: '' },
    })

    const result = await callClaude({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 4096,
    })

    const parsed = extractJson(result.content)
    if (parsed) {
      return NextResponse.json({ draft: parsed, mode: 'live' })
    }

    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  } catch (error) {
    console.error('Evaluation draft API error:', error)
    return NextResponse.json({ error: 'Failed to generate evaluation draft' }, { status: 500 })
  }
}
