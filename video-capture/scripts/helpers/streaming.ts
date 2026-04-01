import { Page } from '@playwright/test'

/**
 * ストリーミング開始を検出（ブリンクカーソル animate-pulse の出現）
 * テキストが実際に流れ始めるまで500ms追加待機（TTFT吸収）
 *
 * Step7壁打ち再生成は animate-spin を使うため、この関数ではなく
 * waitForSelector('text=再生成中...') で別途検出すること
 */
export async function waitForStreamingStart(page: Page, timeout = 60000): Promise<void> {
  await page.waitForSelector('.animate-pulse', { timeout })
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
