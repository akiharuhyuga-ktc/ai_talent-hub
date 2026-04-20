import type { ActionItem, ConditionScore } from '@/lib/types'

const ASSIGNEE_MAP: Record<string, ActionItem['assignee']> = {
  'マネージャー': 'manager',
  'メンバー': 'member',
  '両方': 'both',
}

const ASSIGNEE_REVERSE: Record<string, string> = {
  manager: 'マネージャー',
  member: 'メンバー',
  both: '両方',
}

/**
 * Parse action items from a 1on1 record markdown.
 */
export function parseActionItems(rawMarkdown: string): ActionItem[] {
  const items: ActionItem[] = []
  const lines = rawMarkdown.split('\n')
  let inActions = false
  let current: Partial<ActionItem> | null = null

  for (const line of lines) {
    if (line.startsWith('## ネクストアクション') || line.startsWith('## 次回アクション')) {
      inActions = true
      continue
    }
    if (inActions && line.startsWith('## ')) break

    if (!inActions) continue

    if (line.startsWith('### アクション')) {
      if (current && current.content) items.push(fillActionDefaults(current))
      current = {}
      continue
    }

    if (!current) continue

    if (line.startsWith('- 内容：') || line.startsWith('- 内容:')) {
      current.content = line.replace(/^- 内容[：:]/, '').trim()
    } else if (line.startsWith('- 担当：') || line.startsWith('- 担当:')) {
      const raw = line.replace(/^- 担当[：:]/, '').trim()
      current.assignee = ASSIGNEE_MAP[raw] || 'member'
    } else if (line.startsWith('- 期限：') || line.startsWith('- 期限:')) {
      current.deadline = line.replace(/^- 期限[：:]/, '').trim()
    }
  }

  if (current && current.content) items.push(fillActionDefaults(current))
  return items
}

/**
 * Parse condition scores from a 1on1 record markdown.
 */
export function parseConditionScore(rawMarkdown: string): ConditionScore | null {
  const lines = rawMarkdown.split('\n')
  let inCondition = false

  const score: ConditionScore = { motivation: null, workload: null, teamRelations: null, comment: '' }
  let found = false

  for (const line of lines) {
    if (line.startsWith('## コンディション')) {
      inCondition = true
      continue
    }
    if (inCondition && line.startsWith('## ')) break

    if (!inCondition) continue

    const numMatch = (prefix: string) => {
      const re = new RegExp(`^- ${prefix}[：:]\\s*(\\d)`)
      const m = line.match(re)
      return m ? parseInt(m[1]) : null
    }

    const mot = numMatch('モチベーション')
    if (mot !== null) { score.motivation = mot; found = true }

    const wl = numMatch('業務負荷')
    if (wl !== null) { score.workload = wl; found = true }

    const tr = numMatch('チーム関係性')
    if (tr !== null) { score.teamRelations = tr; found = true }

    if (line.startsWith('- コメント：') || line.startsWith('- コメント:')) {
      score.comment = line.replace(/^- コメント[：:]/, '').trim()
    }
  }

  return found ? score : null
}

/**
 * Parse goal progress entries from a 1on1 record markdown.
 */
export function parseGoalProgress(rawMarkdown: string): { goalLabel: string; status: string; progressComment: string }[] {
  const lines = rawMarkdown.split('\n')
  const entries: { goalLabel: string; status: string; progressComment: string }[] = []
  let inProgress = false
  let current: { goalLabel: string; status: string; progressComment: string } | null = null

  const STATUS_MAP: Record<string, string> = { '順調': 'on-track', '要注意': 'at-risk', '遅延': 'delayed' }

  for (const line of lines) {
    if (line.startsWith('## 目標進捗')) { inProgress = true; continue }
    if (inProgress && line.startsWith('## ')) break
    if (!inProgress) continue

    const headerMatch = line.match(/^### (.+)/)
    if (headerMatch) {
      if (current) entries.push(current)
      current = { goalLabel: headerMatch[1], status: '', progressComment: '' }
      continue
    }
    if (!current) continue
    if (line.startsWith('- 進捗ステータス：') || line.startsWith('- 進捗ステータス:')) {
      const raw = line.replace(/^- 進捗ステータス[：:]/, '').replace(/\*\*/g, '').trim()
      current.status = STATUS_MAP[raw] || raw
    } else if (line.startsWith('- コメント：') || line.startsWith('- コメント:')) {
      current.progressComment = line.replace(/^- コメント[：:]/, '').trim()
    }
  }
  if (current) entries.push(current)
  return entries
}

/**
 * Parse the AI summary section from a 1on1 record.
 */
export function parseSummary(rawMarkdown: string): string {
  const lines = rawMarkdown.split('\n')
  let inSummary = false
  const summaryLines: string[] = []

  for (const line of lines) {
    if (line.startsWith('## 引き継ぎサマリー') || line.startsWith('## AI申し送り')) {
      inSummary = true
      continue
    }
    if (inSummary && line.startsWith('## ')) break
    if (inSummary) summaryLines.push(line)
  }

  return summaryLines.join('\n').trim()
}

/**
 * Build markdown content for saving a 1on1 record.
 */
export function buildOneOnOneMarkdown(data: {
  yearMonth: string
  memberName: string
  actionReviews: { content: string; status: string; comment: string }[]
  goalProgress: { goalLabel: string; status: string; progressComment: string }[]
  condition: ConditionScore
  hearingQuestions: { question: string; memo: string }[]
  additionalMemo: string
  nextActions: ActionItem[]
  aiSummary: string
}): string {
  const lines: string[] = [
    `# 1on1記録 ${data.yearMonth}`,
    '',
    `- 実施日：${new Date().toISOString().split('T')[0]}`,
    `- メンバー：${data.memberName}`,
    '',
  ]

  // Action reviews
  if (data.actionReviews.length > 0) {
    lines.push('## 前回アクション振り返り', '')
    for (const a of data.actionReviews) {
      const statusLabel = a.status === 'completed' ? '完了' : a.status === 'ongoing' ? '継続中' : '未完了'
      lines.push(`- ${a.content}：**${statusLabel}**${a.comment ? `（${a.comment}）` : ''}`)
    }
    lines.push('')
  }

  // Goal progress
  if (data.goalProgress.length > 0) {
    lines.push('## 目標進捗', '')
    for (const g of data.goalProgress) {
      const statusLabel = g.status === 'on-track' ? '順調' : g.status === 'at-risk' ? '要注意' : g.status === 'delayed' ? '遅延' : '未確認'
      lines.push(`### ${g.goalLabel}`)
      lines.push(`- 進捗ステータス：**${statusLabel}**`)
      lines.push(`- コメント：${g.progressComment}`)
      lines.push('')
    }
  }

  // Condition
  lines.push('## コンディション', '')
  lines.push(`- モチベーション：${data.condition.motivation ?? '-'}`)
  lines.push(`- 業務負荷：${data.condition.workload ?? '-'}`)
  lines.push(`- チーム関係性：${data.condition.teamRelations ?? '-'}`)
  if (data.condition.comment) lines.push(`- コメント：${data.condition.comment}`)
  lines.push('')

  // Hearing
  if (data.hearingQuestions.some(q => q.memo)) {
    lines.push('## ヒアリング', '')
    for (const q of data.hearingQuestions) {
      if (q.memo) {
        lines.push(`### ${q.question}`)
        lines.push(q.memo)
        lines.push('')
      }
    }
  }
  if (data.additionalMemo) {
    lines.push('## 追加メモ', '', data.additionalMemo, '')
  }

  // Next actions
  if (data.nextActions.length > 0) {
    lines.push('## ネクストアクション', '')
    data.nextActions.forEach((a, i) => {
      lines.push(`### アクション${i + 1}`)
      lines.push(`- 内容：${a.content}`)
      lines.push(`- 担当：${ASSIGNEE_REVERSE[a.assignee] || a.assignee}`)
      lines.push(`- 期限：${a.deadline}`)
      lines.push('')
    })
  }

  // AI summary
  if (data.aiSummary) {
    lines.push('## 引き継ぎサマリー（AI生成）', '', data.aiSummary, '')
  }

  return lines.join('\n')
}

function fillActionDefaults(partial: Partial<ActionItem>): ActionItem {
  return {
    content: partial.content || '',
    assignee: partial.assignee || 'member',
    deadline: partial.deadline || '',
  }
}
