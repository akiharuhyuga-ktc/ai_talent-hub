/**
 * V06〜V07: 1on1ウィザード 1本撮り
 * Step1(アクション振返り) → Step2(目標進捗) → Step3(コンディション) → Step4(AI質問表示)
 */
import path from 'path'
import { launchRecordingBrowser, stopRecording, checkApiKey, TimestampLogger } from './helpers/browser'
import { ensureDemoModeOn } from './helpers/demo-mode'
import { scrollWizardToBottom, scrollWizardToTop } from './helpers/scroll'

const BASE_URL = 'http://localhost:3000'

const INPUT = {
  step1: {
    // 各アクションのステータス: 完了/未完了/継続中
    action1Status: '完了',
    action1Comment: 'コードレビューガイドラインを作成してチームに共有した。概ね好評。',
    action2Status: '継続中',
    action2Comment: 'R&D調査は着手できたが、まとめまで至らなかった。来月持ち越し。',
  },
  step2: {
    goal1Status: '順調',
    goal1Memo: 'レビュー件数は月20件をキープ。ただし指摘の質にバラつきがある。',
    goal2Status: '遅延',
    goal2Memo: 'R&D時間の確保が難しく、技術検証が予定より1ヶ月遅れている。',
    goal3Status: '順調',
    goal3Memo: 'KINTO Unlimited新機能のアーキテクチャ設計を完了。実装フェーズに入った。',
  },
  step3: {
    motivation: 4,
    workload: 4,
    teamRelations: 5,
    comment: 'R&Dが遅れているのが気になっているが、チームの雰囲気はいい。',
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

    // 1on1タブをクリック
    await page.click('text=1on1記録')
    await page.waitForTimeout(FIELD_WAIT)

    // 「1on1ウィザード」ボタンをクリック
    await page.click('text=1on1ウィザード')
    await page.waitForTimeout(STEP_WAIT)

    // Step1: アクション振り返り
    // 初回の場合（アクションなし）はそのまま次へ進む
    const isFirstTime = await page.locator('text=初回の1on1です').isVisible({ timeout: 2000 }).catch(() => false)

    if (isFirstTime) {
      await page.click('text=次へ進む')
      await page.waitForTimeout(FIELD_WAIT)
    } else {
      // アクションアイテムがある場合: 各アクションのステータスselectを選択してコメント入力
      const selects1 = page.locator('select')
      const textareas1 = page.locator('textarea')
      const selectCount1 = await selects1.count()

      const statuses = [INPUT.step1.action1Status, INPUT.step1.action2Status]
      const comments = [INPUT.step1.action1Comment, INPUT.step1.action2Comment]

      for (let i = 0; i < selectCount1; i++) {
        const status = statuses[i] || '完了'
        const comment = comments[i] || ''
        await selects1.nth(i).selectOption({ label: status })
        await page.waitForTimeout(FIELD_WAIT)
        if (i < await textareas1.count() && comment) {
          await textareas1.nth(i).fill(comment)
          await page.waitForTimeout(FIELD_WAIT)
        }
      }

      await scrollWizardToBottom(page, 3000)
      await page.waitForTimeout(STEP_WAIT)
      await page.click('text=次へ進む')
      await page.waitForTimeout(FIELD_WAIT)
    }

    // === V06: Step2 目標進捗 ===
    ts.mark('V06_START')

    // Step2のselectはStep1のselectとは別ページなのでリセットされている
    const selects2 = page.locator('select')
    const textareas2 = page.locator('textarea')
    const selectCount2 = await selects2.count()
    const textareaCount2 = await textareas2.count()
    console.log(`📋 Step2: select=${selectCount2}, textarea=${textareaCount2}`)

    const goalStatuses = [INPUT.step2.goal1Status, INPUT.step2.goal2Status, INPUT.step2.goal3Status]
    const goalMemos = [INPUT.step2.goal1Memo, INPUT.step2.goal2Memo, INPUT.step2.goal3Memo]

    for (let i = 0; i < Math.min(selectCount2, 3); i++) {
      await selects2.nth(i).selectOption({ label: goalStatuses[i] })
      await page.waitForTimeout(FIELD_WAIT)
      if (i < textareaCount2) {
        await textareas2.nth(i).fill(goalMemos[i])
        await page.waitForTimeout(FIELD_WAIT)
      }
    }

    await scrollWizardToBottom(page, 4000)
    await page.waitForTimeout(2000)
    await scrollWizardToTop(page, 3000)
    await page.waitForTimeout(STEP_WAIT)
    ts.mark('V06_END')

    // 「次へ進む」がdisabledの場合はスクリーンショットを撮ってデバッグ
    const nextBtn = page.locator('button:has-text("次へ進む")')
    const isEnabled = await nextBtn.isEnabled()
    console.log(`📋 次へ進む enabled: ${isEnabled}`)
    if (!isEnabled) {
      await page.screenshot({ path: path.join(__dirname, '../output/raw/debug-v06-step2.png') })
      console.log('📸 debug-v06-step2.png saved')
    }
    await nextBtn.click({ timeout: 5000 }).catch(async () => {
      // disabled対策: scrollして未入力のフィールドがないか確認
      console.log('⚠️ 次へ進む disabled — force click試行')
      await nextBtn.click({ force: true })
    })
    await page.waitForTimeout(FIELD_WAIT)

    // Step3: コンディション
    const sliders = page.locator('input[type="range"]')
    const sliderCount = await sliders.count()

    if (sliderCount >= 3) {
      await sliders.nth(0).dispatchEvent('mousedown')
      await sliders.nth(0).fill(String(INPUT.step3.motivation))
      await page.waitForTimeout(FIELD_WAIT)
      await sliders.nth(1).dispatchEvent('mousedown')
      await sliders.nth(1).fill(String(INPUT.step3.workload))
      await page.waitForTimeout(FIELD_WAIT)
      await sliders.nth(2).dispatchEvent('mousedown')
      await sliders.nth(2).fill(String(INPUT.step3.teamRelations))
      await page.waitForTimeout(FIELD_WAIT)
    }

    const commentTa = page.locator('textarea').last()
    await commentTa.fill(INPUT.step3.comment)
    await page.waitForTimeout(FIELD_WAIT)

    await scrollWizardToBottom(page, 3000)
    await page.waitForTimeout(STEP_WAIT)
    await page.click('text=次へ進む')
    await page.waitForTimeout(FIELD_WAIT)

    // === V07: Step4 AI質問表示 — 短ショーケース ===
    ts.mark('V07_START')
    // 非ストリーミング（通常fetch）のためSTREAM_START=遷移直後
    ts.mark('V07_STREAM_START')
    console.log('⏳ AIヒアリング質問を生成中...')
    await page.waitForSelector('text=意図', { timeout: 180000 })
    ts.mark('V07_AI_DONE')
    console.log('✅ AIヒアリング質問 生成完了')
    await page.waitForTimeout(1000)
    await scrollWizardToBottom(page, 4000)
    await scrollWizardToTop(page, 2000)
    await page.waitForTimeout(1000)
    ts.mark('V07_SHOWCASE_END')
    ts.mark('V07_END')

    ts.save(path.join(__dirname, '../output/raw/timestamps-v06-v07.json'))

  } finally {
    await stopRecording(page, context, browser, 'oneonone-wizard-full')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
