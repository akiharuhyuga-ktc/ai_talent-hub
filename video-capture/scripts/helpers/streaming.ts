import { Page } from '@playwright/test'

/**
 * ストリーミング開始を検出
 *
 * UIの表示パターン:
 * - テキスト未到達時: animate-spin（ローディングスピナー）が表示
 * - テキスト到達後: animate-pulse（ブリンクカーソル）が表示
 *
 * どちらかが出た時点でAI生成が開始されたと判定する。
 * Step7壁打ち再生成は別途 text=再生成中... で検出すること。
 */
export async function waitForStreamingStart(page: Page, timeout = 60000): Promise<void> {
  await page.waitForSelector('.animate-spin, .animate-pulse', { timeout })
  await page.waitForTimeout(500)
}

/**
 * ストリーミング完了を検出（完了ボタンの出現）
 */
export async function waitForStreamingEnd(
  page: Page,
  doneSelector: string,
  timeout = 180000,
): Promise<void> {
  await page.waitForSelector(doneSelector, { timeout })
}
