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

    const { content, period } = await req.json()
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    const filename = period || '2026-h1'
    const goalsDir = path.join(memberDir, 'goals')
    fs.mkdirSync(goalsDir, { recursive: true })

    const today = new Date().toISOString().split('T')[0]
    const markdown = [
      '# 半期目標設定',
      '',
      `- 対象期間：2026年上半期（4月〜9月）`,
      `- 作成日：${today}`,
      `- メンバー：${memberName}`,
      '',
      '## 目標一覧',
      '',
      content,
      '',
    ].join('\n')

    const filePath = path.join(goalsDir, `${filename}.md`)
    fs.writeFileSync(filePath, markdown, 'utf-8')

    return NextResponse.json({ success: true, path: filePath })
  } catch (error) {
    console.error('Failed to save goals:', error)
    return NextResponse.json({ error: 'Failed to save goals' }, { status: 500 })
  }
}
