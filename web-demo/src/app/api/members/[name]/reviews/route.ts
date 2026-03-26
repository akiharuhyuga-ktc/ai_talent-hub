import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { safeMemberDir } from '@/lib/fs/members'
import { getActivePeriod } from '@/lib/utils/period'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    let memberDir: string
    try {
      memberDir = safeMemberDir(params.name)
    } catch {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
    }
    if (!fs.existsSync(memberDir)) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    const memberName = decodeURIComponent(params.name)

    const { content, period } = await req.json()
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    const filename = period || getActivePeriod()
    if (!/^\d{4}-h[12]$/.test(filename)) {
      return NextResponse.json({ error: 'Invalid period format' }, { status: 400 })
    }
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
