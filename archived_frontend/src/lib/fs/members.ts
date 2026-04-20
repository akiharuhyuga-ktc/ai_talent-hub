import fs from 'fs'
import path from 'path'
import { DEMO_MEMBERS_DIR, DEMO_MODE_FILE, MEMBERS_DIR, getMembersDir, isDemoMode } from './paths'
import { parseProfile } from '../parsers/profile'
import { parseGoals } from '../parsers/goals'
import { getActivePeriod, parsePeriodFromFilename, sortPeriods, getOneOnOnePeriod, PERIOD_CONFIG } from '../utils/period'
import type { MemberSummary, MemberDetail, OneOnOneRecord, ReviewData, GoalsData, GoalEvaluation, EvaluationGrade, MemberPeriodStatus, TeamPeriodMatrix } from '../types'

export class MemberDataDirectoryError extends Error {
  readonly code = 'MEMBER_DATA_DIRECTORY_MISSING'
  readonly mode: 'demo' | 'standard'
  readonly directoryPath: string
  readonly hint: string

  constructor() {
    const demoMode = isDemoMode()
    const mode = demoMode ? 'demo' : 'standard'
    const directoryPath = demoMode ? DEMO_MEMBERS_DIR : MEMBERS_DIR
    const hint = demoMode
      ? `デモモードが有効ですが、${directoryPath} が存在しません。data/demo-members を配置するか、${DEMO_MODE_FILE} の enabled を false にしてください。`
      : `デモモードが無効のため ${directoryPath} を参照しています。通常データを使わない場合は ${DEMO_MODE_FILE} の enabled を true にしてください。`

    super(`Member data directory not found: ${directoryPath}`)
    this.name = 'MemberDataDirectoryError'
    this.mode = mode
    this.directoryPath = directoryPath
    this.hint = hint
  }
}

function ensureMembersDirExists(membersDir: string): void {
  if (!fs.existsSync(membersDir)) {
    throw new MemberDataDirectoryError()
  }
}

export function isMemberDataDirectoryError(error: unknown): error is MemberDataDirectoryError {
  return error instanceof MemberDataDirectoryError
}

/**
 * Decode + resolve member name to a safe directory path.
 * Throws if the resolved path escapes the members base directory.
 */
export function safeMemberDir(encodedName: string): string {
  const membersDir = getMembersDir()
  const name = decodeURIComponent(encodedName)
  const resolved = path.resolve(membersDir, name)
  const base = path.resolve(membersDir)

  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error('Invalid member name')
  }
  return resolved
}

export function getMemberNames(): string[] {
  const membersDir = getMembersDir()
  ensureMembersDirExists(membersDir)
  return fs.readdirSync(membersDir)
    .filter(name => {
      const full = path.join(membersDir, name)
      try {
        // profile.md が存在するディレクトリのみメンバーとして認識
        return fs.statSync(full).isDirectory() && !name.startsWith('.') &&
          fs.existsSync(path.join(full, 'profile.md'))
      } catch {
        return false
      }
    })
    .sort()
}

export function getAllMemberSummaries(): MemberSummary[] {
  const membersDir = getMembersDir()
  return getMemberNames().map(name => {
    const profilePath = path.join(membersDir, name, 'profile.md')
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
        folderName: name,
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
  let memberDir: string
  try {
    memberDir = safeMemberDir(encodedName)
  } catch {
    return null
  }
  if (!fs.existsSync(memberDir)) return null

  const profilePath = path.join(memberDir, 'profile.md')
  if (!fs.existsSync(profilePath)) return null

  const rawProfile = fs.readFileSync(profilePath, 'utf-8')
  const profile = parseProfile(rawProfile)

  // Load all goal periods
  const goalsDir = path.join(memberDir, 'goals')
  const goalsByPeriod: Record<string, GoalsData> = {}
  if (fs.existsSync(goalsDir)) {
    const periods = sortPeriods(
      fs.readdirSync(goalsDir)
        .map(parsePeriodFromFilename)
        .filter((p): p is string => p !== null)
    )
    for (const period of periods) {
      const filePath = path.join(goalsDir, `${period}.md`)
      goalsByPeriod[period] = parseGoals(fs.readFileSync(filePath, 'utf-8'))
    }
  }
  const activePeriod = getActivePeriod()
  const goals = goalsByPeriod[activePeriod] ?? null

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

  return { ...profile, goals, goalsByPeriod, activePeriod, oneOnOnes, reviews }
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

  const result: ReviewData = {
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

  // Detect new format (wizard-generated) by checking for ## 目標別評価
  const isNewFormat = lines.some(l => l.trim().startsWith('## 目標別評価'))
  if (isNewFormat) {
    result.overallGrade = (getField('総合評価') || '') as EvaluationGrade
    result.overallComment = extractSection('## 総合コメント', ['## 自己評価との乖離分析', '## 評価者コメント', '## マネージャー変更履歴', '## 特記事項'])
    result.selfEvalGapAnalysis = extractSection('## 自己評価との乖離分析', ['## 評価者コメント', '## マネージャー変更履歴', '## 特記事項'])

    // Parse goal evaluations
    const goalEvals: GoalEvaluation[] = []
    let currentGoal: Partial<GoalEvaluation> | null = null
    let inGoalSection = false
    for (const line of lines) {
      if (line.trim() === '## 目標別評価') { inGoalSection = true; continue }
      if (inGoalSection && line.trim().startsWith('## ') && !line.trim().startsWith('### ')) { break }
      if (!inGoalSection) continue

      const goalMatch = line.match(/^### (.+)/)
      if (goalMatch) {
        if (currentGoal && currentGoal.goalLabel) goalEvals.push(currentGoal as GoalEvaluation)
        currentGoal = { goalLabel: goalMatch[1], goalText: '', grade: '' as EvaluationGrade, rationale: '', changeReason: '' }
        continue
      }
      if (!currentGoal) continue
      if (line.startsWith('- 達成度：') || line.startsWith('- 達成度:')) {
        currentGoal.grade = line.replace(/^- 達成度[：:]/, '').replace(/\*\*/g, '').trim() as EvaluationGrade
      } else if (line.startsWith('- 判定根拠：') || line.startsWith('- 判定根拠:')) {
        currentGoal.rationale = line.replace(/^- 判定根拠[：:]/, '').trim()
      }
    }
    if (currentGoal && currentGoal.goalLabel) goalEvals.push(currentGoal as GoalEvaluation)
    result.goalEvaluations = goalEvals

    // Use overallGrade as h2Eval for unified display
    if (result.overallGrade && !result.h2Eval) {
      result.h2Eval = result.overallGrade
    }
  }

  return result
}

// Team Matrix functions

export function getTeamPeriodMatrix(period: string): TeamPeriodMatrix {
  const names = getMemberNames()
  const members = names.map(name => getMemberPeriodStatus(name, period))
  return { period, members }
}

export function getMemberPeriodStatus(memberName: string, period: string): MemberPeriodStatus {
  const membersDir = getMembersDir()
  const memberDir = path.join(membersDir, memberName)

  // Goal: ファイル存在 + 内容が空テンプレートでないことを確認
  const goalPath = path.join(memberDir, 'goals', `${period}.md`)
  let hasGoal = false
  if (fs.existsSync(goalPath)) {
    const content = fs.readFileSync(goalPath, 'utf-8')
    if (content.includes('## ① 短期成果評価_目標')) {
      // 新フォーマット: shortTermフィールドがテンプレートプレースホルダーでないことを確認
      const shortTermMatch = content.match(/## ① 短期成果評価_目標\s*\n+([\s\S]*?)(?:\n---|\n## |$)/)
      const shortTerm = shortTermMatch ? shortTermMatch[1].trim() : ''
      hasGoal = !!shortTerm && !shortTerm.startsWith('（上長とのすり合わせ後')
    } else {
      // 旧フォーマット: ウィザード生成は「目標①」等を含む / テンプレートは「- 目標内容：」が空のまま
      hasGoal = /目標[①②③④⑤]/.test(content) ||
        (content.includes('- 目標内容：') && /- 目標内容：\S/.test(content))
    }
  }

  // Review
  const hasReview = fs.existsSync(path.join(memberDir, 'reviews', `${period}.md`))

  // 1on1 months for this period
  const oneOnOneMonths = getOneOnOneMonthsForPeriod(memberDir, period)

  // Team from profile
  let team = 'other'
  const profilePath = path.join(memberDir, 'profile.md')
  if (fs.existsSync(profilePath)) {
    const profile = parseProfile(fs.readFileSync(profilePath, 'utf-8'))
    team = profile.teamShort || 'other'
  }

  return { memberName, team, hasGoal, oneOnOneMonths, hasReview }
}

function getOneOnOneMonthsForPeriod(memberDir: string, period: string): string[] {
  const ooDir = path.join(memberDir, 'one-on-one')
  if (!fs.existsSync(ooDir)) return []

  const files = fs.readdirSync(ooDir).filter(f => /^\d{4}-\d{2}\.md$/.test(f))

  return files
    .filter(f => {
      const dateStr = f.replace('.md', '')
      return getOneOnOnePeriod(dateStr) === period
    })
    .map(f => f.replace('.md', '').split('-')[1])
}

export function getAvailablePeriods(): string[] {
  const membersDir = getMembersDir()
  const names = getMemberNames()
  const periodSet = new Set<string>()

  for (const name of names) {
    const memberDir = path.join(membersDir, name)
    // goals
    const goalsDir = path.join(memberDir, 'goals')
    if (fs.existsSync(goalsDir)) {
      for (const f of fs.readdirSync(goalsDir)) {
        const p = parsePeriodFromFilename(f)
        if (p) periodSet.add(p)
      }
    }
    // reviews
    const reviewsDir = path.join(memberDir, 'reviews')
    if (fs.existsSync(reviewsDir)) {
      for (const f of fs.readdirSync(reviewsDir)) {
        const p = parsePeriodFromFilename(f)
        if (p) periodSet.add(p)
      }
    }
  }

  periodSet.add(getActivePeriod())
  return sortPeriods(Array.from(periodSet))
}
