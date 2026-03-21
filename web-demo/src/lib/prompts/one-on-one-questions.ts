export function buildQuestionsSystemPrompt(): string {
  return `あなたは人材育成の専門コンサルタントです。
以下の情報をもとに、マネージャーが1on1で使うヒアリング質問を3つ生成してください。

【ルール】
・質問は「答えやすく・本音が引き出せる」オープンクエスチョンにすること
・進捗が「要注意／遅延」の目標は必ず1問含めること
・コンディションが低下している場合は必ず1問含めること
・「なぜできなかったか」を責める質問は禁止。「何が壁だったか」「何があればできるか」という支援視点で生成すること
・質問の後に「この質問の意図（マネージャー向け）」を1行添えること

【出力フォーマット（JSON配列）】
[
  {"question": "質問文", "intent": "意図の1行説明"},
  {"question": "質問文", "intent": "意図の1行説明"},
  {"question": "質問文", "intent": "意図の1行説明"}
]

JSON配列のみを出力し、前後に説明文やMarkdownコードブロックを付けないこと。`
}

export function buildQuestionsUserMessage(params: {
  memberName: string
  goalProgress: { goalLabel: string; status: string; progressComment: string }[]
  actionReviews: { content: string; status: string }[]
  condition: { motivation: number | null; workload: number | null; teamRelations: number | null; comment: string }
  previousCondition: { motivation: number | null; workload: number | null; teamRelations: number | null } | null
  previousSummary: string
  departmentPolicy: string
}): string {
  const parts = [
    `## メンバー：${params.memberName}`,
    '',
    '## 目標と進捗ステータス',
  ]

  for (const g of params.goalProgress) {
    const statusLabel = g.status === 'on-track' ? '順調' : g.status === 'at-risk' ? '要注意' : g.status === 'delayed' ? '遅延' : '未確認'
    parts.push(`- ${g.goalLabel}：${statusLabel}（${g.progressComment || 'コメントなし'}）`)
  }

  parts.push('', '## 前回未完了アクション')
  const incomplete = params.actionReviews.filter(a => a.status !== 'completed')
  if (incomplete.length > 0) {
    for (const a of incomplete) parts.push(`- ${a.content}（${a.status === 'ongoing' ? '継続中' : '未完了'}）`)
  } else {
    parts.push('- なし（全て完了）')
  }

  parts.push('', '## コンディションスコア')
  parts.push(`- モチベーション：${params.condition.motivation ?? '未入力'}`)
  parts.push(`- 業務負荷：${params.condition.workload ?? '未入力'}`)
  parts.push(`- チーム関係性：${params.condition.teamRelations ?? '未入力'}`)
  if (params.condition.comment) parts.push(`- コメント：${params.condition.comment}`)

  if (params.previousCondition) {
    parts.push('', '## 前月比')
    const diff = (cur: number | null, prev: number | null) => {
      if (cur === null || prev === null) return '比較不可'
      const d = cur - prev
      return d > 0 ? `+${d}` : `${d}`
    }
    parts.push(`- モチベーション：${diff(params.condition.motivation, params.previousCondition.motivation)}`)
    parts.push(`- 業務負荷：${diff(params.condition.workload, params.previousCondition.workload)}`)
    parts.push(`- チーム関係性：${diff(params.condition.teamRelations, params.previousCondition.teamRelations)}`)
  }

  if (params.previousSummary) {
    parts.push('', '## 前回の申し送り事項', params.previousSummary)
  }

  if (params.departmentPolicy) {
    parts.push('', '## グループ方針（参考）', params.departmentPolicy.slice(0, 500))
  }

  parts.push('', '上記の情報をもとに、ヒアリング質問を3つ生成してください。')
  return parts.join('\n')
}
