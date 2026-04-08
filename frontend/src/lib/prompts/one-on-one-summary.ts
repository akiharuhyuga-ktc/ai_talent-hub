export function buildSummarySystemPrompt(): string {
  return `今回の1on1の記録をもとに、次回のマネージャーへの申し送りサマリーを生成してください。

【出力フォーマット】

今月のサマリー（2〜3文）：
　[目標・コンディション・主な話題を簡潔に]

次回の重点確認事項：
　・[アクションや目標の状況で最優先のもの]
　・[コンディション変化で注意が必要なもの]

マネージャーとしての注意点：
　[コンディション推移・目標リスクなど、次回までにマネージャーが意識すべきことを1〜2文で]

出力は日本語で行うこと。`
}

export function buildSummaryUserMessage(params: {
  memberName: string
  yearMonth: string
  actionReviews: { content: string; status: string; comment: string }[]
  goalProgress: { goalLabel: string; status: string; progressComment: string }[]
  condition: { motivation: number | null; workload: number | null; teamRelations: number | null; comment: string }
  previousCondition: { motivation: number | null; workload: number | null; teamRelations: number | null } | null
  hearingMemos: { question: string; memo: string }[]
  nextActions: { content: string; assignee: string; deadline: string }[]
}): string {
  const parts = [
    `## 1on1記録：${params.memberName}（${params.yearMonth}）`,
    '',
    '## 前回アクション振り返り',
  ]

  for (const a of params.actionReviews) {
    const label = a.status === 'completed' ? '完了' : a.status === 'ongoing' ? '継続中' : '未完了'
    parts.push(`- ${a.content}：${label}${a.comment ? `（${a.comment}）` : ''}`)
  }

  parts.push('', '## 目標進捗')
  for (const g of params.goalProgress) {
    const label = g.status === 'on-track' ? '順調' : g.status === 'at-risk' ? '要注意' : g.status === 'delayed' ? '遅延' : '未確認'
    parts.push(`- ${g.goalLabel}：${label} — ${g.progressComment || 'コメントなし'}`)
  }

  parts.push('', '## コンディション')
  parts.push(`- モチベーション：${params.condition.motivation ?? '-'}`)
  parts.push(`- 業務負荷：${params.condition.workload ?? '-'}`)
  parts.push(`- チーム関係性：${params.condition.teamRelations ?? '-'}`)
  if (params.condition.comment) parts.push(`- コメント：${params.condition.comment}`)

  if (params.previousCondition) {
    const diff = (cur: number | null, prev: number | null) => {
      if (cur === null || prev === null) return '-'
      const d = cur - prev
      return d > 0 ? `+${d}` : `${d}`
    }
    parts.push(`- 前月比：モチベ${diff(params.condition.motivation, params.previousCondition.motivation)} / 負荷${diff(params.condition.workload, params.previousCondition.workload)} / 関係性${diff(params.condition.teamRelations, params.previousCondition.teamRelations)}`)
  }

  if (params.hearingMemos.some(h => h.memo)) {
    parts.push('', '## ヒアリングメモ')
    for (const h of params.hearingMemos) {
      if (h.memo) parts.push(`- Q: ${h.question}`, `  → ${h.memo}`)
    }
  }

  if (params.nextActions.length > 0) {
    parts.push('', '## 次回アクション')
    for (const a of params.nextActions) {
      parts.push(`- ${a.content}（${a.assignee}、期限：${a.deadline}）`)
    }
  }

  parts.push('', '上記の記録をもとに、申し送りサマリーを生成してください。')
  return parts.join('\n')
}
