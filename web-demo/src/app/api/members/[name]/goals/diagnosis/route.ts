import { NextRequest, NextResponse } from 'next/server'
import { callClaude, hasApiKey } from '@/lib/ai/call-claude'
import { loadSharedDocs } from '@/lib/fs/shared-docs'
import { buildDiagnosisSystemPrompt, buildDiagnosisUserMessage } from '@/lib/prompts/diagnosis'

export const dynamic = 'force-dynamic'

const MOCK_DIAGNOSIS = `現在地と次ステージのギャップ：
　現在は担当領域内で安定した成果を出しているが、チーム・組織全体を巻き込んで方向性を定義し、推進する動きには至っていない。次のステージでは「自分の手を動かす人」から「周囲を動かす人」への転換が求められる。

発揮されていない強み：
　技術的な深い理解と丁寧な設計力を持っているが、その知見がチーム内に閉じており、他チームや組織全体の意思決定に活用されていない。発信・巻き込みによって影響範囲を広げる余地がある。

今期の最大課題：
　「個人で完結する職人」から「チームの方向を示すリーダー」への転換`

export async function POST(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const body = await req.json()
    const memberName = decodeURIComponent(params.name)

    if (!hasApiKey()) {
      await new Promise(r => setTimeout(r, 1000))
      return NextResponse.json({ diagnosis: MOCK_DIAGNOSIS, mode: 'mock' })
    }

    const shared = loadSharedDocs()
    const systemPrompt = buildDiagnosisSystemPrompt()
    const userMessage = buildDiagnosisUserMessage({
      memberName,
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

    return NextResponse.json({ diagnosis: result.content, mode: result.mode })
  } catch (error) {
    console.error('Diagnosis API error:', error)
    return NextResponse.json({ error: 'Failed to generate diagnosis' }, { status: 500 })
  }
}
