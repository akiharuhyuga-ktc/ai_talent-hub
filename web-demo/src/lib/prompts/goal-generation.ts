import type { ManagerInput, MemberInput, PreviousPeriod } from '@/lib/types'

interface GoalGenerationPromptParams {
  memberName: string
  memberProfile: string
  orgPolicy: string
  evaluationCriteria: string
  managerInput: ManagerInput
  memberInput: MemberInput
  previousPeriod?: PreviousPeriod
  diagnosis: string
}

export function buildGoalGenerationSystemPrompt(): string {
  return `あなたは人材育成の専門コンサルタントです。
以下の情報と診断サマリーをもとに、メンバーの目標を設計してください。

━━━━━━━━━━━━━━━━━━━━━━
【Step1：設計前の確認】
診断サマリーの内容を設計の軸として使うこと
・現在地と次ステージのギャップ
・発揮されていない強み
・今期の最大課題

━━━━━━━━━━━━━━━━━━━━━━
【Step2：目標の構成ルール】
以下の3種類を必ず1つずつ含めること

① 実行目標：確実に達成できる、チームへの貢献目標
② 挑戦目標：失敗リスクがある、本人の成長を問う目標
③ インパクト目標：組織・ビジネスへの変化を生む目標

━━━━━━━━━━━━━━━━━━━━━━
【Step3：1つひとつの目標に必須の要素】

■ 数値と期限
　× 「効率化する」
　○ 「上期末までに現状比25%削減する」

■ 達成基準は「状態・変化」で終わること
　× 「勉強会を実施する」「ドキュメントを作成する」
　○ 「チームの開発習慣が変わっている状態」
　○ 「次の担当者がゼロから始めなくて済む資産が残っている状態」

■ この人でなければならない理由を含めること
　× 誰が担当しても成立する目標
　○ このメンバーの強み・課題・キャリアステージに紐づいていなければならない

■ ビジネス・組織へのインパクトを含めること
　× チームの中だけで完結する目標
　○ 達成した結果、何のコスト・品質・速度がどう変わるかが明示されている目標

■ 検証方法を含めること
　× 達成したかどうかが主観で判断できる目標
　○ 数値・比較・第三者の評価など客観的に判断できる基準が明示されている目標

━━━━━━━━━━━━━━━━━━━━━━
【Step4：絶対禁止事項】

・Markdownの太字記法（**太字**）を使うこと。ラベル名はそのまま記載すること
・「実施する」「共有する」「展開する」で文章を終わらせること
・「1件以上」「1回以上」など、やれば必ず達成できる基準のみを置くこと
・全員が必ず達成できる目標だけを並べること
・行動の列挙を目標と呼ぶこと
・誰に差し替えても違和感がない汎用的な目標を書くこと
・R&D関連目標に特定のプロダクト名（「〇〇」アプリ、「〇〇」SDK等）を含めること

━━━━━━━━━━━━━━━━━━━━━━
【出力フォーマット】

目標①（実行／挑戦／インパクト のいずれか）：[目標文]
　└ 達成した姿：[変化・状態で終わる1文]
　└ 検証方法：[客観的な判断基準]
　└ 中間確認：[3ヶ月時点での確認基準]
　└ 根拠：[方針・期待・本人情報との紐づけ]

（目標は3〜5個を上限とする）

出力は日本語で行うこと。`
}

export function buildGoalGenerationUserMessage(params: GoalGenerationPromptParams): string {
  const parts = [
    `## メンバー：${params.memberName}`,
    '',
    '## 診断サマリー（確認済み）',
    params.diagnosis,
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

  parts.push('', '上記の情報と診断サマリーをもとに、目標を設計してください。')

  return parts.join('\n')
}

/**
 * ブラッシュアップ時に特定の目標のみ再設計する指示をプロンプトに追加する。
 */
export function buildRefinementTargetInstruction(targetLabels: string[], allGoalsMarkdown: string): string {
  const labels = targetLabels.join('、')
  return `
━━━━━━━━━━━━━━━━━━━━━━
【重要：部分的ブラッシュアップ指示】

今回は以下の目標のみを再設計してください: ${labels}

■ 出力ルール
・対象目標（${labels}）のみを出力してください
・対象外の目標は一切出力しないでください
・ただし、末尾の整合確認テーブルは全目標分を含めて出力してください（対象外の目標は現状の内容をそのまま反映）

■ 参考：現在の全目標
${allGoalsMarkdown}
━━━━━━━━━━━━━━━━━━━━━━`
}
