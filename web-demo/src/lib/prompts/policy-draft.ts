export function buildContinuousDraftSystemPrompt(): string {
  return `確定した方向性をもとに、組織方針の全文を作成してください。

【出力ルール】
・前年度のフォーマットを踏襲すること
・方向性に含まれない内容は前年度から引き継ぐこと
・「継続」項目は前年度の表現を尊重しつつ新年度向けに微調整すること
・「新設」項目は具体的かつ実行可能な表現にすること
・Markdownのみを出力すること
・出力は日本語で行うこと`
}

export function buildContinuousDraftUserMessage(params: {
  targetYear: number
  prevContent: string
  confirmedDirection: string
  allInputs: string
}): string {
  return `## 対象年度：${params.targetYear}年度

## 前年度方針（構成・フォーマットの参考）
${params.prevContent}

## 確定した方向性
${params.confirmedDirection}

## 前年度の振り返り・来期テーマ
${params.allInputs}

上記をもとに、${params.targetYear}年度の組織方針全文を作成してください。`
}

export function buildInitialDraftSystemPrompt(): string {
  return `確定した骨格をもとに、組織方針の全文を作成してください。
これが初めての方針策定のため、フォーマットも一から作成します。

【フォーマットのルール】
以下の構成で作成すること：
  1. ミッション
  2. 環境認識（来期の外部・内部環境）
  3. 重点テーマ（各テーマに目標と具体的取り組みを記載）
  4. 行動指針
  5. チーム体制（任意）
・来年度以降も使い回せる汎用的なフォーマットにすること
・具体的かつ実行可能な表現にすること
・Markdownのみを出力すること
・出力は日本語で行うこと`
}

export function buildInitialDraftUserMessage(params: {
  targetYear: number
  confirmedDirection: string
  orgInfo: string
}): string {
  return `## 対象年度：${params.targetYear}年度

## 確定した骨格
${params.confirmedDirection}

## 組織情報
${params.orgInfo}

上記をもとに、${params.targetYear}年度の組織方針全文を作成してください。`
}
