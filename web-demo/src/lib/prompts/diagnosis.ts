import type { ManagerInput, MemberInput, PreviousPeriod } from '@/lib/types'

interface DiagnosisPromptParams {
  memberName: string
  memberProfile: string
  orgPolicy: string
  evaluationCriteria: string
  managerInput: ManagerInput
  memberInput: MemberInput
  previousPeriod?: PreviousPeriod
}

export function buildDiagnosisSystemPrompt(): string {
  return `あなたは人材育成の専門コンサルタントです。
以下の情報をもとに、目標設計の前段階としてこのメンバーの診断サマリーを作成してください。

【出力フォーマット】

現在地と次ステージのギャップ：
　[現在のレベルで不足していること・次のステージに必要なことを1〜2文で]

発揮されていない強み：
　[強みのうち、まだ組織に十分発揮されていないものを1〜2文で]

今期の最大課題：
　[一言のキャッチフレーズで表現すること]
　例）「やり遂げる人」から「方向を決める人」への転換

【注意】
- 情報の要約をしないこと
- マネージャーが読んで「そうそう、これ」と感じるレベルの解像度で書くこと
- 抽象的な表現を避け、このメンバー固有の言葉で書くこと
- 出力は日本語で行うこと`
}

export function buildDiagnosisUserMessage(params: DiagnosisPromptParams): string {
  const parts = [
    `## メンバー：${params.memberName}`,
    '',
    '## メンバープロフィール',
    params.memberProfile,
    '',
    '## 組織方針',
    params.orgPolicy,
    '',
    '## 育成基準・評価基準',
    params.evaluationCriteria,
    '',
    '## マネージャーからの期待',
    `- このメンバーへの期待：${params.managerInput.expectations}`,
    `- このメンバーの最大の課題（一言で）：${params.managerInput.biggestChallenge}`,
    '',
    '## メンバー本人の意見',
    `- 今期最も成長したいスキル・領域：${params.memberInput.growthArea}`,
    `- 現在の業務で困っていること・非効率だと感じること：${params.memberInput.currentDifficulties}`,
    `- 1年後になりたい姿：${params.memberInput.oneYearVision}`,
  ]

  if (params.previousPeriod && params.previousPeriod.previousGoals) {
    parts.push(
      '',
      '## 前期実績',
      `- 前期の主な目標：${params.previousPeriod.previousGoals}`,
      `- 達成レベル：${params.previousPeriod.achievementLevel}`,
    )
    if (params.previousPeriod.reasonIfNotAchieved) {
      parts.push(`- 未達の理由：${params.previousPeriod.reasonIfNotAchieved}`)
    }
  }

  parts.push('', '上記の情報をもとに、診断サマリーを作成してください。')

  return parts.join('\n')
}
