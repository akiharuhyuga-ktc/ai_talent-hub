import { NextRequest, NextResponse } from 'next/server'
import { callClaude, hasApiKey } from '@/lib/ai/call-claude'
import { buildQuestionsSystemPrompt, buildQuestionsUserMessage } from '@/lib/prompts/one-on-one-questions'

export const dynamic = 'force-dynamic'

const MOCK_QUESTIONS = [
  { question: '前回から今日までの間で、一番手応えを感じた瞬間はどんな時でしたか？', intent: '成功体験の言語化を通じてモチベーションの源泉を把握する' },
  { question: '今の業務の中で「もっとこうだったらスムーズなのに」と感じることはありますか？', intent: '業務上のブロッカーを支援視点で引き出す' },
  { question: '来月の自分に向けて、今月中にこれだけはやっておきたいと思うことは何ですか？', intent: '本人の優先度認識を確認し、アクション設定につなげる' },
]

function extractJsonArray(text: string): unknown[] | null {
  // Try direct parse first
  try { return JSON.parse(text) } catch {}
  // Extract JSON array from text
  const match = text.match(/\[[\s\S]*\]/)
  if (match) {
    try { return JSON.parse(match[0]) } catch {}
  }
  return null
}

export async function POST(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const body = await req.json()

    if (!hasApiKey()) {
      await new Promise(r => setTimeout(r, 1000))
      return NextResponse.json({ questions: MOCK_QUESTIONS, mode: 'mock' })
    }

    const systemPrompt = buildQuestionsSystemPrompt()
    const userMessage = buildQuestionsUserMessage({
      memberName: decodeURIComponent(params.name),
      goalProgress: body.goalProgress || [],
      actionReviews: body.actionReviews || [],
      condition: body.condition || {},
      previousCondition: body.previousCondition || null,
      previousSummary: body.previousSummary || '',
      departmentPolicy: body.departmentPolicy || '',
    })

    const result = await callClaude({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 1024,
    })

    const parsed = extractJsonArray(result.content)
    if (parsed && Array.isArray(parsed)) {
      return NextResponse.json({ questions: parsed, mode: result.mode })
    }

    // Fallback to mock if parse fails
    return NextResponse.json({ questions: MOCK_QUESTIONS, mode: 'mock' })
  } catch (error) {
    console.error('Questions API error:', error)
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
  }
}
