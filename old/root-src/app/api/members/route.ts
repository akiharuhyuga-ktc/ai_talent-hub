import { NextResponse } from 'next/server'
import { getAllMemberSummaries } from '@/lib/fs/members'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const members = getAllMemberSummaries()
    return NextResponse.json({ members })
  } catch (error) {
    console.error('Failed to read member data:', error)
    return NextResponse.json({ error: 'Failed to read member data' }, { status: 500 })
  }
}
