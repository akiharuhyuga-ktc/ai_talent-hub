import type { MemberProfile, ProjectAllocation } from '../types'

function extractField(md: string, fieldName: string): string {
  const regex = new RegExp(`- ${fieldName}[：:](.*?)(?=\\n- |\\n##|$)`, 's')
  const match = md.match(regex)
  return match ? match[1].trim() : ''
}

function parseProjectLine(line: string): ProjectAllocation | null {
  // Match: "- ProjectName：4月 NN% / 5月 NN% / 6月 NN%"
  const match = line.match(/^-\s+(.+?)[：:]\s*4月\s*(\d+)%\s*\/\s*5月\s*(\d+)%\s*\/\s*6月\s*(\d+)%/)
  if (!match) return null
  const [, name, a, m, j] = match
  const april = parseInt(a), may = parseInt(m), june = parseInt(j)
  return {
    name: name.trim(),
    april,
    may,
    june,
    avgPct: Math.round((april + may + june) / 3),
  }
}

function deriveTeamShort(team: string): string {
  if (team.includes('Flutter')) return 'Flutter'
  if (team.includes('KMP')) return 'KMP'
  if (team.includes('Producer') || team.includes('プロデュー') || team.includes('企画')) return 'Producer'
  if (team.includes('Manager') || team.includes('マネージャー') || team.includes('manager')) return 'Manager'
  return 'その他'
}

export function parseProfile(raw: string): MemberProfile {
  const projSectionMatch = raw.match(/## 担当プロジェクト.*?\n([\s\S]*?)(?=\n##)/)
  const projLines = projSectionMatch ? projSectionMatch[1].split('\n') : []
  const projects = projLines.map(parseProjectLine).filter(Boolean) as ProjectAllocation[]

  const roleSectionMatch = raw.match(/## 期待する役割\n([\s\S]*?)(?=\n##|$)/)
  const roleSection = roleSectionMatch ? roleSectionMatch[1] : ''

  const currentRoleMatch = roleSection.match(/- 現在の期待役割[：:]([\s\S]*?)(?=\n- 中長期|$)/)
  const longTermMatch = roleSection.match(/- 中長期的なキャリア方向性[：:]([\s\S]*?)(?=\n-|$)/)

  const currentRole = currentRoleMatch
    ? currentRoleMatch[1].trim()
    : roleSection.split('\n').filter(l => l.startsWith('- ') && !l.includes('中長期')).map(l => l.replace(/^- /, '')).join('\n').trim()

  const team = extractField(raw, 'チーム')

  return {
    name: extractField(raw, '名前'),
    role: extractField(raw, '役職'),
    team,
    teamShort: deriveTeamShort(team),
    joinedAt: extractField(raw, '入社年'),
    projects,
    skills: {
      technical: extractField(raw, '技術スキル'),
      experience: extractField(raw, '業務経験'),
      strengths: extractField(raw, '強み'),
      challenges: extractField(raw, '成長課題'),
    },
    expectedRole: {
      current: currentRole,
      longTerm: longTermMatch ? longTermMatch[1].trim() : '',
    },
    rawMarkdown: raw,
  }
}
