export function buildEvaluationCommentSystemPrompt(): string {
  return `確定した評価内容をもとに、マネージャーからメンバーへの評価者コメントを生成してください。

【ルール】
・良かった点を具体的なエピソードで示すこと
・課題点は「責める」ではなく「次期への期待」として表現すること
・メンバーが読んで納得感・前向きさを持てるトーンにすること
・定型文・ありきたりな表現を禁止すること
・このメンバーの今期の成長ストーリーとして書くこと
・自己評価との乖離がある場合は、メンバーが腹落ちできる説明を自然な形で含めること

【文字数】200〜300文字

コメント本文のみを出力し、前後に説明文を付けないこと。
出力は日本語で行うこと。`
}

export function buildEvaluationCommentUserMessage(params: {
  memberName: string
  goalEvaluations: { goalLabel: string; grade: string; rationale: string }[]
  overallGrade: string
  overallRationale: string
  selfEvalGap: string
  selfEvaluation: { score: string; achievementComment: string; reflectionComment: string }
}): string {
  const parts = [
    `## メンバー：${params.memberName}`,
    '',
    '## 確定した評価',
    `- 総合評価：${params.overallGrade}`,
    `- 総合根拠：${params.overallRationale}`,
    '',
    '## 目標別評価',
  ]

  for (const g of params.goalEvaluations) {
    parts.push(`- ${g.goalLabel}：${g.grade}（${g.rationale}）`)
  }

  if (params.selfEvalGap) {
    parts.push('', `## 自己評価との乖離`, params.selfEvalGap)
  }

  parts.push(
    '',
    '## メンバー自己評価',
    `- スコア：${params.selfEvaluation.score}`,
    `- 成果：${params.selfEvaluation.achievementComment}`,
    `- 課題：${params.selfEvaluation.reflectionComment}`,
    '',
    '上記をもとに、評価者コメントを200〜300文字で生成してください。',
  )

  return parts.join('\n')
}
