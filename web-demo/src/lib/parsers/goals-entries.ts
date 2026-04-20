import type { GoalProgressEntry } from '@/lib/types'
import { parseGoalFields } from '@/lib/goals/field-parser'

/**
 * Parse goal entries from goals markdown.
 * Supports three formats:
 * 1. Kaonavi format: ## ① 短期成果評価_目標 / ## ② 発揮能力評価_目標
 * 2. Wizard format: 目標①（実行）：... └ 達成した姿：... └ 検証方法：... └ 中間確認：...
 * 3. Template format: ### 目標1 - 目標内容：... - 達成指標（KPI）：... - 中間マイルストーン：...
 */
export function parseGoalEntries(rawMarkdown: string | null): GoalProgressEntry[] {
  if (!rawMarkdown) return []

  // カオナビ新フォーマット判定
  if (rawMarkdown.includes('## ① 短期成果評価_目標')) {
    return parseKaonaviFormat(rawMarkdown)
  }

  const lines = rawMarkdown.split('\n')
  const isWizardFormat = /目標[①②③④⑤⑥⑦⑧⑨⑩]/.test(rawMarkdown)

  if (isWizardFormat) {
    return parseWizardFormat(rawMarkdown)
  } else {
    return parseTemplateFormat(lines)
  }
}

function parseKaonaviFormat(raw: string): GoalProgressEntry[] {
  const { shortTerm, capability } = parseGoalFields(raw)
  const TEMPLATE_PLACEHOLDER = '（上長とのすり合わせ後'

  const extractKaonaviEntry = (
    content: string,
    label: string,
  ): GoalProgressEntry | null => {
    if (!content || content.trim().startsWith(TEMPLATE_PLACEHOLDER)) return null

    // └ サブフィールドの手前までを goalText として抽出
    const firstSubFieldIdx = content.search(/^└/m)
    const goalText = (firstSubFieldIdx >= 0 ? content.slice(0, firstSubFieldIdx) : content).trim()

    const getSubField = (fieldName: string): string => {
      const re = new RegExp(`└\\s*${fieldName}[：:]\\s*\\n?([\\s\\S]*?)(?=\\n└|\\n---\\n|$)`)
      const m = content.match(re)
      return m ? m[1].trim() : ''
    }

    return {
      goalLabel: label,
      goalText,
      achievedState: getSubField('達成した姿'),
      milestone: getSubField('中間確認(?:（[^）]*）)?'),
      verificationMethod: getSubField('検証方法'),
      status: '',
      progressComment: '',
    }
  }

  const entries: GoalProgressEntry[] = []
  const e1 = extractKaonaviEntry(shortTerm, '① 短期成果評価_目標')
  const e2 = extractKaonaviEntry(capability, '② 発揮能力評価_目標')
  if (e1) entries.push(e1)
  if (e2) entries.push(e2)
  return entries
}

function parseWizardFormat(raw: string): GoalProgressEntry[] {
  const entries: GoalProgressEntry[] = []
  const matches = Array.from(raw.matchAll(/目標([①②③④⑤⑥⑦⑧⑨⑩\d]+)(?:（([^）]*)）)?[：:](.+)/g))

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const label = `目標${match[1]}${match[2] ? `（${match[2]}）` : ''}`
    const goalText = match[3].trim()

    // Extract sub-fields between this match and the next
    const startIdx = match.index! + match[0].length
    const endIdx = i + 1 < matches.length ? matches[i + 1].index! : raw.length
    const section = raw.slice(startIdx, endIdx)

    const getField = (prefix: string): string => {
      const re = new RegExp(`[-└]\\s*${prefix}[：:]\\s*(.+)`, 'm')
      const m = section.match(re)
      return m ? m[1].trim() : ''
    }

    entries.push({
      goalLabel: label,
      goalText,
      achievedState: getField('達成した姿'),
      milestone: getField('中間確認'),
      verificationMethod: getField('検証方法'),
      status: '',
      progressComment: '',
    })
  }

  return entries
}

function parseTemplateFormat(lines: string[]): GoalProgressEntry[] {
  const entries: GoalProgressEntry[] = []
  let currentEntry: Partial<GoalProgressEntry> | null = null

  for (const line of lines) {
    const headerMatch = line.match(/^###\s*目標(\d+)/)
    if (headerMatch) {
      if (currentEntry && currentEntry.goalLabel) {
        entries.push(fillDefaults(currentEntry))
      }
      currentEntry = { goalLabel: `目標${headerMatch[1]}` }
      continue
    }

    if (!currentEntry) continue

    if (line.startsWith('- 目標内容：') || line.startsWith('- 目標内容:')) {
      currentEntry.goalText = line.replace(/^- 目標内容[：:]/, '').trim()
    } else if (line.startsWith('- 達成指標') || line.startsWith('- KPI')) {
      currentEntry.verificationMethod = line.replace(/^- (?:達成指標（KPI）|KPI)[：:]/, '').trim()
    } else if (line.startsWith('- 中間マイルストーン') || line.startsWith('- 中間確認')) {
      currentEntry.milestone = line.replace(/^- (?:中間マイルストーン|中間確認)[：:]/, '').trim()
    }
  }

  if (currentEntry && currentEntry.goalLabel) {
    entries.push(fillDefaults(currentEntry))
  }

  return entries
}

function fillDefaults(partial: Partial<GoalProgressEntry>): GoalProgressEntry {
  return {
    goalLabel: partial.goalLabel || '',
    goalText: partial.goalText || '',
    achievedState: partial.achievedState || '',
    milestone: partial.milestone || '',
    verificationMethod: partial.verificationMethod || '',
    status: '',
    progressComment: '',
  }
}
