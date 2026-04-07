import { NextResponse } from 'next/server'
import { getAllMemberSummaries, isMemberDataDirectoryError } from '@/lib/fs/members'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const members = getAllMemberSummaries()
    return NextResponse.json({ members })
  } catch (error) {
    console.error('Failed to read member data:', error)
    if (isMemberDataDirectoryError(error)) {
      return NextResponse.json(
        {
          error: error.code,
          message: error.hint,
          mode: error.mode,
          directoryPath: error.directoryPath,
        },
        { status: 500 }
      )
    }
    return NextResponse.json({ error: 'Failed to read member data' }, { status: 500 })
  }
}
