import fs from 'fs'
import { NextResponse } from 'next/server'
import { DEMO_MODE_FILE } from '@/lib/fs/paths'

export const dynamic = 'force-dynamic'

function readDemoMode(): boolean {
  try {
    const raw = fs.readFileSync(DEMO_MODE_FILE, 'utf-8')
    const data = JSON.parse(raw)
    return data.enabled === true
  } catch {
    return false
  }
}

function writeDemoMode(enabled: boolean): void {
  fs.writeFileSync(DEMO_MODE_FILE, JSON.stringify({ enabled }), 'utf-8')
}

export async function GET() {
  try {
    const enabled = readDemoMode()
    return NextResponse.json({ enabled })
  } catch (error) {
    console.error('Failed to read demo mode:', error)
    return NextResponse.json({ error: 'Failed to read demo mode' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const current = readDemoMode()
    const next = !current
    writeDemoMode(next)
    return NextResponse.json({ enabled: next })
  } catch (error) {
    console.error('Failed to toggle demo mode:', error)
    return NextResponse.json({ error: 'Failed to toggle demo mode' }, { status: 500 })
  }
}
