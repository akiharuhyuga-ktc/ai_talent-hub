/**
 * V02〜V05: 目標設定ウィザード 1本撮り — v2: ストリーミング検出対応
 * Step1(自動ロード) → Step2(マネージャー入力) → Step3(メンバー入力) → Step4(スキップ)
 * → Step5(AI診断) → Step6(AI目標生成) → Step7(壁打ち1回 + 確定保存)
 */
import path from 'path'
import { launchRecordingBrowser, stopRecording, checkApiKey, TimestampLogger } from './helpers/browser'
import { ensureDemoModeOn } from './helpers/demo-mode'
import { scrollWizardToBottom, scrollWizardToTop } from './helpers/scroll'
import { waitForStreamingStart, waitForStreamingEnd } from './helpers/streaming'

const BASE_URL = 'http://localhost:3000'

const INPUT = {
  step2: {
    expectations: 'KINTO UnlimitedのFlutterチームTLとして、チームのアウトプット品質と開発スピードを両立してほしい。後輩エンジニアの技術指導も役割として期待している。来期はR&Dテーマでも成果を出し、技術的なリーダーシップを社内に示してほしい。',
    challenge: '技術の深さを組織の力に変えられていない',
  },
  step3: {
    growthArea: 'アーキテクチャ設計とチームマネジメントの両立。生成AIをアプリ開発に組み込む実装力。',
    difficulties: 'レビューと自分の実装を並行するとどちらも中途半端になる。R&Dの時間が取りにくい。',
    vision: 'チームが自分なしでも回るような仕組みを作り、自分はより難易度の高い技術課題に集中できている状態。',
  },
  step7: {
    feedback: '目標②（挑戦目標）の検証方法をもう少し具体的にしてほしい。「技術検証レポートの提出」だけでなく、チーム内での共有セッション実施やフィードバック収集まで含めた検証プロセスにしたい。',
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

    // 目標タブをクリック
    await page.locator('text=目標').first().click()
    await page.waitForTimeout(FIELD_WAIT)

    // 期間セレクターで2026-h1を選択
    const periodSelect = page.locator('select').first()
    if (await periodSelect.isVisible()) {
      const options = await periodSelect.locator('option').allTextContents()
      const target = options.find(o => o.includes('2026') && o.includes('上期')) || options[0]
      await periodSelect.selectOption({ label: target })
      await page.waitForTimeout(FIELD_WAIT)
    }

    // 「目標設定ウィザード」ボタンをクリック
    await page.click('text=目標設定ウィザード')
    await page.waitForTimeout(STEP_WAIT)

    // === V02: Step1 自動ロード確認 ===
    ts.mark('V02_START')
    await page.waitForSelector('text=読込済み', { timeout: 10000 })
    await page.waitForTimeout(3000)
    ts.mark('V02_END')

    await page.click('text=次へ進む')
    await page.waitForTimeout(FIELD_WAIT)

    // === V03: Step2 マネージャー入力 ===
    ts.mark('V03_START')
    const ta2 = page.locator('textarea')
    await ta2.nth(0).click()
    await page.keyboard.type(INPUT.step2.expectations, { delay: 25 })
    await page.waitForTimeout(FIELD_WAIT)

    const challengeInput = page.locator('input[type="text"]').first()
    await challengeInput.fill(INPUT.step2.challenge)
    await page.waitForTimeout(FIELD_WAIT)
    await scrollWizardToBottom(page, 3000)
    await page.waitForTimeout(STEP_WAIT)
    ts.mark('V03_END')

    await page.click('text=次へ進む')
    await page.waitForTimeout(FIELD_WAIT)

    // Step3: メンバー入力
    const ta3 = page.locator('textarea')
    await ta3.nth(0).fill(INPUT.step3.growthArea)
    await page.waitForTimeout(FIELD_WAIT)
    await ta3.nth(1).fill(INPUT.step3.difficulties)
    await page.waitForTimeout(FIELD_WAIT)
    await ta3.nth(2).fill(INPUT.step3.vision)
    await page.waitForTimeout(FIELD_WAIT)
    await scrollWizardToBottom(page, 3000)
    await page.waitForTimeout(STEP_WAIT)
    await page.click('text=次へ進む')
    await page.waitForTimeout(FIELD_WAIT)

    // Step4: 前期実績 → スキップ
    const skipBtn = page.locator('button:has-text("スキップ")')
    if (await skipBtn.isVisible({ timeout: 3000 })) {
      await skipBtn.click()
      await page.waitForTimeout(FIELD_WAIT)
    }

    // === V04: Step5 AI診断サマリー — 短ショーケース ===
    ts.mark('V04_START')
    console.log('⏳ AI診断サマリーを生成中...')
    await waitForStreamingStart(page)
    ts.mark('V04_STREAM_START')
    console.log('✅ ストリーミング開始')
    await waitForStreamingEnd(page, 'text=この診断で進む')
    ts.mark('V04_AI_DONE')
    console.log('✅ AI診断サマリー 生成完了')
    await page.waitForTimeout(1000)
    await scrollWizardToBottom(page, 4000)
    await scrollWizardToTop(page, 2000)
    await page.waitForTimeout(1000)
    ts.mark('V04_SHOWCASE_END')
    ts.mark('V04_END')

    await page.click('text=この診断で進む')
    await page.waitForTimeout(FIELD_WAIT)

    // === V05: Step6 AI目標生成 — 中ショーケース ===
    ts.mark('V05_START')
    console.log('⏳ AI目標案を生成中...')
    await waitForStreamingStart(page)
    ts.mark('V05_STREAM_START')
    console.log('✅ ストリーミング開始')
    await waitForStreamingEnd(page, 'text=壁打ちへ進む')
    ts.mark('V05_AI_DONE')
    console.log('✅ AI目標案 生成完了')
    await page.waitForTimeout(1000)
    await scrollWizardToBottom(page, 5000)
    await scrollWizardToTop(page, 3000)
    await page.waitForTimeout(1000)
    ts.mark('V05_SHOWCASE_END')
    ts.mark('V05_END')

    // Step7: 壁打ち1回 + 確定保存
    await page.click('text=壁打ちへ進む')
    await page.waitForTimeout(3000) // Step7レンダリング待ち

    // チェックボックスが全選択されていることを確認（未選択なら全クリック）
    const checkboxes = page.locator('input[type="checkbox"]')
    await page.waitForSelector('input[type="checkbox"]', { timeout: 10000 })
    const checkboxCount = await checkboxes.count()
    console.log(`📋 チェックボックス数: ${checkboxCount}`)
    for (let i = 0; i < checkboxCount; i++) {
      const cb = checkboxes.nth(i)
      const checked = await cb.isChecked()
      console.log(`  [${i}] checked: ${checked}`)
      if (!checked) {
        await cb.click()
        await page.waitForTimeout(300)
      }
    }

    // フィードバック入力
    const feedbackTa = page.locator('textarea').last()
    await feedbackTa.click()
    await page.keyboard.type(INPUT.step7.feedback, { delay: 25 })
    await page.waitForTimeout(FIELD_WAIT)

    // 再生成ボタンの状態確認
    const regenBtn = page.locator('button:has-text("再生成")')
    const btnDisabled = await regenBtn.getAttribute('disabled')
    const btnText = await regenBtn.textContent()
    console.log(`📋 再生成ボタン: text="${btnText}", disabled=${btnDisabled}`)

    // 再生成ボタンが有効になるまで待機してクリック
    await page.locator('button:has-text("再生成"):not([disabled])').click({ timeout: 15000 })
    console.log('⏳ 壁打ち再生成中...')

    // Step7のストリーミング検出: animate-spinではなく「再生成中...」テキスト
    await page.waitForSelector('text=再生成中...', { timeout: 10000 })
    ts.mark('V05R_STREAM_START')
    console.log('✅ 再生成開始')
    await page.waitForSelector('button:has-text("再生成中...")', { state: 'hidden', timeout: 180000 })
    ts.mark('V05R_AI_DONE')
    console.log('✅ 壁打ち再生成 完了')

    await page.waitForTimeout(1000)
    await scrollWizardToBottom(page, 4000)
    await scrollWizardToTop(page, 2000)
    await page.waitForTimeout(1000)
    ts.mark('V05R_SHOWCASE_END')

    // 確定保存
    await page.click('text=この目標で確定する')
    await page.waitForTimeout(3000)
    console.log('✅ 目標を保存完了')

    ts.save(path.join(__dirname, '../output/raw/timestamps-v02-v05.json'))

  } finally {
    await stopRecording(page, context, browser, 'goal-wizard-full')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
