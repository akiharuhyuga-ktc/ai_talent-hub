import { NextRequest, NextResponse } from 'next/server'
import { getTeamPeriodMatrix, getAvailablePeriods, isMemberDataDirectoryError } from '@/lib/fs/members'
import { getActivePeriod } from '@/lib/utils/period'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || getActivePeriod()
    const matrix = getTeamPeriodMatrix(period)
    const availablePeriods = getAvailablePeriods()

    return NextResponse.json({ matrix, availablePeriods })
  } catch (error) {
    console.error('Team matrix API error:', error)
    if (isMemberDataDirectoryError(error)) {
      return NextResponse.json(
        {
          error: error.code,
          message: error.hint,
          mode: error.mode,
        },
        { status: 500 }
      )
    }
    return NextResponse.json({ error: 'Failed to get team matrix' }, { status: 500 })
  }
}
