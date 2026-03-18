import fs from 'fs'
import path from 'path'
import { MEMBERS_DIR } from './paths'
import { parseProfile } from '../parsers/profile'
import { parseGoals } from '../parsers/goals'
import type { MemberSummary, MemberDetail, OneOnOneRecord } from '../types'

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

  return { ...profile, goals, oneOnOnes }
}
