/**
 * V08〜V09: 評価ウィザード 1本撮り
 * Step1(素材確認 + 自己評価入力) → Step2(AI評価ドラフト生成)
 */
import path from 'path'
import { launchRecordingBrowser, stopRecording, checkApiKey, TimestampLogger } from './helpers/browser'
import { ensureDemoModeOn } from './helpers/demo-mode'
import { scrollWizardToBottom, scrollWizardToTop } from './helpers/scroll'
import { waitForStreamingStart, waitForStreamingEnd } from './helpers/streaming'

const BASE_URL = 'http://localhost:3000'
const REVIEW_PASSWORD = 'akiharu0901!'

const INPUT = {
  step1: {
    selfEvalGrade: 'A',
    achievementComment: 'FlutterチームのTLとして月20件以上のコードレビューを継続し、チームのコード品質向上に貢献した。KINTO Unlimited新機能のアーキテクチャ設計をリードし、リリースを予定通り完了できた。',
    reflectionComment: 'R&Dテーマの進捗が計画比で遅れた。レビューと自身の実装の優先度付けに課題があり、後半は自分の開発時間が不足した。来期は仕組みで解決したい。',
    notableEpisodes: '新卒メンバーのオンボーディングを自主的に担当し、3ヶ月でチームの戦力として育て上げた。マネージャーからの依頼ではなく、自発的な行動として高く評価したい。',
    environmentChanges: '期中にKINTO Unlimitedの大型リリースが追加され、当初計画になかった工数が発生した。この影響でR&D時間が圧迫された。',
  },
}

const FIELD_WAIT = 800
const STEP_WAIT = 1500

async function main() {
  checkApiKey()
  const { browser, context, page } = await launchRecordingBrowser()
  const ts = new TimestampLogger()

  try {
    await ensureDemoModeOn(page)

    // 田中の詳細ページへ
    await page.goto(`${BASE_URL}/members/${encodeURIComponent('田中')}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(STEP_WAIT)

    // 評価タブをクリック（ラベルは「評価 (N)」形式）
    await page.locator('button:has-text("評価")').first().click()
    await page.waitForTimeout(STEP_WAIT)

    // デバッグ: 現在の画面状態をスクリーンショットで確認
    await page.screenshot({ path: path.join(__dirname, '../output/raw/debug-v08-before-password.png') })

    // パスワード入力
    const passwordInput = page.locator('input[type="password"]')
    if (await passwordInput.isVisible({ timeout: 5000 })) {
      await passwordInput.fill(REVIEW_PASSWORD)
      await page.click('text=解除する')
      // パスワード解除後、評価ウィザードボタンが表示されるまで待つ
      await page.waitForSelector('text=評価ウィザード', { timeout: 10000 })
      await page.waitForTimeout(STEP_WAIT)
    }

    // 「評価ウィザード」ボタンをクリック
    await page.click('text=評価ウィザード')
    await page.waitForTimeout(STEP_WAIT)

    // === V08: Step1 評価素材確認 + 自己評価入力 ===
    ts.mark('V08_START')

    // 自動集約データが表示されるまで待機
    await page.waitForTimeout(2000)

    // 集約データをスクロールして見せる
    await scrollWizardToBottom(page, 4000)
    await page.waitForTimeout(2000)
    await scrollWizardToTop(page, 3000)
    await page.waitForTimeout(STEP_WAIT)

    // 自己評価入力
    const gradeSelect = page.locator('select').first()
    await gradeSelect.selectOption(INPUT.step1.selfEvalGrade)
    await page.waitForTimeout(FIELD_WAIT)

    const ta = page.locator('textarea')
    await ta.nth(0).fill(INPUT.step1.achievementComment)
    await page.waitForTimeout(FIELD_WAIT)
    await ta.nth(1).fill(INPUT.step1.reflectionComment)
    await page.waitForTimeout(FIELD_WAIT)
    await ta.nth(2).fill(INPUT.step1.notableEpisodes)
    await page.waitForTimeout(FIELD_WAIT)
    await ta.nth(3).fill(INPUT.step1.environmentChanges)
    await page.waitForTimeout(FIELD_WAIT)

    // 入力内容をスクロールして見せる
    await scrollWizardToBottom(page, 4000)
    await page.waitForTimeout(2000)
    await scrollWizardToTop(page, 3000)
    await page.waitForTimeout(STEP_WAIT)
    ts.mark('V08_END')

    // 次へ進む
    await page.click('text=次へ進む')
    await page.waitForTimeout(FIELD_WAIT)

    // === V09: Step2 AI評価ドラフト — 中ショーケース ===
    ts.mark('V09_START')
    console.log('⏳ AI評価ドラフトを生成中...')
    await waitForStreamingStart(page)
    ts.mark('V09_STREAM_START')
    console.log('✅ ストリーミング開始')
    await waitForStreamingEnd(page, 'text=確認・修正へ進む')
    ts.mark('V09_AI_DONE')
    console.log('✅ AI評価ドラフト 生成完了')
    await page.waitForTimeout(1000)
    await scrollWizardToBottom(page, 5000)
    await scrollWizardToTop(page, 3000)
    await page.waitForTimeout(1000)
    ts.mark('V09_SHOWCASE_END')
    ts.mark('V09_END')

    ts.save(path.join(__dirname, '../output/raw/timestamps-v08-v09.json'))

  } finally {
    await stopRecording(page, context, browser, 'review-wizard-full')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
