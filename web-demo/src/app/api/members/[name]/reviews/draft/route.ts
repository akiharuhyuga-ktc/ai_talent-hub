import { NextRequest, NextResponse } from 'next/server'
import { callClaude, hasApiKey } from '@/lib/ai/call-claude'
import { loadSharedDocs } from '@/lib/fs/shared-docs'
import { buildEvaluationDraftSystemPrompt, buildEvaluationDraftUserMessage } from '@/lib/prompts/evaluation-draft'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function extractJson(text: string): unknown | null {
  try { return JSON.parse(text) } catch {}
  // Match the last complete JSON object (most likely the intended output)
  const matches: RegExpExecArray[] = []
  const re = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) matches.push(m)
  if (matches.length > 0) {
    for (let i = matches.length - 1; i >= 0; i--) {
      try { return JSON.parse(matches[i][0]) } catch {}
    }
  }
  return null
}

export async function POST(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const t0 = Date.now()
    console.log(`[PERF] reviews/draft 開始`)

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
    console.log(`[PERF] reviews/draft プロンプト構築完了: ${Date.now() - t0}ms`)

    const result = await callClaude({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 4096,
    })
    console.log(`[PERF] reviews/draft Claude応答完了: ${Date.now() - t0}ms`)

    const parsed = extractJson(result.content)
    if (parsed) {
      console.log(`[PERF] reviews/draft 処理完了: ${Date.now() - t0}ms`)
      return NextResponse.json({ draft: parsed, mode: 'live' })
    }

    console.log(`[PERF] reviews/draft パース失敗: ${Date.now() - t0}ms`)
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  } catch (error) {
    console.error('Evaluation draft API error:', error)
    return NextResponse.json({ error: 'Failed to generate evaluation draft' }, { status: 500 })
  }
}
