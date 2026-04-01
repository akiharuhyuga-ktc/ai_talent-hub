/**
 * デモ動画撮影用データセットアップ
 *
 * 作成するもの:
 * - talent-management/shared/org-policy-2025.md（V01 continuousフローの前提）
 *
 * 作成しないもの:
 * - 田中/goals/2026-h1.md → V02-V05の目標設定ウィザード実行中に生成される
 * - 田中/one-on-one/2026-06.md → V06-V07の1on1ウィザード実行中に生成される
 */

import fs from 'fs'
import path from 'path'

const PROJECT_ROOT = path.join(__dirname, '../..')
const SHARED_DIR = path.join(PROJECT_ROOT, 'talent-management', 'shared')
const DEMO_MEMBERS = path.join(PROJECT_ROOT, 'data', 'demo-members')

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true })
}

function writeIfMissing(filePath: string, content: string, label: string) {
  if (fs.existsSync(filePath)) {
    console.log(`⏭ スキップ（既存）: ${label}`)
    return
  }
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, content, 'utf-8')
  console.log(`✅ 作成: ${label}`)
}

// ==========================================
// org-policy-2025.md（V01用）
// ==========================================
const ORG_POLICY_2025 = `# モバイルアプリ開発部 2025年度 組織方針

## ミッション

KINTOグループのモバイルアプリケーション開発を通じて、顧客体験の向上とビジネス価値の創出に貢献する。

## 環境認識

### 外部環境
- モバイルアプリ市場の成熟に伴い、品質・UXでの差別化が重要性を増している
- クロスプラットフォーム技術（Flutter, KMP）の実用性が向上し、開発効率化の選択肢が広がった
- 生成AI技術の急速な進展により、開発プロセスへの適用可能性が見えてきた

### 内部環境
- Flutter/KMPの2チーム体制が安定稼働し、KINTO Unlimited向け開発が順調に推移
- R&D活動は個人の自主性に依存しており、組織的な成果創出には課題がある
- メンバーの専門性は高いが、マネジメント・リーダーシップ層が薄い

## 2つの柱

### 柱① KTC内ソリューション
- KINTO Unlimitedアプリの継続的な機能拡張・品質向上
- 販売店DXアプリケーションの企画・開発
- 社内ツールのモバイル対応

### 柱② R&D・技術革新
- クロスプラットフォーム技術（Flutter/KMP）の深化と標準化
- AI活用プロダクトのPoC開発
- 次世代開発プロセスの検証

## チーム体制

| チーム | 役割 | 人数 |
|--------|------|------|
| Flutter | アプリUI・販売店DX・AIプロダクト | 約9名 |
| KMP | 共通ロジック・First Note・R&D | 約10名 |
| Producer | 企画提案・PoC要件定義 | 約5名 |

## 行動指針

1. **「使われるもの」を作る**：技術的な美しさより、ユーザーに届く価値を重視する
2. **学習速度を武器にする**：新技術のキャッチアップを個人任せにせず、チームの仕組みで加速する
3. **種をまき、芽を出す**：R&Dは「試して終わり」ではなく、実プロジェクトへの橋渡しまでを責任範囲とする
`

// ==========================================
// 存在確認・作成
// ==========================================
function main() {
  console.log('🔧 デモデータセットアップ開始\n')

  // === クリーンアップ: ウィザードが生成するファイルを削除 ===
  const CLEAN_FILES = [
    { path: path.join(DEMO_MEMBERS, '田中', 'goals', '2026-h1.md'), label: '田中/goals/2026-h1.md' },
    { path: path.join(DEMO_MEMBERS, '田中', 'one-on-one', '2026-06.md'), label: '田中/one-on-one/2026-06.md' },
  ]

  for (const item of CLEAN_FILES) {
    if (fs.existsSync(item.path)) {
      fs.unlinkSync(item.path)
      console.log(`🗑 削除: ${item.label}`)
    }
  }

  // org-policy-2025.md
  writeIfMissing(
    path.join(SHARED_DIR, 'org-policy-2025.md'),
    ORG_POLICY_2025,
    'org-policy-2025.md（V01 continuousフロー用）'
  )

  // 確認：田中の1on1記録（2026-04, 05）
  const ooDir = path.join(DEMO_MEMBERS, '田中', 'one-on-one')
  const required1on1 = ['2026-04.md', '2026-05.md']
  for (const f of required1on1) {
    const fp = path.join(ooDir, f)
    if (fs.existsSync(fp)) {
      console.log(`✅ 確認済み: 田中/one-on-one/${f}`)
    } else {
      console.warn(`⚠️ 不足: 田中/one-on-one/${f} — V08の集約データに影響します`)
    }
  }

  console.log('\n✅ セットアップ完了')
}

main()
