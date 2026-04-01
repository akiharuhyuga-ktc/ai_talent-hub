/**
 * V10: チームマトリクス表示 — v2: スクロール追加、表示延長
 * /team ページに遷移し、ローディング→データ表示→スクロールを録画
 */
import path from 'path'
import { launchRecordingBrowser, stopRecording, TimestampLogger } from './helpers/browser'
import { scrollWizardToBottom, scrollWizardToTop } from './helpers/scroll'

const BASE_URL = 'http://localhost:3000'

async function main() {
  const { browser, context, page } = await launchRecordingBrowser()
  const ts = new TimestampLogger()

  try {
    // デモモードをAPI経由で有効化
    const res = await page.request.get(`${BASE_URL}/api/demo-mode`)
    const { enabled } = await res.json()
    if (!enabled) {
      await page.request.post(`${BASE_URL}/api/demo-mode`)
      const verify = await page.request.get(`${BASE_URL}/api/demo-mode`)
      const { enabled: confirmed } = await verify.json()
      if (!confirmed) throw new Error('デモモードの有効化に失敗しました')
    }
    console.log('✅ デモモード ON 確認済み')

    // /team に直接遷移
    await page.goto(`${BASE_URL}/team`)
    await page.waitForLoadState('networkidle')
    console.log('⏳ /team ページ読込完了、マトリクスデータ待機中...')

    // マトリクスデータ行が描画されるまで待機
    await page.waitForSelector('table tbody tr', { timeout: 30000 })
    console.log('✅ マトリクステーブル データ表示確認')

    ts.mark('V10_START')

    // ヘッダー・カラム名を読ませる静止
    await page.waitForTimeout(3000)

    // 下部のメンバーを見せるスクロール
    await scrollWizardToBottom(page, 5000)

    // 先頭に戻す
    await scrollWizardToTop(page, 3000)

    // 余韻
    await page.waitForTimeout(2000)

    ts.mark('V10_END')
    console.log('✅ チームマトリクス 録画完了')

    ts.save(path.join(__dirname, '../output/raw/timestamps-v10.json'))

  } finally {
    await stopRecording(page, context, browser, 'v10_matrix')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
