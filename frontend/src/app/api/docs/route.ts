import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { SHARED_DIR } from '@/lib/fs/paths'
import { loadSharedDocs, getOrgPolicyYears } from '@/lib/fs/shared-docs'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const yearParam = searchParams.get('year')
    const strict = searchParams.get('strict') === 'true'
    const year = yearParam ? Number(yearParam) : undefined

    // Strict mode: return only the exact year's policy (no fallback)
    if (strict && year) {
      const filePath = path.join(SHARED_DIR, `org-policy-${year}.md`)
      const exists = fs.existsSync(filePath)
      return NextResponse.json({
        orgPolicy: exists ? fs.readFileSync(filePath, 'utf-8') : '',
        policyYear: exists ? year : null,
        exists,
        availableYears: getOrgPolicyYears(),
        criteria: '',
        guidelines: '',
      })
    }

    const shared = loadSharedDocs(year)
    return NextResponse.json({
      orgPolicy: shared.orgPolicy,
      policyYear: shared.policyYear,
      availableYears: shared.availableYears,
      criteria: shared.criteria,
      guidelines: shared.guidelines,
    })
  } catch (error) {
    console.error('Failed to read docs:', error)
    return NextResponse.json({ error: 'Failed to read documents' }, { status: 500 })
  }
}
