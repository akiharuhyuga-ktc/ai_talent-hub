import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { MEMBERS_DIR } from '@/lib/fs/paths'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const memberName = decodeURIComponent(params.name)
    const memberDir = path.join(MEMBERS_DIR, memberName)
    if (!fs.existsSync(memberDir)) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const { content, yearMonth } = await req.json()
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    const filename = yearMonth || new Date().toISOString().slice(0, 7)
    const ooDir = path.join(memberDir, 'one-on-one')
    fs.mkdirSync(ooDir, { recursive: true })

    const filePath = path.join(ooDir, `${filename}.md`)
    fs.writeFileSync(filePath, content, 'utf-8')

    return NextResponse.json({ success: true, path: filePath })
  } catch (error) {
    console.error('Failed to save 1on1 record:', error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
