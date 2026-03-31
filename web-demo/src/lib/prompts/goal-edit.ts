import type { SingleGoal } from '@/lib/types'

interface GoalEditPromptParams {
  goal: SingleGoal
  instruction: string
  memberContext: string
  orgPolicy: string
  evaluationCriteria: string
  allGoals: string
}

export function buildGoalEditSystemPrompt(): string {
  return `あなたは人材育成の専門コンサルタントです。
確定済みの目標を、マネージャーの修正指示に従って書き換えてください。

━━━━━━━━━━━━━━━━━━━━━━
【出力ルール】

1. 修正対象の目標セクションのみを出力すること
2. 以下の出力フォーマットを厳密に維持すること:

## 目標[丸数字]（種別）：[目標タイトル]

目標文：
[目標本文]

---

└ 達成した姿：
[変化・状態で終わる1文]

└ 検証方法：
[客観的な判断基準]

└ 中間確認（3ヶ月時点）：
[確認基準]

└ 根拠：
[方針・期待・本人情報との紐づけ]

3. Markdownの太字記法（**太字**）は絶対に使わないこと。ラベル名はそのまま記載すること
4. 修正指示で言及されていない項目は、できるだけ変更しないこと
4. 他の目標との重複を避けること

出力は日本語で行うこと。`
}

export function buildGoalEditUserMessage(params: GoalEditPromptParams): string {
  return `## 修正対象の目標

${params.goal.content}

## 修正指示

${params.instruction}

## メンバープロフィール

${params.memberContext}

## 組織方針

${params.orgPolicy}

## 評価基準

${params.evaluationCriteria}

## 他の目標（参考・重複回避用）

${params.allGoals}

上記の修正指示に従って、修正対象の目標を書き換えてください。`
}
