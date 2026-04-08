import type { GoalsData } from '../types'

export function parseGoals(raw: string): GoalsData {
  const periodMatch = raw.match(/- 対象期間[：:](.*?)(?=\n)/)
  const memberMatch = raw.match(/- メンバー[：:](.*?)(?=\n)/)

  return {
    period: periodMatch ? periodMatch[1].trim() : '2026年上半期',
    memberName: memberMatch ? memberMatch[1].trim() : '',
    rawMarkdown: raw,
  }
}
