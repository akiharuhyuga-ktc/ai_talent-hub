/**
 * 既存の目標ファイル（旧3目標形式）をカオナビ2フィールド形式に移行するスクリプト
 *
 * 実行方法:
 *   cd /Users/akiharu.hyuga/Documents/Talent_Management_AI/web-demo
 *   npx tsx ../scripts/migrate-goals-to-kaonavi-format.ts
 */

import * as fs from 'fs'
import * as path from 'path'

// .env.local を手動ロード
const envPath = path.join(__dirname, '../web-demo/.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const match = line.match(/^([^#=][^=]*)=(.*)$/)
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
  }
}

const DATA_DIR = path.join(__dirname, '../data/members')
const PERIOD = '2026-h1'

function hasGoalContent(content: string): boolean {
  return (
    content.includes('## 目標①') ||
    content.includes('目標①（実行）') ||
    content.includes('目標①（実行／') ||
    (content.includes('└ 達成した姿') && content.length > 300)
  )
}

function buildEmptyTemplate(memberName: string): string {
  return `# 半期目標設定

- 対象期間：2026年上期（4月〜9月）
- 作成日：
- メンバー：${memberName}

## ① 短期成果評価_目標

（上長とのすり合わせ後、今期の目標を記載してください）

---

## ② 発揮能力評価_目標

（上長とのすり合わせ後、今期の目標を記載してください）
`
}

async function convertWithClaude(oldContent: string, memberName: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_FOUNDRY_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY or ANTHROPIC_FOUNDRY_API_KEY が設定されていません')

  const foundryBaseUrl = process.env.ANTHROPIC_FOUNDRY_BASE_URL
  const isFoundry = !!process.env.ANTHROPIC_FOUNDRY_API_KEY
  const deploymentName = process.env.DEPLOYMENT_NAME || 'claude-sonnet-4-5-20251001'

  const endpoint = isFoundry
    ? `${(foundryBaseUrl || '').replace(/\/$/, '')}/v1/messages`
    : 'https://api.anthropic.com/v1/messages'

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  }
  if (isFoundry) {
    headers['api-key'] = apiKey
    headers['x-api-key'] = apiKey
  } else {
    headers['x-api-key'] = apiKey
  }

  const systemPrompt = `あなたは人材育成の専門コンサルタントです。
旧フォーマットの目標設定を、カオナビの2フィールド形式に変換してください。

【振り分け基準】
- ① 短期成果評価_目標（What）: 期末に成果物・数値・状態の達成で評価できる内容
  → 旧フォーマットの「実行目標」「挑戦目標」をここに統合する
- ② 発揮能力評価_目標（How）: キャリアラダーに対する行動・能力・再現性
  → 旧フォーマットの「インパクト目標」をここに変換する

【変換ルール】
- 目標①（実行）と目標②（挑戦）は1つの文章ブロックに統合して①に記載
- 目標③（インパクト）は②に記載
- 各フィールドの構造（目標文・└達成した姿・└検証方法・└中間確認・└根拠）は維持する
- 「3目標の整合確認」テーブルは削除する
- 「## 目標一覧」セクションヘッダーは削除する
- 内容・情報量は変えない（情報の損失・追加なし）
- Markdownの太字記法（**太字**）は使わない

【出力フォーマット（必ずこの形式で）】
# 半期目標設定

- 対象期間：{元のデータから}
- 作成日：{元のデータから}
- メンバー：{元のデータから}

## ① 短期成果評価_目標

{目標①と目標②を統合した内容ブロック}

└ 達成した姿：...
└ 検証方法：...
└ 中間確認（3ヶ月時点）：...
└ 根拠：...

---

## ② 発揮能力評価_目標

{目標③の内容ブロック}

└ 達成した姿：...
└ 検証方法：...
└ 中間確認（3ヶ月時点）：...
└ 根拠：...`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: deploymentName,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `以下の旧フォーマット目標設定を新フォーマットに変換してください。\n\nメンバー名: ${memberName}\n\n---\n${oldContent}`,
        },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API error ${res.status}: ${err}`)
  }

  const json = await res.json() as { content: Array<{ text: string }> }
  return json.content[0].text
}

async function main() {
  console.log('=== カオナビ目標フォーマット移行スクリプト ===\n')

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`❌ データディレクトリが見つかりません: ${DATA_DIR}`)
    process.exit(1)
  }

  const memberDirs = fs.readdirSync(DATA_DIR).filter((d) =>
    fs.statSync(path.join(DATA_DIR, d)).isDirectory()
  )

  let converted = 0
  let templated = 0
  let skipped = 0
  const errors: string[] = []

  for (const memberName of memberDirs) {
    const goalPath = path.join(DATA_DIR, memberName, 'goals', `${PERIOD}.md`)
    const backupPath = `${goalPath}.bak`

    if (!fs.existsSync(goalPath)) {
      console.log(`⏭  ${memberName}: goalファイルなし、スキップ`)
      skipped++
      continue
    }

    const original = fs.readFileSync(goalPath, 'utf-8')

    // すでに新形式なら何もしない
    if (original.includes('## ① 短期成果評価_目標')) {
      console.log(`✅ ${memberName}: すでに新形式、スキップ`)
      skipped++
      continue
    }

    // バックアップ作成
    fs.copyFileSync(goalPath, backupPath)
    console.log(`📦 ${memberName}: バックアップ作成 (${PERIOD}.md.bak)`)

    if (hasGoalContent(original)) {
      try {
        console.log(`🤖 ${memberName}: AI変換中...`)
        const newContent = await convertWithClaude(original, memberName)
        fs.writeFileSync(goalPath, newContent, 'utf-8')
        console.log(`✅ ${memberName}: AI変換完了`)
        converted++
      } catch (err) {
        const errMsg = `${memberName}: 変換失敗 - ${(err as Error).message}`
        console.error(`❌ ${errMsg}`)
        errors.push(errMsg)
        // バックアップから元に戻す
        fs.copyFileSync(backupPath, goalPath)
      }
    } else {
      const newTemplate = buildEmptyTemplate(memberName)
      fs.writeFileSync(goalPath, newTemplate, 'utf-8')
      console.log(`📝 ${memberName}: テンプレートを新形式に更新`)
      templated++
    }
  }

  console.log('\n=== 完了 ===')
  console.log(`AI変換: ${converted}名`)
  console.log(`テンプレート更新: ${templated}名`)
  console.log(`スキップ: ${skipped}名`)
  if (errors.length > 0) {
    console.log(`エラー: ${errors.length}件`)
    errors.forEach((e) => console.log(`  - ${e}`))
  }
}

main().catch(console.error)
