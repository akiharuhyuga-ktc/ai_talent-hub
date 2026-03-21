import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { getMembersDir } from '@/lib/fs/paths'
import { getActivePeriod } from '@/lib/utils/period'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const memberName = decodeURIComponent(params.name)
    const memberDir = path.join(getMembersDir(), memberName)
    if (!fs.existsSync(memberDir)) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const { content, period } = await req.json()
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    const filename = period || getActivePeriod()
    const reviewsDir = path.join(memberDir, 'reviews')
    fs.mkdirSync(reviewsDir, { recursive: true })

    const filePath = path.join(reviewsDir, `${filename}.md`)
    fs.writeFileSync(filePath, content, 'utf-8')

    return NextResponse.json({ success: true, path: filePath })
  } catch (error) {
    console.error('Failed to save review:', error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
