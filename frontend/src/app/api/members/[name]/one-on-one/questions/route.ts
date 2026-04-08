import { NextRequest, NextResponse } from 'next/server'
import { callClaude, hasApiKey } from '@/lib/ai/call-claude'
import { buildQuestionsSystemPrompt, buildQuestionsUserMessage } from '@/lib/prompts/one-on-one-questions'

export const dynamic = 'force-dynamic'

const FALLBACK_QUESTIONS = [
  { question: '前回から今日までの間で、一番手応えを感じた瞬間はどんな時でしたか？', intent: '成功体験の言語化を通じてモチベーションの源泉を把握する' },
  { question: '今の業務の中で「もっとこうだったらスムーズなのに」と感じることはありますか？', intent: '業務上のブロッカーを支援視点で引き出す' },
  { question: '来月の自分に向けて、今月中にこれだけはやっておきたいと思うことは何ですか？', intent: '本人の優先度認識を確認し、アクション設定につなげる' },
]

function extractJsonArray(text: string): unknown[] | null {
  try { return JSON.parse(text) } catch {}
  const match = text.match(/\[[\s\S]*\]/)
  if (match) { try { return JSON.parse(match[0]) } catch {} }
  return null
}

export async function POST(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const t0 = Date.now()
    console.log(`[PERF] one-on-one/questions 開始`)

    if (!hasApiKey()) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 503 })
    }

    const body = await req.json()
    const systemPrompt = buildQuestionsSystemPrompt()
    const userMessage = buildQuestionsUserMessage({
      memberName: decodeURIComponent(params.name),
      goalProgress: body.goalProgress || [],
      actionReviews: body.actionReviews || [],
      condition: body.condition || {},
      previousCondition: body.previousCondition || null,
      previousSummary: body.previousSummary || '',
      orgPolicy: body.orgPolicy || '',
    })
    console.log(`[PERF] one-on-one/questions プロンプト構築完了: ${Date.now() - t0}ms`)

    const result = await callClaude({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 1024,
    })
    console.log(`[PERF] one-on-one/questions Claude応答完了: ${Date.now() - t0}ms`)

    const parsed = extractJsonArray(result.content)
    if (parsed && Array.isArray(parsed)) {
      console.log(`[PERF] one-on-one/questions 処理完了: ${Date.now() - t0}ms`)
      return NextResponse.json({ questions: parsed, mode: 'live' })
    }

    // Fallback if AI response can't be parsed
    console.log(`[PERF] one-on-one/questions 処理完了(fallback): ${Date.now() - t0}ms`)
    return NextResponse.json({ questions: FALLBACK_QUESTIONS, mode: 'live' })
  } catch (error) {
    console.error('Questions API error:', error)
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
  }
}
