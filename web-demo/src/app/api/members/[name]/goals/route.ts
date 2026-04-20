import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { safeMemberDir } from '@/lib/fs/members'
import { getActivePeriod, formatPeriodLabel } from '@/lib/utils/period'

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

    const targetPeriod = period || getActivePeriod()
    if (!/^\d{4}-h[12]$/.test(targetPeriod)) {
      return NextResponse.json({ error: 'Invalid period format' }, { status: 400 })
    }
    const goalsDir = path.join(memberDir, 'goals')
    fs.mkdirSync(goalsDir, { recursive: true })

    const today = new Date().toISOString().split('T')[0]
    const markdown = [
      '# 半期目標設定',
      '',
      `- 対象期間：${formatPeriodLabel(targetPeriod)}`,
      `- 作成日：${today}`,
      `- メンバー：${memberName}`,
      '',
      content,
      '',
    ].join('\n')

    const filePath = path.join(goalsDir, `${targetPeriod}.md`)
    fs.writeFileSync(filePath, markdown, 'utf-8')

    return NextResponse.json({ success: true, path: filePath })
  } catch (error) {
    console.error('Failed to save goals:', error)
    return NextResponse.json({ error: 'Failed to save goals' }, { status: 500 })
  }
}
