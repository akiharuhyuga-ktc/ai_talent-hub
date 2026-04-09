import fs from 'fs'
import path from 'path'
import { SHARED_DIR, SHARED_DOCS } from './paths'
import { getActivePeriod, getFiscalYear } from '../utils/period'

/**
 * 利用可能な組織方針の年度一覧を返す（降順）
 */
export function getOrgPolicyYears(): number[] {
  try {
    return fs.readdirSync(SHARED_DIR)
      .map(f => f.match(/^org-policy-(\d{4})\.md$/)?.[1])
      .filter((v): v is string => !!v)
      .map(Number)
      .sort((a, b) => b - a)
  } catch {
    return []
  }
}

/**
 * 指定年度（省略時：アクティブ期間の年度）の組織方針を取得
 */
export function loadOrgPolicy(year?: number): {
  content: string
  year: number | null
  availableYears: number[]
} {
  const availableYears = getOrgPolicyYears()
  const targetYear = year ?? getFiscalYear(getActivePeriod())

  // Try versioned file for target year
  const versionedPath = path.join(SHARED_DIR, `org-policy-${targetYear}.md`)
  if (fs.existsSync(versionedPath)) {
    return { content: fs.readFileSync(versionedPath, 'utf-8'), year: targetYear, availableYears }
  }

  // Try latest available year
  if (availableYears.length > 0) {
    const latestYear = availableYears[0]
    const latestPath = path.join(SHARED_DIR, `org-policy-${latestYear}.md`)
    return { content: fs.readFileSync(latestPath, 'utf-8'), year: latestYear, availableYears }
  }

  // Fallback to legacy department-policy.md
  return {
    content: fs.existsSync(SHARED_DOCS.policy) ? fs.readFileSync(SHARED_DOCS.policy, 'utf-8') : '',
    year: null,
    availableYears,
  }
}

/**
 * 共有ドキュメントを一括読み込み（後方互換）
 * orgPolicy は loadOrgPolicy() 経由で最新年度を取得
 */
export function loadSharedDocs(policyYear?: number): {
  policy: string   // 後方互換キー（orgPolicy と同一内容）
  orgPolicy: string
  policyYear: number | null
  availableYears: number[]
  criteria: string
  guidelines: string
} {
  const read = (p: string) => {
    try { return fs.readFileSync(p, 'utf-8') } catch { return '' }
  }
  const org = loadOrgPolicy(policyYear)
  return {
    policy: org.content,    // 後方互換
    orgPolicy: org.content,
    policyYear: org.year,
    availableYears: org.availableYears,
    criteria: read(SHARED_DOCS.criteria),
    guidelines: read(SHARED_DOCS.guidelines),
  }
}
