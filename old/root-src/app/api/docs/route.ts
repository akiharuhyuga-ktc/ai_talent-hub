import { NextResponse } from 'next/server'
import fs from 'fs'
import { SHARED_DOCS } from '@/lib/fs/paths'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json({
      policy: fs.readFileSync(SHARED_DOCS.policy, 'utf-8'),
      criteria: fs.readFileSync(SHARED_DOCS.criteria, 'utf-8'),
      guidelines: fs.readFileSync(SHARED_DOCS.guidelines, 'utf-8'),
    })
  } catch (error) {
    console.error('Failed to read docs:', error)
    return NextResponse.json({ error: 'Failed to read documents' }, { status: 500 })
  }
}
