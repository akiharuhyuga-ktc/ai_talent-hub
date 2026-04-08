export type HalfYear = 'h1' | 'h2'
export type Period = `${number}-${'h1' | 'h2'}`

export const PERIOD_CONFIG = {
  h1: { startMonth: 4, endMonth: 9, label: '上期', displayRange: '4月〜9月' },
  h2: { startMonth: 10, endMonth: 3, label: '下期', displayRange: '10月〜3月' },
} as const

/**
 * 指定日時のアクティブ期間を返す
 * 4〜9月 → {year}-h1
 * 10〜12月 → {year}-h2
 * 1〜3月 → {year-1}-h2
 */
export function getActivePeriod(date: Date = new Date()): Period {
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  if (month >= 4 && month <= 9) return `${year}-h1` as Period
  if (month >= 10) return `${year}-h2` as Period
  return `${year - 1}-h2` as Period
}

/**
 * 期間の表示ラベルを返す
 * "2026-h1" → "2026年上期（4月〜9月）"
 * "2026-h2" → "2026年下期（10月〜3月）"
 */
export function formatPeriodLabel(period: string): string {
  const match = period.match(/^(\d{4})-(h[12])$/)
  if (!match) return period
  const [, year, half] = match
  const config = PERIOD_CONFIG[half as HalfYear]
  return `${year}年${config.label}（${config.displayRange}）`
}

/**
 * 期間を降順ソート（新しい期間が先頭）
 */
export function sortPeriods(periods: string[]): string[] {
  return [...periods].sort((a, b) => b.localeCompare(a))
}

/**
 * ファイル名から Period を抽出（バリデーション付き）
 */
export function parsePeriodFromFilename(filename: string): string | null {
  const match = filename.match(/^(\d{4}-h[12])\.md$/)
  return match ? match[1] : null
}

/**
 * 期間から年度を取得
 * "2026-h1" → 2026, "2026-h2" → 2026
 */
export function getFiscalYear(period: string): number {
  const match = period.match(/^(\d{4})/)
  return match ? parseInt(match[1]) : new Date().getFullYear()
}

/**
 * 1on1記録のファイル名(YYYY-MM)からPeriodを判定
 * 4-9月 → {year}-h1, 10-12月 → {year}-h2, 1-3月 → {year-1}-h2
 */
export function getOneOnOnePeriod(filename: string): string | null {
  const match = filename.match(/^(\d{4})-(\d{2})/)
  if (!match) return null
  const year = parseInt(match[1])
  const month = parseInt(match[2])
  if (month >= 4 && month <= 9) return `${year}-h1`
  if (month >= 10) return `${year}-h2`
  return `${year - 1}-h2`
}

/**
 * 1on1記録を指定期間でフィルタリング
 */
export function filterOneOnOnesByPeriod<T extends { filename: string }>(
  records: T[],
  period: string
): T[] {
  return records.filter(r => {
    const dateStr = r.filename.replace('.md', '')
    return getOneOnOnePeriod(dateStr) === period
  })
}
