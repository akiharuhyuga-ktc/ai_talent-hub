import type { GoalsData, SingleGoal, ParsedGoals } from '../types'

export function parseGoals(raw: string): GoalsData {
  const periodMatch = raw.match(/- 対象期間[：:](.*?)(?=\n)/)
  const memberMatch = raw.match(/- メンバー[：:](.*?)(?=\n)/)

  return {
    period: periodMatch ? periodMatch[1].trim() : '2026年上半期',
    memberName: memberMatch ? memberMatch[1].trim() : '',
    rawMarkdown: raw,
  }
}

// 丸数字 → 数値のマッピング
const CIRCLE_NUM_MAP: Record<string, number> = {
  '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5,
}

// 目標セクション見出しの正規表現
const GOAL_HEADING_RE = /^#{0,3}\s*目標([①②③④⑤])[（(](.+?)[）)][：:](.+)$/

export function parseGoalsToSections(markdown: string): ParsedGoals {
  const lines = markdown.split('\n')

  const goalStarts: { lineIndex: number; label: string; type: string; title: string }[] = []
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(GOAL_HEADING_RE)
    if (match) {
      goalStarts.push({ lineIndex: i, label: match[1], type: match[2], title: match[3].trim() })
    }
  }

  if (goalStarts.length === 0) {
    return { header: markdown, goals: [], footer: '' }
  }

  const header = lines.slice(0, goalStarts[0].lineIndex).join('\n')

  const goals: SingleGoal[] = goalStarts.map((start, idx) => {
    const endLine = idx < goalStarts.length - 1
      ? goalStarts[idx + 1].lineIndex
      : findFooterStart(lines, start.lineIndex + 1)
    const content = lines.slice(start.lineIndex, endLine).join('\n').trimEnd()
    return {
      index: CIRCLE_NUM_MAP[start.label] ?? idx + 1,
      label: start.label,
      type: start.type,
      title: start.title,
      content,
    }
  })

  const lastGoalEnd = findFooterStart(lines, goalStarts[goalStarts.length - 1].lineIndex + 1)
  const footer = lines.slice(lastGoalEnd).join('\n').trimStart()

  return { header, goals, footer }
}

function findFooterStart(lines: string[], fromLine: number): number {
  for (let i = fromLine; i < lines.length; i++) {
    const line = lines[i]
    if (GOAL_HEADING_RE.test(line)) continue
    if (/^#{1,2}\s/.test(line)) return i
  }
  return lines.length
}

export function mergeGoalSections(goals: SingleGoal[], footer: string): string {
  const parts = goals.map(g => g.content)
  if (footer.trim()) {
    parts.push(footer.trim())
  }
  return parts.join('\n\n')
}
