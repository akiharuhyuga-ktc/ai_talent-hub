import { NextRequest, NextResponse } from 'next/server'
import { callClaude, hasApiKey } from '@/lib/ai/call-claude'
import { buildSummarySystemPrompt, buildSummaryUserMessage } from '@/lib/prompts/one-on-one-summary'

export const dynamic = 'force-dynamic'

const MOCK_SUMMARY = `今月のサマリー（2〜3文）：
　目標進捗は全体的に順調に推移しており、特に実行目標については計画通りの進捗が見られた。コンディション面では業務負荷がやや高めで推移しているが、モチベーションは維持されている。

次回の重点確認事項：
　・挑戦目標の中間マイルストーン到達状況の確認
　・業務負荷の継続的なモニタリング

マネージャーとしての注意点：
　業務負荷が2ヶ月連続で高水準のため、タスクの優先順位整理を支援し、必要に応じてリソース調整を検討すること。`

export async function POST(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const body = await req.json()

    if (!hasApiKey()) {
      await new Promise(r => setTimeout(r, 1000))
      return NextResponse.json({ summary: MOCK_SUMMARY, mode: 'mock' })
    }

    const systemPrompt = buildSummarySystemPrompt()
    const userMessage = buildSummaryUserMessage({
      memberName: decodeURIComponent(params.name),
      yearMonth: body.yearMonth || '',
      actionReviews: body.actionReviews || [],
      goalProgress: body.goalProgress || [],
      condition: body.condition || {},
      previousCondition: body.previousCondition || null,
      hearingMemos: body.hearingMemos || [],
      nextActions: body.nextActions || [],
    })

    const result = await callClaude({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 1024,
    })

    return NextResponse.json({ summary: result.content, mode: result.mode })
  } catch (error) {
    console.error('Summary API error:', error)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
