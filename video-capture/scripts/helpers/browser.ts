import { chromium, Browser, BrowserContext, Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const BASE_URL = 'http://localhost:3000'
const OUTPUT_RAW = path.join(__dirname, '../../output/raw')

/**
 * 録画用ブラウザコンテキストを起動
 * 1920x1080 / deviceScaleFactor=1 / recordVideo有効
 */
export async function launchRecordingBrowser(): Promise<{
  browser: Browser
  context: BrowserContext
  page: Page
}> {
  fs.mkdirSync(OUTPUT_RAW, { recursive: true })

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: OUTPUT_RAW,
      size: { width: 1920, height: 1080 },
    },
  })
  const page = await context.newPage()
  return { browser, context, page }
}

/**
 * 録画を終了しファイルパスを返す
 */
export async function stopRecording(
  page: Page,
  context: BrowserContext,
  browser: Browser,
  outputName: string
): Promise<string> {
  const videoPath = await page.video()?.path()
  await context.close()
  await browser.close()

  if (videoPath) {
    const dest = path.join(OUTPUT_RAW, `${outputName}.webm`)
    fs.renameSync(videoPath, dest)
    console.log(`📹 録画保存: ${dest}`)
    return dest
  }

  throw new Error('録画ファイルが見つかりません')
}

/**
 * APIキーの存在確認
 */
export function checkApiKey(): void {
  const envPath = path.join(__dirname, '../../../web-demo/.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('❌ web-demo/.env.local が見つかりません')
    process.exit(1)
  }
  const content = fs.readFileSync(envPath, 'utf-8')
  const hasKey = /ANTHROPIC_FOUNDRY_API_KEY=.+/.test(content) || /ANTHROPIC_API_KEY=.+/.test(content)
  if (!hasKey) {
    console.error('❌ APIキーが設定されていません。web-demo/.env.local にANTHROPIC_FOUNDRY_API_KEY または ANTHROPIC_API_KEY を設定してください')
    process.exit(1)
  }
  console.log('✅ APIキー確認済み')
}

/**
 * devサーバーの起動待ち（ポーリング）
 */
export async function waitForServer(url: string, timeout: number = 30000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // サーバー未起動
    }
    await new Promise(r => setTimeout(r, 1000))
  }
  throw new Error(`サーバー起動タイムアウト: ${url}`)
}

/**
 * タイムスタンプロガー（ffmpeg分割用）
 * save() は各マーカーの絶対秒数（.time）を出力する
 */
export class TimestampLogger {
  private startTime: number
  private marks: { id: string; time: number }[] = []

  constructor() {
    this.startTime = Date.now()
  }

  mark(id: string): void {
    const elapsed = (Date.now() - this.startTime) / 1000
    this.marks.push({ id, time: elapsed })
    console.log(`⏱ [SPLIT] ${id}: ${elapsed.toFixed(3)}s`)
  }

  save(outputPath: string): void {
    const data = {
      marks: this.marks.map(m => ({
        id: m.id,
        time: parseFloat(m.time.toFixed(3)),
      })),
      // 後方互換: 旧形式のsplitsも出力
      splits: this.marks.map((m, i) => ({
        id: m.id,
        start: i === 0 ? '0.000' : this.marks[i - 1].time.toFixed(3),
        end: m.time.toFixed(3),
      })),
    }
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2))
    console.log(`📋 タイムスタンプ保存: ${outputPath}`)
  }
}
