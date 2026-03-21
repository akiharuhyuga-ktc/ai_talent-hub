import { NextRequest, NextResponse } from 'next/server'
import { callClaude, hasApiKey } from '@/lib/ai/call-claude'
import { buildEvaluationCommentSystemPrompt, buildEvaluationCommentUserMessage } from '@/lib/prompts/evaluation-comment'

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
    const systemPrompt = buildEvaluationCommentSystemPrompt()
    const userMessage = buildEvaluationCommentUserMessage({
      memberName: decodeURIComponent(params.name),
      goalEvaluations: body.goalEvaluations || [],
      overallGrade: body.overallGrade || '',
      overallRationale: body.overallRationale || '',
      selfEvalGap: body.selfEvalGap || '',
      selfEvaluation: body.selfEvaluation || { score: '', achievementComment: '', reflectionComment: '' },
    })

    const result = await callClaude({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 512,
    })

    return NextResponse.json({ comment: result.content, mode: 'live' })
  } catch (error) {
    console.error('Evaluation comment API error:', error)
    return NextResponse.json({ error: 'Failed to generate comment' }, { status: 500 })
  }
}
