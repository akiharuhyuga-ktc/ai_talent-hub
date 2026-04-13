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
以下の情報と診断サマリーをもとに、カオナビの評価フォーマットに沿ったメンバーの目標を設計してください。

━━━━━━━━━━━━━━━━━━━━━━
【Step1：設計前の確認】
診断サマリーの内容を設計の軸として使うこと
・現在地と次ステージのギャップ
・発揮されていない強み
・今期の最大課題

━━━━━━━━━━━━━━━━━━━━━━
【Step2：2フィールドの設計方針】

① 短期成果評価_目標（What）
・半期で「何を達成するか」を問うフィールド
・期末に成果物・数値・状態の達成で評価できる内容
・賞与額に影響する
・例：「9月末までに〇〇を達成し、△△を実証する」

② 発揮能力評価_目標（How）
・「どう動いたか・どんな能力を発揮したか」を問うフィールド
・キャリアラダーに対する行動・姿勢・再現性で評価できる内容
・昇降格（基本給）に影響する
・例：「〇〇の能力を発揮し、組織に△△の変化をもたらす」

振り分け判断テスト：
「期末に成果物や数値が出ていれば達成と言える目標か？」
→ YES: ①短期成果評価　→ NO（行動・能力の発揮を問う）: ②発揮能力評価

━━━━━━━━━━━━━━━━━━━━━━
【Step3：各フィールドの必須要素】

■ 数値と期限
　× 「効率化する」
　○ 「上期末までに現状比25%削減する」

■ 達成基準は「状態・変化」で終わること
　× 「勉強会を実施する」
　○ 「チームの開発習慣が変わっている状態」

■ この人でなければならない理由を含めること
　○ このメンバーの強み・課題・キャリアステージに紐づいていなければならない

■ 検証方法を含めること
　○ 数値・比較・第三者の評価など客観的に判断できる基準が明示されていること

━━━━━━━━━━━━━━━━━━━━━━
【Step4：絶対禁止事項】

・Markdownの太字記法（**太字**）を使うこと
・「実施する」「共有する」「展開する」で文章を終わらせること
・各フィールド内に「目標1」「目標2」のように番号を振ること
・行動の列挙を目標と呼ぶこと
・誰に差し替えても違和感がない汎用的な目標を書くこと
・R&D関連目標に特定のプロダクト名を含めること

━━━━━━━━━━━━━━━━━━━━━━
【出力フォーマット】

必ず以下の2フィールドをこの順番で出力すること：

## ① 短期成果評価_目標

[半期で達成する具体的な成果を1つの文章ブロックとして記述]

└ 達成した姿：[変化・状態で終わる1文]
└ 検証方法：[客観的な判断基準。複数観点は①②③で列挙]
└ 中間確認（3ヶ月時点）：[6月末時点での確認基準]
└ 根拠：[方針・期待・本人情報との紐づけ]

---

## ② 発揮能力評価_目標

[キャリアラダーに対する能力の発揮を1つの文章ブロックとして記述]

└ 達成した姿：[変化・状態で終わる1文]
└ 検証方法：[客観的な判断基準]
└ 中間確認（3ヶ月時点）：[6月末時点での確認基準]
└ 根拠：[キャリアラダー・方針との紐づけ]

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
 * ブラッシュアップ時に特定のフィールドのみ再設計する指示をプロンプトに追加する。
 */
export function buildRefinementTargetInstruction(
  targetField: 'shortTerm' | 'capability' | 'both',
  shortTermGoals: string,
  capabilityGoals: string,
): string {
  const fieldLabel = {
    shortTerm: '① 短期成果評価_目標',
    capability: '② 発揮能力評価_目標',
    both: '① 短期成果評価_目標と② 発揮能力評価_目標の両方',
  }[targetField]

  return `
━━━━━━━━━━━━━━━━━━━━━━
【重要：部分的ブラッシュアップ指示】

今回は ${fieldLabel} のみを再設計してください。

■ 出力ルール
・対象フィールドのみを出力フォーマット通りに出力してください
・非対象のフィールドは出力しないでください

■ 参考：現在の全フィールド
## ① 短期成果評価_目標

${shortTermGoals}

---

## ② 発揮能力評価_目標

${capabilityGoals}
━━━━━━━━━━━━━━━━━━━━━━`
}
