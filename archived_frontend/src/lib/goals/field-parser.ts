/**
 * ゴール生成ストリームを2フィールドに分割するユーティリティ
 *
 * AI出力フォーマット:
 *   ## ① 短期成果評価_目標
 *   （内容）
 *   ---
 *   ## ② 発揮能力評価_目標
 *   （内容）
 */

export const SHORT_TERM_MARKER = '## ① 短期成果評価_目標'
export const CAPABILITY_MARKER = '## ② 発揮能力評価_目標'

export interface ParsedGoalFields {
  shortTerm: string
  capability: string
}

/**
 * テキスト全体から2フィールドを抽出する。
 * ストリーミング中（② がまだ来ていない）でも呼び出し可能。
 */
export function parseGoalFields(text: string): ParsedGoalFields {
  const shortTermIdx = text.indexOf(SHORT_TERM_MARKER)
  const capabilityIdx = text.indexOf(CAPABILITY_MARKER)

  // ① のみない場合：② だけ出力されるケース（targetField === 'capability' の部分再生成）
  if (shortTermIdx === -1) {
    if (capabilityIdx === -1) {
      return { shortTerm: '', capability: '' }
    }
    const capability = text
      .slice(capabilityIdx + CAPABILITY_MARKER.length)
      .replace(/^\n+/, '')
      .trim()
    return { shortTerm: '', capability }
  }

  if (capabilityIdx === -1) {
    // ② がまだ来ていない（ストリーミング中）
    const shortTerm = text
      .slice(shortTermIdx + SHORT_TERM_MARKER.length)
      .replace(/^\n+/, '')
    return { shortTerm, capability: '' }
  }

  const shortTerm = text
    .slice(shortTermIdx + SHORT_TERM_MARKER.length, capabilityIdx)
    .replace(/^\n+/, '')
    .replace(/\n+---\n+$/, '')
    .trim()

  const capability = text
    .slice(capabilityIdx + CAPABILITY_MARKER.length)
    .replace(/^\n+/, '')
    .trim()

  return { shortTerm, capability }
}

/**
 * 2フィールドを保存用markdownに組み立てる。
 */
export function assembleGoalMarkdown(
  shortTerm: string,
  capability: string,
): string {
  return `${SHORT_TERM_MARKER}\n\n${shortTerm}\n\n---\n\n${CAPABILITY_MARKER}\n\n${capability}`
}
