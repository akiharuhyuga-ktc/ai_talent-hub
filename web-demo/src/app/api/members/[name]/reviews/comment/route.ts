import { NextRequest, NextResponse } from 'next/server'
import { callClaudeStream, createSSEResponse, hasApiKey } from '@/lib/ai/call-claude'
import { buildEvaluationCommentSystemPrompt, buildEvaluationCommentUserMessage } from '@/lib/prompts/evaluation-comment'
import { loadSharedDocs } from '@/lib/fs/shared-docs'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const t0 = Date.now()
    console.log(`[PERF] reviews/comment 開始`)

    if (!hasApiKey()) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 503 })
    }

    const body = await req.json()
    const shared = loadSharedDocs()
    const baseSystemPrompt = buildEvaluationCommentSystemPrompt()
    const systemPrompt = shared.orgPolicy
      ? `${baseSystemPrompt}\n\n## 参考：組織方針\n${shared.orgPolicy.slice(0, 1000)}`
      : baseSystemPrompt
    const userMessage = buildEvaluationCommentUserMessage({
      memberName: decodeURIComponent(params.name),
      goalEvaluations: body.goalEvaluations || [],
      overallGrade: body.overallGrade || '',
      overallRationale: body.overallRationale || '',
      selfEvalGap: body.selfEvalGap || '',
      selfEvaluation: body.selfEvaluation || { score: '', achievementComment: '', reflectionComment: '' },
    })
    console.log(`[PERF] reviews/comment プロンプト構築完了: ${Date.now() - t0}ms`)

    const stream = callClaudeStream({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 512,
      signal: req.signal,
    })

    console.log(`[PERF] reviews/comment ストリーミング開始: ${Date.now() - t0}ms`)
    return createSSEResponse(stream)
  } catch (error) {
    console.error('Evaluation comment API error:', error)
    return NextResponse.json({ error: 'Failed to generate comment' }, { status: 500 })
  }
}
