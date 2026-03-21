import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { SHARED_DIR } from '@/lib/fs/paths'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { year, content, overwrite } = await req.json()

    if (!year || typeof year !== 'number' || year < 2020 || year > 2099) {
      return NextResponse.json({ error: 'year must be between 2020 and 2099' }, { status: 400 })
    }
    if (!content || typeof content !== 'string' || content.trim().length < 100) {
      return NextResponse.json({ error: 'content must be at least 100 characters' }, { status: 400 })
    }

    const filePath = path.join(SHARED_DIR, `org-policy-${year}.md`)

    if (fs.existsSync(filePath) && !overwrite) {
      return NextResponse.json({
        error: `${year}年度の組織方針は既に存在します。上書きする場合は overwrite: true を指定してください。`,
        exists: true,
      }, { status: 409 })
    }

    fs.writeFileSync(filePath, content, 'utf-8')

    return NextResponse.json({ success: true, path: filePath, year })
  } catch (error) {
    console.error('Failed to save policy:', error)
    return NextResponse.json({ error: 'Failed to save policy' }, { status: 500 })
  }
}
