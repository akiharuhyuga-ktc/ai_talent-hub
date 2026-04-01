import { NextRequest, NextResponse } from 'next/server'
import { getMemberDetail } from '@/lib/fs/members'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const member = getMemberDetail(params.name)
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    return NextResponse.json({ member })
  } catch (error) {
    console.error('Failed to read member:', error)
    return NextResponse.json({ error: 'Failed to read member data' }, { status: 500 })
  }
}
