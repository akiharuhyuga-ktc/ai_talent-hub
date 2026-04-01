/**
 * V01: 組織方針ウィザード（continuousフロー）— v2: ストリーミング検出対応
 * Step1→Step2A→Step3A→Step4(AI方向性)→Step5(AI草案)→Step6(壁打ち1回)→Step7(保存)
 */
import path from 'path'
import { launchRecordingBrowser, stopRecording, checkApiKey, TimestampLogger } from './helpers/browser'
import { ensureDemoModeOn } from './helpers/demo-mode'
import { scrollWizardToBottom, scrollWizardToTop } from './helpers/scroll'
import { waitForStreamingStart, waitForStreamingEnd } from './helpers/streaming'

const BASE_URL = 'http://localhost:3000'

const INPUT = {
  step2a: {
    whatWorked: 'KINTO Unlimited向けの機能開発スピードが向上し、Flutter/KMPの共通化による工数削減を実現できた。TLを中心にしたコードレビュー文化も定着してきた。',
    whatDidntWork: 'R&D成果の社内展開が遅く、実プロジェクトへの反映が限定的だった。メンバーの目標と組織方針の連動が弱く、個人目標が属人的になった。',
    leftBehind: '生成AI活用の技術検証。プロダクトマネジメント力強化の仕組み化。',
  },
  step3a: {
    envChanges: '生成AI技術の実用化フェーズへの移行。KINTO Unlimited向けの機能拡張のペースアップ。社内へのソリューション提供ニーズの増加。',
    techChanges: 'AI活用による開発生産性の向上。KTC内ソリューション展開の加速。メンバーの専門性とマネジメント力の両立育成。',
    focusThemes: 'クロスプラットフォーム基盤の本番適用拡大。AI機能のプロダクト組込み。次世代TLの育成とマネジメント体制強化。',
  },
  step6: {
    feedback: '「重点テーマ」の3つ目「次世代TLの育成」について、もう少し具体的なアクションプランを書き込んでほしい。例えば「TL候補者に対して四半期ごとにリーダーシップ課題を設定し、マネージャーが壁打ち相手となる」のような粒度で。',
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

    // /docs に遷移
    await page.goto(`${BASE_URL}/docs`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(STEP_WAIT)

    // 「組織方針」タブ → 新年度方針作成
    await page.locator('button:has-text("組織方針")').click()
    await page.waitForTimeout(FIELD_WAIT)
    await page.click('text=新年度方針を作成')
    await page.waitForTimeout(STEP_WAIT)

    // === Step1: 年度選択 ===
    await page.waitForSelector('text=継続モード', { timeout: 10000 })
    await page.waitForTimeout(STEP_WAIT)
    await page.click('text=次へ進む')
    await page.waitForTimeout(FIELD_WAIT)

    // === Step2A: 前年度振り返り ===
    const ta2 = page.locator('textarea')
    await ta2.nth(0).fill(INPUT.step2a.whatWorked)
    await page.waitForTimeout(FIELD_WAIT)
    await ta2.nth(1).fill(INPUT.step2a.whatDidntWork)
    await page.waitForTimeout(FIELD_WAIT)
    await ta2.nth(2).fill(INPUT.step2a.leftBehind)
    await page.waitForTimeout(FIELD_WAIT)
    await scrollWizardToBottom(page, 4000)
    await page.waitForTimeout(STEP_WAIT)
    await page.click('text=次へ進む')
    await page.waitForTimeout(FIELD_WAIT)

    // === Step3A: 来期テーマ ===
    const ta3 = page.locator('textarea')
    await ta3.nth(0).fill(INPUT.step3a.envChanges)
    await page.waitForTimeout(FIELD_WAIT)
    await ta3.nth(1).fill(INPUT.step3a.techChanges)
    await page.waitForTimeout(FIELD_WAIT)
    await ta3.nth(2).fill(INPUT.step3a.focusThemes)
    await page.waitForTimeout(FIELD_WAIT)
    await scrollWizardToBottom(page, 4000)
    await page.waitForTimeout(STEP_WAIT)
    await page.click('text=次へ進む')
    await page.waitForTimeout(FIELD_WAIT)

    // === Step4: AI方向性提案 — 初見効果: フル5秒 ===
    console.log('⏳ AI方向性提案を生成中...')
    await waitForStreamingStart(page)
    ts.mark('V01S4_STREAM_START')
    console.log('✅ ストリーミング開始')
    await waitForStreamingEnd(page, 'text=この方向性で草案を生成')
    ts.mark('V01S4_AI_DONE')
    console.log('✅ AI方向性提案 生成完了')
    await page.waitForTimeout(1000)
    await scrollWizardToBottom(page, 5000)
    await scrollWizardToTop(page, 3000)
    await page.waitForTimeout(1000)
    ts.mark('V01S4_SHOWCASE_END')
    await page.click('text=この方向性で草案を生成')
    await page.waitForTimeout(FIELD_WAIT)

    // === Step5: AI草案生成 — 成果物重視: ロングスクロール ===
    console.log('⏳ AI草案を生成中...')
    await waitForStreamingStart(page)
    ts.mark('V01S5_STREAM_START')
    console.log('✅ ストリーミング開始')
    await waitForStreamingEnd(page, 'text=壁打ちへ進む')
    ts.mark('V01S5_AI_DONE')
    console.log('✅ AI草案 生成完了')
    await page.waitForTimeout(1000)
    await scrollWizardToBottom(page, 7000)
    await scrollWizardToTop(page, 4000)
    await page.waitForTimeout(1000)
    ts.mark('V01S5_SHOWCASE_END')
    await page.click('text=壁打ちへ進む')
    await page.waitForTimeout(STEP_WAIT)

    // === Step6: 壁打ち — 対話感: 入力→応答 ===
    const chatInput = page.locator('textarea[placeholder*="修正の指示"]')
    await chatInput.click()
    await page.keyboard.type(INPUT.step6.feedback, { delay: 25 })
    await page.waitForTimeout(FIELD_WAIT)

    const sendBtn = page.locator('button:has(svg)').last()
    await sendBtn.click()
    console.log('⏳ AI壁打ち応答を待機中...')

    await waitForStreamingStart(page)
    ts.mark('V01S6_STREAM_START')
    console.log('✅ ストリーミング開始')
    await page.waitForSelector('.animate-pulse', { state: 'hidden', timeout: 180000 })
    ts.mark('V01S6_AI_DONE')
    console.log('✅ AI壁打ち応答 完了')
    await page.waitForTimeout(1000)
    await scrollWizardToBottom(page, 4000)
    await scrollWizardToTop(page, 2000)
    await page.waitForTimeout(1000)
    ts.mark('V01S6_SHOWCASE_END')

    // 確定
    await page.click('text=この内容で確定する')
    await page.waitForTimeout(STEP_WAIT)

    // === Step7: 確認・保存 ===
    await page.waitForTimeout(1000)
    await scrollWizardToBottom(page, 3000)
    await scrollWizardToTop(page, 2000)
    await page.waitForTimeout(1000)

    const saveBtn = page.locator('button:has-text("保存する")')
    if (await saveBtn.isVisible({ timeout: 5000 })) {
      await saveBtn.click()
      await page.waitForTimeout(3000)
      console.log('✅ 2026年度組織方針を保存完了')
    }

    ts.save(path.join(__dirname, '../output/raw/timestamps-v01.json'))

  } finally {
    await stopRecording(page, context, browser, 'v01_policy_wizard')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
