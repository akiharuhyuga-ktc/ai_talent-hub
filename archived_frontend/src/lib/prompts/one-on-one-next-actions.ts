export function buildNextActionsSystemPrompt(): string {
  return `あなたは人材育成の専門コンサルタントです。
以下の1on1情報をもとに、メンバーの次回までのアクション案を2〜3件提案してください。

【ルール】
・「今の課題を解決する具体的な一手」を優先すること
・達成可能な期限を設定すること（期限は2〜4週間以内を目安）
・担当（member/manager/both）を必ず指定すること
・「何を・どのように・いつまでに」が明確なアクションにすること。「〜を確認する」「〜を合意する」など実行内容が曖昧なアクションは禁止
・各アクションに「なぜこのアクションを設定するか」の根拠を1〜2文で添えること

【出力フォーマット（JSON配列のみ）】
[
  {"content": "アクション内容", "assignee": "member", "deadline": "YYYY-MM-DD", "reason": "このアクションを設定する根拠"},
  {"content": "アクション内容", "assignee": "manager", "deadline": "YYYY-MM-DD", "reason": "このアクションを設定する根拠"}
]

JSON配列のみを出力し、前後に説明文やMarkdownコードブロックを付けないこと。`
}

export function buildNextActionsUserMessage(params: {
  memberName: string
  today: string
  goalProgress: { goalLabel: string; status: string; progressComment: string }[]
  actionReviews: { content: string; status: string; comment: string }[]
  condition: { motivation: number | null; workload: number | null; teamRelations: number | null; comment: string }
  hearingMemos: { question: string; memo: string }[]
  previousSummary: string
}): string {
  const parts = [
    `## メンバー：${params.memberName}`,
    `今日の日付：${params.today}`,
    '',
    '## 目標と進捗ステータス',
  ]

  for (const g of params.goalProgress) {
    const statusLabel = g.status === 'on-track' ? '順調' : g.status === 'at-risk' ? '要注意' : g.status === 'delayed' ? '遅延' : '未確認'
    parts.push(`- ${g.goalLabel}：${statusLabel}`)
    if (g.progressComment) parts.push(`  ${g.progressComment}`)
  }

  parts.push('', '## 前回アクション振り返り')
  if (params.actionReviews.length > 0) {
    for (const a of params.actionReviews) {
      const statusLabel = a.status === 'completed' ? '完了' : a.status === 'ongoing' ? '継続中' : '未完了'
      parts.push(`- ${a.content}：${statusLabel}${a.comment ? `（${a.comment}）` : ''}`)
    }
  } else {
    parts.push('- なし（初回）')
  }

  parts.push('', '## コンディションスコア')
  parts.push(`- モチベーション：${params.condition.motivation ?? '未入力'}`)
  parts.push(`- 業務負荷：${params.condition.workload ?? '未入力'}`)
  parts.push(`- チーム関係性：${params.condition.teamRelations ?? '未入力'}`)
  if (params.condition.comment) parts.push(`- コメント：${params.condition.comment}`)

  const filledMemos = params.hearingMemos.filter(m => m.memo)
  if (filledMemos.length > 0) {
    parts.push('', '## ヒアリングメモ')
    for (const m of filledMemos) {
      parts.push(`Q: ${m.question}`)
      parts.push(`A: ${m.memo}`)
    }
  }

  if (params.previousSummary) {
    parts.push('', '## 前回の申し送り事項', params.previousSummary)
  }

  parts.push('', '上記の情報をもとに、次回までのアクション案を2〜3件提案してください。')
  return parts.join('\n')
}
