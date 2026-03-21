import { NextRequest, NextResponse } from 'next/server'
import { callClaude, hasApiKey } from '@/lib/ai/call-claude'
import { loadSharedDocs } from '@/lib/fs/shared-docs'
import { buildGoalGenerationSystemPrompt, buildGoalGenerationUserMessage } from '@/lib/prompts/goal-generation'
import type { ChatMessage } from '@/lib/types'

export const dynamic = 'force-dynamic'

const MOCK_GOALS = `目標①（実行）：チーム内のコードレビュー基準を策定し、上期末までにレビュー指摘の手戻り率を現状比30%削減する
　└ 達成した姿：レビュー基準がチーム全員に浸透し、指摘内容が「設計判断」中心に変わっている状態
　└ 検証方法：レビューコメントの分類集計（手戻り系 vs 設計系）を月次で計測
　└ 中間確認：6月末時点でレビュー基準v1がチームに展開され、2週間以上運用されている
　└ 根拠：マネージャーの期待「チーム全体の品質向上」／本人の強み「丁寧な設計力」

目標②（挑戦）：新規メンバー2名のオンボーディングプログラムを設計・実行し、配属後2ヶ月以内に独力でタスク完了できる状態にする
　└ 達成した姿：新規メンバーが3ヶ月目から既存メンバーと同等のベロシティで稼働できている状態
　└ 検証方法：新規メンバーのタスク完了率・1人あたり質問回数の推移を計測
　└ 中間確認：6月末時点でオンボーディング資料が完成し、1名目の受入が完了している
　└ 根拠：マネージャーの課題認識「育成への関与不足」／グループ方針「人材育成の加速」

目標③（インパクト）：AI活用による開発効率化の検証結果をチーム横断で展開し、対象チームの開発工数を上期末までに15%削減する
　└ 達成した姿：2チーム以上がAI活用プロセスを日常的に運用し、効率化の効果が数値で確認できている状態
　└ 検証方法：導入前後のタスク消化速度の比較データ（JIRAベース）
　└ 中間確認：6月末時点で1チームへの導入が完了し、効果測定が開始されている
　└ 根拠：本人の希望「AI活用スキルの向上」／部方針「次世代開発プロセスの確立」`

export async function POST(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const body = await req.json()
    const memberName = decodeURIComponent(params.name)

    if (!hasApiKey()) {
      await new Promise(r => setTimeout(r, 1500))
      return NextResponse.json({ goals: MOCK_GOALS, mode: 'mock' })
    }

    const shared = loadSharedDocs()
    const systemPrompt = buildGoalGenerationSystemPrompt()

    // Build messages: initial context + optional refinement history
    const baseMessage = buildGoalGenerationUserMessage({
      memberName,
      memberProfile: body.memberContext || '',
      departmentPolicy: shared.policy,
      evaluationCriteria: shared.criteria,
      managerInput: body.managerInput,
      memberInput: body.memberInput,
      previousPeriod: body.previousPeriod,
      diagnosis: body.diagnosis,
    })

    const messages: ChatMessage[] = [{ role: 'user', content: baseMessage }]

    // Append refinement conversation history if present
    if (body.refinementMessages && body.refinementMessages.length > 0) {
      for (const msg of body.refinementMessages) {
        messages.push({ role: msg.role, content: msg.content })
      }
    }

    const result = await callClaude({
      systemPrompt,
      messages,
      maxTokens: 4096,
    })

    return NextResponse.json({ goals: result.content, mode: result.mode })
  } catch (error) {
    console.error('Goal generation API error:', error)
    return NextResponse.json({ error: 'Failed to generate goals' }, { status: 500 })
  }
}
