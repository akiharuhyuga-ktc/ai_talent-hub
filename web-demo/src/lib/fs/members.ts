import fs from 'fs'
import path from 'path'
import { MEMBERS_DIR } from './paths'
import { parseProfile } from '../parsers/profile'
import { parseGoals } from '../parsers/goals'
import type { MemberSummary, MemberDetail, OneOnOneRecord, ReviewData } from '../types'

export function getMemberNames(): string[] {
  return fs.readdirSync(MEMBERS_DIR)
    .filter(name => {
      const full = path.join(MEMBERS_DIR, name)
      try {
        return fs.statSync(full).isDirectory() && !name.startsWith('.')
      } catch {
        return false
      }
    })
    .sort()
}

export function getAllMemberSummaries(): MemberSummary[] {
  return getMemberNames().map(name => {
    const profilePath = path.join(MEMBERS_DIR, name, 'profile.md')
    if (!fs.existsSync(profilePath)) return null
    try {
      const raw = fs.readFileSync(profilePath, 'utf-8')
      const profile = parseProfile(raw)
      const rdProject = profile.projects.find(p =>
        p.name.includes('R＆D') || p.name.includes('R&D')
      )
      const mainProject = [...profile.projects].sort((a, b) => b.avgPct - a.avgPct)[0]
      return {
        name: profile.name || name,
        role: profile.role,
        team: profile.team,
        teamShort: profile.teamShort,
        joinedAt: profile.joinedAt,
        projects: profile.projects,
        mainProject: mainProject?.name ?? '',
        rdPct: rdProject?.avgPct ?? 0,
      } satisfies MemberSummary
    } catch {
      return null
    }
  }).filter(Boolean) as MemberSummary[]
}

export function getMemberDetail(encodedName: string): MemberDetail | null {
  const name = decodeURIComponent(encodedName)
  const memberDir = path.join(MEMBERS_DIR, name)
  if (!fs.existsSync(memberDir)) return null

  const profilePath = path.join(memberDir, 'profile.md')
  if (!fs.existsSync(profilePath)) return null

  const rawProfile = fs.readFileSync(profilePath, 'utf-8')
  const profile = parseProfile(rawProfile)

  const goalsPath = path.join(memberDir, 'goals', '2026-h1.md')
  let goals = null
  if (fs.existsSync(goalsPath)) {
    goals = parseGoals(fs.readFileSync(goalsPath, 'utf-8'))
  }

  const ooDir = path.join(memberDir, 'one-on-one')
  let oneOnOnes: OneOnOneRecord[] = []
  if (fs.existsSync(ooDir)) {
    oneOnOnes = fs.readdirSync(ooDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .map(filename => ({
        filename,
        date: filename.replace('.md', ''),
        rawMarkdown: fs.readFileSync(path.join(ooDir, filename), 'utf-8'),
      }))
  }

  const reviewDir = path.join(memberDir, 'reviews')
  let reviews: ReviewData[] = []
  if (fs.existsSync(reviewDir)) {
    reviews = fs.readdirSync(reviewDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .map(filename => {
        const raw = fs.readFileSync(path.join(reviewDir, filename), 'utf-8')
        return parseReview(raw, filename)
      })
      .filter(Boolean) as ReviewData[]
  }

  return { ...profile, goals, oneOnOnes, reviews }
}

function parseReview(raw: string, filename: string): ReviewData | null {
  const lines = raw.split('\n')

  const getField = (prefix: string): string => {
    const line = lines.find(l => l.startsWith(`- ${prefix}：`) || l.startsWith(`- ${prefix}:`))
    if (!line) return ''
    return line.replace(new RegExp(`^- ${prefix}[：:]\\s*`), '').replace(/\*\*/g, '').trim()
  }

  const h2Eval = getField('下期ミッション評価')
  const annualEval = getField('年間ミッション評価')
  const grade = getField('等級')
  const roleName = getField('役職')
  const promotion = lines.some(l => l.includes('昇格：★'))

  // Extract period
  const periodLine = lines.find(l => l.startsWith('- 対象期間'))
  const period = periodLine ? periodLine.replace(/^- 対象期間[：:]\s*/, '').trim() : '2025年度下期'

  // Extract sections by ## and ### headers
  const extractSection = (startHeader: string, endHeaders: string[]): string => {
    const startIdx = lines.findIndex(l => l.trim() === startHeader)
    if (startIdx < 0) return ''
    let endIdx = lines.length
    for (let i = startIdx + 1; i < lines.length; i++) {
      const trimmed = lines[i].trim()
      if (endHeaders.some(h => trimmed === h || (trimmed.startsWith('## ') && !trimmed.startsWith('### ')))) {
        endIdx = i
        break
      }
    }
    return lines.slice(startIdx + 1, endIdx).join('\n').trim()
  }

  // Feedback sections
  const feedbackPoints = extractSection('### 評価のポイント', ['### 今後の期待', '## 各評価者コメント'])
  const feedbackExpectations = extractSection('### 今後の期待', ['## 各評価者コメント'])

  // Evaluator comments
  const evaluatorComments: ReviewData['evaluatorComments'] = []
  const commentLabels = ['本人コメント', 'プレ一次評価', '一次評価', '二次評価', '三次評価']

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line.startsWith('### ')) continue

    const headerText = line.replace('### ', '')
    const matchedLabel = commentLabels.find(l => headerText.startsWith(l))
    if (!matchedLabel) continue

    // Extract evaluator name from parentheses
    const evalMatch = headerText.match(/[（(](.+?)[）)]/)
    const evaluator = evalMatch ? evalMatch[1] : ''

    // Find content until next ### or ## or end
    let endIdx = lines.length
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim().startsWith('### ') || lines[j].trim().startsWith('## ')) {
        endIdx = j
        break
      }
    }
    const content = lines.slice(i + 1, endIdx).join('\n').trim()
    if (content) {
      evaluatorComments.push({ label: matchedLabel, evaluator, content })
    }
  }

  return {
    period,
    filename,
    grade,
    roleName,
    h2Eval,
    annualEval,
    promotion,
    feedbackPoints,
    feedbackExpectations,
    evaluatorComments,
    rawMarkdown: raw,
  }
}
