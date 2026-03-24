# AIタレントハブ システム設計書

> 文書バージョン：2.3
> 作成日：2026-03-21
> 最終更新：2026-03-21（チームマトリクスビュー（セクション16）を追加）
> 対象システム：KTC TalentHub（モバイルアプリ開発部 AIタレントマネジメントシステム）

---

## 1. システム概要

### 1.1 目的・背景

KTC TalentHub は、モバイルアプリ開発部のマネージャーが部下24名の目標設定・1on1・評価を効率的かつ高品質に運用するための AI 支援システムである。

Claude を「AI秘書」として活用し、以下を実現する。

- **目標設定支援**：部方針・評価基準・メンバープロフィールを横断的に参照し、個人に最適化された目標案を AI が生成
- **1on1準備**：過去の1on1記録と目標進捗から、ヒアリング項目を自動提案
- **評価ドラフト作成**：事実ベースの評価コメント骨子を AI が生成
- **チーム横断分析**：リソース配分・目標難易度バランスの俯瞰

このシステムは**意思決定の補助**に徹し、評価の最終判断・人事的決定はマネージャーが行う方針を厳守する。

### 1.2 ユーザー

| 項目 | 内容 |
|------|------|
| マネージャー | 日向彰治（Akiharu Hyuga） |
| 所属 | モバイルアプリ開発部 |
| 管理メンバー数 | 24名（Flutter / KMP / Producer の3チーム） |
| 対象期 | 2026年上期（4月〜9月） |

### 1.3 技術スタック

| レイヤー | 技術 | バージョン |
|----------|------|-----------|
| フレームワーク | Next.js (App Router) | 14.2.35 |
| 言語 | TypeScript | ^5 |
| UI | React | ^18 |
| スタイリング | Tailwind CSS | ^3.4.1 |
| Tailwind プラグイン | @tailwindcss/typography | ^0.5.19 |
| Markdown レンダリング | react-markdown + remark-gfm | ^10.1.0 / ^4.0.1 |
| CSS ユーティリティ | clsx, tailwind-merge | ^2.1.1 / ^3.5.0 |
| AI SDK | @anthropic-ai/sdk | ^0.79.0 |
| Markdown パース（未使用） | gray-matter | ^4.0.3 |
| データストア | ファイルシステム（Markdown） | - |

---

## 2. アーキテクチャ

### 2.1 全体構成図

```
┌─────────────────────────────────────────────────────────────────┐
│                        ブラウザ（localhost:3000）                    │
│                                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌─────────────┐   │
│  │ダッシュボード│  │メンバー詳細    │  │組織方針ドキュメント│  │目標設定ウィザード│   │
│  │ (/)       │  │(/members/[name])│  │(/docs)    │  │(モーダル)     │   │
│  └──────────┘  └──────────────┘  └──────────┘  └─────────────┘   │
│  ┌──────────────┐                                                  │
│  │チームマトリクス │                                                  │
│  │(/team)        │                                                  │
│  └──────────────┘                                                  │
│                                             ┌─────────────┐        │
│                                             │1on1ウィザード  │        │
│                                             │(モーダル)     │        │
│                                             └─────────────┘        │
│                                             ┌─────────────┐        │
│                                             │評価ウィザード  │        │
│                                             │(モーダル)     │        │
│                                             └─────────────┘        │
│                                             ┌─────────────┐        │
│                                             │組織方針ウィザード│        │
│                                             │(モーダル)     │        │
│                                             └─────────────┘        │
└──────────────┬──────────────────────────────────────────────────┘
               │ HTTP (fetch)
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js API Routes（サーバーサイド）              │
│                                                                     │
│  GET /api/members           メンバー一覧                             │
│  GET /api/members/[name]    メンバー詳細                             │
│  POST /api/members/[name]/goals           目標保存                   │
│  POST /api/members/[name]/goals/diagnosis  AI診断サマリー生成         │
│  POST /api/members/[name]/goals/generate   AI目標生成                │
│  POST /api/chat                            AIチャット                │
│  GET /api/docs                             共有ドキュメント取得       │
│  POST /api/members/[name]/one-on-one/questions  AI質問生成           │
│  POST /api/members/[name]/one-on-one/summary    AI引き継ぎサマリー    │
│  POST /api/members/[name]/one-on-one            1on1記録保存          │
│  POST /api/members/[name]/reviews/draft         AI評価ドラフト生成    │
│  POST /api/members/[name]/reviews/comment       AI評価者コメント生成  │
│  POST /api/members/[name]/reviews               評価保存              │
│  POST /api/docs/policy/direction                AI組織方針の方向性提案│
│  POST /api/docs/policy/draft                    AI組織方針ドラフト生成│
│  POST /api/docs/policy/refine                   AI組織方針リファイン  │
│  POST /api/docs/policy/save                     組織方針保存          │
│  GET  /api/team/matrix                          チームマトリクス取得  │
└──────────────┬──────────────┬──────────────────────────────────┘
               │              │
    ┌──────────▼───┐    ┌────▼──────────────────────┐
    │ ファイルシステム │    │ AI API                       │
    │                  │    │                              │
    │ data/members/    │    │ パス1: Azure AI Foundry       │
    │   {name}/        │    │   (ANTHROPIC_FOUNDRY_API_KEY) │
    │   ├ profile.md   │    │                              │
    │   ├ goals/       │    │ パス2: Anthropic API 直接     │
    │   ├ one-on-one/  │    │   (ANTHROPIC_API_KEY)        │
    │   └ reviews/     │    │                              │
    │                  │    │ ※ キーなし→エラー返却        │
    │ talent-management│    │   （v1.5でモック廃止）        │
    │ /shared/         │    └──────────────────────────────┘
    │   ├ department-  │
    │   │  policy.md   │
    │   ├ evaluation-  │
    │   │  criteria.md │
    │   └ guidelines.md│
    └──────────────────┘
```

### 2.2 ディレクトリ構成

```
Talent_Management_AI/
├── .gitignore                  ← data/ を除外（個人情報保護）
├── package.json                ← ルート（web-demo と同一内容）
├── data/                       ← 【.gitignore対象】個人データ集約
│   ├── archive/                ← 元データ（xlsx, pptx, pdf）
│   ├── resources/              ← リソース管理表
│   ├── .demo-mode.json         ← デモモード状態（v1.6新設）
│   ├── members/                ← メンバー個別データ（24名分）
│   │   └── {name}/
│   │       ├── profile.md      ← プロフィール
│   │       ├── goals/
│   │       │   └── 2026-h1.md  ← 半期目標
│   │       ├── one-on-one/     ← 1on1記録（YYYY-MM.md）
│   │       └── reviews/        ← 評価（YYYY-h{1|2}.md）
│   │           └── 2025-h2.md
│   └── demo-members/           ← デモ用架空メンバーデータ（5名分、v1.6新設）
│       └── {name}/             ← 構成は members/ と同一
├── talent-management/          ← 共有ドキュメント・テンプレート
│   ├── CLAUDE.md               ← AI行動指針
│   ├── shared/
│   │   ├── department-policy.md    ← 組織方針（旧名。後方互換のため残存）
│   │   ├── org-policy-{year}.md   ← 組織方針（年度別、v1.7新設）
│   │   ├── evaluation-criteria.md  ← 評価基準（キャリアラダー）
│   │   └── guidelines.md          ← 運用ガイドライン
│   ├── templates/
│   │   ├── profile-template.md
│   │   ├── goal-template.md
│   │   ├── one-on-one-template.md
│   │   └── review-template.md
│   └── members/                ← （現在は空。data/membersに移行済み）
├── web-demo/                   ← Next.js Webアプリケーション
│   ├── package.json
│   ├── next.config.mjs
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── postcss.config.mjs
│   └── src/
│       ├── app/                ← ページ・APIルート
│       │   ├── team/          ← チームマトリクスビュー
│       ├── components/         ← UIコンポーネント
│       ├── hooks/              ← カスタムフック
│       └── lib/                ← ユーティリティ・型定義・AI連携
└── docs/                       ← ドキュメント
```

### 2.3 データフロー

#### 読み取りフロー（ダッシュボード表示時）

```
1. ブラウザが / にアクセス
2. page.tsx（Server Component）が getAllMemberSummaries() を呼び出し
3. members.ts が data/members/ 配下のディレクトリを走査
4. 各メンバーの profile.md を読み取り、parseProfile() で構造化
5. MemberSummary[] としてクライアントに渡す
6. MemberGrid がチームフィルター付きでカードグリッドを描画
```

#### AI チャットフロー（廃止）

> **v1.6で廃止**：AIチャットサイドバーは v1.6 で廃止された。すべてのAI支援機能は目標設定ウィザード・1on1ウィザード・評価ウィザードの3つに統合されている。以下は旧仕様の記録として残す。

```
1. ユーザーがサイドバーにメッセージ入力
2. useChat フックが POST /api/chat を呼び出し
3. API Route で API キーの有無を確認
   - キーなし → エラーレスポンスを返却（v1.5でモック廃止済み）
   - キーあり → システムプロンプトを構築し、Claude API を呼び出し
4. レスポンスを { content, mode } で返却
5. クライアントがメッセージ一覧に追加・描画
```

#### 目標設定ウィザードフロー

```
1. メンバー詳細ページの「目標設定ウィザード」ボタンで GoalWizard を起動
2. Step1: 固定情報（部方針・評価基準・プロフィール・ガイドライン）の読み込み確認
3. Step2: マネージャーが期待・課題を入力
4. Step3: メンバー本人の意見を代入力
5. Step4: 前期実績データ入力（スキップ可）
6. Step5: POST /api/members/[name]/goals/diagnosis → AI が診断サマリーを生成
7. Step6: POST /api/members/[name]/goals/generate → AI が目標案を生成
8. Step7: フィードバックによる壁打ち（最大2回）→ 確定時に POST /api/members/[name]/goals で保存
```

---

## 3. データ設計

### 3.1 ファイルベースデータ構造

本システムはデータベースを使用せず、**Markdown ファイルをデータストア**として使用する。すべての個人データは `data/members/{name}/` 配下に集約される。

#### 3.1.1 プロフィール（`profile.md`）

```markdown
# メンバープロフィール

## 基本情報
- 名前：{名前}
- 役職：{役職}
- チーム：{所属グループ} / {チーム略称}
- 入社年：{YYYY/MM/DD}

## 担当プロジェクト（2026年4月〜6月）
- {プロジェクト名}：4月 {N}% / 5月 {N}% / 6月 {N}%

## スキル・経験
- 技術スキル：{技術スキルの箇条書き}
- 業務経験：{業務経験の箇条書き}
- 強み：{強みの箇条書き}
- 成長課題：{課題の箇条書き}

## 期待する役割
- 現在の期待役割：{現在の役割・ミッション}
- 中長期的なキャリア方向性：{中長期キャリア}
```

**パーサー**：`lib/parsers/profile.ts` の `parseProfile()` が正規表現で各フィールドを抽出し、`MemberProfile` 型に変換する。プロジェクト配分は「4月 NN% / 5月 NN% / 6月 NN%」形式をパースし、3ヶ月平均を自動計算する。

#### 3.1.2 目標（`goals/2026-h1.md`）

```markdown
# 半期目標設定

- 対象期間：2026年上半期（4月〜9月）
- 作成日：{YYYY-MM-DD}
- メンバー：{名前}

## 目標一覧

{目標本文（ウィザードまたはテンプレート形式）}
```

**パーサー**：`lib/parsers/goals.ts` の `parseGoals()` が対象期間・メンバー名を抽出し、本文は `rawMarkdown` として保持する。

#### 3.1.3 1on1記録（`one-on-one/YYYY-MM.md`）

ファイル名がそのまま日付として使用される。テンプレートに従い、前回からの変化・目標進捗・ネクストアクション等を記録する。

#### 3.1.4 評価（`reviews/YYYY-h{1|2}.md`）

`parseReview()` 関数（`lib/fs/members.ts` 内）が以下を構造化して抽出する。

| フィールド | 抽出方法 |
|-----------|---------|
| 対象期間 | `- 対象期間：` 行 |
| 等級 | `- 等級：` 行 |
| 役職 | `- 役職：` 行 |
| 下期ミッション評価 | `- 下期ミッション評価：` 行（S/A/B/C） |
| 年間ミッション評価 | `- 年間ミッション評価：` 行（S/A/B/C） |
| 昇格フラグ | `昇格：★` の存在確認 |
| 評価のポイント | `### 評価のポイント` セクション |
| 今後の期待 | `### 今後の期待` セクション |
| 各評価者コメント | `### 本人コメント` / `### プレ一次評価` / `### 一次評価` / `### 二次評価` / `### 三次評価` セクション |

### 3.2 共有ドキュメント（`talent-management/shared/`）

| ファイル | 内容 | 用途 |
|---------|------|------|
| `department-policy.md` | モバイルアプリ開発部の部方針（FY2026）。ミッション、来期環境認識、2つの柱（KTC内ソリューション / R&D）、チーム体制、R&D計画等 | 目標設定時の組織目標参照、AIプロンプトへの注入 |
| `evaluation-criteria.md` | キャリアラダー（等級1〜6 / サブ等級1〜5）。Impact（複雑性・不確実性・作用範囲）とJob/Skill（専門性）の2軸評価 | 目標難易度の妥当性確認、AI診断時の基準 |
| `guidelines.md` | 運用ガイドライン。Claude の役割定義、運用サイクル、依頼方法、目標立案ルール、ファイル命名規則等 | AIチャットのシステムプロンプトに注入、ウィザードの目標生成ルールに使用 |

### 3.3 型定義一覧（`lib/types.ts`）

| 型名 | 用途 |
|------|------|
| `ProjectAllocation` | プロジェクト配分（名前、4〜6月の月別%、平均%） |
| `MemberProfile` | メンバープロフィール全体（基本情報、プロジェクト、スキル、期待役割、rawMarkdown） |
| `GoalsData` | 目標データ（期間、メンバー名、rawMarkdown） |
| `OneOnOneRecord` | 1on1記録（ファイル名、日付、rawMarkdown） |
| `ReviewData` | 評価データ（期間、等級、役職、評価、フィードバック、各評価者コメント、rawMarkdown） |
| `MemberDetail` | MemberProfile + goals + oneOnOnes + reviews の複合型 |
| `MemberSummary` | ダッシュボード用の軽量型（mainProject、rdPct を含む） |
| `ManagerInput` | ウィザード Step2（マネージャーの期待、最大課題） |
| `MemberInput` | ウィザード Step3（成長領域、困りごと、1年後ビジョン） |
| `PreviousPeriod` | ウィザード Step4（前期目標、達成レベル、未達理由） |
| `GoalWizardState` | ウィザード全体の状態（7ステップ分のデータ + 診断 + 目標 + 壁打ち履歴） |
| `WizardContextData` | ウィザードに渡す固定コンテキスト（メンバー名、プロフィール、部方針、評価基準、ガイドライン） |
| `ChatMessage` | チャットメッセージ（role: user/assistant、content） |
| `ChatRequest` | チャットAPIリクエスト（messages、memberName、memberContext） |
| `ConditionScore` | 1on1コンディションスコア（モチベーション・業務負荷・チーム関係の3軸、1〜5） |
| `ActionItemReview` | 前回アクションアイテムの振り返り（完了チェック・コメント付き） |
| `GoalProgressEntry` | 目標進捗エントリ（ステータス・進捗メモ付き） |
| `HearingQuestion` | AIヒアリング質問（質問文・意図・メモ） |
| `ActionItem` | ネクストアクション（内容・担当者・期限） |
| `OneOnOneWizardState` | 1on1ウィザード全体の状態（5ステップ分のデータ + 引き継ぎサマリー + 保存先） |
| `OneOnOneWizardContextData` | 1on1ウィザードに渡す固定コンテキスト（メンバー名、プロフィール、目標、前回記録、部方針、ガイドライン） |
| `MemberPeriodStatus` | チームマトリクス: メンバー1名分の期間別ステータス（目標有無、1on1実施月、評価有無） |
| `TeamPeriodMatrix` | チームマトリクス: 期間全体のマトリクスデータ（期間 + メンバーステータス配列） |

---

## 4. 画面設計

### 4.1 ダッシュボード（`/`）

**ファイル**：`app/page.tsx`（Server Component）

**レンダリング方式**：サーバーサイドで `getAllMemberSummaries()` を実行し、クライアントコンポーネントに渡す。

#### 構成要素

| コンポーネント | 説明 |
|---------------|------|
| `StatsBar` | メンバー数、実案件稼働率、R&D稼働率、Flutter/KMP/Producer人数を6列グリッドで表示。R&D稼働率カードはインディゴ背景でアクセント表示 |
| `MemberGrid` | チームフィルター（全員/Flutter/KMP/Producer/その他）付きカードグリッド。2列レイアウト |
| `MemberCard` | チームバッジ、R&D配分バッジ、名前、役職、入社年、プロジェクト配分バー（棒グラフ）、詳細リンク |

**チームフィルター**：ボタンピル形式。選択中はインディゴ背景白文字、非選択は白背景グレー枠。各ボタンにメンバー数を表示。0人のチームは非表示。

### 4.2 メンバー詳細（`/members/[name]`）

**ファイル**：`app/members/[name]/page.tsx`（Server Component）→ `MemberDetailClient`（Client Component）

**レイアウト**：タブコンテンツがフル幅で表示される（v1.6でAIチャットサイドバーを廃止し、メインコンテンツがフル幅に変更）。

パンくずリスト：`← ダッシュボード / {メンバー名}`

#### 4.2.1 タブ構成

| タブID | ラベル | コンポーネント |
|--------|--------|---------------|
| `profile` | プロフィール | `ProfileTab` |
| `goals` | 目標（2026上期） | `GoalsTab` |
| `reviews` | 評価 ({N}) | `ReviewsTab` |
| `one-on-one` | 1on1記録 ({N}) | `OneOnOneTab` |

デフォルトタブは `profile`。

#### プロフィールタブ

- **ヒーローヘッダー**：名前頭文字アイコン + 名前 + チームバッジ + 役職 + チーム + 入社年。インディゴ〜パープルのグラデーション背景
- **2列レイアウト**
  - 左：スキル・経験（技術スキル/業務経験/強み/成長課題）+ 期待する役割（現在/中長期）
  - 右：担当プロジェクト（月別%表示 + プログレスバー）

#### 目標タブ

- 「未記入」バッジ（目標本文が空の場合）
- 「目標設定ウィザード」ボタン → クリックでウィザードモーダルを表示
- 既存目標は MarkdownRenderer で表示

#### 評価タブのパスワード保護

`ReviewsTab` は**パスワードゲート**を実装している。

| 項目 | 内容 |
|------|------|
| パスワード | `akiharu0901!`（ハードコード） |
| 保存先 | `sessionStorage`（キー: `reviews_unlocked`） |
| 有効期間 | ブラウザセッション中のみ |
| UI | パスワード入力フォーム + 「解除する」ボタン |

解除後は `ReviewCard` コンポーネントで以下を表示する。
- 評価バッジ（S/A/B/C を色分け表示、下期評価 + 年間評価）
- 等級・役職・昇格フラグ
- フィードバック（評価のポイント / 今後の期待）
- 各評価者コメント（アコーディオン形式、本人コメント/プレ一次/一次/二次/三次）

#### 1on1記録タブ

日付降順で1on1記録を表示。各記録はヘッダー（日付）+ 本文（Markdown描画）。

### 4.3 部方針ドキュメント（`/docs`）

**ファイル**：`app/docs/page.tsx`（Server Component）

**レイアウト**：左サイドバーナビ + 右メインコンテンツ。

| タブ | アイコン | ソースファイル |
|------|---------|---------------|
| 部方針 | - | `department-policy.md` |
| 評価基準 | - | `evaluation-criteria.md` |
| 運用ガイドライン | - | `guidelines.md` |

サイドバーはスティッキー配置（`top-28`）。選択中のタブはインディゴ背景。

### 4.4 AIチャットサイドバー（廃止）

> **v1.6で廃止**：AIチャットサイドバーは v1.6 で廃止された。すべてのAI支援機能は以下の3ウィザードに移行済みである。
> - **目標設定ウィザード**（セクション7）：目標の診断・生成・壁打ち
> - **1on1ウィザード**（セクション10）：ヒアリング質問生成・引き継ぎサマリー
> - **評価ウィザード**（セクション11）：評価ドラフト・評価者コメント生成
>
> `ChatSidebar.tsx` および `useChat.ts` はコードベースに残存するが未使用（将来削除候補）。

~~**ファイル**：`components/chat/ChatSidebar.tsx`~~

~~メンバー詳細ページの右側に常時表示される520px幅のチャットパネル。~~

#### 旧機能一覧（参考）

| 機能 | 説明 |
|------|------|
| クイックアクション | 「1on1の準備をして」「評価ドラフトを作って」「チーム全体を俯瞰して」の3ボタン |
| メッセージ送信 | textarea + 送信ボタン。Enter で改行、Shift+Enter で送信 |
| モード表示 | 「Claude API 接続中」（グリーン）のバッジ |
| 目標保存 | AI応答に `目標[1-5]` パターンが含まれる場合、「この目標で確定する」ボタンを表示 |
| クリア | メッセージ履歴をリセット |
| 自動スクロール | 新メッセージ追加時に最下部へスクロール |

### 4.5 目標設定ウィザード（7ステップ）

**ファイル**：`components/goals/GoalWizard.tsx`

全画面モーダル（`fixed inset-0 z-50`）として表示される。`useReducer` で状態管理を行い、7ステップを順に進める。

#### レイアウト仕様

| 要素 | Tailwind クラス | 備考 |
|------|----------------|------|
| ヘッダー | `px-16 py-5` | メンバー名 + 閉じるボタン |
| ステッパー | `px-16 py-5` | 7ステップ進捗バー |
| コンテンツ領域 | `max-w-5xl mx-auto px-16 py-8` | 中央寄せ + 左右余白 |

#### フォントサイズ規約（既存画面に準拠）

| 要素 | サイズ |
|------|--------|
| ページ見出し（h2） | `text-4xl font-bold` |
| 説明文 | `text-xl` |
| フォームラベル | `text-xl font-medium` |
| フォーム入力（textarea/input/select） | `text-xl` |
| ボタン | `text-xl font-semibold` |
| バッジ・ステータス | `text-lg` |
| ヘルパーテキスト・注釈 | `text-lg` |
| ステッパー数字 | `text-xl font-bold`（`w-12 h-12` 円形） |
| ステッパーラベル | `text-lg` |

#### ステッパー

`WizardStepper` コンポーネントで7ステップの進捗を視覚的に表示。完了ステップにはチェックマーク、現在ステップはインディゴ背景。

#### 各ステップ詳細

| ステップ | コンポーネント | 内容 |
|---------|---------------|------|
| 1 | `Step1AutoLoad` | 固定情報の読み込み確認。部方針・評価基準・プロフィール・ガイドラインの4項目を「読込済み/未読込」で表示 |
| 2 | `Step2ManagerInput` | マネージャーインプット入力。「このメンバーへの期待」（textarea）+ 「最大の課題（一言で）」（input）。両方必須 |
| 3 | `Step3MemberInput` | メンバー本人の意見入力（マネージャーが代入力）。「成長したいスキル・領域」「困っていること」「1年後になりたい姿」の3項目。全て必須 |
| 4 | `Step4PreviousPeriod` | 前期実績データ入力。「前期の主な目標」「達成レベル」（達成/概ね達成/未達）「未達の理由」（未達時のみ表示）。スキップ可能 |
| 5 | `Step5Diagnosis` | AI診断サマリー表示。自動で diagnosis API を呼び出し、結果を表示。手動修正可能（編集モード切り替え）。「この診断で進む」で確定 |
| 6 | `Step6GoalGeneration` | AI目標案表示。診断結果 + インプットをもとに generate API を呼び出し。「壁打ちへ進む」で次ステップへ |
| 7 | `Step7Refinement` | 壁打ち・精緻化。フィードバック入力 → 再生成（最大2回）。「この目標で確定する」で goals/ に保存 |

#### 状態遷移（Reducer Actions）

| Action | 効果 |
|--------|------|
| `SET_MANAGER_INPUT` | マネージャー入力を保存、Step 3 へ遷移 |
| `SET_MEMBER_INPUT` | メンバー入力を保存、Step 4 へ遷移 |
| `SET_PREVIOUS_PERIOD` | 前期実績を保存、Step 5 へ遷移（診断をリセット） |
| `SET_DIAGNOSIS` | 診断結果を保存（ステップは変更しない） |
| `CONFIRM_DIAGNOSIS` | 診断を確定し、Step 6 へ遷移（目標をリセット） |
| `SET_GENERATED_GOALS` | 生成目標を保存、Step 7 へ遷移 |
| `ADD_REFINEMENT` | 壁打ちメッセージ・更新目標・回数を保存 |
| `SET_FINAL_GOALS` | 最終目標を保存 |
| `GO_TO_STEP` | 指定ステップへ直接遷移 |
| `NEXT_STEP` / `PREV_STEP` | 前後ステップへ遷移 |

---

## 5. API設計

すべての API Route に `export const dynamic = 'force-dynamic'` を設定し、キャッシュを無効化している。

### 5.1 GET /api/members

**ファイル**：`app/api/members/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | 全メンバーのサマリー一覧を取得 |
| レスポンス | `{ members: MemberSummary[] }` |
| データソース | `data/members/` 配下の全 `profile.md` をパース |
| エラー | 500: ファイル読み取り失敗 |

### 5.2 GET /api/members/[name]

**ファイル**：`app/api/members/[name]/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | 指定メンバーの詳細情報を取得 |
| パラメータ | `name`（URLエンコード済みメンバー名） |
| レスポンス | `{ member: MemberDetail }` |
| データソース | `profile.md` + `goals/2026-h1.md` + `one-on-one/*.md` + `reviews/*.md` |
| エラー | 404: メンバー未発見、500: ファイル読み取り失敗 |

### 5.3 POST /api/members/[name]/goals

**ファイル**：`app/api/members/[name]/goals/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | 目標をMarkdownファイルとして保存 |
| リクエスト | `{ content: string, period?: string }` |
| 処理 | ヘッダー（対象期間・作成日・メンバー名）を自動生成し、`goals/{period}.md` に書き込み |
| レスポンス | `{ success: true, path: string }` |
| エラー | 400: content 未指定、404: メンバー未発見、500: 書き込み失敗 |

### 5.4 POST /api/members/[name]/goals/diagnosis

**ファイル**：`app/api/members/[name]/goals/diagnosis/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | AI による診断サマリーを生成 |
| リクエスト | `{ memberContext, managerInput, memberInput, previousPeriod? }` |
| AI なしの場合 | ~~1秒遅延後にモック診断を返却~~ → v1.5: APIキー未設定エラーを返却（セクション12参照） |
| AI ありの場合 | `buildDiagnosisSystemPrompt()` + `buildDiagnosisUserMessage()` で Claude に問い合わせ |
| レスポンス | `{ diagnosis: string, mode: 'mock' | 'live' }` |

### 5.5 POST /api/members/[name]/goals/generate

**ファイル**：`app/api/members/[name]/goals/generate/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | AI による目標案を生成（壁打ち対応） |
| リクエスト | `{ memberContext, managerInput, memberInput, previousPeriod?, diagnosis, refinementMessages? }` |
| AI なしの場合 | ~~1.5秒遅延後にモック目標を返却~~ → v1.5: APIキー未設定エラーを返却（セクション12参照） |
| AI ありの場合 | `buildGoalGenerationSystemPrompt()` + `buildGoalGenerationUserMessage()` で Claude に問い合わせ。`refinementMessages` がある場合はメッセージ履歴に追加して送信 |
| レスポンス | `{ goals: string, mode: 'mock' | 'live' }` |
| maxTokens | 4096 |

### 5.6 POST /api/chat（廃止）

> **v1.6で廃止**：AIチャットサイドバーの廃止に伴い、このエンドポイントは未使用となった。ルートファイルは残存するが将来削除候補。

**ファイル**：`app/api/chat/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | ~~AIチャット（サイドバー用）~~ **廃止** |
| リクエスト | `{ messages: ChatMessage[], memberName?: string, memberContext?: string }` |
| AI なしの場合 | ~~700ms遅延後にモック応答を返却（キーワードマッチング）~~ → v1.5: APIキー未設定エラーを返却（セクション12参照） |
| AI ありの場合 | システムプロンプト（AI秘書定義 + guidelines.md + メンバーコンテキスト）でClaude に問い合わせ |
| レスポンス | `{ content: string, mode: 'mock' | 'live' }` |
| maxTokens | 1024 |

### 5.7 GET /api/docs

**ファイル**：`app/api/docs/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | 共有ドキュメント（組織方針・評価基準・ガイドライン）を取得 |
| クエリパラメータ | `year`（任意）: 組織方針の年度指定。`strict=true`（任意）: 指定年度のみ返す（フォールバックなし） |
| レスポンス | `{ orgPolicy: string, policyYear: number \| null, availableYears: number[], criteria: string, guidelines: string }` |
| strict モード | `?year=2024&strict=true` の場合、指定年度のファイルが存在しなければ `orgPolicy: ''`, `exists: false` を返す。組織方針ウィザードのStep1で前年度方針の有無を検出するために使用 |

### 5.8 POST /api/members/[name]/one-on-one/questions

**ファイル**：`app/api/members/[name]/one-on-one/questions/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | AIによるパーソナライズされたヒアリング質問を3つ生成 |
| リクエスト | `{ memberContext, goalsMarkdown, departmentPolicy, previousActionReviews, goalProgress, condition, previousCondition? }` |
| レスポンス | `{ questions: { question: string, intent: string }[], mode: 'live' }` ※v1.5でmockモード廃止 |
| 詳細 | セクション10.4.1を参照 |

### 5.9 POST /api/members/[name]/one-on-one/summary

**ファイル**：`app/api/members/[name]/one-on-one/summary/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | AIによる次回1on1への引き継ぎサマリーを生成 |
| リクエスト | `{ memberContext, goalsMarkdown, previousActionReviews, goalProgress, condition, previousCondition?, hearingQuestions, nextActions }` |
| レスポンス | `{ summary: string, mode: 'live' }` ※v1.5でmockモード廃止 |
| 詳細 | セクション10.4.2を参照 |

### 5.10 POST /api/members/[name]/one-on-one

**ファイル**：`app/api/members/[name]/one-on-one/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | 1on1記録をMarkdownファイルとして保存 |
| リクエスト | `{ yearMonth: string, content: string }` |
| レスポンス | `{ success: true, path: string }` |
| 詳細 | セクション10.4.3を参照 |

### 5.11 POST /api/members/[name]/reviews/draft

**ファイル**：`app/api/members/[name]/reviews/draft/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | AIによる評価ドラフト（目標別評価 + 総合評価 + 乖離分析）を生成 |
| リクエスト | 評価素材（目標・1on1記録・自己評価・マネージャー補足等） |
| レスポンス | `{ draft: EvaluationDraft, mode: 'live' }` |
| 詳細 | セクション11.4.1を参照 |

### 5.12 POST /api/members/[name]/reviews/comment

**ファイル**：`app/api/members/[name]/reviews/comment/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | AIによる評価者コメント（200〜300文字）を生成 |
| リクエスト | 確定済み評価内容（目標別評価・総合評価・乖離分析・変更理由） |
| レスポンス | `{ comment: string, mode: 'live' }` |
| 詳細 | セクション11.4.2を参照 |

### 5.13 POST /api/members/[name]/reviews

**ファイル**：`app/api/members/[name]/reviews/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | 評価をMarkdownファイルとして保存 |
| リクエスト | `{ period: string, content: string }` |
| レスポンス | `{ success: true, path: string }` |
| 詳細 | セクション11.4.3を参照 |

### 5.14 POST /api/docs/policy/direction

**ファイル**：`app/api/docs/policy/direction/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | AIによる組織方針の方向性・骨格提案を生成（継続/初回フロー共通） |
| リクエスト | `{ mode: 'continuous' \| 'initial', ...モード別パラメータ }` |
| レスポンス | `{ direction: string, mode: 'live' }` |
| 詳細 | セクション14.6.6を参照 |

### 5.15 POST /api/docs/policy/draft

**ファイル**：`app/api/docs/policy/draft/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | AIによる組織方針ドラフトを生成 |
| リクエスト | `{ year: number, previousPolicy?: string, evaluationCriteria: string, guidelines: string, managerContext: string }` |
| レスポンス | `{ draft: string, mode: 'live' }` |
| 詳細 | セクション14.6を参照 |

### 5.16 POST /api/docs/policy/refine

**ファイル**：`app/api/docs/policy/refine/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | AIによる組織方針リファイン（壁打ち） |
| リクエスト | `{ currentDraft: string, feedback: string, previousPolicy?: string, evaluationCriteria: string, guidelines: string }` |
| レスポンス | `{ refined: string, mode: 'live' }` |
| 詳細 | セクション14.6を参照 |

### 5.17 POST /api/docs/policy

**ファイル**：`app/api/docs/policy/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | 組織方針をMarkdownファイルとして保存 |
| リクエスト | `{ year: number, content: string }` |
| レスポンス | `{ success: true, path: string }` |
| エラー | 400: year または content 未指定、500: 書き込み失敗 |
| 詳細 | セクション14.6を参照 |

### 5.18 GET /api/team/matrix

**ファイル**：`app/api/team/matrix/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | 指定期間のチームマトリクスデータ（目標/1on1/評価の実施状況）を全メンバー分取得 |
| クエリパラメータ | `period`（任意）: 対象期間（例: `2025-h2`）。省略時は `getActivePeriod()` |
| レスポンス | `{ matrix: TeamPeriodMatrix }` |
| 詳細 | セクション16を参照 |

### 5.18 GET /api/team/matrix

**ファイル**：`app/api/team/matrix/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | 指定期間のチーム全体の目標・1on1・評価ステータスをマトリクス形式で取得 |
| クエリパラメータ | `period`（任意。例: `2026-h1`。未指定時は `getActivePeriod()` を使用） |
| レスポンス | `{ matrix: TeamPeriodMatrix }` |
| エラー | 500: ファイル読み取り失敗 |
| 詳細 | セクション16を参照 |

---

## 6. AI連携

### 6.1 Azure AI Foundry / Anthropic API デュアルパス

`lib/ai/call-claude.ts` が2つの AI 接続パスを提供する。

#### 優先順位

```
1. ANTHROPIC_FOUNDRY_API_KEY がある場合 → Azure AI Foundry パス
2. ANTHROPIC_API_KEY がある場合 → Anthropic API 直接パス
3. どちらもない場合 → エラー（NO_API_KEY）→ 503エラーを返却
```

#### Azure AI Foundry パス

| 環境変数 | 用途 |
|---------|------|
| `ANTHROPIC_FOUNDRY_API_KEY` | API キー（`api-key` と `x-api-key` ヘッダーに設定） |
| `ANTHROPIC_FOUNDRY_BASE_URL` | ベースURL（省略時は `ANTHROPIC_FOUNDRY_RESOURCE` から構築） |
| `ANTHROPIC_FOUNDRY_RESOURCE` | Azure リソース名 |
| `DEPLOYMENT_NAME` | モデル名（省略時: `claude-sonnet-4-20250514`） |

エンドポイント：`{baseUrl}/v1/messages`

ヘッダー：`anthropic-version: 2023-06-01`

#### Anthropic API 直接パス

`@anthropic-ai/sdk` の `Anthropic` クラスを動的インポートし、`client.messages.create()` を使用する。

#### チャットAPIの独自実装

`POST /api/chat` はチャット専用として `call-claude.ts` を経由せず、同等のロジックを直接実装している。モデルは `claude-sonnet-4-6` をデフォルトとする。

### 6.2 モックモード

v1.5でモックモードは廃止。APIキー未設定時は503エラーを返却する。

### 6.3 システムプロンプト設計

#### 6.3.1 チャット用システムプロンプト

```
あなたはAIタレントマネジメント秘書です。
マネージャーの意思決定を支援することが役割で、評価の最終判断は行いません。
事実ベースで提案し、主観的・推測的な表現は避けます。
出力は日本語で行ってください。

## 運用ガイドライン（必ず遵守）
{guidelines.md の全文}

## 対象メンバーの情報
{メンバーの profile.md rawMarkdown}
```

#### 6.3.2 診断用システムプロンプト

役割：人材育成の専門コンサルタント

出力フォーマット：
- **現在地と次ステージのギャップ**（1〜2文）
- **発揮されていない強み**（1〜2文）
- **今期の最大課題**（キャッチフレーズ形式）

注意事項：情報の要約をしないこと。マネージャーが「そうそう、これ」と感じる解像度で書くこと。

ユーザーメッセージに含まれる情報：
- メンバープロフィール
- グループ方針
- 育成基準・評価基準
- マネージャーからの期待
- メンバー本人の意見
- 前期実績（任意）

#### 6.3.3 目標生成用システムプロンプト

役割：人材育成の専門コンサルタント

4ステップの設計プロセス：
1. **設計前の確認**：診断サマリーの内容を設計の軸として使用
2. **目標の構成ルール**：実行目標・挑戦目標・インパクト目標の3種を必ず含める
3. **1つの目標に必須の要素**：数値と期限、達成基準（状態・変化）、この人でなければならない理由、ビジネスインパクト、検証方法
4. **絶対禁止事項**：「実施する」で終わる文、「1件以上」のような最低基準、汎用的な目標、R&D目標への特定プロダクト名

出力フォーマット（目標3〜5個）：
```
目標N（実行/挑戦/インパクト）：[目標文]
  └ 達成した姿：[変化・状態で終わる1文]
  └ 検証方法：[客観的な判断基準]
  └ 中間確認：[3ヶ月時点での確認基準]
  └ 根拠：[方針・期待・本人情報との紐づけ]
```

壁打ち時は `refinementMessages` を会話履歴として追加し、再生成を行う。maxTokens は 4096。

---

## 7. 目標設定プロセス

### 7.1 7ステップフロー詳細

```
Step1: 固定情報確認
  │ 部方針・評価基準・プロフィール・ガイドラインが読み込まれていることを視覚確認
  ▼
Step2: マネージャーインプット
  │ 「このメンバーへの期待」（必須）
  │ 「最大の課題（一言で）」（必須）
  ▼
Step3: メンバー本人の意見
  │ 「今期最も成長したいスキル・領域」（必須）
  │ 「現在の業務で困っていること」（必須）
  │ 「1年後になりたい姿」（必須）
  ▼
Step4: 前期実績データ ← スキップ可能
  │ 「前期の主な目標」（必須 ※スキップしない場合）
  │ 「達成レベル」（達成/概ね達成/未達）
  │ 「未達の理由」（未達時のみ）
  ▼
Step5: AI診断サマリー
  │ POST /api/members/[name]/goals/diagnosis
  │ 結果を表示。手動修正可能。
  │ 「この診断で進む」で確定
  ▼
Step6: AI目標案生成
  │ POST /api/members/[name]/goals/generate
  │ 診断サマリー + 全インプットをもとに3〜5個の目標を生成
  │ 「壁打ちへ進む」で次ステップ
  ▼
Step7: 壁打ち・精緻化
  │ フィードバック入力 → 再生成（最大2回推奨）
  │ 「この目標で確定する」で goals/2026-h1.md に保存
  ▼
完了（ウィザードを閉じる → 目標タブに反映）
```

### 7.2 目標立案ルール（`guidelines.md`）

ウィザードとは独立に、Claude への直接依頼時にも適用されるルール群。

#### 必須ヒアリング2ステップ

1. **マネージャーへの期待ヒアリング**：重点テーマ・成長方向性・避けたい方向性・前期からの引き継ぎ
2. **メンバー本人の意見ヒアリング**：取り組みたいテーマ・キャリア志向・課題意識

#### 品質ルール5か条

1. 必ず「数値」と「期限」を含めること
2. 「誰にでも当てはまる目標」は絶対に禁止
3. 目標ごとに「達成した姿（1文）」を添えること
4. 難易度は「少し背伸びすれば届く」レベルに設定
5. グループ方針・マネージャーの期待・本人の希望をバランスよく反映

#### R&D目標制約

R&D関連目標に特定プロダクト名を含めてはならない。成果の性質・レベルで定義する。

### 7.3 診断サマリー仕様

| 項目 | 内容 |
|------|------|
| 入力 | メンバープロフィール + 部方針 + 評価基準 + マネージャー期待 + メンバー意見 + 前期実績（任意） |
| 出力 | 3セクション：現在地と次ステージのギャップ / 発揮されていない強み / 今期の最大課題 |
| maxTokens | 1024 |
| 編集 | マネージャーが手動修正可能（テキストエリア切り替え） |

### 7.4 目標生成仕様

| 項目 | 内容 |
|------|------|
| 入力 | 診断サマリー + 上記全インプット |
| 出力 | 3〜5個の目標（実行/挑戦/インパクトの3種を必ず含む）。各目標に下記5要素を付記 |
| maxTokens | 4096 |

#### 目標の3分類

| 分類 | 定義 |
|------|------|
| 実行目標 | 確実に達成できる、チームへの貢献目標 |
| 挑戦目標 | 失敗リスクがある、本人の成長を問う目標 |
| インパクト目標 | 組織・ビジネスへの変化を生む目標 |

#### 出力フォーマット

```
目標①（実行／挑戦／インパクト）：[目標文]
　└ 達成した姿：[変化・状態で終わる1文]
　└ 検証方法：[客観的な判断基準]
　└ 中間確認：[3ヶ月時点での確認基準]
　└ 根拠：[方針・期待・本人情報との紐づけ]
```

#### 絶対禁止事項

- 「実施する」「共有する」「展開する」で文章を終わらせること
- 「1件以上」「1回以上」など必ず達成できる基準のみを置くこと
- 誰に差し替えても違和感がない汎用的な目標を書くこと
- R&D関連目標に特定プロダクト名を含めること

### 7.5 壁打ち仕様

| 項目 | 内容 |
|------|------|
| 推奨回数 | 最大2回 |
| 仕組み | フィードバック（ユーザーメッセージ）を前回の生成結果（アシスタントメッセージ）の後に追加し、generate API を再呼び出し |
| UI制御 | 2回到達後はフィードバック入力欄を非表示にし、確定を促すメッセージを表示 |
| 保存 | 「この目標で確定する」で POST /api/members/[name]/goals を呼び出し |

---

## 8. セキュリティ・運用

### 8.1 個人情報管理（`data/` ディレクトリ集約）

すべてのメンバー個人データ（プロフィール、目標、1on1記録、評価）は `data/` ディレクトリに集約されている。

| ディレクトリ | 内容 |
|-------------|------|
| `data/members/{name}/` | 24名分の個人データ |
| `data/archive/` | 元データファイル（xlsx, pptx, pdf） |
| `data/resources/` | リソース管理表 |

### 8.2 .gitignore ポリシー

ルートの `.gitignore` で以下を除外し、個人情報がリポジトリに入らないよう制御している。

```
data/          ← 個人情報・機密データ全体
*.xlsx         ← Excelファイル
*.pptx         ← PowerPointファイル
*.csv          ← CSVファイル
.env           ← 環境変数
.env*.local    ← ローカル環境変数
```

`talent-management/shared/` と `talent-management/templates/` は共有ドキュメント・テンプレートのみを含み、個人情報を含まないため Git 管理対象となっている。

### 8.3 評価タブのアクセス制御

評価データは機密性が高いため、クライアントサイドのパスワードゲートで保護している。

| 項目 | 内容 |
|------|------|
| 方式 | クライアントサイドのパスワード照合 |
| パスワード | ハードコード（`ReviewsTab.tsx` 内） |
| セッション管理 | `sessionStorage` にフラグを保存。ブラウザを閉じるとリセット |
| 制限事項 | サーバーサイド保護ではないため、API経由では評価データに直接アクセス可能。ローカル運用前提の簡易保護 |

### 8.4 APIキー管理

| 環境変数 | 用途 | 保存場所 |
|---------|------|---------|
| `ANTHROPIC_FOUNDRY_API_KEY` | Azure AI Foundry 認証 | `.env.local` |
| `ANTHROPIC_FOUNDRY_BASE_URL` | Foundry エンドポイント | `.env.local` |
| `ANTHROPIC_FOUNDRY_RESOURCE` | Azure リソース名 | `.env.local` |
| `DEPLOYMENT_NAME` | モデルデプロイメント名 | `.env.local` |
| `ANTHROPIC_API_KEY` | Anthropic API 直接認証 | `.env.local` |

`.env.local` は `.gitignore` で除外されている。API キーが未設定の場合はモックモードで動作し、エラーにはならない。

---

## 9. ファイル一覧

### 9.1 設定ファイル

| ファイルパス | 役割 |
|------------|------|
| `package.json` | プロジェクト依存関係・スクリプト定義 |
| `web-demo/package.json` | 同上（ルートと同一内容） |
| `web-demo/next.config.mjs` | Next.js 設定（空） |
| `web-demo/tsconfig.json` | TypeScript 設定。`@/*` → `./src/*` パスエイリアス |
| `web-demo/tailwind.config.ts` | Tailwind CSS 設定。indigo カラーをカスタムパレット（#19708C 系ティール）に上書き。typography プラグイン有効 |
| `web-demo/postcss.config.mjs` | PostCSS 設定 |
| `.gitignore` | data/, .env, Office ファイルを除外 |
| `web-demo/.gitignore` | Next.js 標準の除外設定 |

### 9.2 ページ（`web-demo/src/app/`）

| ファイルパス | 種類 | 役割 |
|------------|------|------|
| `app/layout.tsx` | Server Component | ルートレイアウト。NavBar + metadata 定義 |
| `app/page.tsx` | Server Component | ダッシュボード。StatsBar + MemberGrid |
| `app/globals.css` | CSS | ベーススタイル。`html { font-size: 60% }` でベースフォントサイズを縮小 |
| `app/docs/page.tsx` | Server Component | 部方針ドキュメント表示。DocsTabs |
| `app/members/[name]/page.tsx` | Server Component | メンバー詳細。MemberDetailClient に member + wizardContext を渡す |
| `app/team/page.tsx` | Server Component | チームマトリクスビュー。期間別の目標・1on1・評価ステータスを一覧表示 |

### 9.3 APIルート（`web-demo/src/app/api/`）

| ファイルパス | メソッド | 役割 |
|------------|---------|------|
| `api/members/route.ts` | GET | メンバー一覧取得 |
| `api/members/[name]/route.ts` | GET | メンバー詳細取得 |
| `api/members/[name]/goals/route.ts` | POST | 目標保存 |
| `api/members/[name]/goals/diagnosis/route.ts` | POST | AI診断サマリー生成 |
| `api/members/[name]/goals/generate/route.ts` | POST | AI目標生成（壁打ち対応） |
| `api/chat/route.ts` | POST | ~~AIチャット~~ **v1.6で廃止。残存するが未使用（将来削除候補）** |
| `api/demo-mode/route.ts` | GET/POST | デモモード状態の取得・切替（v1.6新設） |
| `api/docs/route.ts` | GET | 共有ドキュメント取得 |
| `api/team/matrix/route.ts` | GET | チームマトリクス取得（期間別の目標・1on1・評価ステータス） |

### 9.4 コンポーネント（`web-demo/src/components/`）

| ファイルパス | 種類 | 役割 |
|------------|------|------|
| `layout/NavBar.tsx` | Client | グローバルナビゲーション。ダッシュボード / 部方針リンク + デモ版バッジ |
| `layout/TalentHubLogo.tsx` | Server | SVG ロゴ（THモノグラム + 6ノードのハブ図形） |
| `dashboard/StatsBar.tsx` | Server | 統計サマリー（6列グリッド） |
| `dashboard/MemberGrid.tsx` | Client | チームフィルター + メンバーカードグリッド |
| `dashboard/MemberCard.tsx` | Server | メンバーカード（バッジ + プロジェクト配分バー + 詳細リンク） |
| `member/MemberDetailClient.tsx` | Client | メンバー詳細ページの統合レイアウト（タブ + ウィザード制御）※v1.6でチャットサイドバー連携を除去 |
| `member/ProfileTab.tsx` | Server | プロフィール表示（ヒーローヘッダー + 2列レイアウト） |
| `member/GoalsTab.tsx` | Client | 目標表示 + ウィザード起動ボタン |
| `member/OneOnOneTab.tsx` | Server | 1on1記録一覧表示 |
| `member/ReviewsTab.tsx` | Client | 評価表示（パスワードゲート + 評価カード + アコーディオン） |
| `chat/ChatSidebar.tsx` | Client | ~~AIチャットパネル（クイックアクション + メッセージ履歴 + 目標保存）~~ **v1.6で廃止。残存するが未使用（将来削除候補）** |
| `docs/DocsTabs.tsx` | Client | 部方針ドキュメントのタブ切り替え（サイドバー + メインコンテンツ） |
| `goals/GoalWizard.tsx` | Client | 目標設定ウィザード本体（useReducer + 7ステップ描画） |
| `goals/WizardStepper.tsx` | Client | ステッパーUI（7ステップの進捗表示） |
| `goals/steps/Step1AutoLoad.tsx` | Client | Step1: 固定情報確認 |
| `goals/steps/Step2ManagerInput.tsx` | Client | Step2: マネージャーインプット |
| `goals/steps/Step3MemberInput.tsx` | Client | Step3: メンバー本人の意見 |
| `goals/steps/Step4PreviousPeriod.tsx` | Client | Step4: 前期実績データ |
| `goals/steps/Step5Diagnosis.tsx` | Client | Step5: AI診断サマリー（自動呼出 + 編集 + 確認） |
| `goals/steps/Step6GoalGeneration.tsx` | Client | Step6: AI目標生成（自動呼出 + 確認） |
| `goals/steps/Step7Refinement.tsx` | Client | Step7: 壁打ち・精緻化（再生成 + 保存） |
| `ui/Badge.tsx` | Server | バッジ（7色バリアント + teamBadgeVariant ヘルパー） |
| `ui/Card.tsx` | Server | カード（ホバーエフェクト対応） |
| `ui/EmptyState.tsx` | Server | 空状態表示（アイコン + タイトル + 説明） |
| `ui/Tabs.tsx` | Client | 汎用タブUI |
| `ui/MarkdownRenderer.tsx` | Server | Markdown描画（react-markdown + remark-gfm）。目標フォーマットの「└」記号を自動整形 |
| `dashboard/TeamMatrixView.tsx` | Client | チームマトリクスビューのコンテナ（ツールバー：期間セレクター + チームフィルター + サマリーチップ） |
| `dashboard/TeamMatrixTable.tsx` | Client | チームマトリクスのテーブル本体（メンバー行 × ステータス列） |
| `dashboard/MatrixCell.tsx` | Server | マトリクスセル（○/×/－ のステータス表示） |

### 9.5 ライブラリ（`web-demo/src/lib/`）

| ファイルパス | 役割 |
|------------|------|
| `lib/types.ts` | 型定義一覧（14型） |
| `lib/fs/paths.ts` | ファイルパス定数（PROJECT_ROOT, DATA_ROOT, MEMBERS_DIR, DEMO_MEMBERS_DIR, SHARED_DIR, SHARED_DOCS） + `getMembersDir()`（デモモード状態に応じたディレクトリ切替） |
| `lib/fs/members.ts` | メンバーデータ読み取り（getMemberNames, getAllMemberSummaries, getMemberDetail, parseReview, getTeamPeriodMatrix, getAvailablePeriods）。getMemberNames は `profile.md` が存在するディレクトリのみをメンバーとして認識する |
| `lib/fs/shared-docs.ts` | 共有ドキュメント読み取り（loadSharedDocs） |
| `lib/parsers/profile.ts` | プロフィールパーサー（extractField, parseProjectLine, deriveTeamShort, parseProfile） |
| `lib/parsers/goals.ts` | 目標パーサー（parseGoals） |
| `lib/ai/call-claude.ts` | Claude API 呼び出し（Azure AI Foundry / Anthropic デュアルパス + hasApiKey） |
| ~~`lib/mock/responses.ts`~~ | ~~モックレスポンス（キーワードマッチング + フォールバック）~~ **v1.5で廃止予定 → v1.6で削除済み** |
| `lib/prompts/diagnosis.ts` | 診断サマリー用プロンプト（buildDiagnosisSystemPrompt, buildDiagnosisUserMessage） |
| `lib/prompts/goal-generation.ts` | 目標生成用プロンプト（buildGoalGenerationSystemPrompt, buildGoalGenerationUserMessage） |

### 9.6 フック（`web-demo/src/hooks/`）

| ファイルパス | 役割 |
|------------|------|
| `hooks/useChat.ts` | ~~チャット状態管理フック（messages, isLoading, mode, sendMessage, reset）~~ **v1.6で廃止。残存するが未使用（将来削除候補）** |

### 9.7 データ・ドキュメント

| ファイルパス | 役割 |
|------------|------|
| `talent-management/CLAUDE.md` | AI行動指針（フォルダ構成ルール + 行動指針5か条 + よくあるタスク） |
| `talent-management/shared/department-policy.md` | 部方針（ミッション・環境認識・2つの柱・チーム体制・R&D計画） |
| `talent-management/shared/evaluation-criteria.md` | 評価基準（キャリアラダー・等級定義・Impact/Job/Skill 2軸評価） |
| `talent-management/shared/guidelines.md` | 運用ガイドライン（Claudeの役割・運用サイクル・依頼方法・目標立案ルール・Q&A） |
| `talent-management/templates/profile-template.md` | プロフィールテンプレート |
| `talent-management/templates/goal-template.md` | 目標テンプレート |
| `talent-management/templates/one-on-one-template.md` | 1on1記録テンプレート |
| `talent-management/templates/review-template.md` | 評価ドラフトテンプレート |
| `data/members/{name}/profile.md` | メンバープロフィール（24名分） |
| `data/members/{name}/goals/2026-h1.md` | 2026年上期目標（24名分） |
| `data/members/{name}/reviews/2025-h2.md` | 2025年下期評価（24名分） |
| `data/members/{name}/one-on-one/` | 1on1ウィザードで作成された月次記録（`YYYY-MM.md`） |
| `data/archive/` | 元データファイル群（xlsx, pptx, pdf） |

---

## 10. 1on1ウィザード

### 10.1 概要・方針

1on1ウィザードは、マネージャーとメンバーの月次1on1面談を構造化して支援するための5ステップウィザードである。目標設定ウィザード（セクション7）と同様に全画面モーダルとして動作し、`useReducer` で状態管理を行う。

#### 設計方針

- **継続性の重視**：前回の1on1記録（アクションアイテム・コンディション）を自動ロードし、面談の継続性を担保する
- **目標ウィザードとの連携**：目標設定ウィザードで作成した目標・マイルストーン・達成基準を自動参照し、進捗確認を効率化する
- **コンディション可視化**：モチベーション・業務負荷・チーム関係の3軸を5段階で定量化し、月次推移を追跡する
- **AIによる質問生成**：ステップ1〜3の情報をもとに、パーソナライズされたヒアリング質問をAIが生成する
- **引き継ぎサマリー**：完了時にAIが次回1on1への引き継ぎサマリーを自動生成し、ファイルに含めて保存する
- **マネージャー専用**：フェーズ1ではマネージャーのみが操作する前提とする

#### モデル

`claude-sonnet-4-20250514`（`call-claude.ts` のデフォルトモデルと同一）

### 10.2 画面設計（5ステップ + 完了画面）

#### 全体レイアウト

目標設定ウィザードと同一のレイアウト構造を採用する。

| 要素 | Tailwind クラス | 備考 |
|------|----------------|------|
| コンテナ | `fixed inset-0 z-50 bg-white flex flex-col` | 全画面モーダル |
| ヘッダー | `px-16 py-5 border-b border-gray-200 bg-gray-50` | `{メンバー名}さんの1on1ウィザード` + 閉じるボタン |
| ステッパー | `px-16 py-5 border-b border-gray-100` | 5ステップ進捗バー |
| コンテンツ領域 | `max-w-5xl mx-auto px-16 py-8` | 中央寄せ + 左右余白 |

#### フォントサイズ規約

目標設定ウィザードと同一の規約を適用する（セクション4.5のフォントサイズ規約を参照）。

| 要素 | サイズ |
|------|--------|
| ページ見出し（h2） | `text-4xl font-bold` |
| 説明文 | `text-xl` |
| フォームラベル | `text-xl font-medium` |
| フォーム入力（textarea/input/select） | `text-xl` |
| スライダーラベル・値 | `text-xl` |
| ボタン | `text-xl font-semibold` |
| バッジ・ステータス | `text-lg` |
| ヘルパーテキスト・注釈 | `text-lg` |
| ステッパー数字 | `text-xl font-bold`（`w-12 h-12` 円形） |
| ステッパーラベル | `text-lg` |

#### ステッパー

`OneOnOneStepper` コンポーネントで5ステップの進捗を視覚的に表示する。`WizardStepper` と同一のUIパターンを採用し、ステップ数のみ5に変更する。

ステップラベル：
1. 前回振り返り
2. 目標進捗
3. コンディション
4. ヒアリング
5. アクション設定

#### Step1: 前回アクションアイテム振り返り

**コンポーネント名**：`OOStep1PreviousActions`

**表示内容**：
- 前回の1on1記録（`one-on-one/YYYY-MM.md`）からアクションアイテムを自動ロード
- 前回記録が存在しない場合は「前回の1on1記録がありません。初回面談として進めます。」と表示し、空のアクションアイテムリストを表示
- 前回の引き継ぎサマリー（存在する場合）をカード形式で表示

**入力フィールド**：
- アクションアイテムごとの完了チェックボックス（チェックボックス、`w-6 h-6`）
- アクションアイテムごとのコメント入力（textarea、`text-xl`、placeholder: 「進捗や補足があれば記入」、各2行）

**AI連携**：なし（データロードのみ）

**UIレイアウト**：
```
┌──────────────────────────────────────────────┐
│ h2: 前回アクションアイテムの振り返り              │
│ p: 前回の1on1で設定したアクションアイテムの        │
│    進捗を確認します。                             │
│                                                  │
│ ┌─ 引き継ぎサマリー（前回AIが生成）─────────────┐ │
│ │ bg-indigo-50 border-indigo-200 p-6 rounded-lg│ │
│ │ {前回の引き継ぎサマリー本文}                    │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ┌─ アクションアイテム1 ─────────────────────────┐ │
│ │ □ {アクション内容}（担当：{assignee}、期限：{date}）│
│ │ [コメント入力欄]                                │ │
│ └──────────────────────────────────────────────┘ │
│ ┌─ アクションアイテム2 ─────────────────────────┐ │
│ │ □ {アクション内容}（担当：{assignee}、期限：{date}）│
│ │ [コメント入力欄]                                │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ [戻る]                          [次へ進む]        │
└──────────────────────────────────────────────────┘
```

**ボタン**：
- 「次へ進む」：`bg-indigo-600 text-white hover:bg-indigo-700`。常に有効（チェック状態の変更は任意）
- 「閉じる」：ヘッダーの閉じるボタンで対応（Step1には「戻る」ボタンなし）

#### Step2: 目標進捗確認

**コンポーネント名**：`OOStep2GoalProgress`

**表示内容**：
- 目標設定ウィザードで作成した目標データ（`goals/2026-h1.md`）を自動ロード
- 各目標の内容（目標文、達成した姿、検証方法、中間確認）をカード形式で表示
- 目標データが存在しない場合は「目標が未設定です。目標設定ウィザードで目標を作成してから1on1を実施してください。」と表示し、フリーテキスト入力欄を代わりに表示
- AIによるタイムライン警告を表示（中間確認の期限が近い場合など）

**入力フィールド**：
- 各目標の進捗ステータス選択（select、`text-xl`）：「未着手」「進行中」「遅延あり」「完了」の4択
- 各目標の進捗メモ（textarea、`text-xl`、placeholder: 「具体的な進捗・課題を記入」、各3行）

**AI連携（タイムライン警告）**：
- 目標の「中間確認」フィールドに含まれる期限（例：「6月末時点で〜」）を解析し、現在日付との差分を計算
- 期限まで30日以内の場合、該当目標カードに警告バッジ（`bg-amber-100 text-amber-800 border-amber-300`）を表示：「中間確認まであと{N}日」
- 期限を過ぎている場合、赤色バッジ（`bg-red-100 text-red-800 border-red-300`）を表示：「中間確認の期限を{N}日超過」
- この警告はクライアントサイドで計算するため、API呼び出しは不要

**UIレイアウト**：
```
┌──────────────────────────────────────────────┐
│ h2: 目標進捗確認                                │
│ p: 各目標の進捗状況を確認します。                 │
│                                                  │
│ ┌─ 目標①（実行）──────────────────────────────┐ │
│ │ 目標文: ...                                    │ │
│ │ 達成した姿: ...                                │ │
│ │ 中間確認: ...  [⚠ 中間確認まであと14日]         │ │
│ │                                                │ │
│ │ 進捗ステータス: [select: 未着手/進行中/遅延/完了]│ │
│ │ 進捗メモ: [textarea]                           │ │
│ └──────────────────────────────────────────────┘ │
│ ┌─ 目標②（挑戦）──────────────────────────────┐ │
│ │ ...                                            │ │
│ └──────────────────────────────────────────────┘ │
│ ┌─ 目標③（インパクト）───────────────────────── ┐ │
│ │ ...                                            │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ [戻る]                          [次へ進む]        │
└──────────────────────────────────────────────────┘
```

**ボタン**：
- 「戻る」：`border border-gray-300 text-gray-600 hover:bg-gray-50`
- 「次へ進む」：`bg-indigo-600 text-white hover:bg-indigo-700`。各目標のステータスがすべて選択済みの場合に有効化

> **フリーテキストモード時のバリデーション**：フリーテキストモード時は、テキストが空でない場合に「次へ進む」を有効化する。

#### Step3: コンディション確認

**コンポーネント名**：`OOStep3Condition`

**表示内容**：
- モチベーション・業務負荷・チーム関係の3軸を1〜5のスライダーで入力
- 前回のコンディションスコアが存在する場合、前月比の変化を矢印アイコンと差分値で表示

**入力フィールド**：
- モチベーション（range スライダー、1〜5、`accent-indigo-600`）：1=非常に低い / 2=低い / 3=普通 / 4=高い / 5=非常に高い
- 業務負荷（range スライダー、1〜5、`accent-indigo-600`）：1=余裕あり / 2=やや余裕 / 3=適正 / 4=やや過多 / 5=過多
- チーム関係（range スライダー、1〜5、`accent-indigo-600`）：1=課題あり / 2=やや課題 / 3=普通 / 4=良好 / 5=非常に良好
- フリーコメント（textarea、`text-xl`、placeholder: 「コンディションについて補足があれば記入」、4行）

**前月比表示ロジック**：
- 前回1on1記録のコンディションスコアを読み取り、差分を計算
- 上昇：`text-green-600` + 「↑ +{N}」
- 下降：`text-red-600` + 「↓ -{N}」
- 変化なし：`text-gray-400` + 「→ 変化なし」
- 前回記録がない場合は「前回データなし」とグレーで表示

**UIレイアウト**：
```
┌──────────────────────────────────────────────┐
│ h2: コンディション確認                          │
│ p: 現在のコンディションを確認します。             │
│                                                  │
│ ┌─ モチベーション ─────────────────────────────┐ │
│ │ label: モチベーション          前月比: ↑ +1   │ │
│ │ 1 ─────●───────── 5                          │ │
│ │ 選択中: 4（高い）                              │ │
│ └──────────────────────────────────────────────┘ │
│ ┌─ 業務負荷 ───────────────────────────────────┐ │
│ │ label: 業務負荷                前月比: → 変化なし│
│ │ 1 ───────●─────── 5                          │ │
│ │ 選択中: 3（適正）                              │ │
│ └──────────────────────────────────────────────┘ │
│ ┌─ チーム関係 ─────────────────────────────────┐ │
│ │ label: チーム関係              前月比: ↓ -1   │ │
│ │ 1 ─────────●───── 5                          │ │
│ │ 選択中: 3（普通）                              │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ フリーコメント:                                   │
│ [textarea]                                       │
│                                                  │
│ [戻る]                          [次へ進む]        │
└──────────────────────────────────────────────────┘
```

**ボタン**：
- 「戻る」：`border border-gray-300 text-gray-600 hover:bg-gray-50`
- 「次へ進む」：`bg-indigo-600 text-white hover:bg-indigo-700`。3つのスライダーすべてがユーザーによって明示的に操作済みの場合に有効化

> **スライダー初期値**：初期値は未選択（`null`）とし、ユーザーが明示的に操作したかどうかをフラグ管理する。スライダーUI上は中央（3）を表示するが、操作前は未選択扱いとする。

> **プリフェッチ最適化**：Step3の「次へ進む」ボタン押下時にStep4のAI質問生成APIをプリフェッチ開始し、Step4表示時にはロード済みの結果を表示する。

#### Step4: AIヒアリング質問 + メモ

**コンポーネント名**：`OOStep4Hearing`

**表示内容**：
- AIが生成した3つのパーソナライズされたヒアリング質問を表示
- 各質問に対するメモ入力欄
- AI呼び出し中はスピナーを表示（目標設定ウィザードの Step5Diagnosis と同一パターン）

**入力フィールド**：
- 各質問に対するメモ（textarea、`text-xl`、placeholder: 「面談中のメモ・メンバーの回答を記入」、各4行）

**AI連携**：
- ウィザードがStep4に遷移した時点で自動的に `POST /api/members/[name]/one-on-one/questions` を呼び出す
- Step1〜3の情報（前回アクションアイテムの進捗、目標進捗、コンディション）を送信
- AIが3つの質問を生成して返却
- 生成済みの場合（state に質問が保存済み）は再呼び出ししない

**UIレイアウト**：
```
┌──────────────────────────────────────────────┐
│ h2: ヒアリング                                  │
│ p: 今回の面談でヒアリングすべきポイントをAIが       │
│    提案しました。面談中のメモを記録してください。     │
│                                                  │
│ ┌─ 質問1 ──────────────────────────────────────┐ │
│ │ bg-indigo-50 p-5 rounded-lg                  │ │
│ │ text-xl font-medium: {質問文1}                │ │
│ │ text-lg text-gray-500: {質問の意図}            │ │
│ └──────────────────────────────────────────────┘ │
│ メモ: [textarea]                                 │
│                                                  │
│ ┌─ 質問2 ──────────────────────────────────────┐ │
│ │ bg-indigo-50 p-5 rounded-lg                  │ │
│ │ text-xl font-medium: {質問文2}                │ │
│ │ text-lg text-gray-500: {質問の意図}            │ │
│ └──────────────────────────────────────────────┘ │
│ メモ: [textarea]                                 │
│                                                  │
│ ┌─ 質問3 ──────────────────────────────────────┐ │
│ │ bg-indigo-50 p-5 rounded-lg                  │ │
│ │ text-xl font-medium: {質問文3}                │ │
│ │ text-lg text-gray-500: {質問の意図}            │ │
│ └──────────────────────────────────────────────┘ │
│ メモ: [textarea]                                 │
│                                                  │
│ [戻る]                          [次へ進む]        │
└──────────────────────────────────────────────────┘
```

**ボタン**：
- 「戻る」：`border border-gray-300 text-gray-600 hover:bg-gray-50`
- 「次へ進む」：`bg-indigo-600 text-white hover:bg-indigo-700`。AIの質問生成が完了している場合に有効化（メモは任意）

#### Step5: ネクストアクション設定

**コンポーネント名**：`OOStep5Actions`

**表示内容**：
- 次回までのアクションアイテムを複数登録する
- 各アクションアイテムに担当者と期限を設定

**入力フィールド**：
- アクション内容（input、`text-xl`、placeholder: 「アクション内容を入力」）
- 担当者（select、`text-xl`）：「マネージャー」「メンバー」「両方」の3択
- 期限（input type="date"、`text-xl`）
- 「アクションを追加」ボタン：新しいアクションアイテム行を追加
- 「削除」ボタン：各アクションアイテム行の右端に配置（`text-red-400 hover:text-red-600`）

**初期状態**：アクションアイテム1行が空で表示される。

**UIレイアウト**：
```
┌──────────────────────────────────────────────┐
│ h2: ネクストアクション                          │
│ p: 次回の1on1までに実施するアクションを設定します。│
│                                                  │
│ ┌─ アクション1 ────────────────────────────────┐ │
│ │ アクション内容: [input]                        │ │
│ │ 担当者: [select]      期限: [date]    [✕ 削除]│ │
│ └──────────────────────────────────────────────┘ │
│ ┌─ アクション2 ────────────────────────────────┐ │
│ │ アクション内容: [input]                        │ │
│ │ 担当者: [select]      期限: [date]    [✕ 削除]│ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ [+ アクションを追加]                              │
│   border-dashed border-2 border-gray-300         │
│   text-gray-500 hover:border-indigo-400          │
│                                                  │
│ [戻る]                     [1on1を完了する]       │
└──────────────────────────────────────────────────┘
```

**ボタン**：
- 「戻る」：`border border-gray-300 text-gray-600 hover:bg-gray-50`
- 「1on1を完了する」：`bg-indigo-600 text-white hover:bg-indigo-700`。アクションアイテムが1つ以上入力済み（内容が空でない）の場合に有効化。押下で以下を順次実行：
  1. `POST /api/members/[name]/one-on-one/summary` でAI引き継ぎサマリーを生成
  2. `POST /api/members/[name]/one-on-one` で1on1記録全体を保存
  3. 完了画面を表示

#### 完了画面

**コンポーネント名**：`OOStepComplete`

**表示内容**：
- 完了メッセージ：「1on1記録を保存しました」
- AIが生成した引き継ぎサマリーをカード形式で表示
- 保存先ファイルパスを表示（`text-lg text-gray-500`）

**UIレイアウト**：
```
┌──────────────────────────────────────────────┐
│ （中央寄せ）                                    │
│ ✓ チェックマーク（bg-green-100 text-green-600    │
│    w-20 h-20 rounded-full）                     │
│                                                  │
│ h2: 1on1記録を保存しました                       │
│ p: {メンバー名}さんの{YYYY年MM月}の1on1記録を      │
│    保存しました。                                 │
│                                                  │
│ ┌─ 次回への引き継ぎサマリー ──────────────────┐  │
│ │ bg-indigo-50 border-indigo-200 p-8 rounded-lg│  │
│ │ {AI生成の引き継ぎサマリー}                     │  │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ p: 保存先: data/members/{name}/one-on-one/       │
│    YYYY-MM.md                                    │
│                                                  │
│ [閉じる]                                         │
│   bg-indigo-600 text-white hover:bg-indigo-700   │
└──────────────────────────────────────────────────┘
```

> **画面更新**：「閉じる」ボタン押下時に `router.refresh()` を実行し、1on1記録タブの表示を更新する。

### 10.3 データ設計

#### 10.3.1 型定義（`lib/types.ts` に追加）

```typescript
// 1on1 Wizard types

export interface ConditionScore {
  motivation: number    // 1-5
  workload: number      // 1-5
  teamRelation: number  // 1-5
  comment: string       // フリーコメント
}

export interface ActionItemReview {
  content: string
  assignee: 'manager' | 'member' | 'both'
  deadline: string           // YYYY-MM-DD
  completed: boolean
  reviewComment: string
}

export interface GoalProgressEntry {
  goalTitle: string
  goalBody: string           // 達成した姿・検証方法・中間確認を含む
  status: 'not-started' | 'in-progress' | 'delayed' | 'completed'
  progressNote: string
}

export interface HearingQuestion {
  question: string
  intent: string             // 質問の意図
  memo: string               // 面談中のメモ
}

export interface ActionItem {
  content: string
  assignee: 'manager' | 'member' | 'both'
  deadline: string           // YYYY-MM-DD
}

export interface OneOnOneWizardState {
  currentStep: number                        // 1-5 + 6(完了)
  yearMonth: string                          // YYYY-MM
  previousActionItems: ActionItemReview[]    // Step1: 前回アクションアイテム
  previousSummary: string                    // Step1: 前回の引き継ぎサマリー
  goalProgress: GoalProgressEntry[]          // Step2: 目標進捗
  condition: ConditionScore                  // Step3: コンディション
  previousCondition: ConditionScore | null   // Step3: 前月比表示用
  hearingQuestions: HearingQuestion[]        // Step4: AI質問 + メモ
  nextActions: ActionItem[]                  // Step5: ネクストアクション
  handoverSummary: string | null             // 完了: AI引き継ぎサマリー
  savedPath: string | null                   // 完了: 保存先パス
}

export interface OneOnOneWizardContextData {
  memberName: string
  memberProfile: string
  goalsMarkdown: string        // goals/2026-h1.md の rawMarkdown
  previousOneOnOne: OneOnOneRecord | null  // 前回の1on1記録
  previousActionItems: ActionItem[]        // 前回のネクストアクション（パース済み）
  previousCondition: ConditionScore | null // 前回のコンディションスコア（パース済み）
  previousSummary: string                  // 前回の引き継ぎサマリー（パース済み）
  departmentPolicy: string
  guidelines: string           // 運用ガイドライン
  yearMonth: string            // YYYY-MM形式
}
```

> **前回記録のパース**：`previousActionItems`、`previousCondition`、`previousSummary` のパースはサーバーコンポーネント（`page.tsx`）で実行し、パース済みデータをウィザードに渡す。

> **yearMonth の自動設定**：ウィザード起動時に `new Date()` から `YYYY-MM` 形式を自動設定する。同月に2回目の1on1を実施した場合は既存ファイルを上書きする。

> **evaluationCriteria の除外**：評価基準は1on1の文脈では不要なため、コンテキストから除外した。代わりに `departmentPolicy` と `guidelines` をAI質問生成のコンテキストとして活用する。

#### 10.3.2 Markdown ファイルフォーマット（保存形式）

> **テンプレート移行**：既存の `one-on-one-template.md` は本ウィザード導入に伴い廃止し、新フォーマットに統一する。手動作成の旧形式記録は rawMarkdown として読み込み可能だが、構造化パースの対象外とする。

ファイルパス：`data/members/{name}/one-on-one/YYYY-MM.md`

```markdown
# 1on1記録

- 日付：YYYY-MM-DD
- メンバー：{名前}
- 実施者：比良津暁

## 前回アクションアイテム振り返り

### アクション1
- 内容：{アクション内容}
- 担当：{マネージャー/メンバー/両方}
- 期限：{YYYY-MM-DD}
- 完了：{はい/いいえ}
- コメント：{コメント}

### アクション2
- 内容：{アクション内容}
- 担当：{マネージャー/メンバー/両方}
- 期限：{YYYY-MM-DD}
- 完了：{はい/いいえ}
- コメント：{コメント}

## 目標進捗確認

### 目標①（実行）：{目標文}
- 進捗ステータス：{未着手/進行中/遅延あり/完了}
- 進捗メモ：{進捗メモ}

### 目標②（挑戦）：{目標文}
- 進捗ステータス：{未着手/進行中/遅延あり/完了}
- 進捗メモ：{進捗メモ}

### 目標③（インパクト）：{目標文}
- 進捗ステータス：{未着手/進行中/遅延あり/完了}
- 進捗メモ：{進捗メモ}

## コンディション

- モチベーション：{1-5}
- 業務負荷：{1-5}
- チーム関係：{1-5}
- コメント：{フリーコメント}

## ヒアリング

### 質問1：{質問文}
- 意図：{質問の意図}
- メモ：{面談中のメモ}

### 質問2：{質問文}
- 意図：{質問の意図}
- メモ：{面談中のメモ}

### 質問3：{質問文}
- 意図：{質問の意図}
- メモ：{面談中のメモ}

## ネクストアクション

### アクション1
- 内容：{アクション内容}
- 担当：{マネージャー/メンバー/両方}
- 期限：{YYYY-MM-DD}

### アクション2
- 内容：{アクション内容}
- 担当：{マネージャー/メンバー/両方}
- 期限：{YYYY-MM-DD}

## 引き継ぎサマリー（AI生成）

{AIが生成した次回1on1への引き継ぎサマリー}
```

**担当者マッピング表**：

| TypeScript値 | Markdown表記 |
|---|---|
| `manager` | マネージャー |
| `member` | メンバー |
| `both` | 両方 |

#### 10.3.3 前回記録からのデータ抽出

前回の1on1記録（`one-on-one/YYYY-MM.md`）から以下を抽出するパーサー `parseOneOnOneRecord()` を `lib/parsers/one-on-one.ts` に実装する。

| 抽出対象 | 抽出方法 |
|---------|---------|
| ネクストアクション | `## ネクストアクション` セクション内の `### アクションN` を走査。各アクションの内容・担当・期限を抽出 |
| コンディションスコア | `## コンディション` セクション内の `- モチベーション：` `- 業務負荷：` `- チーム関係：` 行から数値を抽出 |
| 引き継ぎサマリー | `## 引き継ぎサマリー（AI生成）` セクションの本文を抽出 |

### 10.4 API設計

#### 10.4.1 POST /api/members/[name]/one-on-one/questions

**ファイル**：`app/api/members/[name]/one-on-one/questions/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | AIによるパーソナライズされたヒアリング質問を3つ生成 |
| メソッド | POST |
| パラメータ | `name`（URLエンコード済みメンバー名） |
| `dynamic` | `'force-dynamic'` |

**リクエストボディ**：
```typescript
{
  memberContext: string           // メンバープロフィール rawMarkdown
  goalsMarkdown: string          // 目標 rawMarkdown
  departmentPolicy: string       // 部方針（組織の優先事項をAIが理解するためのコンテキスト）
  previousActionReviews: {       // Step1の振り返り結果
    content: string
    completed: boolean
    reviewComment: string
  }[]
  goalProgress: {                // Step2の進捗
    goalTitle: string
    status: string
    progressNote: string
  }[]
  condition: {                   // Step3のコンディション
    motivation: number
    workload: number
    teamRelation: number
    comment: string
  }
  previousCondition?: {          // 前月のコンディション（存在する場合）
    motivation: number
    workload: number
    teamRelation: number
  }
}
```

**レスポンス**：
```typescript
{
  questions: {
    question: string
    intent: string
  }[]
  mode: 'mock' | 'live'
}
```

**モックレスポンス**（APIキーなしの場合）：
```typescript
const MOCK_QUESTIONS = [
  {
    question: '前回のアクションアイテムで未完了のものがありますが、何か障害になっていることはありますか？',
    intent: '未完了タスクの根本原因を把握し、支援が必要かどうかを確認する'
  },
  {
    question: '目標の進捗について、特に手応えを感じている部分と、不安を感じている部分を教えてください。',
    intent: '目標に対する本人の認識と感情を把握し、支援の方向性を定める'
  },
  {
    question: '最近のチーム内でのコミュニケーションで、何か気になることや改善したいことはありますか？',
    intent: 'チーム関係のコンディション変化の背景を深掘りする'
  }
]
```

遅延：1000ms

**システムプロンプト**：

```
あなたは1on1面談の専門ファシリテーターです。
マネージャーがメンバーとの月次1on1面談で使用するヒアリング質問を3つ生成してください。

【質問設計の原則】
1. ステップ1〜3で収集した情報（前回アクションアイテムの進捗、目標の進捗状況、コンディションスコア）をもとに、最も深掘りすべきポイントを特定すること
2. 表面的な進捗確認ではなく、本人の内面（動機・不安・成長実感）に踏み込む質問にすること
3. 質問は具体的で、このメンバー固有の文脈に基づいたものにすること。汎用的な質問は禁止
4. コンディションスコアに前月比で下降が見られる場合は、その背景を探る質問を必ず1つ含めること
5. 目標に「遅延あり」のものがある場合は、遅延の構造的原因を探る質問を必ず1つ含めること

【出力フォーマット】
以下のJSON形式で出力すること。JSON以外のテキストは一切含めないこと。

[
  {
    "question": "質問文（メンバーに直接投げかける形で）",
    "intent": "この質問をする意図（マネージャー向けの補足説明、1文で）"
  },
  {
    "question": "質問文",
    "intent": "意図"
  },
  {
    "question": "質問文",
    "intent": "意図"
  }
]

出力は日本語で行うこと。
```

**ユーザーメッセージ構築**（`buildOneOnOneQuestionsUserMessage()`）：

```
## メンバー：{memberName}

## メンバープロフィール
{memberContext}

## 部方針
{departmentPolicy}

## 現在の目標
{goalsMarkdown}

## 前回アクションアイテムの振り返り
{previousActionReviewsをMarkdown形式で列挙}
- アクション1：{内容}（完了: はい/いいえ）コメント: {comment}
- アクション2：...

## 今期の目標進捗
{goalProgressをMarkdown形式で列挙}
- 目標1：{goalTitle}（ステータス: {status}）メモ: {progressNote}
- 目標2：...

## 今月のコンディション
- モチベーション：{motivation}/5
- 業務負荷：{workload}/5
- チーム関係：{teamRelation}/5
- コメント：{comment}

## 前月のコンディション（参考）
- モチベーション：{previousMotivation}/5
- 業務負荷：{previousWorkload}/5
- チーム関係：{previousTeamRelation}/5

上記の情報をもとに、今回の1on1面談で聞くべき質問を3つ生成してください。
```

**maxTokens**：1024

**JSONパースフォールバック**：

AIの出力がvalid JSONでない場合（Markdownコードブロック囲みや前後の説明文付き等）に備え、正規表現 `/\[[\s\S]*\]/` でJSON配列部分を抽出する。抽出・パース失敗時は以下のフォールバック質問を使用する：

```typescript
const FALLBACK_QUESTIONS = [
  {
    question: '最近の業務で、特にやりがいを感じていることは何ですか？',
    intent: 'モチベーションの源泉を把握し、今後の業務アサインに活かす'
  },
  {
    question: '現在の目標に対して、何か障害になっていると感じることはありますか？',
    intent: '目標達成を阻む構造的な問題を早期に発見する'
  },
  {
    question: 'チーム内で改善できそうだと思うことがあれば教えてください。',
    intent: 'チーム関係やプロセスの改善点を本人視点で収集する'
  }
]
```

#### 10.4.2 POST /api/members/[name]/one-on-one/summary

**ファイル**：`app/api/members/[name]/one-on-one/summary/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | AIによる次回1on1への引き継ぎサマリーを生成 |
| メソッド | POST |
| パラメータ | `name`（URLエンコード済みメンバー名） |
| `dynamic` | `'force-dynamic'` |

**リクエストボディ**：
```typescript
{
  memberContext: string
  goalsMarkdown: string
  previousActionReviews: ActionItemReview[]
  goalProgress: GoalProgressEntry[]
  condition: ConditionScore
  previousCondition?: ConditionScore
  hearingQuestions: HearingQuestion[]
  nextActions: ActionItem[]
}
```

**レスポンス**：
```typescript
{
  summary: string
  mode: 'mock' | 'live'
}
```

**モックレスポンス**（APIキーなしの場合）：
```typescript
const MOCK_SUMMARY = `【次回1on1への引き継ぎサマリー】

■ 要注目ポイント
- 目標②（挑戦目標）が遅延傾向。具体的な障害の特定と支援策の検討が必要
- モチベーションが前月比で低下。背景要因の継続的なモニタリングが必要

■ 継続フォロー事項
- アクションアイテム「技術ブログの執筆」が2ヶ月連続で未完了。優先度の見直しまたはアクション自体の変更を検討
- チーム内のコミュニケーション改善の取り組みについて進捗確認

■ ポジティブな変化
- 目標①（実行目標）は順調に進捗。中間確認の基準を前倒しで達成する見込み
- 業務負荷が適正範囲に収まっている

■ 次回の面談で確認すべきこと
- 挑戦目標の遅延に対する具体的な打ち手の実行状況
- モチベーション回復の兆候があるかどうか`
```

遅延：1500ms

**システムプロンプト**：

```
あなたは1on1面談の専門ファシリテーターです。
今回の1on1面談の全記録をもとに、次回の1on1面談に引き継ぐべきサマリーを作成してください。

【引き継ぎサマリーの目的】
次回の1on1面談を実施する際に、前回の内容を素早く把握し、継続的なフォローを可能にすること。

【出力フォーマット】

■ 要注目ポイント
（次回必ず確認すべき事項。目標の遅延、コンディションの低下、未完了アクションの蓄積など、放置するとリスクになる項目を箇条書きで）

■ 継続フォロー事項
（今回の面談で話題に上がり、次回以降も継続的にフォローすべき事項を箇条書きで）

■ ポジティブな変化
（目標の進捗、コンディションの改善、新しい取り組みの開始など、良い兆候を箇条書きで）

■ 次回の面談で確認すべきこと
（今回設定したアクションアイテムの進捗確認、コンディション変化の追跡など、次回の面談で優先的に確認すべき事項を箇条書きで）

【注意】
- 事実ベースで記述すること。推測や主観的な評価は含めないこと
- 具体的なアクションアイテムや目標名を明記すること
- 箇条書きで簡潔に記述すること（各項目1〜2文）
- 出力は日本語で行うこと
```

**ユーザーメッセージ構築**（`buildOneOnOneSummaryUserMessage()`）：

```
## メンバー：{memberName}

## メンバープロフィール
{memberContext}

## 現在の目標
{goalsMarkdown}

## 前回アクションアイテムの振り返り
{previousActionReviewsをMarkdown形式で列挙}
### アクション1
- 内容：{content}
- 担当：{assignee}
- 期限：{deadline}
- 完了：{completed ? 'はい' : 'いいえ'}
- コメント：{reviewComment}

### アクション2
- 内容：...

## 今期の目標進捗
### 目標①：{goalTitle}
- 進捗ステータス：{status}
- 進捗メモ：{progressNote}

### 目標②：...

## 今月のコンディション
- モチベーション：{motivation}/5
- 業務負荷：{workload}/5
- チーム関係：{teamRelation}/5
- コメント：{comment}

## 前月のコンディション（参考）
- モチベーション：{previousMotivation}/5
- 業務負荷：{previousWorkload}/5
- チーム関係：{previousTeamRelation}/5

## ヒアリング記録
### 質問1：{question}
- 意図：{intent}
- メモ：{memo}

### 質問2：...

### 質問3：...

## 次回アクションアイテム
- {content}（担当：{assignee}、期限：{deadline}）
- ...

上記の1on1記録をもとに、次回の1on1面談に引き継ぐべきサマリーを作成してください。
```

**maxTokens**：1024

#### 10.4.3 POST /api/members/[name]/one-on-one

**ファイル**：`app/api/members/[name]/one-on-one/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | 1on1記録をMarkdownファイルとして保存 |
| メソッド | POST |
| パラメータ | `name`（URLエンコード済みメンバー名） |
| `dynamic` | `'force-dynamic'` |

**リクエストボディ**：
```typescript
{
  yearMonth: string              // YYYY-MM
  content: string                // 組み立て済みMarkdown全文
}
```

**処理**：
1. `decodeURIComponent(params.name)` でメンバー名をデコード
2. `MEMBERS_DIR` からメンバーディレクトリの存在を確認
3. `one-on-one/` ディレクトリが存在しない場合は `mkdirSync` で作成（`{ recursive: true }`）
4. `one-on-one/{yearMonth}.md` にコンテンツを書き込み

**レスポンス**：
```typescript
{
  success: true
  path: string    // 保存先の相対パス（例: "data/members/山田(剛)/one-on-one/2026-04.md"）
}
```

**エラー**：
- 400: `yearMonth` または `content` が未指定
- 404: メンバーディレクトリが見つからない
- 500: ファイル書き込み失敗

**実装パターン**：`app/api/members/[name]/goals/route.ts` の POST 処理と同一パターンに従う。

### 10.5 目標設定ウィザードとの連携

#### 10.5.1 目標データの自動取得

1on1ウィザード起動時に、メンバー詳細ページの Server Component（`app/members/[name]/page.tsx`）から `goals` データを `OneOnOneWizardContextData.goalsMarkdown` として渡す。

目標データのフォーマット（`goals/2026-h1.md`）は以下の構造を持つ。

```
目標①（実行／挑戦／インパクト）：[目標文]
　└ 達成した姿：[1文]
　└ 検証方法：[基準]
　└ 中間確認：[3ヶ月時点での基準]
　└ 根拠：[紐づけ]
```

#### 10.5.2 Step2での目標分解

`OOStep2GoalProgress` コンポーネントは、`goalsMarkdown` を以下のロジックでパースし、目標ごとのカードを生成する。

```typescript
// lib/parsers/goal-progress.ts

/**
 * 目標Markdownを個別エントリに分解する。
 * 以下の2つのフォーマットを自動検出して対応する。
 *
 * ウィザード形式: 「目標①（実行）：目標文」
 * テンプレート形式: 「### 目標N」 + 「- 目標内容：目標文」
 */
export function parseGoalEntries(goalsMarkdown: string): GoalProgressEntry[] {
  // フォーマット検出: テンプレート形式は「### 目標」+ 「- 目標内容：」の組み合わせで判定
  const isTemplateFormat = /### 目標\d+/.test(goalsMarkdown) && /- 目標内容：/.test(goalsMarkdown)

  if (isTemplateFormat) {
    return parseTemplateFormat(goalsMarkdown)
  }
  return parseWizardFormat(goalsMarkdown)
}

/** ウィザード形式: 「目標①（実行）：...」パターン */
function parseWizardFormat(goalsMarkdown: string): GoalProgressEntry[] {
  const goalPattern = /目標[①-⑩\d]+（[^）]+）：(.+)/g
  const matches = [...goalsMarkdown.matchAll(goalPattern)]

  return matches.map((match, i) => {
    const startIdx = match.index!
    const endIdx = i + 1 < matches.length ? matches[i + 1].index! : goalsMarkdown.length
    const goalBody = goalsMarkdown.slice(startIdx, endIdx).trim()

    return {
      goalTitle: match[0],
      goalBody,
      status: 'not-started' as const,
      progressNote: '',
    }
  })
}

/** テンプレート形式: 「### 目標N」 + 「- 目標内容：...」パターン */
function parseTemplateFormat(goalsMarkdown: string): GoalProgressEntry[] {
  const sectionPattern = /### 目標\d+/g
  const matches = [...goalsMarkdown.matchAll(sectionPattern)]

  return matches.map((match, i) => {
    const startIdx = match.index!
    const endIdx = i + 1 < matches.length ? matches[i + 1].index! : goalsMarkdown.length
    const section = goalsMarkdown.slice(startIdx, endIdx).trim()

    // 「- 目標内容：」行から目標文を抽出
    const contentMatch = section.match(/- 目標内容：(.+)/)
    const goalTitle = contentMatch ? `${match[0]}：${contentMatch[1]}` : match[0]

    return {
      goalTitle,
      goalBody: section,
      status: 'not-started' as const,
      progressNote: '',
    }
  })
}
```

#### 10.5.3 タイムライン警告の計算

Step2のタイムライン警告は、各目標の「中間確認」フィールドから期限を推定してクライアントサイドで計算する。

```typescript
// lib/utils/timeline-warning.ts

export function getTimelineWarning(goalBody: string, currentDate: Date): {
  type: 'warning' | 'overdue' | null
  message: string
  daysRemaining: number
} | null {
  // 「中間確認：」行を抽出
  const midCheckMatch = goalBody.match(/中間確認：(.+)/)
  if (!midCheckMatch) return null

  const midCheckText = midCheckMatch[1]

  // 「X月末」パターンを検出
  const monthMatch = midCheckText.match(/(\d{1,2})月末/)
  if (!monthMatch) return null

  const targetMonth = parseInt(monthMatch[1])
  const targetYear = currentDate.getFullYear()
  // 月末日を計算（翌月の0日 = 当月末日）
  const targetDate = new Date(targetYear, targetMonth, 0)
  const diffDays = Math.ceil((targetDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { type: 'overdue', message: `中間確認の期限を${Math.abs(diffDays)}日超過`, daysRemaining: diffDays }
  } else if (diffDays <= 30) {
    return { type: 'warning', message: `中間確認まであと${diffDays}日`, daysRemaining: diffDays }
  }

  return null
}
```

#### 10.5.4 目標データ不在時の動作

目標データが存在しない場合（`goals` が `null`）、Step2は以下の代替表示を行う。

- 警告メッセージ：「目標が未設定です。目標設定ウィザードで目標を作成してから1on1を実施してください。」（`bg-amber-50 border-amber-200 text-amber-800`）
- フリーテキスト入力欄：「目標が未設定のため、ここに進捗メモを自由記入してください。」（textarea、8行）
- この場合、Step4のAI質問生成では目標関連の情報が空として扱われる

### 10.6 新規ファイル一覧

#### 10.6.1 新規作成ファイル

| ファイルパス | 種類 | 役割 |
|------------|------|------|
| `web-demo/src/components/one-on-one/OneOnOneWizard.tsx` | Client Component | 1on1ウィザード本体（useReducer + 5ステップ描画） |
| `web-demo/src/components/one-on-one/OneOnOneStepper.tsx` | Client Component | ステッパーUI（5ステップの進捗表示） |
| `web-demo/src/components/one-on-one/steps/OOStep1PreviousActions.tsx` | Client Component | Step1: 前回アクションアイテム振り返り |
| `web-demo/src/components/one-on-one/steps/OOStep2GoalProgress.tsx` | Client Component | Step2: 目標進捗確認 |
| `web-demo/src/components/one-on-one/steps/OOStep3Condition.tsx` | Client Component | Step3: コンディション確認 |
| `web-demo/src/components/one-on-one/steps/OOStep4Hearing.tsx` | Client Component | Step4: AIヒアリング質問 + メモ |
| `web-demo/src/components/one-on-one/steps/OOStep5Actions.tsx` | Client Component | Step5: ネクストアクション設定 |
| `web-demo/src/components/one-on-one/steps/OOStepComplete.tsx` | Client Component | 完了画面 |
| `web-demo/src/app/api/members/[name]/one-on-one/route.ts` | API Route | 1on1記録保存 |
| `web-demo/src/app/api/members/[name]/one-on-one/questions/route.ts` | API Route | AIヒアリング質問生成 |
| `web-demo/src/app/api/members/[name]/one-on-one/summary/route.ts` | API Route | AI引き継ぎサマリー生成 |
| `web-demo/src/lib/prompts/one-on-one-questions.ts` | Prompt Builder | ヒアリング質問用プロンプト（buildOneOnOneQuestionsSystemPrompt, buildOneOnOneQuestionsUserMessage） |
| `web-demo/src/lib/prompts/one-on-one-summary.ts` | Prompt Builder | 引き継ぎサマリー用プロンプト（buildOneOnOneSummarySystemPrompt, buildOneOnOneSummaryUserMessage） |
| `web-demo/src/lib/parsers/one-on-one.ts` | Parser | 1on1記録パーサー（parseOneOnOneRecord: アクションアイテム・コンディション・引き継ぎサマリー抽出） |
| `web-demo/src/lib/parsers/goal-progress.ts` | Parser | 目標分解パーサー（parseGoalEntries: 目標Markdownを個別エントリに分解） |
| `web-demo/src/lib/utils/timeline-warning.ts` | Utility | タイムライン警告計算（getTimelineWarning: 中間確認期限の残日数計算） |
| `web-demo/src/lib/utils/one-on-one-markdown.ts` | Utility | 1on1記録Markdown組み立て（buildOneOnOneMarkdown: ウィザード状態からMarkdown文字列を生成） |

#### 10.6.2 修正が必要な既存ファイル

| ファイルパス | 修正内容 |
|------------|---------|
| `web-demo/src/lib/types.ts` | `ConditionScore`, `ActionItemReview`, `GoalProgressEntry`, `HearingQuestion`, `ActionItem`, `OneOnOneWizardState`, `OneOnOneWizardContextData` の7型を追加 |
| `web-demo/src/components/member/MemberDetailClient.tsx` | `oneOnOneWizardOpen` state を追加。`OneOnOneWizard` コンポーネントのインポートと描画。`OneOnOneTab` に `onStartWizard` props を渡す |
| `web-demo/src/components/member/OneOnOneTab.tsx` | 「1on1ウィザードを開始」ボタンを追加。`onStartWizard` props を受け取る |
| `web-demo/src/app/members/[name]/page.tsx` | `oneOnOneWizardContext` を構築して `MemberDetailClient` に渡す。前回の1on1記録を取得してコンテキストに含める |
| `web-demo/src/lib/fs/members.ts` | `getLatestOneOnOne(memberName)` 関数を追加（最新の1on1記録を取得） |

### 10.7 実装フェーズ

#### フェーズ1: データ基盤（見積：0.5日）

1. `lib/types.ts` に1on1ウィザード関連の7型を追加
2. `lib/parsers/one-on-one.ts` を実装（前回記録のパース）
3. `lib/parsers/goal-progress.ts` を実装（目標分解）
4. `lib/utils/timeline-warning.ts` を実装（タイムライン警告）
5. `lib/utils/one-on-one-markdown.ts` を実装（Markdown組み立て）
6. `lib/fs/members.ts` に `getLatestOneOnOne()` を追加

#### フェーズ2: API実装（見積：1日）

1. `POST /api/members/[name]/one-on-one` を実装（記録保存）
2. `lib/prompts/one-on-one-questions.ts` を実装（質問生成プロンプト）
3. `POST /api/members/[name]/one-on-one/questions` を実装（AI質問生成、モック込み）
4. `lib/prompts/one-on-one-summary.ts` を実装（サマリー生成プロンプト）
5. `POST /api/members/[name]/one-on-one/summary` を実装（AIサマリー生成、モック込み）

#### フェーズ3: ウィザードUI（見積：2日）

1. `OneOnOneStepper.tsx` を実装（5ステップ進捗バー）
2. `OneOnOneWizard.tsx` を実装（useReducer + 全体レイアウト）
3. `OOStep1PreviousActions.tsx` を実装（前回振り返り）
4. `OOStep2GoalProgress.tsx` を実装（目標進捗 + タイムライン警告）
5. `OOStep3Condition.tsx` を実装（コンディション + 前月比）
6. `OOStep4Hearing.tsx` を実装（AI質問 + メモ）
7. `OOStep5Actions.tsx` を実装（ネクストアクション）
8. `OOStepComplete.tsx` を実装（完了画面 + サマリー表示）

#### フェーズ4: 統合・テスト（見積：0.5日）

1. `MemberDetailClient.tsx` に1on1ウィザードの起動制御を追加
2. `OneOnOneTab.tsx` にウィザード起動ボタンを追加
3. `app/members/[name]/page.tsx` で `oneOnOneWizardContext` を構築
4. 全ステップの遷移テスト（モックモード）
5. AI連携テスト（APIキーあり環境）
6. 保存されたMarkdownファイルの内容確認
7. 前回記録の自動ロードテスト（2回目以降の1on1）

---

## 11. 評価ウィザード

### 11.1 概要・方針

評価ウィザードは、半期ごとのメンバー評価を構造化して支援するための4ステップウィザードである。目標設定ウィザード（セクション7）および1on1ウィザード（セクション10）と同様に全画面モーダルとして動作し、`useReducer` で状態管理を行う。

#### 設計方針

- **エビデンスベースの評価**：目標ウィザードで設定した目標・達成基準と、1on1ウィザードで蓄積した進捗・コンディション・ヒアリングメモを自動収集し、事実に基づく評価を支援する
- **3ウィザード連携**：目標設定 → 1on1記録 → 評価 → 次期目標設定の一連のサイクルをデータで接続し、マネジメントの継続性を担保する
- **自己評価との対話**：カオナビの自己評価（S/A/B/C/D評価、達成コメント、振り返りコメント）をインプットとし、マネージャー評価との乖離を可視化する
- **AI補助・人間決定**：AIは評価ドラフトとコメント案を生成するが、最終的な評価グレードの決定・修正はマネージャーが行う。変更時は理由の記録を必須とする
- **マネージャー専用**：1on1ウィザードと同様、マネージャーのみが操作する前提とする

#### モデル

`claude-sonnet-4-20250514`（`call-claude.ts` のデフォルトモデルと同一）

### 11.2 画面設計（4ステップ + 完了画面）

> **パスワード保護について**：評価ウィザードは `ReviewsTab` 内の PasswordGate 解除後にのみ「評価ウィザードを開始」ボタンが表示されるため、ウィザード自体に追加のパスワード保護は不要。`onStartWizard` コールバックは PasswordGate コンポーネント内部でのみ呼び出される設計とする。

#### 全体レイアウト

目標設定ウィザード・1on1ウィザードと同一のレイアウト構造を採用する。

| 要素 | Tailwind クラス | 備考 |
|------|----------------|------|
| コンテナ | `fixed inset-0 z-50 bg-white flex flex-col` | 全画面モーダル |
| ヘッダー | `px-16 py-5 border-b border-gray-200 bg-gray-50` | `{メンバー名}さんの評価` + 閉じるボタン |
| ステッパー | `px-16 py-5 border-b border-gray-100` | 4ステップ進捗バー |
| コンテンツ領域 | `max-w-5xl mx-auto px-16 py-8` | 中央寄せ + 左右余白 |

#### フォントサイズ規約

目標設定ウィザード・1on1ウィザードと同一の規約を適用する（セクション4.5のフォントサイズ規約を参照）。

| 要素 | サイズ |
|------|--------|
| ページ見出し（h2） | `text-4xl font-bold` |
| 説明文 | `text-xl` |
| フォームラベル | `text-xl font-medium` |
| フォーム入力（textarea/input/select） | `text-xl` |
| ボタン | `text-xl font-semibold` |
| バッジ・ステータス | `text-lg` |
| ヘルパーテキスト・注釈 | `text-lg` |
| ステッパー数字 | `text-xl font-bold`（`w-12 h-12` 円形） |
| ステッパーラベル | `text-lg` |

#### ステッパー

`ReviewStepper` コンポーネントで4ステップの進捗を視覚的に表示する。`WizardStepper` / `OneOnOneStepper` と同一のUIパターンを採用し、ステップ数のみ4に変更する。

ステップラベル：
1. 素材収集
2. AI評価ドラフト
3. マネージャー確認・修正
4. 評価者コメント

#### Step1: 評価素材の自動収集 + 自己評価入力

**コンポーネント名**：`ReviewStep1Materials`

**表示内容**：
- 自動収集された評価素材（目標データ、1on1記録、プロフィール情報）を一覧表示
- カオナビ自己評価の入力フォーム
- マネージャー補足情報の入力フォーム

**自動収集データ**：
- **目標データ**（`goals/2026-h1.md`）：各目標の内容・達成基準・検証方法・中間確認を目標カードとして表示
- **1on1記録**（`one-on-one/*.md`）：全1on1記録から進捗トレンド・コンディショントレンド・完了アクション・ヒアリングメモを集約して表示
- **プロフィール**（`profile.md`）：等級・期待する役割を表示

**入力フィールド（自己評価）**：
- 総合自己評価（select、`text-xl`）：S / A / B / C / D の5択
- 達成コメント（textarea、`text-xl`、placeholder: 「今期の主な達成事項を記入（カオナビの自己評価コメントを転記）」、6行）
- 振り返りコメント（textarea、`text-xl`、placeholder: 「今期の振り返り・反省点を記入（カオナビの振り返りコメントを転記）」、6行）

**入力フィールド（マネージャー補足）**：
- 特筆すべきエピソード（textarea、`text-xl`、placeholder: 「1on1記録に含まれない特筆すべき行動・成果を記入」、4行）
- 環境変化・特殊事情（textarea、`text-xl`、placeholder: 「組織変更・プロジェクト変更等、評価に影響する環境変化があれば記入」、4行）

**1on1記録が0件の場合の処理**：
1on1記録が0件の場合、目標進捗・コンディション・アクション・ヒアリングメモの各セクションに「1on1記録がありません。マネージャー補足情報に詳しい情報を入力してください。」と警告メッセージを表示する。AIプロンプトにも「1on1記録がない場合は自己評価とマネージャー補足を重視して評価する」旨を追記する。

**バリデーション**：
- 総合自己評価の選択が必須
- 達成コメントの入力が必須（10文字以上）
- 振り返りコメント・マネージャー補足は任意

**UIレイアウト**：
```
┌──────────────────────────────────────────────┐
│ h2: 評価素材の収集                              │
│ p: 目標・1on1記録・プロフィールから評価素材を     │
│    自動収集しました。自己評価を入力してください。   │
│                                                  │
│ ┌─ 自動収集データ ────────────────────────────┐ │
│ │ bg-gray-50 border-gray-200 p-6 rounded-lg   │ │
│ │                                              │ │
│ │ ▼ 目標データ（N件）                           │ │
│ │   目標①（実行）：... ステータス：順調          │ │
│ │   目標②（挑戦）：... ステータス：遅延          │ │
│ │   目標③（インパクト）：... ステータス：順調     │ │
│ │                                              │ │
│ │ ▼ 1on1記録（N回分）                           │ │
│ │   進捗トレンド：目標①順調→順調、目標②順調→遅延│ │
│ │   コンディション推移：モチベ 4→3→4、負荷 3→4→3│ │
│ │   完了アクション：N件 / 未完了：N件             │ │
│ │   ヒアリングメモ：{要約}                       │ │
│ │                                              │ │
│ │ ▼ プロフィール                                │ │
│ │   等級：{grade} / 期待する役割：{current}      │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ┌─ 自己評価（カオナビより転記）──────────────── ┐ │
│ │ bg-white border-gray-200 p-6 rounded-lg       │ │
│ │                                              │ │
│ │ 総合自己評価: [select: S/A/B/C/D]             │ │
│ │                                              │ │
│ │ 達成コメント:                                  │ │
│ │ [textarea]                                    │ │
│ │                                              │ │
│ │ 振り返りコメント:                              │ │
│ │ [textarea]                                    │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ┌─ マネージャー補足情報 ─────────────────────── ┐ │
│ │ bg-white border-gray-200 p-6 rounded-lg       │ │
│ │                                              │ │
│ │ 特筆すべきエピソード:                          │ │
│ │ [textarea]                                    │ │
│ │                                              │ │
│ │ 環境変化・特殊事情:                            │ │
│ │ [textarea]                                    │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│                               [AI評価を生成する]  │
└──────────────────────────────────────────────────┘
```

**ボタン**：
- 「AI評価を生成する」：`bg-indigo-600 text-white hover:bg-indigo-700`。バリデーション通過時に有効化。押下で `POST /api/members/[name]/reviews/draft` を呼び出し、Step2へ遷移

#### Step2: AI評価ドラフト生成

**コンポーネント名**：`ReviewStep2Draft`

**表示内容**：
- AIが生成した評価ドラフトを表示
- 目標別評価（各目標のS/A/B/C/D評価 + 根拠）
- 総合評価（S/A/B/C/D + 総合コメント）
- 自己評価との乖離分析
- 特記事項

**AI連携**：
- Step1からの遷移時に自動的に `POST /api/members/[name]/reviews/draft` を呼び出す
- AI呼び出し中はスピナーを表示（目標設定ウィザードの Step5Diagnosis と同一パターン）
- 生成済みの場合（state にドラフトが保存済み）は再呼び出ししない

**UIレイアウト**：
```
┌──────────────────────────────────────────────┐
│ h2: AI評価ドラフト                              │
│ p: 収集した素材をもとにAIが評価ドラフトを          │
│    生成しました。内容を確認してください。           │
│                                                  │
│ ┌─ 目標別評価 ───────────────────────────────┐  │
│ │                                              │ │
│ │ ┌─ 目標①（実行）──────────────────────────┐│ │
│ │ │ AI評価: [A] badge                         ││ │
│ │ │ 根拠: {AIが生成した根拠テキスト}            ││ │
│ │ └──────────────────────────────────────────┘│ │
│ │ ┌─ 目標②（挑戦）──────────────────────────┐│ │
│ │ │ AI評価: [B] badge                         ││ │
│ │ │ 根拠: {AIが生成した根拠テキスト}            ││ │
│ │ └──────────────────────────────────────────┘│ │
│ │ ┌─ 目標③（インパクト）─────────────────────┐│ │
│ │ │ AI評価: [A] badge                         ││ │
│ │ │ 根拠: {AIが生成した根拠テキスト}            ││ │
│ │ └──────────────────────────────────────────┘│ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ┌─ 総合評価 ─────────────────────────────────┐  │
│ │ bg-indigo-50 border-indigo-200 p-6 rounded-lg│ │
│ │ AI総合評価: [A] badge (text-3xl)             │ │
│ │ 総合コメント: {AIが生成した総合コメント}       │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ┌─ 自己評価との乖離分析 ────────────────────── ┐ │
│ │ bg-amber-50 border-amber-200 p-6 rounded-lg  │ │
│ │ 自己評価: [B] → AI評価: [A]                   │ │
│ │ 分析: {乖離の要因分析テキスト}                 │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ┌─ 特記事項 ─────────────────────────────────┐  │
│ │ {環境変化や特殊事情に基づく補足}              │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ [戻る]                    [確認・修正へ進む]      │
└──────────────────────────────────────────────────┘
```

**ボタン**：
- 「戻る」：`border border-gray-300 text-gray-600 hover:bg-gray-50`
- 「確認・修正へ進む」：`bg-indigo-600 text-white hover:bg-indigo-700`。AI生成が完了している場合に有効化

#### Step3: マネージャー確認・修正

**コンポーネント名**：`ReviewStep3Edit`

**表示内容**：
- AI評価ドラフトの各項目を編集可能な状態で表示
- 変更箇所にはハイライトとマークを付与
- 変更理由の記録欄

**入力フィールド**：
- 目標別評価グレード変更（select、`text-xl`）：S / A / B / C / D の5択。各目標に1つ
- 目標別根拠テキスト編集（textarea、`text-xl`、各4行）
- 総合評価グレード変更（select、`text-xl`）：S / A / B / C / D の5択
- 総合コメント編集（textarea、`text-xl`、6行）
- 変更理由（textarea、`text-xl`、placeholder: 「AI評価から変更した理由を記入してください」、4行）：グレードを1箇所以上変更した場合に必須

**変更検知ロジック**：
- AI生成時のグレードと現在のグレードを比較
- 変更がある目標カードに `border-amber-400 bg-amber-50` のハイライトを適用
- 変更があるグレードバッジの横に「変更」ラベル（`text-sm text-amber-600`）を表示

**UIレイアウト**：
```
┌──────────────────────────────────────────────┐
│ h2: 評価の確認・修正                            │
│ p: AI評価ドラフトを確認し、必要に応じて            │
│    修正してください。変更した場合は理由を記入      │
│    してください。                                 │
│                                                  │
│ ┌─ 目標①（実行）──────────────── [変更あり] ─┐ │
│ │ 評価: [select: S/A/B/C/D]                   │ │
│ │ 根拠:                                        │ │
│ │ [textarea: AIが生成した根拠（編集可能）]       │ │
│ └──────────────────────────────────────────────┘ │
│ ┌─ 目標②（挑戦）────────────────────────────┐  │
│ │ 評価: [select: S/A/B/C/D]                   │ │
│ │ 根拠:                                        │ │
│ │ [textarea: AIが生成した根拠（編集可能）]       │ │
│ └──────────────────────────────────────────────┘ │
│ ┌─ 目標③（インパクト）───────────────────────┐  │
│ │ 評価: [select: S/A/B/C/D]                   │ │
│ │ 根拠:                                        │ │
│ │ [textarea: AIが生成した根拠（編集可能）]       │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ┌─ 総合評価 ─────────────────────────────────┐  │
│ │ 総合評価: [select: S/A/B/C/D]               │ │
│ │ 総合コメント:                                │ │
│ │ [textarea: AIが生成した総合コメント（編集可能）]│ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ┌─ 変更理由（グレード変更時は必須）──────────── ┐ │
│ │ bg-amber-50 border-amber-200 p-6 rounded-lg  │ │
│ │ [textarea: 変更理由]                          │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ [戻る]                   [評価者コメントを生成]   │
└──────────────────────────────────────────────────┘
```

**ボタン**：
- 「戻る」：`border border-gray-300 text-gray-600 hover:bg-gray-50`
- 「評価者コメントを生成」：`bg-indigo-600 text-white hover:bg-indigo-700`。グレード変更がある場合は変更理由の入力が完了している場合に有効化。押下で `POST /api/members/[name]/reviews/comment` を呼び出し、Step4へ遷移

#### Step4: AI評価者コメント生成

**コンポーネント名**：`ReviewStep4Comment`

**表示内容**：
- AIが生成した評価者コメント（200〜300文字）を表示
- マネージャーが最終編集して確定

**AI連携**：
- Step3からの遷移時に自動的に `POST /api/members/[name]/reviews/comment` を呼び出す
- AI呼び出し中はスピナーを表示

**入力フィールド**：
- 評価者コメント（textarea、`text-xl`、初期値にAI生成コメントを設定、8行）

**UIレイアウト**：
```
┌──────────────────────────────────────────────┐
│ h2: 評価者コメント                              │
│ p: AIが評価者コメント案を生成しました。            │
│    内容を確認・編集して確定してください。           │
│                                                  │
│ ┌─ 評価サマリー ────────────────────────────── ┐ │
│ │ bg-gray-50 border-gray-200 p-6 rounded-lg    │ │
│ │ 総合評価: [A] badge                          │ │
│ │ 目標①: [A] / 目標②: [B] / 目標③: [A]       │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ┌─ AI生成コメント ─────────────────────────── ┐  │
│ │ bg-indigo-50 border-indigo-200 p-8 rounded-lg│ │
│ │                                              │ │
│ │ 評価者コメント:                               │ │
│ │ [textarea: AI生成コメント（編集可能）]          │ │
│ │                                              │ │
│ │ text-lg text-gray-500: 推奨文字数: 200〜300字  │ │
│ │ text-lg: 現在の文字数: {N}文字                 │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ [戻る]                       [評価を保存する]     │
└──────────────────────────────────────────────────┘
```

**ボタン**：
- 「戻る」：`border border-gray-300 text-gray-600 hover:bg-gray-50`
- 「評価を保存する」：`bg-indigo-600 text-white hover:bg-indigo-700`。評価者コメントが空でない場合に有効化。押下で以下を順次実行：
  1. `POST /api/members/[name]/reviews` で評価をMarkdownファイルとして保存
  2. 完了画面を表示

#### 完了画面

**コンポーネント名**：`ReviewStepComplete`

**表示内容**：
- 完了メッセージ：「評価を保存しました」
- 評価サマリー（総合評価 + 目標別評価のバッジ表示）
- 保存先ファイルパスを表示（`text-lg text-gray-500`）
- 次期目標設定ウィザードへの誘導リンク

**UIレイアウト**：
```
┌──────────────────────────────────────────────┐
│ （中央寄せ）                                    │
│ ✓ チェックマーク（bg-green-100 text-green-600    │
│    w-20 h-20 rounded-full）                     │
│                                                  │
│ h2: 評価を保存しました                           │
│ p: {メンバー名}さんの{期間}の評価を保存しました。  │
│                                                  │
│ ┌─ 評価サマリー ─────────────────────────────┐  │
│ │ bg-indigo-50 border-indigo-200 p-8 rounded-lg│ │
│ │ 総合評価: [A] badge (text-3xl)               │ │
│ │ 目標①: [A] / 目標②: [B] / 目標③: [A]       │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ p: 保存先: data/members/{name}/reviews/           │
│    2026-h1.md                                    │
│                                                  │
│ ┌─ 次のステップ ─────────────────────────────┐  │
│ │ bg-gray-50 border-gray-200 p-6 rounded-lg    │ │
│ │ この評価結果は次期の目標設定ウィザードで       │ │
│ │ 自動的に参照されます。                         │ │
│ │ [次期の目標設定ウィザードを開く]               │ │
│ │   text-indigo-600 hover:text-indigo-800       │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ [閉じる]                                         │
│   bg-indigo-600 text-white hover:bg-indigo-700   │
└──────────────────────────────────────────────────┘
```

> **画面更新**：「閉じる」ボタン押下時に `router.refresh()` を実行し、評価タブの表示を更新する。

### 11.3 データ設計

#### 11.3.1 型定義（`lib/types.ts` に追加）

> **ReviewData 型拡張（新旧フォーマット共存）**：`ReviewData` 型に以下のOptionalフィールドを追加して新旧フォーマットを共存させる：`goalEvaluations?: GoalEvaluation[]`, `overallGrade?: EvaluationGrade`, `overallComment?: string`, `selfEvalGapAnalysis?: string`, `managerChangeLog?: string[]`

```typescript
// Evaluation Wizard types

export type EvaluationGrade = 'S' | 'A' | 'B' | 'C' | 'D'

export interface SelfEvaluation {
  overallGrade: EvaluationGrade | ''
  achievementComment: string    // 達成コメント（カオナビ転記）
  reflectionComment: string     // 振り返りコメント（カオナビ転記）
}

export interface ManagerSupplementary {
  notableEpisodes: string       // 特筆すべきエピソード
  environmentChanges: string    // 環境変化・特殊事情
}

export interface GoalEvaluation {
  goalLabel: string             // 目標ラベル（例: "目標①（実行）"）
  goalText: string              // 目標文
  aiGrade: EvaluationGrade      // AI評価グレード
  aiRationale: string           // AI評価根拠
  finalGrade: EvaluationGrade   // マネージャー最終グレード
  finalRationale: string        // マネージャー最終根拠
}

export interface EvaluationDraft {
  goalEvaluations: GoalEvaluation[]
  overallGrade: EvaluationGrade         // AI総合評価
  overallComment: string                // AI総合コメント
  selfEvalGapAnalysis: string           // 自己評価との乖離分析
  specialNotes: string                  // 特記事項
}

export interface EvaluationWizardState {
  currentStep: number                     // 1-4 + 5(完了)
  period: string                          // 例: "2026-h1"。目標ファイル名（`goals/2026-h1.md` → `2026-h1`）から自動導出する。UI上は確認のみ（編集不可）。
  selfEvaluation: SelfEvaluation
  managerSupplementary: ManagerSupplementary
  evaluationDraft: EvaluationDraft | null
  goalEvaluations: GoalEvaluation[]       // Step3: マネージャー修正後
  overallGrade: EvaluationGrade | ''      // Step3: マネージャー最終総合評価
  overallComment: string                  // Step3: マネージャー最終総合コメント
  changeReason: string                    // Step3: 変更理由
  evaluatorComment: string                // Step4: 評価者コメント（最終）
  savedPath: string | null                // 完了: 保存先パス
}

export interface EvaluationWizardContextData {
  memberName: string
  memberProfile: string                   // profile.md rawMarkdown
  memberGrade: string                     // 等級（profileから抽出）
  goalsRawMarkdown: string | null         // goals/2026-h1.md
  goalsByPeriod: Record<string, string>  // 全期間の目標rawMarkdown
  oneOnOneRecords: OneOnOneRecord[]       // 全1on1記録
  goalProgressHistory: {                  // 1on1記録から抽出した目標進捗トレンド
    yearMonth: string
    entries: GoalProgressEntry[]
  }[]
  conditionHistory: {                     // 1on1記録から抽出したコンディション推移
    yearMonth: string
    condition: ConditionScore
  }[]
  completedActions: {                     // 全1on1記録の完了アクションアイテム
    content: string
    completedMonth: string
  }[]
  hearingMemos: {                         // 全1on1記録のヒアリングメモ
    yearMonth: string
    question: string
    memo: string
  }[]
  previousReview: ReviewData | null       // 前期の評価（存在する場合）
  departmentPolicy: string
  evaluationCriteria: string
  guidelines: string
}
```

> **期間切替の最適化**：`goalsByPeriod` により、期間変更時は `goalsByPeriod[selectedPeriod]` でクライアント側で切り替える。APIコール不要。

> **コンテキスト構築**：`EvaluationWizardContextData` のうち `goalProgressHistory`、`conditionHistory`、`completedActions`、`hearingMemos` は、サーバーコンポーネント（`app/members/[name]/page.tsx`）で全1on1記録をパースして構築する。`parseActionItems()`、`parseConditionScore()`、`parseSummary()` の既存パーサーを活用する。

> **前期評価の参照**：`previousReview` は `reviews/` ディレクトリから最新の評価ファイルを取得する。次期目標設定ウィザードへの連携に使用する。

#### 11.3.2 Markdown ファイルフォーマット（保存形式）

ファイルパス：`data/members/{name}/reviews/{period}.md`（例: `reviews/2026-h1.md`）

```markdown
# {期間表示} 評価

- 対象期間：{期間表示}（例: 2026年上期（4月〜9月））
- メンバー：{名前}
- 等級：{grade}
- 作成日：{YYYY-MM-DD}
- 総合評価：**{S/A/B/C/D}**

## 目標別評価

### 目標①（実行）：{目標文}
- 評価：**{S/A/B/C/D}**
- 根拠：{根拠テキスト}

### 目標②（挑戦）：{目標文}
- 評価：**{S/A/B/C/D}**
- 根拠：{根拠テキスト}

### 目標③（インパクト）：{目標文}
- 評価：**{S/A/B/C/D}**
- 根拠：{根拠テキスト}

## 総合コメント

{マネージャーが確定した総合コメント}

## 自己評価との乖離分析

- 自己評価：{S/A/B/C/D}
- マネージャー評価：{S/A/B/C/D}
- 分析：{乖離分析テキスト}

## 特記事項

{環境変化・特殊事情に基づく補足}

## マネージャー変更履歴

{AI評価から変更した箇所と理由。変更がない場合は「変更なし」}

## 評価者コメント

{マネージャーが確定した200〜300文字の評価者コメント}

## 自己評価（カオナビ転記）

### 達成コメント
{達成コメント}

### 振り返りコメント
{振り返りコメント}

## 次期への申し送り

{AI生成の次期目標設定への示唆。評価結果から自動導出}
```

### 11.4 API設計

#### 11.4.1 POST /api/members/[name]/reviews/draft

**ファイル**：`app/api/members/[name]/reviews/draft/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | AIによる評価ドラフト（目標別評価 + 総合評価 + 乖離分析）を生成 |
| メソッド | POST |
| パラメータ | `name`（URLエンコード済みメンバー名） |
| `dynamic` | `'force-dynamic'` |

**リクエストボディ**：
```typescript
{
  memberName: string
  memberProfile: string
  memberGrade: string
  goalsRawMarkdown: string | null
  goalProgressHistory: {
    yearMonth: string
    entries: { goalLabel: string; status: string; progressComment: string }[]
  }[]
  conditionHistory: {
    yearMonth: string
    condition: { motivation: number | null; workload: number | null; teamRelations: number | null; comment: string }
  }[]
  completedActions: { content: string; completedMonth: string }[]
  hearingMemos: { yearMonth: string; question: string; memo: string }[]
  selfEvaluation: {
    overallGrade: string
    achievementComment: string
    reflectionComment: string
  }
  managerSupplementary: {
    notableEpisodes: string
    environmentChanges: string
  }
  departmentPolicy: string
  evaluationCriteria: string
}
```

**レスポンス**：
```typescript
{
  draft: {
    goalEvaluations: {
      goalLabel: string
      goalText: string
      grade: string         // S/A/B/C/D
      rationale: string
    }[]
    overallGrade: string    // S/A/B/C/D
    overallComment: string
    selfEvalGapAnalysis: string
    specialNotes: string
  }
  mode: 'live'
}
```

**システムプロンプト**：

```
あなたは人事評価の専門コンサルタントです。
マネージャーがメンバーの半期評価を行うための評価ドラフトを生成してください。

【評価の基本原則】
1. すべての評価は具体的なエビデンス（目標の進捗データ、1on1記録、完了アクション）に基づくこと。推測や印象に基づく評価は絶対に行わないこと
2. 等級（グレード）に応じた期待水準を基準とすること。同じ成果でも等級によって評価が異なる
3. 目標の種類（実行/挑戦/インパクト）に応じた評価基準を適用すること
   - 実行目標：確実な達成と品質が求められる。達成は当然、超過達成でA以上
   - 挑戦目標：プロセスと学びも評価対象。完全未達でも意味ある挑戦はC止まり
   - インパクト目標：組織への波及効果を重視。個人の努力だけでなく周囲への影響を評価
4. 自己評価との乖離がある場合、その理由を具体的に説明すること

【評価グレード基準】
- S：期待を大きく超える成果。等級を超えた貢献が明確に認められる
- A：期待を超える成果。目標を超えた達成や質の高い取り組みが認められる
- B：期待通りの成果。目標を概ね達成し、等級相応の貢献をしている
- C：期待をやや下回る。目標の一部が未達、または質に改善の余地がある
- D：期待を大きく下回る。目標の大部分が未達、または重大な課題がある

【禁止事項】
- エビデンスのない評価理由を記述すること（「〜と思われる」「おそらく〜」は禁止）
- 全目標を同じグレードにすること（目標ごとに個別に評価すること）
- コンディションの低下を直接的な減点要因にすること（背景理解は必要だが評価は成果に対して行う）
- 自己評価に引きずられること（自己評価はインプットの一つであり、独立して評価すること）

【テンプレート形式目標への対応】達成基準（達成した姿）が明記されていない目標の場合は、目標文と達成指標（KPI）から達成水準を推測して評価する旨を判定根拠に明記すること。

【出力フォーマット】
以下のJSON形式で出力すること。JSON以外のテキストは一切含めないこと。

{
  "goalEvaluations": [
    {
      "goalLabel": "目標ラベル（例: 目標①（実行））",
      "goalText": "目標文",
      "grade": "S/A/B/C/D",
      "rationale": "評価根拠（3〜5文。具体的なエビデンスを引用すること）"
    }
  ],
  "overallGrade": "S/A/B/C/D",
  "overallComment": "総合コメント（5〜8文。目標別評価を踏まえた総合的な評価と、今後の期待を含むこと）",
  "selfEvalGapAnalysis": "自己評価との乖離がある場合はその分析（2〜3文）。乖離がない場合は「自己評価とマネージャー評価に大きな乖離はありません。」",
  "specialNotes": "環境変化や特殊事情がある場合の補足（1〜2文）。ない場合は空文字列"
}

出力は日本語で行うこと。
```

**ユーザーメッセージ構築**（`buildReviewDraftUserMessage()`）：

```
## メンバー：{memberName}
## 等級：{memberGrade}

## メンバープロフィール
{memberProfile}

## 部方針
{departmentPolicy}

## 評価基準（キャリアラダー）
{evaluationCriteria}

## 今期の目標
{goalsRawMarkdown}

## 目標進捗トレンド（1on1記録より）
{goalProgressHistoryをMarkdown形式で列挙}
### {yearMonth}月の進捗
- {goalLabel}：ステータス={status}、コメント={progressComment}
...

## コンディション推移（1on1記録より）
{conditionHistoryをMarkdown形式で列挙}
### {yearMonth}月
- モチベーション：{motivation}/5
- 業務負荷：{workload}/5
- チーム関係：{teamRelations}/5
- コメント：{comment}
...

## 完了アクションアイテム
{completedActionsをMarkdown形式で列挙}
- {content}（{completedMonth}月完了）
...

## ヒアリングメモ（1on1記録より）
{hearingMemosをMarkdown形式で列挙}
### {yearMonth}月
- Q: {question}
- A: {memo}
...

## 自己評価（カオナビより）
- 総合自己評価：{overallGrade}
- 達成コメント：{achievementComment}
- 振り返りコメント：{reflectionComment}

## マネージャー補足情報
- 特筆すべきエピソード：{notableEpisodes}
- 環境変化・特殊事情：{environmentChanges}

上記の情報をもとに、このメンバーの半期評価ドラフトを生成してください。
```

**maxTokens**：4096

**JSONパースフォールバック**：
1on1ウィザードと同様、AIの出力がvalid JSONでない場合に正規表現 `/\{[\s\S]*\}/` でJSONオブジェクト部分を抽出する。抽出・パース失敗時は500エラーを返却する（モックモードは存在しない）。

#### 11.4.2 POST /api/members/[name]/reviews/comment

**ファイル**：`app/api/members/[name]/reviews/comment/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | AIによる評価者コメント（200〜300文字）を生成 |
| メソッド | POST |
| パラメータ | `name`（URLエンコード済みメンバー名） |
| `dynamic` | `'force-dynamic'` |

**リクエストボディ**：
```typescript
{
  memberName: string
  memberGrade: string
  goalEvaluations: {
    goalLabel: string
    goalText: string
    grade: string
    rationale: string
  }[]
  overallGrade: string
  overallComment: string
  selfEvalGapAnalysis: string
  changeReason: string
}
```

**レスポンス**：
```typescript
{
  comment: string     // 200〜300文字の評価者コメント
  mode: 'live'
}
```

**システムプロンプト**：

```
あなたは人事評価コメントの専門ライターです。
マネージャーが確定した評価内容をもとに、評価者コメント（一次評価コメント）を作成してください。

【コメントの目的】
このコメントはメンバー本人にフィードバックされるものです。
メンバーの成長を促し、次の半期に向けたモチベーションを高めることが目的です。

【コメント作成ルール】
1. 200〜300文字で作成すること
2. 以下の3要素を必ず含めること：
   a. 今期の成果に対する具体的な評価（何が良かったか）
   b. 改善点や課題（建設的なトーンで）
   c. 次期への期待（具体的な方向性を示す）
3. 成長ナラティブのトーンで書くこと。「ダメ出し」ではなく「成長の道筋」を示す
4. 具体的なエピソードや成果を1つ以上引用すること
5. 等級に応じた期待水準を踏まえた表現にすること

【禁止事項】
- 抽象的・汎用的な表現のみで構成すること（「頑張りました」「期待しています」のみは不可）
- ネガティブな表現で終わること（必ずポジティブな期待で締めること）
- 他のメンバーとの比較に言及すること
- 評価グレードの文字（S/A/B/C/D）を直接記載すること

【出力フォーマット】
評価者コメントのテキストのみを出力すること。前後の説明や装飾は不要。
出力は日本語で行うこと。
```

**ユーザーメッセージ構築**（`buildReviewCommentUserMessage()`）：

```
## メンバー：{memberName}
## 等級：{memberGrade}

## 目標別評価
{goalEvaluationsをMarkdown形式で列挙}
### {goalLabel}：{goalText}
- 評価：{grade}
- 根拠：{rationale}
...

## 総合評価：{overallGrade}
## 総合コメント
{overallComment}

## 自己評価との乖離分析
{selfEvalGapAnalysis}

## マネージャーによる変更理由
{changeReason || 'AI評価からの変更なし'}

上記の評価内容をもとに、メンバー本人へのフィードバック用評価者コメント（200〜300文字）を作成してください。
```

**maxTokens**：512

#### 11.4.3 POST /api/members/[name]/reviews

**ファイル**：`app/api/members/[name]/reviews/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | 評価をMarkdownファイルとして保存 |
| メソッド | POST |
| パラメータ | `name`（URLエンコード済みメンバー名） |
| `dynamic` | `'force-dynamic'` |

**リクエストボディ**：
```typescript
{
  period: string                // 例: "2026-h1"
  content: string               // 組み立て済みMarkdown全文
}
```

**処理**：
1. `decodeURIComponent(params.name)` でメンバー名をデコード
2. `MEMBERS_DIR` からメンバーディレクトリの存在を確認
3. `reviews/` ディレクトリが存在しない場合は `mkdirSync` で作成（`{ recursive: true }`）
4. `reviews/{period}.md` にコンテンツを書き込み

**レスポンス**：
```typescript
{
  success: true
  path: string    // 保存先の相対パス（例: "data/members/山田(剛)/reviews/2026-h1.md"）
}
```

**エラー**：
- 400: `period` または `content` が未指定
- 404: メンバーディレクトリが見つからない
- 500: ファイル書き込み失敗

**実装パターン**：`app/api/members/[name]/goals/route.ts` および `app/api/members/[name]/one-on-one/route.ts` の POST 処理と同一パターンに従う。

### 11.5 3ウィザード連携設計

#### 11.5.1 目標ウィザード → 評価ウィザード

目標設定ウィザードで作成した目標データが、評価ウィザードの評価素材として自動的に参照される。

```
目標ウィザードの出力:
  goals/2026-h1.md
    ├ 目標①（実行）：{目標文}
    │   └ 達成した姿 → 評価基準として使用
    │   └ 検証方法 → 達成度の客観的判定に使用
    │   └ 中間確認 → 中間時点での進捗評価に使用
    ├ 目標②（挑戦）：...
    └ 目標③（インパクト）：...

評価ウィザードでの参照:
  Step1: 自動収集データとして各目標をカード表示
  Step2: AIが各目標の達成基準に照らして個別評価
  保存: reviews/{period}.md に目標ラベル・目標文を転記
```

**データフロー**：
1. `app/members/[name]/page.tsx` で `goals` データを取得
2. `EvaluationWizardContextData.goalsRawMarkdown` として渡す
3. `parseGoalEntries()` で個別目標に分解
4. Step1で表示、Step2でAI評価のインプットに使用

#### 11.5.2 1on1ウィザード → 評価ウィザード

1on1ウィザードで蓄積された月次記録が、評価のエビデンスとして集約される。

```
1on1ウィザードの出力（複数月分）:
  one-on-one/2026-04.md
  one-on-one/2026-05.md
  one-on-one/2026-06.md
  ...
    ├ ## 目標進捗確認 → 進捗トレンド（月次推移）
    ├ ## コンディション → コンディショントレンド（月次推移）
    ├ ## 前回アクションアイテム振り返り → 完了アクション一覧
    └ ## ヒアリング → ヒアリングメモ集約

評価ウィザードでの参照:
  Step1: 集約された進捗トレンド・コンディション推移・完了アクション・メモを表示
  Step2: AIが月次推移データを時系列で分析し、成長の軌跡を評価に反映
```

**新規パーサー**：
`lib/parsers/one-on-one.ts` に `parseGoalProgress()` 関数を新設し、1on1記録の `## 目標進捗` セクションから `{ goalLabel, status, progressComment }` を抽出する。

**データフロー**：
1. `app/members/[name]/page.tsx` で全1on1記録を取得
2. 各記録を `parseGoalProgress()`、`parseGoalProgressEntries()`、`parseConditionScore()`、`parseActionItems()` でパース
3. 月次データを時系列に集約して `EvaluationWizardContextData` に格納
4. `goalProgressHistory`：目標ごとのステータス推移（例: 「4月:on-track → 5月:on-track → 6月:at-risk」）
5. `conditionHistory`：モチベーション・業務負荷・チーム関係の月次推移
6. `completedActions`：全期間で完了したアクションアイテムのリスト
7. `hearingMemos`：メモが記入されたヒアリング質問と回答のリスト

#### 11.5.3 評価ウィザード → 次期目標ウィザード

評価ウィザードの結果が、次期の目標設定ウィザードのインプットとして参照される。

```
評価ウィザードの出力:
  reviews/2026-h1.md
    ├ 総合評価 → 次期の目標難易度調整の参考
    ├ 目標別評価 → 未達目標の継続検討
    ├ 総合コメント → 次期の重点テーマ抽出
    ├ 自己評価との乖離分析 → 認識ギャップの解消
    └ 次期への申し送り → 目標設定の直接インプット

次期目標ウィザードでの参照:
  Step4（前期実績データ）: 評価結果を自動ロード
    - 前期の主な目標 → reviews/{period}.md の目標別評価から抽出
    - 達成レベル → 総合評価グレードから自動マッピング
      S/A → "achieved"
      B → "mostly-achieved"
      C/D → "not-achieved"
    - 未達の理由 → 総合コメントから関連部分を抽出
  Step5（AI診断）: 前期評価を含む診断サマリー生成
```

**具体的な連携メカニズム**：
`WizardContextData` に `previousReview: ReviewData | null` を追加。`page.tsx` で最新の評価ファイルを読み込みコンテキストに含める。GoalWizard の Step4（前期実績）で `previousReview` が存在する場合、以下を自動入力する：
- `previousGoals`: 評価の目標一覧を結合したテキスト
- `achievementLevel`: 総合評価のマッピング（S/A → achieved, B → mostly-achieved, C/D → not-achieved）
- `reasonIfNotAchieved`: 評価コメントから抜粋

**データフロー**：
1. 目標設定ウィザード起動時に `reviews/` ディレクトリから最新の評価ファイルを取得
2. `parseReview()` で構造化
3. `GoalWizardState.previousPeriod` に自動入力（マネージャーは内容を確認・修正可能）
4. 診断サマリー生成時に前期評価データをコンテキストとして送信

**3ウィザード全体のデータフロー図**：

```
┌─────────────┐     goals/2026-h1.md      ┌──────────────┐
│ 目標設定      │ ──────────────────────── → │ 1on1          │
│ ウィザード    │                            │ ウィザード     │
│              │                            │              │
│ ・目標内容    │     goals → 進捗確認       │ ・目標進捗     │
│ ・達成基準    │     Step2で参照            │ ・コンディション│
│ ・検証方法    │                            │ ・アクション   │
│ ・中間確認    │                            │ ・ヒアリング   │
└──────┬───────┘                            └──────┬───────┘
       │                                          │
       │ goals/2026-h1.md                          │ one-on-one/*.md
       │ 目標・達成基準                             │ 進捗・コンディション・
       │                                          │ アクション・メモ
       ▼                                          ▼
┌────────────────────────────────────────────────────┐
│                    評価ウィザード                      │
│                                                      │
│ Step1: 自動収集（目標 + 1on1記録 + プロフィール）      │
│ Step2: AI評価ドラフト生成                             │
│ Step3: マネージャー確認・修正                          │
│ Step4: 評価者コメント生成                             │
└──────────────────────┬───────────────────────────────┘
                       │
                       │ reviews/2026-h1.md
                       │ 評価結果・申し送り
                       ▼
              ┌─────────────────┐
              │ 次期目標設定      │
              │ ウィザード        │
              │                  │
              │ Step4: 前期実績   │
              │ データ自動入力    │
              └─────────────────┘
```

### 11.6 新規ファイル一覧

#### 11.6.1 新規作成ファイル

| ファイルパス | 種類 | 役割 |
|------------|------|------|
| `web-demo/src/components/reviews/ReviewWizard.tsx` | Client Component | 評価ウィザード本体（useReducer + 4ステップ描画） |
| `web-demo/src/components/reviews/ReviewStepper.tsx` | Client Component | ステッパーUI（4ステップの進捗表示） |
| `web-demo/src/components/reviews/steps/ReviewStep1Materials.tsx` | Client Component | Step1: 評価素材の自動収集 + 自己評価入力 |
| `web-demo/src/components/reviews/steps/ReviewStep2Draft.tsx` | Client Component | Step2: AI評価ドラフト表示 |
| `web-demo/src/components/reviews/steps/ReviewStep3Edit.tsx` | Client Component | Step3: マネージャー確認・修正 |
| `web-demo/src/components/reviews/steps/ReviewStep4Comment.tsx` | Client Component | Step4: AI評価者コメント生成 + 編集 |
| `web-demo/src/components/reviews/ReviewStepComplete.tsx` | Client Component | 完了画面（評価サマリー + 次期目標誘導） |
| `web-demo/src/app/api/members/[name]/reviews/route.ts` | API Route | 評価保存 |
| `web-demo/src/app/api/members/[name]/reviews/draft/route.ts` | API Route | AI評価ドラフト生成 |
| `web-demo/src/app/api/members/[name]/reviews/comment/route.ts` | API Route | AI評価者コメント生成 |
| `web-demo/src/lib/prompts/review-draft.ts` | Prompt Builder | 評価ドラフト用プロンプト（buildReviewDraftSystemPrompt, buildReviewDraftUserMessage） |
| `web-demo/src/lib/prompts/review-comment.ts` | Prompt Builder | 評価者コメント用プロンプト（buildReviewCommentSystemPrompt, buildReviewCommentUserMessage） |
| `web-demo/src/lib/utils/review-markdown.ts` | Utility | 評価Markdown組み立て（buildReviewMarkdown: ウィザード状態からMarkdown文字列を生成） |
| `web-demo/src/lib/utils/evaluation-context.ts` | Utility | 評価コンテキスト構築（buildEvaluationContext: 1on1記録から進捗トレンド・コンディション推移等を集約） |
| `web-demo/src/lib/parsers/one-on-one.ts` | Parser（関数追加） | `parseGoalProgress()` 関数を新設（1on1記録の `## 目標進捗` セクションから `{ goalLabel, status, progressComment }` を抽出） |

#### 11.6.2 修正が必要な既存ファイル

| ファイルパス | 修正内容 |
|------------|---------|
| `web-demo/src/lib/types.ts` | `EvaluationGrade`, `SelfEvaluation`, `ManagerSupplementary`, `GoalEvaluation`, `EvaluationDraft`, `EvaluationWizardState`, `EvaluationWizardContextData` の7型を追加 |
| `web-demo/src/components/member/MemberDetailClient.tsx` | `reviewWizardOpen` state を追加。`ReviewWizard` コンポーネントのインポートと描画。`ReviewsTab` に `onStartWizard` props を渡す |
| `web-demo/src/components/member/ReviewsTab.tsx` | 「評価ウィザードを開始」ボタンを追加。`onStartWizard` props を受け取る。パスワード解除後に表示 |
| `web-demo/src/app/members/[name]/page.tsx` | `evaluationWizardContext` を構築して `MemberDetailClient` に渡す。全1on1記録のパースと集約。前期評価の取得 |
| `web-demo/src/lib/fs/members.ts` | `getLatestReview(memberName)` 関数を追加（最新の評価記録を取得） |
| `web-demo/src/lib/parsers/goals-entries.ts` | 評価ウィザードからも参照されるため、エクスポートの確認のみ（変更不要の可能性あり） |
| `web-demo/src/lib/types.ts` | `WizardContextData` に `previousReview: ReviewData | null` を追加（評価→次期目標連携用） |
| `web-demo/src/app/members/[name]/page.tsx` | 最新の評価ファイルを読み込み、`WizardContextData` のコンテキストに含める処理を追加 |
| `web-demo/src/components/goals/GoalWizard.tsx` | Step4（前期実績）で `previousReview` が存在する場合に `previousGoals`・`achievementLevel`・`reasonIfNotAchieved` を自動入力 |
| `web-demo/src/components/member/ReviewsTab.tsx` | `evalColorMap` に D評価の色定義を追加：`D: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-400' }` |

### 11.7 実装フェーズ

#### フェーズ1: データ基盤（見積：1日）

1. `lib/types.ts` に評価ウィザード関連の7型を追加
2. `lib/utils/evaluation-context.ts` を実装（1on1記録から進捗トレンド・コンディション推移・完了アクション・ヒアリングメモを集約）
3. `lib/utils/review-markdown.ts` を実装（ウィザード状態からMarkdown文字列を生成）
4. `lib/fs/members.ts` に `getLatestReview()` を追加
5. `app/members/[name]/page.tsx` で `evaluationWizardContext` の構築ロジックを実装

#### フェーズ2: API実装（見積：1.5日）

1. `lib/prompts/review-draft.ts` を実装（評価ドラフト用プロンプト）
2. `POST /api/members/[name]/reviews/draft` を実装（AI評価ドラフト生成）
3. `lib/prompts/review-comment.ts` を実装（評価者コメント用プロンプト）
4. `POST /api/members/[name]/reviews/comment` を実装（AI評価者コメント生成）
5. `POST /api/members/[name]/reviews` を実装（評価保存）

#### フェーズ3: ウィザードUI（見積：2.5日）

1. `ReviewStepper.tsx` を実装（4ステップ進捗バー）
2. `ReviewWizard.tsx` を実装（useReducer + 全体レイアウト）
3. `ReviewStep1Materials.tsx` を実装（自動収集表示 + 自己評価入力 + マネージャー補足入力）
4. `ReviewStep2Draft.tsx` を実装（AI評価ドラフト表示）
5. `ReviewStep3Edit.tsx` を実装（評価グレード・根拠の編集 + 変更検知 + 変更理由入力）
6. `ReviewStep4Comment.tsx` を実装（AI評価者コメント表示 + 編集）
7. `ReviewStepComplete.tsx` を実装（完了画面 + 次期目標誘導）

#### フェーズ4: 統合・連携テスト（見積：1日）

1. `MemberDetailClient.tsx` に評価ウィザードの起動制御を追加
2. `ReviewsTab.tsx` にウィザード起動ボタンを追加
3. 全ステップの遷移テスト
4. AI連携テスト（APIキーあり環境）
5. 保存されたMarkdownファイルの内容確認
6. `parseReview()` を改修し、新フォーマット（`## 目標別評価` セクション有無で判別）にも対応させる。`ReviewData` 型にOptionalフィールドを追加。
7. 目標ウィザード → 1on1ウィザード → 評価ウィザードの一連のフローテスト
8. 評価結果 → 次期目標ウィザードの前期実績データ自動入力テスト

---

## 12. デモモード廃止

### 12.1 概要

v1.5 において、APIキー未設定時のモックモード（デモモード）を廃止する。これまではAPIキーが設定されていない場合に定型のモック応答を返していたが、Azure AI Foundry 連携が安定稼働しているため、モックモードを維持する必要がなくなった。

#### 廃止の背景

- Azure AI Foundry 経由での Claude Sonnet 連携が安定的に動作しており、APIキーなしで運用するケースが存在しない
- モック応答はデモ用途のみであり、実運用では誤解を招く可能性がある
- 評価ウィザード（セクション11）の追加に伴い、新たなモック応答を作成・維持するコストが不要になる
- コードの簡素化と保守性の向上

#### 廃止後の動作

APIキーが設定されていない場合、すべてのAIエンドポイントは以下の統一エラーレスポンスを返却する。

```typescript
{
  error: 'AI APIキーが設定されていません。.env.local にANTHROPIC_FOUNDRY_API_KEY または ANTHROPIC_API_KEY を設定してください。',
  code: 'NO_API_KEY'
}
```

HTTPステータスコード：`503 Service Unavailable`

### 12.2 削除対象ファイル

| ファイルパス | 削除内容 | 状態 |
|------------|---------|------|
| `web-demo/src/lib/mock/responses.ts` | ファイル全体を削除。`getMockResponse()` 関数と `MOCK_QA_PAIRS` 定数、`FALLBACK_RESPONSE` 定数を完全に除去 | **削除済み（v1.6）** |

### 12.3 修正対象ファイル

> **ChatSidebar 目標保存機能の削除**：ChatSidebar から `isGoalProposal()` / `extractGoalsContent()` / `handleSaveGoals()` 関数および「この目標で確定する」ボタンを削除する。目標保存は目標設定ウィザード経由に統一する。

#### 12.3.1 チャットAPI（`app/api/chat/route.ts`）

**変更前**：
```typescript
import { getMockResponse } from '@/lib/mock/responses'
// ...
if (!apiKey) {
  await new Promise(r => setTimeout(r, 700))
  const reply = getMockResponse(lastUserMessage, memberName)
  return NextResponse.json({ content: reply, mode: 'mock' })
}
```

**変更後**：
```typescript
// getMockResponse のインポートを削除
// ...
if (!apiKey) {
  return NextResponse.json({
    error: 'AI APIキーが設定されていません。.env.local にANTHROPIC_FOUNDRY_API_KEY または ANTHROPIC_API_KEY を設定してください。',
    code: 'NO_API_KEY'
  }, { status: 503 })
}
```

#### 12.3.2 診断API（`app/api/members/[name]/goals/diagnosis/route.ts`）

**変更前**：
```typescript
const MOCK_DIAGNOSIS = `現在地と次ステージのギャップ：...`

if (!hasApiKey()) {
  await new Promise(r => setTimeout(r, 1000))
  return NextResponse.json({ diagnosis: MOCK_DIAGNOSIS, mode: 'mock' })
}
```

**変更後**：
```typescript
// MOCK_DIAGNOSIS 定数を削除

if (!hasApiKey()) {
  return NextResponse.json({
    error: 'AI APIキーが設定されていません。.env.local にANTHROPIC_FOUNDRY_API_KEY または ANTHROPIC_API_KEY を設定してください。',
    code: 'NO_API_KEY'
  }, { status: 503 })
}
```

#### 12.3.3 目標生成API（`app/api/members/[name]/goals/generate/route.ts`）

**変更前**：
```typescript
const MOCK_GOALS = `目標①（実行）：...`

if (!hasApiKey()) {
  await new Promise(r => setTimeout(r, 1500))
  return NextResponse.json({ goals: MOCK_GOALS, mode: 'mock' })
}
```

**変更後**：
```typescript
// MOCK_GOALS 定数を削除

if (!hasApiKey()) {
  return NextResponse.json({
    error: 'AI APIキーが設定されていません。.env.local にANTHROPIC_FOUNDRY_API_KEY または ANTHROPIC_API_KEY を設定してください。',
    code: 'NO_API_KEY'
  }, { status: 503 })
}
```

#### 12.3.4 1on1質問生成API（`app/api/members/[name]/one-on-one/questions/route.ts`）

**変更前**：
```typescript
const MOCK_QUESTIONS = [...]

if (!hasApiKey()) {
  await new Promise(r => setTimeout(r, 1000))
  return NextResponse.json({ questions: MOCK_QUESTIONS, mode: 'mock' })
}
// ...
// Fallback to mock if parse fails
return NextResponse.json({ questions: MOCK_QUESTIONS, mode: 'mock' })
```

**変更後**：
```typescript
// MOCK_QUESTIONS 定数を削除

if (!hasApiKey()) {
  return NextResponse.json({
    error: 'AI APIキーが設定されていません。.env.local にANTHROPIC_FOUNDRY_API_KEY または ANTHROPIC_API_KEY を設定してください。',
    code: 'NO_API_KEY'
  }, { status: 503 })
}
// ...
// JSONパース失敗時はフォールバック質問を使用（FALLBACK_QUESTIONS は維持）
return NextResponse.json({ questions: FALLBACK_QUESTIONS, mode: 'live' })
```

> **注意**：`FALLBACK_QUESTIONS` はAIの出力がvalid JSONでなかった場合のフォールバックであり、モック応答とは異なる。これは維持する。

#### 12.3.5 1on1サマリー生成API（`app/api/members/[name]/one-on-one/summary/route.ts`）

**変更前**：
```typescript
const MOCK_SUMMARY = `今月のサマリー...`

if (!hasApiKey()) {
  await new Promise(r => setTimeout(r, 1000))
  return NextResponse.json({ summary: MOCK_SUMMARY, mode: 'mock' })
}
```

**変更後**：
```typescript
// MOCK_SUMMARY 定数を削除

if (!hasApiKey()) {
  return NextResponse.json({
    error: 'AI APIキーが設定されていません。.env.local にANTHROPIC_FOUNDRY_API_KEY または ANTHROPIC_API_KEY を設定してください。',
    code: 'NO_API_KEY'
  }, { status: 503 })
}
```

#### 12.3.6 チャットサイドバー（`components/chat/ChatSidebar.tsx`）

**変更前**：
```tsx
{mode === 'mock' && (
  <span className="text-lg bg-orange-100 text-orange-600 px-3 py-1 rounded-full border border-orange-200">
    デモモード
  </span>
)}
{mode === 'live' && (
  <span className="text-lg bg-green-100 text-green-600 px-3 py-1 rounded-full border border-green-200">
    Claude API 接続中
  </span>
)}
{mode === null && (
  <span className="text-lg bg-orange-100 text-orange-600 px-3 py-1 rounded-full border border-orange-200">
    デモモード
  </span>
)}
```

**変更後**：

`mode` が `null`（未接続）の場合は バッジを非表示とし、最初のAPIリクエスト成功後に「Claude API 接続中」バッジを表示する。APIキー未設定の場合はリクエスト失敗時に「API未設定」エラーメッセージを表示する。

```tsx
{mode === 'live' && (
  <span className="text-lg bg-green-100 text-green-600 px-3 py-1 rounded-full border border-green-200">
    Claude API 接続中
  </span>
)}
```

また、`useChat` フックの `mode` 状態管理も簡素化する。APIからエラーレスポンス（`code: 'NO_API_KEY'`）が返却された場合は、以下のエラーメッセージをチャット内に表示する。

```
⚠ AI APIキーが設定されていません。

.env.local に以下のいずれかの環境変数を設定してください：
- ANTHROPIC_FOUNDRY_API_KEY（Azure AI Foundry経由）
- ANTHROPIC_API_KEY（Anthropic API直接）

設定方法の詳細はREADMEを参照してください。
```

表示スタイル：`bg-red-50 border-red-200 text-red-700 p-4 rounded-lg`

### 12.4 レスポンス型の変更

#### mode フィールドの変更

すべてのAIエンドポイントのレスポンスから `mode: 'mock'` の可能性を除去する。

**変更前**：
```typescript
{ content: string, mode: 'mock' | 'live' }
{ diagnosis: string, mode: 'mock' | 'live' }
{ goals: string, mode: 'mock' | 'live' }
{ questions: {...}[], mode: 'mock' | 'live' }
{ summary: string, mode: 'mock' | 'live' }
```

**変更後**：
```typescript
{ content: string, mode: 'live' }
{ diagnosis: string, mode: 'live' }
{ goals: string, mode: 'live' }
{ questions: {...}[], mode: 'live' }
{ summary: string, mode: 'live' }
```

> **後方互換性**：`mode` フィールドは文字列であり、クライアント側で `mode === 'mock'` チェックを行っている箇所をすべて削除する。`mode` フィールド自体は `'live'` 固定で残すこともできるが、将来的に不要であれば削除を検討する。

### 12.5 セクション6.2の更新

セクション6.2「モックモード」は以下に差し替える。

> **v1.5で廃止**：モックモードは v1.5 で廃止された。APIキーが設定されていない場合、すべてのAIエンドポイントは `503 Service Unavailable` と `NO_API_KEY` エラーコードを返却する。詳細はセクション12を参照。

### 12.6 影響範囲のチェックリスト

| 対象 | 確認事項 | 対応 |
|------|---------|------|
| `lib/mock/responses.ts` | ファイル全体 | 削除 |
| `app/api/chat/route.ts` | `getMockResponse` のインポートとモック分岐 | エラーレスポンスに置換 |
| `app/api/members/[name]/goals/diagnosis/route.ts` | `MOCK_DIAGNOSIS` 定数とモック分岐 | エラーレスポンスに置換 |
| `app/api/members/[name]/goals/generate/route.ts` | `MOCK_GOALS` 定数とモック分岐 | エラーレスポンスに置換 |
| `app/api/members/[name]/one-on-one/questions/route.ts` | `MOCK_QUESTIONS` 定数とモック分岐 | エラーレスポンスに置換。`FALLBACK_QUESTIONS` は維持 |
| `app/api/members/[name]/one-on-one/summary/route.ts` | `MOCK_SUMMARY` 定数とモック分岐 | エラーレスポンスに置換 |
| `components/chat/ChatSidebar.tsx` | `デモモード` バッジ表示 | 削除。エラー時のメッセージ表示を追加 |
| `hooks/useChat.ts` | `mode` の `'mock'` 判定 | `'mock'` 分岐を削除 |
| セクション2.1 アーキテクチャ図 | `パス3: モックモード` | `※ キーなし→エラー返却` に変更済み |
| セクション5 API設計 | 各APIの「AI なしの場合」 | エラーレスポンスに変更済み |
| セクション6.2 モックモード | セクション全体 | 廃止注記に差し替え |

---

## 13. デモモード機能

### 13.1 概要

デモモードは、実際の個人データを公開せずに安全なデモプレゼンテーションを実施するための機能である。NavBar 上のトグルスイッチにより、実データとデモデータを即座に切り替えることができる。

デモモード有効時は、すべてのページ上部にアンバー（琥珀色）のバナーが表示される。

```
デモデータを表示中です。実際のメンバー情報ではありません。
```

### 13.2 デモデータ構成

デモデータは `data/demo-members/` 配下に5名分の架空メンバーとして格納される。

| メンバー名 | 役割 | 等級 | データ充実度 |
|-----------|------|------|------------|
| 田中 | Flutter TL | 4 | フルデータ（goals + 1on1×2 + review） |
| 佐藤 | iOS | 3 | フルデータ（goals + 1on1×1 + review） |
| 鈴木 | Producer | 4 | フルデータ（goals + 1on1×1 + review） |
| 高橋 | Android/KMP | 2 | テンプレート目標のみ（新人シナリオ） |
| 渡辺 | AM | 5 | テンプレート目標のみ（シニアシナリオ） |

各メンバーディレクトリは実データと同じ構成（`profile.md`, `goals/`, `one-on-one/`, `reviews/`）を持つ。

### 13.3 切替メカニズム

#### 状態管理

デモモードの有効/無効は `data/.demo-mode.json` ファイルで管理される。

```json
{
  "enabled": true
}
```

#### APIエンドポイント

| メソッド | パス | 役割 |
|---------|------|------|
| GET | `/api/demo-mode` | 現在のデモモード状態を取得 |
| POST | `/api/demo-mode` | デモモードの有効/無効を切り替え |

#### パス解決

`lib/fs/paths.ts` の `getMembersDir()` 関数が、デモモードの状態に応じてデータディレクトリを切り替える。

```typescript
// デモモード OFF → data/members/（実データ）
// デモモード ON  → data/demo-members/（デモデータ）
getMembersDir() // → MEMBERS_DIR or DEMO_MEMBERS_DIR
```

すべてのメンバー読み書き操作は `getMembersDir()` 経由でディレクトリを取得するため、デモモード切替がシステム全体に自動的に反映される。

### 13.4 影響範囲

| 対象 | 変更内容 |
|------|---------|
| `layout/NavBar.tsx` | トグルスイッチを追加。デモモード有効時は「デモ版」バッジを表示 |
| 全メンバーAPI | `getMembersDir()` 経由で読み書き先が `demo-members/` に切り替わる |
| ダッシュボード | デモメンバー5名のカードグリッドを表示 |
| メンバー詳細 | デモメンバーのプロフィール・目標・1on1・評価を表示。各ウィザードもデモデータ上で動作 |
| 全ページ | デモモード有効時にアンバーバナー「デモデータを表示中です。実際のメンバー情報ではありません。」を表示 |

### 13.5 新規ファイル一覧

#### 13.5.1 新規作成ファイル

| ファイルパス | 種類 | 役割 |
|------------|------|------|
| `data/demo-members/` | データ | デモ用メンバーデータディレクトリ（5名分。各メンバーに profile.md, goals/, one-on-one/, reviews/ を配置） |
| `data/.demo-mode.json` | 設定 | デモモード状態ファイル（`{"enabled": true/false}`） |
| `web-demo/src/app/api/demo-mode/route.ts` | API Route | デモモード状態の取得・切替 |

#### 13.5.2 修正が必要な既存ファイル

| ファイルパス | 修正内容 |
|------------|---------|
| `web-demo/src/lib/fs/paths.ts` | `DEMO_MEMBERS_DIR` 定数および `getMembersDir()` 関数を追加。デモモード状態に応じてデータディレクトリを切り替え |
| `web-demo/src/lib/fs/members.ts` | メンバー一覧・詳細取得で `getMembersDir()` を使用するよう変更 |
| `web-demo/src/components/layout/NavBar.tsx` | デモモードトグルスイッチ + 「デモ版」バッジ + アンバーバナーを追加 |
| `web-demo/src/app/api/members/[name]/goals/route.ts` | `getMembersDir()` 経由でパスを解決するよう変更 |
| `web-demo/src/app/api/members/[name]/one-on-one/route.ts` | 同上 |
| `web-demo/src/app/api/members/[name]/reviews/route.ts` | 同上 |

---

## 14. 複数期間対応・組織方針バージョン管理

### 14.1 概要

本セクションでは、KTC TalentHub の以下2つの拡張を設計する。

#### 14.1.1 複数期間対応

現行システムは目標ファイル `goals/2026-h1.md` をハードコードで参照しており、単一期間（2026年上期）のみに対応している。本拡張により、過去・未来の複数期間にわたる目標・1on1・評価データの管理を可能にする。

- **期間定義**：h1=4月〜9月（上期）、h2=10月〜翌3月（下期）
- **アクティブ期間の自動判定**：現在日付から自動的にアクティブな期間を算出
- **UI上の期間セレクター**：目標タブで過去・現在の期間を切り替えて表示
- **ウィザードのアクティブ期間対応**：目標設定・1on1・評価の各ウィザードがアクティブ期間を自動参照

#### 14.1.2 組織方針バージョン管理

現行システムは `department-policy.md` を単一ファイルで管理しているが、年度ごとに方針が更新される運用に対応するため、年度別バージョン管理を導入する。

- **用語統一**：「部方針」→「組織方針」（department-policy → org-policy）
- **年度別ファイル**：`org-policy-{year}.md`（例：`org-policy-2026.md`）
- **AIウィザード**：前年度方針の有無で継続/初回モードに自動分岐し、AIが方向性提案→ドラフト生成→壁打ち精緻化を行う7ステップウィザード

### 14.2 期間管理基盤（`lib/utils/period.ts`）

#### 14.2.1 型定義

```typescript
// lib/utils/period.ts

/**
 * 期間識別子。"YYYY-h1" または "YYYY-h2" の形式。
 * 例: "2026-h1" = 2026年度上期（4月〜9月）
 *      "2025-h2" = 2025年度下期（10月〜翌3月）
 */
export type Period = `${number}-h${'1' | '2'}`

/**
 * 期間設定の定数。
 * h1: 上期（4月〜9月）、h2: 下期（10月〜翌3月）
 */
export const PERIOD_CONFIG = {
  h1: {
    label: '上期',
    startMonth: 4,   // 4月
    endMonth: 9,     // 9月
    monthRange: '4月〜9月',
  },
  h2: {
    label: '下期',
    startMonth: 10,  // 10月
    endMonth: 3,     // 翌3月
    monthRange: '10月〜3月',
  },
} as const

export type HalfYear = keyof typeof PERIOD_CONFIG
```

#### 14.2.2 アクティブ期間の算出

```typescript
/**
 * 現在日付からアクティブな期間を算出する。
 *
 * ロジック:
 *   - 4月〜9月  → YYYY-h1（当年の上期）
 *   - 10月〜12月 → YYYY-h2（当年の下期）
 *   - 1月〜3月  → (YYYY-1)-h2（前年の下期）
 *
 * エッジケース:
 *   - 2027年1月 → "2026-h2"（2026年度下期に属する）
 *   - 2026年4月 → "2026-h1"（2026年度上期の開始月）
 *   - 2026年3月 → "2025-h2"（2025年度下期の最終月）
 *
 * @param now - 基準日付。省略時は現在日時
 * @returns アクティブな Period 識別子
 */
export function getActivePeriod(now: Date = new Date()): Period {
  const month = now.getMonth() + 1  // 1-12
  const year = now.getFullYear()

  if (month >= 4 && month <= 9) {
    return `${year}-h1`
  } else if (month >= 10) {
    return `${year}-h2`
  } else {
    // 1月〜3月は前年の下期
    return `${year - 1}-h2`
  }
}
```

#### 14.2.3 期間ラベルのフォーマット

```typescript
/**
 * Period 識別子を日本語ラベルに変換する。
 *
 * @example
 *   formatPeriodLabel("2026-h1") → "2026年上期（4月〜9月）"
 *   formatPeriodLabel("2025-h2") → "2025年下期（10月〜3月）"
 *
 * @param period - Period 識別子
 * @returns 日本語表示ラベル
 */
export function formatPeriodLabel(period: Period): string {
  const match = period.match(/^(\d{4})-h([12])$/)
  if (!match) return period

  const year = match[1]
  const half = `h${match[2]}` as HalfYear
  const config = PERIOD_CONFIG[half]

  return `${year}年${config.label}（${config.monthRange}）`
}
```

#### 14.2.4 期間のソート

```typescript
/**
 * Period 配列を新しい順（降順）にソートする。
 *
 * ソート順: 年が新しいほうが先、同年ならh2がh1より先。
 *
 * @example
 *   sortPeriods(["2025-h2", "2026-h1", "2025-h1"])
 *   → ["2026-h1", "2025-h2", "2025-h1"]
 *
 * @param periods - ソート対象の Period 配列
 * @returns 降順ソート済みの新しい配列
 */
export function sortPeriods(periods: Period[]): Period[] {
  return [...periods].sort((a, b) => {
    const [yearA, halfA] = a.split('-') as [string, string]
    const [yearB, halfB] = b.split('-') as [string, string]
    if (yearA !== yearB) return parseInt(yearB) - parseInt(yearA)
    return halfB.localeCompare(halfA)  // h2 > h1
  })
}
```

#### 14.2.5 ファイル名からの期間パース

```typescript
/**
 * ファイル名から Period を抽出する。
 *
 * 対応フォーマット:
 *   - "2026-h1.md" → "2026-h1"
 *   - "2025-h2.md" → "2025-h2"
 *   - "profile.md" → null（期間情報なし）
 *
 * @param filename - ファイル名（拡張子付き）
 * @returns Period または null
 */
export function parsePeriodFromFilename(filename: string): Period | null {
  const match = filename.match(/^(\d{4}-h[12])\.md$/)
  return match ? match[1] as Period : null
}
```

#### 14.2.6 年度の算出

```typescript
/**
 * Period 識別子から年度（fiscal year）を返す。
 * h1/h2 いずれも Period の年部分がそのまま年度となる。
 *
 * @example
 *   getFiscalYear("2026-h1") → 2026
 *   getFiscalYear("2026-h2") → 2026
 *
 * @param period - Period 識別子
 * @returns 年度（数値）
 */
export function getFiscalYear(period: Period): number {
  return parseInt(period.split('-')[0])
}
```

#### 14.2.7 1on1記録の期間フィルタリング

```typescript
/**
 * 1on1記録のファイル名（YYYY-MM.md）から所属する Period を判定する。
 *
 * マッピングルール:
 *   - 4月〜9月  → {year}-h1
 *   - 10月〜12月 → {year}-h2
 *   - 1月〜3月  → {year-1}-h2
 *
 * @param filename - 1on1記録のファイル名（例: "2026-04.md"）
 * @returns 対応する Period、または判定不能の場合 null
 */
export function getOneOnOnePeriod(filename: string): Period | null {
  // YYYY-MM.md → Period mapping
  const match = filename.match(/^(\d{4})-(\d{2})\.md$/)
  if (!match) return null

  const year = parseInt(match[1])
  const month = parseInt(match[2])

  if (month >= 4 && month <= 9) {
    return `${year}-h1`
  } else if (month >= 10) {
    return `${year}-h2`
  } else {
    // 1月〜3月は前年の下期
    return `${year - 1}-h2`
  }
}

/**
 * 1on1記録を指定期間でフィルタリングする。
 *
 * @param records - 全1on1記録
 * @param period - フィルタ対象の期間
 * @returns 指定期間に属する1on1記録のみ
 */
export function filterOneOnOnesByPeriod(records: OneOnOneRecord[], period: Period): OneOnOneRecord[] {
  return records.filter(r => getOneOnOnePeriod(r.filename) === period)
}
```

### 14.3 目標の複数期間対応

#### 14.3.1 `members.ts` の変更

**`getAllGoalPeriods()`**：指定メンバーの `goals/` ディレクトリを走査し、存在するすべての期間を返す。

```typescript
// lib/fs/members.ts に追加

import { parsePeriodFromFilename, sortPeriods, type Period } from '../utils/period'

/**
 * メンバーの目標ファイルから全期間を取得する。
 *
 * @param encodedName - URLエンコード済みメンバー名
 * @returns 降順ソート済みの Period 配列
 */
export function getAllGoalPeriods(encodedName: string): Period[] {
  const membersDir = getMembersDir()
  const name = decodeURIComponent(encodedName)
  const goalsDir = path.join(membersDir, name, 'goals')

  if (!fs.existsSync(goalsDir)) return []

  const periods = fs.readdirSync(goalsDir)
    .filter(f => f.endsWith('.md'))
    .map(f => parsePeriodFromFilename(f))
    .filter((p): p is Period => p !== null)

  return sortPeriods(periods)
}
```

> ※ 期間数が10を超える場合は直近5期間のみロードする最適化を将来検討

**`getGoalsByPeriod()`**：指定期間の目標データを取得する。

```typescript
/**
 * 指定期間の目標データを取得する。
 *
 * @param encodedName - URLエンコード済みメンバー名
 * @param period - 期間識別子（例: "2026-h1"）
 * @returns GoalsData または null
 */
export function getGoalsByPeriod(encodedName: string, period: Period): GoalsData | null {
  const membersDir = getMembersDir()
  const name = decodeURIComponent(encodedName)
  const goalsPath = path.join(membersDir, name, 'goals', `${period}.md`)

  if (!fs.existsSync(goalsPath)) return null

  return parseGoals(fs.readFileSync(goalsPath, 'utf-8'))
}
```

**`getMemberDetail()` の変更**：

```typescript
// 変更前（ハードコード）
const goalsPath = path.join(memberDir, 'goals', '2026-h1.md')
let goals = null
if (fs.existsSync(goalsPath)) {
  goals = parseGoals(fs.readFileSync(goalsPath, 'utf-8'))
}

// 変更後（アクティブ期間＋全期間マップ）
import { getActivePeriod, type Period } from '../utils/period'

const activePeriod = getActivePeriod()
const allGoalPeriods = getAllGoalPeriods(encodedName)
const goalsByPeriod: Record<string, GoalsData> = {}

for (const period of allGoalPeriods) {
  const g = getGoalsByPeriod(encodedName, period)
  if (g) goalsByPeriod[period] = g
}

const goals = goalsByPeriod[activePeriod] ?? null
```

#### 14.3.2 `MemberDetail` 型の変更

```typescript
// lib/types.ts

export interface MemberDetail extends MemberProfile {
  goals: GoalsData | null                    // アクティブ期間の目標（後方互換）
  goalsByPeriod: Record<string, GoalsData>   // 全期間の目標マップ（v1.7新設）
  activePeriod: string                       // アクティブ期間（v1.7新設）
  oneOnOnes: OneOnOneRecord[]
  reviews: ReviewData[]
}
```

#### 14.3.3 `GoalsTab.tsx` の期間セレクターUI

```typescript
// components/member/GoalsTab.tsx

'use client'

import { useState } from 'react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { EmptyState } from '@/components/ui/EmptyState'
import type { GoalsData } from '@/lib/types'

interface GoalsTabProps {
  goals: GoalsData | null                    // アクティブ期間の目標
  goalsByPeriod: Record<string, GoalsData>   // 全期間の目標マップ
  activePeriod: string                       // アクティブ期間
  onStartWizard?: () => void
}

export function GoalsTab({ goals, goalsByPeriod, activePeriod, onStartWizard }: GoalsTabProps) {
  const periods = Object.keys(goalsByPeriod).sort().reverse()
  const [selectedPeriod, setSelectedPeriod] = useState(activePeriod)
  const currentGoals = goalsByPeriod[selectedPeriod] ?? null

  const isEmpty = !currentGoals || !currentGoals.rawMarkdown.includes('目標内容') &&
    !currentGoals.rawMarkdown.includes('目標①')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-3xl font-semibold text-gray-800">半期目標</h3>
          {/* 期間セレクター */}
          {periods.length > 1 ? (
            <select
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value)}
              className="mt-2 text-xl text-gray-600 border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
            >
              {periods.map(p => (
                <option key={p} value={p}>
                  {formatPeriodLabel(p)}{p === activePeriod ? '（現在）' : ''}
                </option>
              ))}
            </select>
          ) : (
            currentGoals && <p className="text-2xl text-gray-500 mt-1">{currentGoals.period}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isEmpty && (
            <span className="text-xl bg-amber-50 text-amber-600 px-5 py-2 rounded-full border border-amber-200 font-medium">
              未記入
            </span>
          )}
          {onStartWizard && selectedPeriod === activePeriod && (
            <button
              onClick={onStartWizard}
              className="text-lg bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
            >
              目標設定ウィザード
            </button>
          )}
        </div>
      </div>
      {currentGoals ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10">
          <MarkdownRenderer content={currentGoals.rawMarkdown} />
        </div>
      ) : (
        <EmptyState
          title="目標設定ファイルが見つかりません"
          description="ウィザードから目標を作成できます"
          icon="🎯"
        />
      )}
    </div>
  )
}
```

**UIレイアウト**：

```
┌──────────────────────────────────────────────┐
│ h3: 半期目標                                    │
│ [select: 2026年上期（4月〜9月）（現在） ▼]        │
│          2025年下期（10月〜3月）                  │
│                                    [未記入]      │
│                              [目標設定ウィザード]  │
│                                                  │
│ ┌─ 目標内容 ──────────────────────────────────┐ │
│ │ {選択された期間の目標 Markdown}              │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

**挙動仕様**：

| 項目 | 内容 |
|------|------|
| セレクターの表示条件 | `goalsByPeriod` のキー数が2以上の場合にセレクターを表示。1以下の場合は従来通りテキスト表示 |
| デフォルト選択 | アクティブ期間 |
| ウィザードボタンの表示条件 | 選択中の期間がアクティブ期間と一致する場合のみ表示 |
| 「（現在）」ラベル | アクティブ期間のオプションにのみ付与 |

> **タブラベルの動的化**：`MemberDetailClient.tsx` のタブラベル `目標（2026上期）` を `目標（${formatPeriodLabel(activePeriod)}）` に動的化する。

#### 14.3.4 目標保存APIの期間パラメータ変更

**変更前**（`POST /api/members/[name]/goals`）：

```typescript
const { content, period } = await req.json()
const filename = period || '2026-h1'  // period は optional、デフォルト '2026-h1'
```

**変更後**：

```typescript
const { content, period } = await req.json()
if (!content || typeof content !== 'string') {
  return NextResponse.json({ error: 'content is required' }, { status: 400 })
}
if (!period || typeof period !== 'string' || !/^\d{4}-h[12]$/.test(period)) {
  return NextResponse.json({ error: 'period is required (format: YYYY-h1 or YYYY-h2)' }, { status: 400 })
}
const filename = period

// 対象期間ラベルの動的生成
const periodLabel = formatPeriodLabel(period)
const markdown = [
  '# 半期目標設定',
  '',
  `- 対象期間：${periodLabel}`,
  `- 作成日：${today}`,
  `- メンバー：${memberName}`,
  '',
  '## 目標一覧',
  '',
  content,
  '',
].join('\n')
```

| 項目 | 変更前 | 変更後 |
|------|--------|--------|
| `period` パラメータ | optional（デフォルト `'2026-h1'`） | **required**（バリデーション付き） |
| 期間ラベル | ハードコード `'2026年上半期（4月〜9月）'` | `formatPeriodLabel()` で動的生成 |
| エラー | なし | 400: period 未指定または不正フォーマット |

### 14.4 ウィザードのアクティブ期間対応

#### 14.4.1 目標設定ウィザード

**`GoalWizardState` への `targetPeriod` 追加**：

```typescript
// lib/types.ts（GoalWizardState に追加）

export interface GoalWizardState {
  currentStep: number
  targetPeriod: string           // v1.7新設：目標の対象期間（例: "2026-h1"）
  managerInput: ManagerInput
  memberInput: MemberInput
  previousPeriod: PreviousPeriod
  diagnosis: string | null
  diagnosisConfirmed: boolean
  generatedGoals: string | null
  refinementMessages: ChatMessage[]
  refinementCount: number
  finalGoals: string | null
}
```

**ウィザードヘッダーの変更**：

```
変更前: "{メンバー名}さんの目標設定"
変更後: "{メンバー名}さんの目標設定（{formatPeriodLabel(targetPeriod)}）"
```

**保存時の期間指定**：

```typescript
// Step7Refinement.tsx での保存処理

const handleSave = async () => {
  const res = await fetch(`/api/members/${encodeURIComponent(context.memberName)}/goals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: state.finalGoals,
      period: state.targetPeriod,  // 必須パラメータとして送信
    }),
  })
  // ...
}
```

**初期化**：

```typescript
// GoalWizard.tsx の初期状態

const initialState: GoalWizardState = {
  currentStep: 1,
  targetPeriod: getActivePeriod(),  // アクティブ期間を自動設定
  // ... 他フィールド
}
```

#### 14.4.2 1on1ウィザード

**`OneOnOneWizardContextData` への `activePeriod` 追加**：

```typescript
// lib/types.ts（OneOnOneWizardContextData に追加）

export interface OneOnOneWizardContextData {
  memberName: string
  memberProfile: string
  departmentPolicy: string       // → orgPolicy に改名（14.7節参照）
  guidelines: string
  goalsRawMarkdown: string | null  // アクティブ期間の目標
  activePeriod: string             // v1.7新設：アクティブ期間
  previousOneOnOne: OneOnOneRecord | null
  previousActionItems: ActionItem[]
  previousCondition: ConditionScore | null
  previousSummary: string
}
```

**目標参照の期間対応**：

```typescript
// app/members/[name]/page.tsx での目標取得

// 変更前
goalsRawMarkdown: member.goals?.rawMarkdown || null,

// 変更後
goalsRawMarkdown: member.goalsByPeriod[member.activePeriod]?.rawMarkdown || null,
activePeriod: member.activePeriod,
```

#### 14.4.3 評価ウィザード

**Step1の期間セレクター追加**：

評価ウィザードの Step1（素材収集）に、評価対象期間を選択するセレクターを追加する。利用可能な期間は `goalsByPeriod` のキーから取得する。

```typescript
// lib/types.ts（EvaluationWizardState に追加）

export interface EvaluationWizardState {
  currentStep: number
  period: string                          // v1.7変更：セレクターで選択可能に
  availablePeriods: string[]              // v1.7新設：選択可能な期間一覧
  selfEvaluation: SelfEvaluation
  managerSupplementary: ManagerSupplementary
  aiDraft: EvaluationDraft | null
  confirmedDraft: EvaluationDraft | null
  evaluatorComment: string
  aiCommentDraft: string | null
}
```

**UIレイアウト（Step1冒頭部分）**：

```
┌──────────────────────────────────────────────┐
│ h2: 評価素材の収集                              │
│                                                  │
│ 評価対象期間:                                    │
│ [select: 2026年上期（4月〜9月） ▼]               │
│                                                  │
│ ┌─ 自動収集データ ────────────────────────────┐ │
│ │ （選択された期間のデータが表示される）        │ │
│ └──────────────────────────────────────────────┘ │
│ ...                                              │
└──────────────────────────────────────────────────┘
```

> **Step2の1on1フィルタリング**：評価ウィザードのStep2では `filterOneOnOnesByPeriod()` で選択期間の1on1記録のみをAIに送信する。

### 14.5 組織方針バージョン管理

#### 14.5.1 ファイル構成の変更

**変更前**：

```
talent-management/shared/
├── department-policy.md         ← 単一ファイル
├── evaluation-criteria.md
└── guidelines.md
```

**変更後**：

```
talent-management/shared/
├── department-policy.md         ← 後方互換のため残存（最新年度へのフォールバック）
├── org-policy-2025.md          ← 2025年度組織方針
├── org-policy-2026.md          ← 2026年度組織方針
├── evaluation-criteria.md
└── guidelines.md
```

**命名規則**：`org-policy-{年度}.md`（例：`org-policy-2026.md`）

**フォールバックロジック**：年度別ファイルが存在しない場合は `department-policy.md` を参照する。これにより、既存データとの後方互換性を維持する。

#### 14.5.2 `shared-docs.ts` の変更

```typescript
// lib/fs/shared-docs.ts

import fs from 'fs'
import path from 'path'
import { SHARED_DIR, SHARED_DOCS } from './paths'
import { getActivePeriod, getFiscalYear } from '../utils/period'

/**
 * 指定年度の組織方針を読み込む。
 *
 * 優先順位:
 *   1. shared/org-policy-{year}.md が存在すればそれを返す
 *   2. 存在しなければ shared/department-policy.md をフォールバック
 *   3. どちらも存在しなければ空文字列
 *
 * @param year - 年度（例: 2026）
 * @returns 組織方針の Markdown テキスト
 */
export function loadOrgPolicy(year: number): string {
  const orgPolicyPath = path.join(SHARED_DIR, `org-policy-${year}.md`)
  try {
    return fs.readFileSync(orgPolicyPath, 'utf-8')
  } catch {
    // フォールバック: 旧ファイル名
    try {
      return fs.readFileSync(SHARED_DOCS.policy, 'utf-8')
    } catch {
      return ''
    }
  }
}

/**
 * 存在するすべての組織方針の年度一覧を取得する。
 *
 * shared/ ディレクトリから org-policy-{year}.md パターンのファイルを走査し、
 * department-policy.md のみ存在する場合は空配列を返す。
 *
 * @returns 降順ソート済みの年度配列（例: [2026, 2025]）
 */
export function getOrgPolicyYears(): number[] {
  try {
    const files = fs.readdirSync(SHARED_DIR)
    const years = files
      .map(f => {
        const match = f.match(/^org-policy-(\d{4})\.md$/)
        return match ? parseInt(match[1]) : null
      })
      .filter((y): y is number => y !== null)
    return years.sort((a, b) => b - a)
  } catch {
    return []
  }
}

/**
 * 共有ドキュメントを読み込む。
 * orgPolicy は指定年度のものを返す。年度未指定時はアクティブ期間から算出。
 */
export function loadSharedDocs(year?: number): {
  orgPolicy: string
  criteria: string
  guidelines: string
} {
  const targetYear = year ?? getFiscalYear(getActivePeriod())  // 期間整合性を保つ（例：3月は前年度の方針を参照）
  const read = (p: string) => {
    try { return fs.readFileSync(p, 'utf-8') } catch { return '' }
  }
  return {
    orgPolicy: loadOrgPolicy(targetYear),
    criteria: read(SHARED_DOCS.criteria),
    guidelines: read(SHARED_DOCS.guidelines),
  }
}
```

#### 14.5.3 `GET /api/docs` の変更

```typescript
// app/api/docs/route.ts

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { SHARED_DOCS } from '@/lib/fs/paths'
import { loadOrgPolicy, getOrgPolicyYears } from '@/lib/fs/shared-docs'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const yearParam = searchParams.get('year')
    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear()

    return NextResponse.json({
      orgPolicy: loadOrgPolicy(year),
      availableYears: getOrgPolicyYears(),
      criteria: fs.readFileSync(SHARED_DOCS.criteria, 'utf-8'),
      guidelines: fs.readFileSync(SHARED_DOCS.guidelines, 'utf-8'),
    })
  } catch (error) {
    console.error('Failed to read docs:', error)
    return NextResponse.json({ error: 'Failed to read documents' }, { status: 500 })
  }
}
```

**レスポンスの変更**：

| フィールド | 変更前 | 変更後 |
|-----------|--------|--------|
| `policy` | `string` | **削除**（`orgPolicy` に置換） |
| `orgPolicy` | なし | `string`（指定年度の組織方針） |
| `availableYears` | なし | `number[]`（利用可能な年度一覧、降順） |
| `criteria` | `string` | 変更なし |
| `guidelines` | `string` | 変更なし |

**クエリパラメータ**：

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|------|------|-----------|------|
| `year` | number | いいえ | 現在の年 | 組織方針の年度 |

#### 14.5.4 `DocsTabs.tsx` の変更

```typescript
// components/docs/DocsTabs.tsx

'use client'

import { useState } from 'react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { clsx } from 'clsx'

interface DocsTabsProps {
  docs: {
    orgPolicy: string
    availableYears: number[]
    criteria: string
    guidelines: string
  }
}

const TABS = [
  { id: 'policy', label: '組織方針', icon: '🏢' },
  { id: 'criteria', label: '評価基準', icon: '📊' },
  { id: 'guidelines', label: '運用ガイドライン', icon: '📋' },
] as const

type TabId = typeof TABS[number]['id']

export function DocsTabs({ docs }: DocsTabsProps) {
  const [active, setActive] = useState<TabId>('policy')
  const [selectedYear, setSelectedYear] = useState<number>(
    docs.availableYears[0] ?? new Date().getFullYear()
  )
  const [policyContent, setPolicyContent] = useState(docs.orgPolicy)

  // 年度変更時にAPIから取得
  const handleYearChange = async (year: number) => {
    setSelectedYear(year)
    try {
      const res = await fetch(`/api/docs?year=${year}`)
      const data = await res.json()
      setPolicyContent(data.orgPolicy)
    } catch {
      setPolicyContent('')
    }
  }

  const content: Record<TabId, string> = {
    policy: policyContent,
    criteria: docs.criteria,
    guidelines: docs.guidelines,
  }

  return (
    <div className="flex gap-8 items-start">
      {/* Left sidebar nav */}
      <aside className="w-80 shrink-0 sticky top-28">
        <nav className="flex flex-col gap-3">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={clsx(
                'flex items-center gap-4 px-6 py-5 rounded-xl text-left text-2xl font-medium transition-colors',
                active === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
              )}
            >
              <span className="text-3xl">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* 組織方針タブ選択時に年度セレクターを表示 */}
        {active === 'policy' && docs.availableYears.length > 0 && (
          <div className="flex items-center gap-4 mb-6">
            <label className="text-xl font-medium text-gray-700">年度：</label>
            <select
              value={selectedYear}
              onChange={e => handleYearChange(parseInt(e.target.value))}
              className="text-xl border border-gray-300 rounded-lg px-4 py-2 bg-white"
            >
              {docs.availableYears.map(y => (
                <option key={y} value={y}>{y}年度</option>
              ))}
            </select>
          </div>
        )}
        <div className="bg-white border border-gray-200 rounded-xl p-12">
          <MarkdownRenderer content={content[active]} />
        </div>
      </div>
    </div>
  )
}
```

**変更点まとめ**：

| 項目 | 変更前 | 変更後 |
|------|--------|--------|
| タブラベル | `部方針` | `組織方針` |
| データプロパティ | `docs.policy` | `docs.orgPolicy` |
| 年度セレクター | なし | 組織方針タブ選択時に表示。`availableYears` から選択肢を生成 |
| 年度変更時の挙動 | なし | `GET /api/docs?year={year}` でAPIから取得してコンテンツを更新 |

### 14.6 組織方針ウィザード（PolicyWizard）— 7ステップ分岐フロー

#### 14.6.1 概要・方針

組織方針ウィザードは、年度の組織方針策定をAIが支援する**7ステップの分岐フロー**ウィザードである。前年度方針の有無によって**継続モード（continuous）**と**初回モード（initial）**に自動分岐し、それぞれに最適化されたインプット収集を行った上で、AIが方向性の提案 → ドラフト生成 → 壁打ち精緻化 → 確認保存の流れで方針策定を支援する。

**設計方針**：

- **分岐フローによるコンテキスト最適化**：前年度方針が存在する「継続」ケースと、初めて策定する「初回」ケースで、収集すべき情報が大きく異なるため、Step2・Step3を分岐させて各モードに最適なインプットを収集する
- **方向性提案（Direction）の導入**：ドラフト生成前にAIが方向性の骨子を提案し、マネージャーが方向性レベルで合意してからドラフトに進むことで、大幅な手戻りを防止する
- **前年度方針の継承と進化**（継続モード）：前年度の振り返りを構造化して収集し、何を継続し何を変えるかを明確にする
- **構造化された方針策定**：ミッション・環境認識・重点施策・チーム体制・KPIの構成要素を網羅的にカバー
- **差分プレビュー**：保存前に前年度方針との差分をテキストベースで確認可能（継続モード）
- **目標設定ウィザードとの連携**：保存された方針は目標設定ウィザードのコンテキストとして自動的に参照される

**途中離脱の確認**: ウィザードのStep2以降で「閉じる」ボタンを押した場合、入力データが存在するときは確認ダイアログ「入力内容が破棄されます。閉じてよろしいですか？」を表示する。Step1のみの場合は確認なしで閉じる。

#### 14.6.2 フロー全体図

```
Step1: 年度選択（共通）
  │
  ├─ 前年度方針あり ──→ flowMode = 'continuous'
  │                       │
  │                   Step2A: 前年度振り返り
  │                       │
  │                   Step3A: 来期テーマ・環境変化
  │                       │
  │                       ├──→ Step4: AI方向性提案（共通）
  │                                    │
  └─ 前年度方針なし ──→ flowMode = 'initial'
                          │
                      Step2B: 現在の組織状態
                          │
                      Step3B: 上位組織方針（任意）
                          │
                          ├──→ Step4: AI方向性提案（共通）
                                       │
                                   Step5: AIドラフト生成（共通）
                                       │
                                   Step6: 壁打ち・精緻化（共通）
                                       │
                                   Step7: 確認・保存（共通）
                                     │
                                     ├─ continuous: 差分プレビュー + 全文プレビュー
                                     └─ initial: 全文プレビューのみ
```

**ステップ対応表**：

| ステップ | 共通/分岐 | 継続モード | 初回モード |
|---------|----------|-----------|-----------|
| Step1 | 共通 | 年度選択 | 年度選択 |
| Step2 | 分岐 | Step2A: 前年度振り返り | Step2B: 現在の組織状態 |
| Step3 | 分岐 | Step3A: 来期テーマ・環境変化 | Step3B: 上位組織方針 |
| Step4 | 共通 | AI方向性提案 | AI方向性提案 |
| Step5 | 共通 | AIドラフト生成 | AIドラフト生成 |
| Step6 | 共通 | 壁打ち・精緻化 | 壁打ち・精緻化 |
| Step7 | 共通 | 差分確認 + 保存 | 全文確認 + 保存 |

#### 14.6.3 画面設計（7ステップ）

**全体レイアウト**：

目標設定ウィザード・1on1ウィザード・評価ウィザードと同一のレイアウト構造を採用する。

| 要素 | Tailwind クラス | 備考 |
|------|----------------|------|
| コンテナ | `fixed inset-0 z-50 bg-white flex flex-col` | 全画面モーダル |
| ヘッダー | `px-16 py-5 border-b border-gray-200 bg-gray-50` | `{year}年度 組織方針ウィザード` + フローモードバッジ + 閉じるボタン |
| ステッパー | `px-16 py-5 border-b border-gray-100` | 7ステップ進捗バー（分岐ステップはモードに応じたラベルを表示） |
| コンテンツ領域 | `max-w-5xl mx-auto px-16 py-8` | 中央寄せ + 左右余白 |

**フォントサイズ規約**：

他ウィザードと同一（セクション4.5参照）。

**ステッパー**：

`PolicyStepper` コンポーネントで7ステップの進捗を視覚的に表示する。分岐ステップ（Step2, Step3）はフローモードに応じたラベルを動的に切り替える。

ステップラベル（継続モード）：
1. 年度選択
2. 前年度振り返り
3. 来期テーマ
4. AI方向性提案
5. AIドラフト
6. 壁打ち・精緻化
7. 確認・保存

ステップラベル（初回モード）：
1. 年度選択
2. 組織状態
3. 上位方針
4. AI方向性提案
5. AIドラフト
6. 壁打ち・精緻化
7. 確認・保存

**フローインジケーター**：

ヘッダー右側にフローモードをバッジ表示する。

- 継続モード：`bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm`、ラベル「継続策定」
- 初回モード：`bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm`、ラベル「新規策定」
- Step1完了前（未決定）：バッジ非表示

#### Step1: 年度選択（共通）

**コンポーネント名**：`PolicyStep1Year`

**Props**：
```typescript
interface PolicyStep1YearProps {
  state: PolicyWizardState
  dispatch: React.Dispatch<PolicyWizardAction>
  availableYears: number[]
}
```

**表示内容**：
- 対象年度の選択
- 前年度方針の有無を自動検出し、フローモード（継続/初回）を表示
- フローの概要説明

**入力フィールド**：
- 対象年度（select、`text-xl`）：現在の年度がデフォルト選択。前後2年分の選択肢を提供

**前年度方針の検出**：
- 対象年度の前年（`targetYear - 1`）の `org-policy-{year}.md` が存在するかをAPI経由で確認
- 前年度方針の検出は年度入力のonChange時にリアルタイムで実行する。年度が変更されるたびに `/api/docs?year={targetYear-1}` をfetchし、レスポンスの `orgPolicy` が空でないかで判定する。検出結果に応じてフロー案内テキストを即座に切り替える。
- 存在する場合：「前年度（{year-1}年度）の組織方針が見つかりました。前年度を振り返りながら方針を策定します。」（`bg-blue-50 border-blue-200 p-4 rounded-lg`）
- 存在しない場合：「前年度の組織方針がありません。新規に組織方針を策定します。」（`bg-green-50 border-green-200 p-4 rounded-lg`）

**フロー概要表示**：
```
┌──────────────────────────────────────────────────┐
│ ┌─ フロー概要 ───────────────────────────────┐    │
│ │ bg-gray-50 border-gray-200 p-6 rounded-lg  │    │
│ │                                             │    │
│ │ [継続モードの場合]                           │    │
│ │ 1. 年度選択 → 2. 前年度振り返り →            │    │
│ │ 3. 来期テーマ → 4. AI方向性提案 →            │    │
│ │ 5. AIドラフト → 6. 壁打ち → 7. 確認・保存    │    │
│ │                                             │    │
│ │ [初回モードの場合]                           │    │
│ │ 1. 年度選択 → 2. 組織状態 →                  │    │
│ │ 3. 上位方針 → 4. AI方向性提案 →              │    │
│ │ 5. AIドラフト → 6. 壁打ち → 7. 確認・保存    │    │
│ └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

**UIレイアウト**：

```
┌──────────────────────────────────────────────┐
│ h2: 組織方針の策定                              │
│ p: 年度の組織方針をAIと一緒に策定します。        │
│                                                  │
│ 対象年度: [select: 2026年度 ▼]                   │
│                                                  │
│ ┌─ フロー検出結果 ─────────────────────────── ┐ │
│ │ bg-blue-50（継続）/ bg-green-50（初回）      │ │
│ │ {検出メッセージ}                             │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ┌─ フロー概要 ─────────────────────────────── ┐ │
│ │ {7ステップの概要}                            │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│                                    [次へ進む]     │
└──────────────────────────────────────────────────┘
```

**ボタン**：
- 「次へ進む」：`bg-indigo-600 text-white hover:bg-indigo-700`。常に有効。押下で `SET_FLOW_MODE` をdispatchし、Step2（A or B）へ遷移

**バリデーション**：なし（年度はデフォルト値あり）

#### Step2A: 前年度振り返り（継続モード）

**コンポーネント名**：`PolicyStep2AReview`

**Props**：
```typescript
interface PolicyStep2AReviewProps {
  state: PolicyWizardState
  dispatch: React.Dispatch<PolicyWizardAction>
}
```

**表示内容**：
- 前年度方針の全文をアコーディオンで参照表示
- 前年度の振り返り3項目の入力

**入力フィールド**：
- うまくいったこと（textarea、`text-xl`、placeholder: 「前年度方針のうち、成果が出た施策・継続したい取り組みを記入」、5行）：**必須**、state キー `whatWorked`
- うまくいかなかったこと（textarea、`text-xl`、placeholder: 「期待した成果が出なかった施策・改善が必要な取り組みを記入」、5行）：**必須**、state キー `whatDidntWork`
- 積み残し・持ち越し（textarea、`text-xl`、placeholder: 「着手できなかった課題・来期に持ち越す事項を記入」、4行）：任意、state キー `leftBehind`

**前年度方針の表示**：
- アコーディオン形式（`bg-gray-50 border-gray-200 p-6 rounded-lg`）
- デフォルトは折りたたみ状態
- ヘッダー：「{year-1}年度組織方針（クリックで展開）」

**UIレイアウト**：

```
┌──────────────────────────────────────────────┐
│ h2: 前年度の振り返り                            │
│ p: 前年度の方針を振り返り、来期の方針策定に      │
│    活かします。                                  │
│                                                  │
│ ┌─ {year-1}年度組織方針（参考）────────────── ┐ │
│ │ ▼ クリックで展開                            │ │
│ │ bg-gray-50 border-gray-200 p-6 rounded-lg  │ │
│ │ {前年度方針の全文}                          │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ うまくいったこと（必須）:                         │
│ [textarea: whatWorked]                           │
│                                                  │
│ うまくいかなかったこと（必須）:                    │
│ [textarea: whatDidntWork]                        │
│                                                  │
│ 積み残し・持ち越し:                               │
│ [textarea: leftBehind]                           │
│                                                  │
│ [戻る]                           [次へ進む]      │
└──────────────────────────────────────────────────┘
```

**ボタン**：
- 「戻る」：`border border-gray-300 text-gray-600 hover:bg-gray-50`。Step1へ遷移
- 「次へ進む」：`bg-indigo-600 text-white hover:bg-indigo-700`。`whatWorked` と `whatDidntWork` が入力済みの場合に有効化。Step3Aへ遷移

**バリデーション**：
- `whatWorked`：必須（空文字不可）
- `whatDidntWork`：必須（空文字不可）
- `leftBehind`：任意

#### Step2B: 現在の組織状態（初回モード）

**コンポーネント名**：`PolicyStep2BCurrentState`

**Props**：
```typescript
interface PolicyStep2BCurrentStateProps {
  state: PolicyWizardState
  dispatch: React.Dispatch<PolicyWizardAction>
}
```

**表示内容**：
- 組織の現在の状態を多角的に収集するための入力フォーム

**入力フィールド**：
- チーム構成・人数（textarea、`text-xl`、placeholder: 「チーム構成、各チームの人数、主要メンバーの役割などを記入」、4行）：**必須**、state キー `teamInfo`
- 現在の課題（textarea、`text-xl`、placeholder: 「組織が抱えている課題・ボトルネック・改善したい点を記入」、5行）：**必須**、state キー `challenges`
- 組織の強み（textarea、`text-xl`、placeholder: 「組織が持つ強み・競争優位性・得意分野を記入」、4行）：**必須**、state キー `strengths`
- ミッション・役割（textarea、`text-xl`、placeholder: 「部門のミッション・会社内での役割・期待されていることを記入」、4行）：**必須**、state キー `mission`
- 注力テーマ（textarea、`text-xl`、placeholder: 「今期特に注力したいテーマ・方向性を記入」、4行）：**必須**、state キー `themes`

**UIレイアウト**：

```
┌──────────────────────────────────────────────┐
│ h2: 現在の組織状態                              │
│ p: 方針策定の基礎となる、組織の現状を            │
│    教えてください。                              │
│                                                  │
│ チーム構成・人数（必須）:                         │
│ [textarea: teamInfo]                            │
│                                                  │
│ 現在の課題（必須）:                               │
│ [textarea: challenges]                          │
│                                                  │
│ 組織の強み（必須）:                               │
│ [textarea: strengths]                           │
│                                                  │
│ ミッション・役割（必須）:                         │
│ [textarea: mission]                             │
│                                                  │
│ 注力テーマ（必須）:                               │
│ [textarea: themes]                              │
│                                                  │
│ [戻る]                           [次へ進む]      │
└──────────────────────────────────────────────────┘
```

**ボタン**：
- 「戻る」：`border border-gray-300 text-gray-600 hover:bg-gray-50`。Step1へ遷移
- 「次へ進む」：`bg-indigo-600 text-white hover:bg-indigo-700`。全必須フィールドが入力済みの場合に有効化。Step3Bへ遷移

**バリデーション**：
- `teamInfo`：必須（空文字不可）
- `challenges`：必須（空文字不可）
- `strengths`：必須（空文字不可）
- `mission`：必須（空文字不可）
- `themes`：必須（空文字不可）

#### Step3A: 来期テーマ・環境変化（継続モード）

**コンポーネント名**：`PolicyStep3AThemes`

**Props**：
```typescript
interface PolicyStep3AThemesProps {
  state: PolicyWizardState
  dispatch: React.Dispatch<PolicyWizardAction>
}
```

**表示内容**：
- 来期の環境変化・注力テーマの入力

**入力フィールド**：
- 来期の環境変化（textarea、`text-xl`、placeholder: 「来期の事業環境の変化、組織変更、技術動向の変化などを記入」、6行）：**必須**、state キー `environmentChanges`
- 来期の注力テーマ（textarea、`text-xl`、placeholder: 「来期に特に注力したいテーマ・新たな方向性を記入」、4行）：**必須**、state キー `focusThemes`
- 補足情報（textarea、`text-xl`、placeholder: 「その他、方針に反映したい情報があれば記入（上位方針、予算変更など）」、4行）：任意、state キー `supplementary`

**UIレイアウト**：

```
┌──────────────────────────────────────────────┐
│ h2: 来期のテーマ・環境変化                      │
│ p: 来期に向けた環境変化と注力テーマを            │
│    教えてください。                              │
│                                                  │
│ 来期の環境変化（必須）:                           │
│ [textarea: environmentChanges]                  │
│                                                  │
│ 来期の注力テーマ（必須）:                         │
│ [textarea: focusThemes]                         │
│                                                  │
│ 補足情報:                                        │
│ [textarea: supplementary]                       │
│                                                  │
│ [戻る]                   [AI方向性提案へ進む]     │
└──────────────────────────────────────────────────┘
```

**ボタン**：
- 「戻る」：`border border-gray-300 text-gray-600 hover:bg-gray-50`。Step2Aへ遷移
- 「AI方向性提案へ進む」：`bg-indigo-600 text-white hover:bg-indigo-700`。`environmentChanges` と `focusThemes` が入力済みの場合に有効化。Step4へ遷移

**バリデーション**：
- `environmentChanges`：必須（空文字不可）
- `focusThemes`：必須（空文字不可）
- `supplementary`：任意

#### Step3B: 上位組織方針（初回モード）

**コンポーネント名**：`PolicyStep3BUpperPolicy`

**Props**：
```typescript
interface PolicyStep3BUpperPolicyProps {
  state: PolicyWizardState
  dispatch: React.Dispatch<PolicyWizardAction>
}
```

**表示内容**：
- 上位組織（会社・事業部）の方針を任意で入力
- 全フィールド任意であることを明示

**入力フィールド**：
- 上位組織の方針（textarea、`text-xl`、placeholder: 「会社全体や事業部の方針・戦略があればペーストまたは要約を記入」、8行）：任意、state キー `upperPolicy`
- 補足情報（textarea、`text-xl`、placeholder: 「その他、方針に反映したい情報があれば記入（予算、人員計画など）」、4行）：任意、state キー `supplementary`

**UIレイアウト**：

```
┌──────────────────────────────────────────────┐
│ h2: 上位組織の方針（任意）                      │
│ p: 会社や事業部の方針があれば入力してください。   │
│    スキップしても問題ありません。                 │
│                                                  │
│ ┌─ 説明 ─────────────────────────────────── ┐  │
│ │ bg-amber-50 border-amber-200 p-4 rounded   │  │
│ │ このステップは任意です。上位方針の情報が      │  │
│ │ あるとより整合性の高い方針を策定できますが、   │  │
│ │ なくても問題ありません。                      │  │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ 上位組織の方針:                                   │
│ [textarea: upperPolicy]                         │
│                                                  │
│ 補足情報:                                        │
│ [textarea: supplementary]                       │
│                                                  │
│ [戻る]                   [AI方向性提案へ進む]     │
└──────────────────────────────────────────────────┘
```

**ボタン**：
- 「戻る」：`border border-gray-300 text-gray-600 hover:bg-gray-50`。Step2Bへ遷移
- 「AI方向性提案へ進む」：`bg-indigo-600 text-white hover:bg-indigo-700`。常に有効（全フィールド任意のため）。Step4へ遷移

**バリデーション**：なし（全フィールド任意）

#### Step4: AI方向性提案（共通）

**コンポーネント名**：`PolicyStep4Direction`

**Props**：
```typescript
interface PolicyStep4DirectionProps {
  state: PolicyWizardState
  dispatch: React.Dispatch<PolicyWizardAction>
}
```

**表示内容**：
- AIが生成した方向性の骨子をMarkdownで表示
- マネージャーが方向性レベルで合意するか、フィードバックを返して再生成するかを選択

**AI連携**：
- Step3（A or B）からの遷移時に自動的に `POST /api/docs/policy/direction` を呼び出す
- 生成済みの場合（`state.direction` が存在）は再呼び出ししない
- AI呼び出し中はスピナーを表示

**エラー表示**: API呼出失敗時は `bg-red-50 border-red-200 text-red-700 p-6 rounded-lg` でエラーメッセージを表示し、「再試行」ボタンを配置する。再試行ボタンクリックで同じAPIを再呼び出しする。

**方向性の再生成**：
- フィードバック入力欄（textarea、`text-xl`、placeholder: 「方向性に対するフィードバック・修正してほしい点を入力」、3行）
- 「方向性を再生成」ボタンで `POST /api/docs/policy/direction` を再呼び出し（フィードバックを追加コンテキストとして送信）
- 再生成回数は最大2回

**UIレイアウト**：

```
┌──────────────────────────────────────────────┐
│ h2: AI方向性提案                                │
│ p: 入力内容をもとに、AIが方針の方向性・骨子を     │
│    提案しました。内容を確認してください。          │
│                                                  │
│ ┌─ 提案された方向性 ──────────────────────── ┐  │
│ │ bg-white border-indigo-200 p-8 rounded-lg  │  │
│ │ border-l-4 border-l-indigo-400             │  │
│ │ {MarkdownRenderer: AI方向性提案}            │  │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ┌─ 方向性のフィードバック ──────────────────┐   │
│ │ フィードバック:                             │   │
│ │ [textarea]                                 │   │
│ │                                             │   │
│ │ [方向性を再生成]  再生成回数: 0/2            │   │
│ │ bg-indigo-100 text-indigo-700              │   │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ [戻る]                [この方向性でドラフト生成]   │
└──────────────────────────────────────────────────┘
```

**ボタン**：
- 「方向性を再生成」：`bg-indigo-100 text-indigo-700 hover:bg-indigo-200`。フィードバック入力済みかつ再生成回数が2回未満の場合に有効化。2回到達後は非表示にし「再生成回数の上限に達しました。この方向性をベースにドラフトを生成してください。」と表示
- 「戻る」：`border border-gray-300 text-gray-600 hover:bg-gray-50`。Step3（A or B）へ遷移
- 「この方向性でドラフト生成」：`bg-indigo-600 text-white hover:bg-indigo-700`。AI生成が完了している場合に有効化。Step5へ遷移

#### Step5: AIドラフト生成（共通）

**コンポーネント名**：`PolicyStep5Draft`

**Props**：
```typescript
interface PolicyStep5DraftProps {
  state: PolicyWizardState
  dispatch: React.Dispatch<PolicyWizardAction>
}
```

**表示内容**：
- AIが生成した組織方針ドラフトをMarkdown形式で表示
- AI呼び出し中はスピナーを表示

**AI連携**：
- Step4からの遷移時に自動的に `POST /api/docs/policy/draft` を呼び出す
- `mode`（`'continuous'` or `'initial'`）と `direction`（Step4の方向性テキスト）をパラメータとして送信
- 生成済みの場合（`state.aiDraft` が存在）は再呼び出ししない

**エラー表示**: API呼出失敗時は `bg-red-50 border-red-200 text-red-700 p-6 rounded-lg` でエラーメッセージを表示し、「再試行」ボタンを配置する。再試行ボタンクリックで同じAPIを再呼び出しする。

**UIレイアウト**：

```
┌──────────────────────────────────────────────┐
│ h2: AIドラフト                                  │
│ p: 方向性をもとにAIが組織方針のドラフトを         │
│    生成しました。内容を確認してください。          │
│                                                  │
│ ┌─ 生成されたドラフト ─────────────────────── ┐ │
│ │ bg-white border-gray-200 p-8 rounded-lg     │ │
│ │ {MarkdownRenderer: AIドラフト}               │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ [戻る]                        [壁打ちへ進む]     │
└──────────────────────────────────────────────────┘
```

**ボタン**：
- 「戻る」：`border border-gray-300 text-gray-600 hover:bg-gray-50`。Step4へ遷移
- 「壁打ちへ進む」：`bg-indigo-600 text-white hover:bg-indigo-700`。AI生成が完了している場合に有効化。Step6へ遷移

#### Step6: 壁打ち・精緻化（共通）

**コンポーネント名**：`PolicyStep6Refine`

**Props**：
```typescript
interface PolicyStep6RefineProps {
  state: PolicyWizardState
  dispatch: React.Dispatch<PolicyWizardAction>
}
```

**表示内容**：
- 現在のドラフトをMarkdownエディタで表示（直接編集可能）
- フィードバック入力欄とAIリファインのチャットインターフェース

**入力フィールド**：
- ドラフト全文編集（textarea、`text-xl font-mono`、全文が表示される十分な高さ）
- フィードバック入力（textarea、`text-xl`、placeholder: 「修正してほしいポイント・追加したい内容を入力」、4行）

**AI連携**：
- 「AIに修正を依頼」ボタン押下で `POST /api/docs/policy/refine` を呼び出す
- 現在のドラフト全文とフィードバックを送信
- 壁打ち回数は最大5回とする（現行実装と同一）

**UIレイアウト**：

```
┌──────────────────────────────────────────────┐
│ h2: 壁打ち・精緻化                              │
│ p: ドラフトを直接編集するか、AIに修正を            │
│    依頼してください。                             │
│                                                  │
│ ┌─ ドラフト編集 ──────────────────────────────┐ │
│ │ [textarea: ドラフト全文（編集可能）]          │ │
│ │ min-h-[400px] font-mono                     │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ┌─ AIに修正を依頼 ───────────────────────────┐  │
│ │ フィードバック:                              │ │
│ │ [textarea]                                  │ │
│ │                                              │ │
│ │ [AIに修正を依頼]  壁打ち回数: 1/5            │ │
│ │ bg-indigo-100 text-indigo-700               │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ [戻る]                    [確認へ進む]            │
└──────────────────────────────────────────────────┘
```

**ボタン**：
- 「AIに修正を依頼」：`bg-indigo-100 text-indigo-700 hover:bg-indigo-200`。フィードバック入力済みかつ壁打ち回数が5回未満の場合に有効化。5回到達後は非表示にし、「壁打ち回数の上限に達しました。直接編集で最終調整してください。」と表示
- 「戻る」：`border border-gray-300 text-gray-600 hover:bg-gray-50`。Step5へ遷移
- 「確認へ進む」：`bg-indigo-600 text-white hover:bg-indigo-700`。常に有効。Step7へ遷移

#### Step7: 確認・保存（共通）

**コンポーネント名**：`PolicyStep7Confirm`

**Props**：
```typescript
interface PolicyStep7ConfirmProps {
  state: PolicyWizardState
  dispatch: React.Dispatch<PolicyWizardAction>
  onClose: () => void
}
```

**表示内容**：
- **継続モード**：前年度方針との差分をテキストベースで表示 + 最終版のプレビュー
- **初回モード**：最終版のプレビューのみ（差分表示なし）

**差分表示ロジック**（継続モードのみ）：
- 前年度方針と新方針を行単位で比較
- 追加行：`bg-green-50 border-l-4 border-green-400`
- 削除行：`bg-red-50 border-l-4 border-red-400 line-through`

**UIレイアウト（継続モード）**：

```
┌──────────────────────────────────────────────┐
│ h2: 確認・保存                                  │
│ p: 最終版を確認して保存してください。              │
│                                                  │
│ ┌─ 前年度からの変更点 ────────────────────────┐ │
│ │ bg-gray-50 p-6 rounded-lg overflow-auto     │ │
│ │ max-h-[300px]                               │ │
│ │                                              │ │
│ │ + 追加された行（bg-green-50）                │ │
│ │ - 削除された行（bg-red-50 line-through）     │ │
│ │   変更なしの行                               │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ┌─ 最終版プレビュー ─────────────────────────┐  │
│ │ bg-white border-gray-200 p-8 rounded-lg     │ │
│ │ {MarkdownRenderer: 最終版}                   │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ p: 保存先: talent-management/shared/             │
│    org-policy-{year}.md                          │
│                                                  │
│ [戻る]                       [組織方針を保存]     │
└──────────────────────────────────────────────────┘
```

**UIレイアウト（初回モード）**：

```
┌──────────────────────────────────────────────┐
│ h2: 確認・保存                                  │
│ p: 最終版を確認して保存してください。              │
│                                                  │
│ ┌─ 最終版プレビュー ─────────────────────────┐  │
│ │ bg-white border-gray-200 p-8 rounded-lg     │ │
│ │ {MarkdownRenderer: 最終版}                   │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ p: 保存先: talent-management/shared/             │
│    org-policy-{year}.md                          │
│                                                  │
│ [戻る]                       [組織方針を保存]     │
└──────────────────────────────────────────────────┘
```

**ボタン**：
- 「戻る」：`border border-gray-300 text-gray-600 hover:bg-gray-50`。Step6へ遷移
- 「組織方針を保存」：`bg-indigo-600 text-white hover:bg-indigo-700`。押下で `POST /api/docs/policy/save` を呼び出し、成功時にStep8（完了画面）へ遷移する

#### 完了画面（Step8）

**コンポーネント名**: `PolicyStepComplete`

保存成功後に表示される完了画面。他ウィザード（目標設定・1on1・評価）と同一のUIパターンを採用する。

**表示内容**:
- チェックマークアイコン（`bg-green-100 text-green-600 w-20 h-20 rounded-full`）
- 「{targetYear}年度の組織方針を保存しました」
- 保存先ファイルパス（`text-lg text-gray-500`）
- 「組織方針を確認する」ボタン → ウィザードを閉じて`/docs`に戻る

**ボタン**: 「閉じる」（`bg-indigo-600 text-white`）→ `onClose()` を呼び出し

#### 14.6.4 型定義

```typescript
// lib/types.ts に追加

/**
 * 組織方針ウィザードのフローモード。
 * - 'continuous': 前年度方針が存在する場合（継続策定）
 * - 'initial': 前年度方針が存在しない場合（新規策定）
 */
export type PolicyFlowMode = 'continuous' | 'initial'

export interface PolicyWizardState {
  currentStep: number                     // 1-8（8は完了画面）
  targetYear: number                      // 対象年度
  flowMode: PolicyFlowMode | null         // フローモード（Step1完了後に確定）
  previousPolicy: string | null           // 前年度方針テキスト

  // Step2A（継続モード）：前年度振り返り
  review: {
    whatWorked: string                    // うまくいったこと
    whatDidntWork: string                 // うまくいかなかったこと
    leftBehind: string                    // 積み残し・持ち越し
  }

  // Step2B（初回モード）：現在の組織状態
  currentState: {
    teamInfo: string                      // チーム構成・人数
    challenges: string                    // 現在の課題
    strengths: string                     // 組織の強み
    mission: string                       // ミッション・役割
    themes: string                        // 注力テーマ
  }

  // Step3A（継続モード）：来期テーマ・環境変化
  continuousThemes: {
    environmentChanges: string            // 来期の環境変化
    focusThemes: string                   // 来期の注力テーマ
    supplementary: string                 // 補足情報
  }

  // Step3B（初回モード）：上位組織方針
  upperPolicy: {
    content: string                       // 上位組織の方針テキスト
    supplementary: string                 // 補足情報
  }

  // Step4: AI方向性提案
  direction: string | null                // AI生成の方向性テキスト
  directionFeedback: string               // 方向性へのフィードバック
  directionRegenerateCount: number        // 方向性の再生成回数（最大2）

  // Step5-6: AIドラフト・精緻化
  aiDraft: string | null                  // AI生成ドラフト
  currentDraft: string | null             // 編集中のドラフト
  refinementCount: number                 // 壁打ち回数（最大5）

  // Step7: 保存
  savedPath: string | null                // 保存先パス
}
```

#### 14.6.5 Reducer Actions

| Action | ペイロード | 効果 |
|--------|----------|------|
| `SET_TARGET_YEAR` | `{ year: number }` | 対象年度を設定し、前年度方針を自動ロード |
| `SET_FLOW_MODE` | `{ mode: PolicyFlowMode, previousPolicy: string \| null }` | フローモードと前年度方針を確定。Step2（A or B）へ遷移。フローモード変更時に、前モード固有のフィールドをクリアする：continuous → initial に変更: `review`, `continuousThemes` をクリア。initial → continuous に変更: `currentState`, `upperPolicy` をクリア。両方共通: `direction`, `aiDraft`, `currentDraft` をクリア |
| `SET_REVIEW` | `{ field: keyof PolicyWizardState['review'], value: string }` | 前年度振り返りの各フィールドを更新（継続モード） |
| `SET_CURRENT_STATE` | `{ field: keyof PolicyWizardState['currentState'], value: string }` | 現在の組織状態の各フィールドを更新（初回モード） |
| `SET_CONTINUOUS_THEMES` | `{ field: keyof PolicyWizardState['continuousThemes'], value: string }` | 来期テーマの各フィールドを更新（継続モード） |
| `SET_UPPER_POLICY` | `{ field: keyof PolicyWizardState['upperPolicy'], value: string }` | 上位組織方針の各フィールドを更新（初回モード） |
| `SET_DIRECTION` | `{ direction: string }` | AI方向性提案を保存 |
| `SET_DIRECTION_FEEDBACK` | `{ feedback: string }` | 方向性フィードバックを保存 |
| `REGENERATE_DIRECTION` | `{ direction: string }` | 方向性を再設定。`directionRegenerateCount` をインクリメント |
| `SET_AI_DRAFT` | `{ draft: string }` | AIドラフトを保存。`currentDraft` も同じ値で初期化 |
| `UPDATE_CURRENT_DRAFT` | `{ draft: string }` | 直接編集によるドラフト更新 |
| `SET_REFINED_DRAFT` | `{ draft: string }` | AIリファイン結果を保存。`currentDraft` を更新。`refinementCount` をインクリメント |
| `SET_SAVED_PATH` | `{ path: string }` | 保存先パスを保存 |
| `NEXT_STEP` | なし | 次のステップへ遷移（フローモードに応じた分岐を考慮） |
| `PREV_STEP` | なし | 前のステップへ遷移（フローモードに応じた分岐を考慮）。Step4以降に進んだ後にStep2/Step3に戻った場合、`direction` と `aiDraft` を `null` にリセットする。これにより、インプット変更後にStep4/Step5に再遷移した際にAI生成が再実行される。 |
| `RESET_DOWNSTREAM` | なし | Step2/Step3の入力が変更された場合に `direction`, `aiDraft`, `currentDraft` を `null` にリセット |

**ステップ遷移ロジック**（`NEXT_STEP` / `PREV_STEP`）：

```typescript
// NEXT_STEP のロジック
function getNextStep(currentStep: number, flowMode: PolicyFlowMode | null): number {
  // Step1 → Step2（flowMode に応じて 2A or 2B だが、内部的には step=2）
  // Step2 → Step3（同上、3A or 3B）
  // Step3 → Step4（共通）
  // Step4 → Step5（共通）
  // Step5 → Step6（共通）
  // Step6 → Step7（共通）
  // Step7 → Step8（完了画面、保存成功時にdispatch）
  return Math.min(currentStep + 1, 8)
}

// PREV_STEP のロジック
function getPrevStep(currentStep: number, flowMode: PolicyFlowMode | null): number {
  return Math.max(currentStep - 1, 1)
}
```

> **注記**：ステップ番号は内部的に1〜7の連番で管理する。Step2・Step3でどちらのコンポーネントを描画するかは `flowMode` で判定する。

#### 14.6.6 API設計

##### POST /api/docs/policy/direction（新規）

**ファイル**：`app/api/docs/policy/direction/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | AIによる組織方針の方向性・骨子を提案 |
| メソッド | POST |
| `dynamic` | `'force-dynamic'` |

**リクエストボディ**：
```typescript
{
  year: number                    // 対象年度
  mode: 'continuous' | 'initial' // フローモード
  previousPolicy?: string        // 前年度方針テキスト（継続モード時）
  evaluationCriteria: string     // 評価基準
  guidelines: string             // 運用ガイドライン
  // 継続モード用
  review?: {
    whatWorked: string
    whatDidntWork: string
    leftBehind: string
  }
  continuousThemes?: {
    environmentChanges: string
    focusThemes: string
    supplementary: string
  }
  // 初回モード用
  currentState?: {
    teamInfo: string
    challenges: string
    strengths: string
    mission: string
    themes: string
  }
  upperPolicy?: {
    content: string
    supplementary: string
  }
  // 再生成時のフィードバック（任意）
  feedback?: string
}
```

**レスポンス**：
```typescript
{
  direction: string              // 生成された方向性テキスト（Markdown）
  mode: 'live'
}
```

**システムプロンプト（継続モード）**：

```
あなたはIT部門の組織戦略コンサルタントです。
モバイルアプリ開発部のマネージャーが年度の組織方針を策定するにあたり、まず方針の「方向性・骨子」を提案してください。

この段階ではドラフト全文ではなく、方向性レベルの提案を行います。マネージャーがこの方向性に合意してから、詳細なドラフトを生成します。

【あなたに提供される情報】
- 前年度の組織方針（全文）
- 前年度の振り返り（うまくいったこと、うまくいかなかったこと、積み残し）
- 来期の環境変化と注力テーマ
- 評価基準（キャリアラダー）
- 運用ガイドライン

【方向性提案の原則】
1. 前年度方針の振り返りを踏まえ、「継続すべきこと」「変えるべきこと」「新たに始めること」の3軸で整理すること
2. 来期の環境変化を反映した、具体的かつ実行可能な方向性を提案すること
3. 以下の構成で方向性を提案すること：
   - ミッション方向性（継続 or 刷新、その理由）
   - 重点施策の候補（2〜3本の柱とその背景）
   - チーム体制の方向性（変更の有無とその理由）
   - KPI方向性（注目すべき指標の候補）
   - R&D方向性（研究開発テーマの候補）
4. 各項目について「なぜその方向性なのか」の根拠を簡潔に付記すること

【出力フォーマット】
Markdown 形式で出力すること。見出しレベルは ## から開始すること。
箇条書きで簡潔に記載すること（各項目3〜5行程度）。
出力は日本語で行うこと。
```

**システムプロンプト（初回モード）**：

```
あなたはIT部門の組織戦略コンサルタントです。
モバイルアプリ開発部のマネージャーが初めて年度の組織方針を策定するにあたり、まず方針の「方向性・骨子」を提案してください。

この段階ではドラフト全文ではなく、方向性レベルの提案を行います。マネージャーがこの方向性に合意してから、詳細なドラフトを生成します。

【あなたに提供される情報】
- 組織の現在の状態（チーム構成、課題、強み、ミッション、注力テーマ）
- 上位組織の方針（任意、提供されない場合もある）
- 評価基準（キャリアラダー）
- 運用ガイドライン

【方向性提案の原則】
1. 組織の現状（強み・課題）を踏まえた現実的な方向性を提案すること
2. 以下の構成で方向性を提案すること：
   - ミッション案（部門の存在意義、1〜2文の候補）
   - 環境認識の要点（内部・外部環境から方針に影響する要素）
   - 重点施策の候補（2〜3本の柱とその背景）
   - チーム体制の活用方針（既存チーム構成をどう活かすか）
   - KPI方向性（測定すべき指標の候補）
   - R&D方向性（研究開発テーマの候補）
3. 上位組織の方針が提供されている場合、それとの整合性を確保すること
4. 各項目について「なぜその方向性なのか」の根拠を簡潔に付記すること

【出力フォーマット】
Markdown 形式で出力すること。見出しレベルは ## から開始すること。
箇条書きで簡潔に記載すること（各項目3〜5行程度）。
出力は日本語で行うこと。
```

**ユーザーメッセージ構築（継続モード）**：

```
## 対象年度：{year}年度（継続策定）

## 前年度の組織方針
{previousPolicy}

## 前年度の振り返り

### うまくいったこと
{review.whatWorked}

### うまくいかなかったこと
{review.whatDidntWork}

### 積み残し・持ち越し
{review.leftBehind || '（なし）'}

## 来期の環境変化
{continuousThemes.environmentChanges}

## 来期の注力テーマ
{continuousThemes.focusThemes}

## 補足情報
{continuousThemes.supplementary || '（なし）'}

## 評価基準（キャリアラダー）
{evaluationCriteria}

## 運用ガイドライン
{guidelines}

{feedback ? `## 方向性に対するフィードバック\n${feedback}\n\n上記のフィードバックを踏まえて、方向性を再提案してください。` : '上記の情報をもとに、方針の方向性・骨子を提案してください。'}
```

**ユーザーメッセージ構築（初回モード）**：

```
## 対象年度：{year}年度（新規策定）

## 組織の現在の状態

### チーム構成・人数
{currentState.teamInfo}

### 現在の課題
{currentState.challenges}

### 組織の強み
{currentState.strengths}

### ミッション・役割
{currentState.mission}

### 注力テーマ
{currentState.themes}

## 上位組織の方針
{upperPolicy.content || '（提供なし）'}

## 補足情報
{upperPolicy.supplementary || '（なし）'}

## 評価基準（キャリアラダー）
{evaluationCriteria}

## 運用ガイドライン
{guidelines}

{feedback ? `## 方向性に対するフィードバック\n${feedback}\n\n上記のフィードバックを踏まえて、方向性を再提案してください。` : '上記の情報をもとに、方針の方向性・骨子を提案してください。'}
```

**maxTokens**：2048

##### POST /api/docs/policy/draft（変更）

**ファイル**：`app/api/docs/policy/draft/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | AIによる組織方針ドラフトを生成（方向性をベースに） |
| メソッド | POST |
| `dynamic` | `'force-dynamic'` |

**リクエストボディ**（変更後）：
```typescript
{
  year: number                    // 対象年度
  mode: 'continuous' | 'initial' // フローモード
  direction: string              // Step4で合意された方向性テキスト（v1.9新設）
  previousPolicy?: string        // 前年度方針テキスト（継続モード時）
  evaluationCriteria: string     // 評価基準
  guidelines: string             // 運用ガイドライン
  // 継続モード用
  review?: {
    whatWorked: string
    whatDidntWork: string
    leftBehind: string
  }
  continuousThemes?: {
    environmentChanges: string
    focusThemes: string
    supplementary: string
  }
  // 初回モード用
  currentState?: {
    teamInfo: string
    challenges: string
    strengths: string
    mission: string
    themes: string
  }
  upperPolicy?: {
    content: string
    supplementary: string
  }
}
```

**レスポンス**：
```typescript
{
  draft: string                  // 生成された方針ドラフト（Markdown）
  mode: 'live'
}
```

**システムプロンプト（継続モード）**：

```
あなたはIT部門の組織戦略コンサルタントです。
モバイルアプリ開発部のマネージャーが年度の組織方針を策定するためのドラフトを生成してください。

マネージャーはすでに方針の「方向性・骨子」に合意しています。この方向性をベースに、詳細な組織方針ドラフトを生成してください。

【方針策定の原則】
1. 合意された方向性に忠実にドラフトを展開すること。方向性から大きく逸脱しないこと
2. 前年度方針の振り返り（うまくいったこと、うまくいかなかったこと、積み残し）を適切に反映すること
3. 具体的かつ実行可能な方針を策定すること。抽象的なスローガンのみは不可
4. 以下のセクション構成を必ず含めること：
   - ミッション（部門の存在意義、1〜2文）
   - 来期環境認識（市場・技術・組織の変化）
   - 重点施策（2〜3本の柱、各柱に具体的な施策を記載）
   - チーム体制（Flutter / KMP / Producer の役割と連携）
   - KPI・定量目標（測定可能な指標）
   - R&D方針（研究開発の方向性）
5. 評価基準（キャリアラダー）との整合性を確保すること
6. 運用ガイドラインに記載された目標立案ルールを踏まえ、個人目標に展開可能な粒度で書くこと

【禁止事項】
- 前年度方針の単純なコピー（環境変化を反映していない繰り返しは不可）
- 具体性のない抽象的な表現のみの方針（「DXを推進する」「品質を向上する」のみは不可）
- 実現可能性を考慮しない過大な目標設定
- 合意された方向性からの大幅な逸脱

【出力フォーマット】
Markdown 形式で出力すること。見出しレベルは ## から開始すること。
出力は日本語で行うこと。
```

**システムプロンプト（初回モード）**：

```
あなたはIT部門の組織戦略コンサルタントです。
モバイルアプリ開発部のマネージャーが初めて年度の組織方針を策定するためのドラフトを生成してください。

マネージャーはすでに方針の「方向性・骨子」に合意しています。この方向性をベースに、詳細な組織方針ドラフトを生成してください。

【方針策定の原則】
1. 合意された方向性に忠実にドラフトを展開すること。方向性から大きく逸脱しないこと
2. 組織の現状（チーム構成、強み、課題）を踏まえた実現可能な方針を策定すること
3. 具体的かつ実行可能な方針を策定すること。抽象的なスローガンのみは不可
4. 以下のセクション構成を必ず含めること：
   - ミッション（部門の存在意義、1〜2文）
   - 環境認識（内部・外部環境の現状分析）
   - 重点施策（2〜3本の柱、各柱に具体的な施策を記載）
   - チーム体制（各チームの役割と連携）
   - KPI・定量目標（測定可能な指標）
   - R&D方針（研究開発の方向性）
5. 上位組織の方針が提供されている場合、それとの整合性を確保すること
6. 評価基準（キャリアラダー）との整合性を確保すること
7. 運用ガイドラインに記載された目標立案ルールを踏まえ、個人目標に展開可能な粒度で書くこと

【禁止事項】
- 具体性のない抽象的な表現のみの方針（「DXを推進する」「品質を向上する」のみは不可）
- 実現可能性を考慮しない過大な目標設定
- 合意された方向性からの大幅な逸脱

【出力フォーマット】
Markdown 形式で出力すること。見出しレベルは ## から開始すること。
出力は日本語で行うこと。
```

**ユーザーメッセージ構築（継続モード）**：

```
## 対象年度：{year}年度（継続策定）

## 合意された方向性・骨子
{direction}

## 前年度の組織方針
{previousPolicy}

## 前年度の振り返り

### うまくいったこと
{review.whatWorked}

### うまくいかなかったこと
{review.whatDidntWork}

### 積み残し・持ち越し
{review.leftBehind || '（なし）'}

## 来期の環境変化
{continuousThemes.environmentChanges}

## 来期の注力テーマ
{continuousThemes.focusThemes}

## 補足情報
{continuousThemes.supplementary || '（なし）'}

## 評価基準（キャリアラダー）
{evaluationCriteria}

## 運用ガイドライン
{guidelines}

上記の方向性をベースに、{year}年度の組織方針ドラフト全文を生成してください。
```

**ユーザーメッセージ構築（初回モード）**：

```
## 対象年度：{year}年度（新規策定）

## 合意された方向性・骨子
{direction}

## 組織の現在の状態

### チーム構成・人数
{currentState.teamInfo}

### 現在の課題
{currentState.challenges}

### 組織の強み
{currentState.strengths}

### ミッション・役割
{currentState.mission}

### 注力テーマ
{currentState.themes}

## 上位組織の方針
{upperPolicy.content || '（提供なし）'}

## 補足情報
{upperPolicy.supplementary || '（なし）'}

## 評価基準（キャリアラダー）
{evaluationCriteria}

## 運用ガイドライン
{guidelines}

上記の方向性をベースに、{year}年度の組織方針ドラフト全文を生成してください。
```

**maxTokens**：4096

##### POST /api/docs/policy/refine（修正あり）

**修正あり**: リクエストボディを `{ currentContent, messages }` から `{ currentDraft, feedback, previousPolicy?, evaluationCriteria?, guidelines? }` に変更。レスポンスも `{ reply, updatedPolicy }` から `{ refined: string, mode: 'live' }` に変更。ただし、実装時にチャット形式のUIを採用する場合は現行の `{ currentContent, messages }` 形式を維持してもよい（実装判断に委ねる）。

**ファイル**：`app/api/docs/policy/refine/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | AIによる組織方針リファイン（壁打ち） |
| メソッド | POST |
| `dynamic` | `'force-dynamic'` |

**リクエストボディ**：
```typescript
{
  currentDraft: string           // 現在のドラフト全文
  feedback: string               // マネージャーのフィードバック
  previousPolicy?: string        // 前年度方針テキスト
  evaluationCriteria: string     // 評価基準
  guidelines: string             // 運用ガイドライン
}
```

**レスポンス**：
```typescript
{
  refined: string                // リファイン後のドラフト（Markdown）
  mode: 'live'
}
```

**システムプロンプト**：

```
あなたはIT部門の組織戦略コンサルタントです。
マネージャーのフィードバックをもとに、組織方針ドラフトを修正・改善してください。

【修正の原則】
1. フィードバックで指摘されたポイントを確実に反映すること
2. 修正していない箇所の品質を維持すること（無関係な箇所を不用意に書き換えない）
3. 全体の整合性を確保すること（一部修正が他のセクションに影響する場合は連動して修正）
4. 修正後もMarkdownの構造を維持すること

【出力フォーマット】
修正後の方針全文をMarkdown形式で出力すること。差分ではなく全文を出力すること。
出力は日本語で行うこと。
```

**ユーザーメッセージ構築**：

```
## 現在のドラフト
{currentDraft}

## 前年度の組織方針（参考）
{previousPolicy || '（なし）'}

## 評価基準（参考）
{evaluationCriteria}

## 運用ガイドライン（参考）
{guidelines}

## マネージャーのフィードバック
{feedback}

上記のフィードバックを反映して、組織方針ドラフトを修正してください。修正後の全文を出力してください。
```

**maxTokens**：4096

##### POST /api/docs/policy/save（変更なし）

**ファイル**：`app/api/docs/policy/save/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | 組織方針をMarkdownファイルとして保存 |
| メソッド | POST |
| `dynamic` | `'force-dynamic'` |

**リクエストボディ**：
```typescript
{
  year: number                   // 対象年度
  content: string                // 組み立て済みMarkdown全文
}
```

**処理**：
1. `year` と `content` のバリデーション
2. `SHARED_DIR` から共有ドキュメントディレクトリのパスを取得
3. `shared/org-policy-{year}.md` にコンテンツを書き込み

**レスポンス**：
```typescript
{
  success: true
  path: string    // 保存先の相対パス（例: "talent-management/shared/org-policy-2026.md"）
}
```

**エラー**：
- 400: `year` または `content` が未指定
- 500: ファイル書き込み失敗

**実装パターン**：`app/api/members/[name]/goals/route.ts` の POST 処理と同一パターンに従う。

#### 14.6.7 コンポーネント一覧

| ファイルパス | 種類 | 役割 |
|------------|------|------|
| `web-demo/src/components/policy/PolicyWizard.tsx` | Client Component | 組織方針ウィザード本体（useReducer + 7ステップ分岐描画） |
| `web-demo/src/components/policy/PolicyStepper.tsx` | Client Component | ステッパーUI（7ステップの進捗表示、フローモードに応じたラベル切替） |
| `web-demo/src/components/policy/steps/PolicyStep1Year.tsx` | Client Component | Step1: 年度選択 + フローモード検出 |
| `web-demo/src/components/policy/steps/PolicyStep2AReview.tsx` | Client Component | Step2A: 前年度振り返り（継続モード） |
| `web-demo/src/components/policy/steps/PolicyStep2BCurrentState.tsx` | Client Component | Step2B: 現在の組織状態（初回モード） |
| `web-demo/src/components/policy/steps/PolicyStep3AThemes.tsx` | Client Component | Step3A: 来期テーマ・環境変化（継続モード） |
| `web-demo/src/components/policy/steps/PolicyStep3BUpperPolicy.tsx` | Client Component | Step3B: 上位組織方針（初回モード） |
| `web-demo/src/components/policy/steps/PolicyStep4Direction.tsx` | Client Component | Step4: AI方向性提案（共通） |
| `web-demo/src/components/policy/steps/PolicyStep5Draft.tsx` | Client Component | Step5: AIドラフト表示（共通） |
| `web-demo/src/components/policy/steps/PolicyStep6Refine.tsx` | Client Component | Step6: 壁打ち・精緻化（共通） |
| `web-demo/src/components/policy/steps/PolicyStep7Confirm.tsx` | Client Component | Step7: 確認・保存（共通、フローモードに応じた差分表示切替） |
| `web-demo/src/components/policy/steps/PolicyStepComplete.tsx` | Client Component | Step8: 完了画面（保存成功後の確認画面） |

#### 14.6.8 ウィザードの起動

組織方針ウィザードは `/docs` ページ（`DocsTabs`）から起動する。

```typescript
// components/docs/DocsTabs.tsx に追加

{active === 'policy' && (
  <button
    onClick={() => setPolicyWizardOpen(true)}
    className="text-lg bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
  >
    組織方針ウィザード
  </button>
)}
```

`DocsTabs` から `criteria` と `guidelines` を `PolicyWizard` にpropsとして渡す。ウィザード内ではこれらをdirection API・draft APIのリクエストボディに含めて送信する。

```typescript
interface PolicyWizardProps {
  onClose: () => void
  availableYears: number[]
  criteria: string       // 評価基準テキスト
  guidelines: string     // 運用ガイドラインテキスト
}
```

ウィザード閉了時に `router.refresh()` を実行し、組織方針タブの表示を更新する。

### 14.7 用語置換一覧

以下の用語をシステム全体で統一的に置換する。

#### 14.7.1 変数名・プロパティ名

`departmentPolicy` の全出現箇所をプロジェクト横断でgrep し、`orgPolicy` に一括置換する。対象にはコンポーネントのprops参照、プロンプトビルダーの型パラメータ名、APIルートのローカル変数を含む。

補足置換:

| 変更前 | 変更後 | 備考 |
|--------|--------|------|
| `policy` | `orgPolicy` | `loadSharedDocs()` の戻り値 `policy` → `orgPolicy` |
| `policy` | `orgPolicy` | `SHARED_DOCS.policy` は残存（フォールバック用） |
| `policy` | `orgPolicy` | `GET /api/docs` レスポンスの `policy` → `orgPolicy` |
| `docs.policy` | `docs.orgPolicy` | `DocsTabs` の props |

#### 14.7.2 ファイル名

| 変更前 | 変更後 | 備考 |
|--------|--------|------|
| `department-policy.md` | `org-policy-{year}.md` | 旧ファイルはフォールバック用に残存 |

#### 14.7.3 UIラベル

| 変更前 | 変更後 | 対象箇所 |
|--------|--------|---------|
| `部方針` | `組織方針` | `DocsTabs` のタブラベル |
| `部方針ドキュメント` | `組織方針ドキュメント` | NavBar のリンクラベル |
| `部方針` | `組織方針` | 目標設定ウィザード Step1 の固定情報表示 |
| `部方針` | `組織方針` | アーキテクチャ図（セクション2.1） |

#### 14.7.4 AIプロンプト内テキスト

| 変更前 | 変更後 | 対象箇所 |
|--------|--------|---------|
| `## 部方針` | `## 組織方針` | 診断用ユーザーメッセージ（`buildDiagnosisUserMessage`） |
| `## 部方針` | `## 組織方針` | 目標生成用ユーザーメッセージ（`buildGoalGenerationUserMessage`） |
| `## 部方針` | `## 組織方針` | 1on1質問生成ユーザーメッセージ（`buildOneOnOneQuestionsUserMessage`） |
| `## 部方針` | `## 組織方針` | 評価ドラフトユーザーメッセージ（`buildReviewDraftUserMessage`） |
| `## グループ方針` | `## 組織方針` | 診断用システムプロンプト内の参照テキスト |

### 14.8 新規ファイル一覧

#### 14.8.1 新規作成ファイル

| ファイルパス | 種類 | 役割 |
|------------|------|------|
| `web-demo/src/lib/utils/period.ts` | Utility | 期間管理基盤（Period型、getActivePeriod、formatPeriodLabel、sortPeriods、parsePeriodFromFilename、getFiscalYear） |
| `web-demo/src/components/policy/PolicyWizard.tsx` | Client Component | 組織方針ウィザード本体（useReducer + 7ステップ分岐描画） |
| `web-demo/src/components/policy/PolicyStepper.tsx` | Client Component | ステッパーUI（7ステップの進捗表示、フローモードに応じたラベル切替） |
| `web-demo/src/components/policy/steps/PolicyStep1Year.tsx` | Client Component | Step1: 年度選択 + フローモード検出 |
| `web-demo/src/components/policy/steps/PolicyStep2AReview.tsx` | Client Component | Step2A: 前年度振り返り（継続モード） |
| `web-demo/src/components/policy/steps/PolicyStep2BCurrentState.tsx` | Client Component | Step2B: 現在の組織状態（初回モード） |
| `web-demo/src/components/policy/steps/PolicyStep3AThemes.tsx` | Client Component | Step3A: 来期テーマ・環境変化（継続モード） |
| `web-demo/src/components/policy/steps/PolicyStep3BUpperPolicy.tsx` | Client Component | Step3B: 上位組織方針（初回モード） |
| `web-demo/src/components/policy/steps/PolicyStep4Direction.tsx` | Client Component | Step4: AI方向性提案（共通） |
| `web-demo/src/components/policy/steps/PolicyStep5Draft.tsx` | Client Component | Step5: AIドラフト表示（共通） |
| `web-demo/src/components/policy/steps/PolicyStep6Refine.tsx` | Client Component | Step6: 壁打ち・精緻化（共通） |
| `web-demo/src/components/policy/steps/PolicyStep7Confirm.tsx` | Client Component | Step7: 確認・保存（共通、フローモードに応じた差分表示切替） |
| `web-demo/src/components/policy/steps/PolicyStepComplete.tsx` | Client Component | Step8: 完了画面（保存成功後の確認画面） |
| `web-demo/src/app/api/docs/policy/direction/route.ts` | API Route | AI組織方針の方向性・骨子提案（v1.9新設） |
| `web-demo/src/app/api/docs/policy/refine/route.ts` | API Route | AI組織方針リファイン |
| `web-demo/src/app/api/docs/policy/save/route.ts` | API Route | 組織方針保存 |
| `web-demo/src/lib/prompts/policy-direction.ts` | Prompt Builder | 組織方針方向性提案用プロンプト（buildPolicyDirectionSystemPrompt, buildPolicyDirectionUserMessage）（v1.9新設） |
| `web-demo/src/lib/prompts/policy-draft.ts` | Prompt Builder | 組織方針ドラフト用プロンプト（buildPolicyDraftSystemPrompt, buildPolicyDraftUserMessage）（v1.9でモード別プロンプトに変更） |
| `web-demo/src/lib/prompts/policy-refine.ts` | Prompt Builder | 組織方針リファイン用プロンプト（buildPolicyRefineSystemPrompt, buildPolicyRefineUserMessage） |

#### 14.8.2 v1.9で廃止されたファイル（旧4ステップ設計）

> 以下のファイルは v1.8 の旧4ステップ設計で定義されていたもので、v1.9 の7ステップ分岐フロー設計により廃止・置換された。

| 廃止ファイルパス | 置換先 |
|----------------|--------|
| `web-demo/src/components/policy/steps/PolicyStep1Input.tsx` | `PolicyStep1Year.tsx` + `PolicyStep2AReview.tsx` / `PolicyStep2BCurrentState.tsx` + `PolicyStep3AThemes.tsx` / `PolicyStep3BUpperPolicy.tsx` に分割 |
| `web-demo/src/components/policy/steps/PolicyStep2Draft.tsx` | `PolicyStep5Draft.tsx` に置換 |
| `web-demo/src/components/policy/steps/PolicyStep3Refine.tsx` | `PolicyStep6Refine.tsx` に置換 |
| `web-demo/src/components/policy/steps/PolicyStep4Preview.tsx` | `PolicyStep7Confirm.tsx` に置換 |

#### 14.8.3 修正が必要な既存ファイル

| ファイルパス | 修正内容 |
|------------|---------|
| `web-demo/src/lib/types.ts` | `MemberDetail` に `goalsByPeriod`, `activePeriod` を追加。`GoalWizardState` に `targetPeriod` を追加。`PolicyWizardState` 型を v1.9 の7ステップ分岐フロー仕様に新設（`PolicyFlowMode` 型、`review`, `currentState`, `continuousThemes`, `upperPolicy`, `direction` 等のフィールドを含む）。`EvaluationWizardState` に `availablePeriods` を追加 |
| `web-demo/src/lib/fs/members.ts` | `getAllGoalPeriods()`, `getGoalsByPeriod()` を新設。`getMemberDetail()` を複数期間対応に改修 |
| `web-demo/src/lib/fs/shared-docs.ts` | `loadOrgPolicy()`, `getOrgPolicyYears()` を新設。`loadSharedDocs()` を年度対応に改修。戻り値キーを `policy` → `orgPolicy` に変更 |
| `web-demo/src/lib/fs/paths.ts` | `SHARED_DOCS.policy` は後方互換のため残存。`SHARED_DIR` のエクスポートを確認 |
| `web-demo/src/app/api/docs/route.ts` | `year` クエリパラメータ対応。レスポンスキーを `policy` → `orgPolicy` に変更。`availableYears` を追加 |
| `web-demo/src/app/api/members/[name]/goals/route.ts` | `period` パラメータを必須化。対象期間ラベルの動的生成。バリデーション追加 |
| `web-demo/src/components/member/GoalsTab.tsx` | 期間セレクターUI追加。`goalsByPeriod`, `activePeriod` props を受け取る |
| `web-demo/src/components/member/MemberDetailClient.tsx` | `GoalsTab` への `goalsByPeriod`, `activePeriod` props 追加。`policyWizardOpen` state は不要（/docs ページで管理） |
| `web-demo/src/components/docs/DocsTabs.tsx` | タブラベル「部方針」→「組織方針」。年度セレクター追加。`orgPolicy` プロパティ対応。PolicyWizard 起動ボタン追加 |
| `web-demo/src/app/docs/page.tsx` | `loadSharedDocs()` + `getOrgPolicyYears()` 経由に書き換え、`availableYears` を `DocsTabs` に渡す |
| `web-demo/src/app/members/[name]/page.tsx` | `loadSharedDocs()` の戻り値変更に対応。`goalsByPeriod`, `activePeriod` の構築 |
| `web-demo/src/components/layout/NavBar.tsx` | 「部方針」→「組織方針」リンクラベル変更 |
| `web-demo/src/lib/prompts/diagnosis.ts` | ユーザーメッセージ内「部方針」→「組織方針」 |
| `web-demo/src/lib/prompts/goal-generation.ts` | ユーザーメッセージ内「部方針」→「組織方針」 |
| `web-demo/src/lib/prompts/one-on-one-questions.ts` | ユーザーメッセージ内「部方針」→「組織方針」 |
| `web-demo/src/lib/prompts/one-on-one-summary.ts` | コンテキスト変数名 `departmentPolicy` → `orgPolicy` |
| `web-demo/src/lib/prompts/review-draft.ts` | ユーザーメッセージ内「部方針」→「組織方針」、変数名 `departmentPolicy` → `orgPolicy` |
| `web-demo/src/components/goals/GoalWizard.tsx` | `targetPeriod` の初期化・保存時送信。ヘッダーに期間ラベル表示 |
| `web-demo/src/components/goals/steps/Step1AutoLoad.tsx` | 「部方針」→「組織方針」表示ラベル変更 |
| `web-demo/src/app/api/members/[name]/reviews/draft/route.ts` | リクエストボディに `policyYear` パラメータを追加し、`loadOrgPolicy(policyYear)` で対応年度の方針を参照する |
| `web-demo/src/app/api/members/[name]/reviews/route.ts` | `period \|\| '2026-h1'` のハードコードを `period \|\| getActivePeriod()` に変更 |
| `web-demo/src/app/api/chat/route.ts` | `loadSharedDocs()` の戻り値型変更に追従（`shared.guidelines` のみ使用のため実質影響なし） |
| `web-demo/src/app/api/docs/policy/draft/route.ts` | v1.9: `mode`, `direction` パラメータを追加。モード別のシステムプロンプト・ユーザーメッセージ構築に変更 |

### 14.9 実装フェーズ

#### フェーズ1: 期間管理基盤（見積：0.5日）

1. `lib/utils/period.ts` を新規作成（Period型、getActivePeriod、formatPeriodLabel、sortPeriods、parsePeriodFromFilename、getFiscalYear）
2. 単体テスト：エッジケース（1月=前年h2、4月=当年h1、12月=当年h2）の動作確認

#### フェーズ2: 目標の複数期間対応 + ウィザードのアクティブ期間対応（見積：1.5日）

> API変更とウィザード修正は同一フェーズで実施し、非互換状態を防ぐ。

1. `lib/types.ts` に `goalsByPeriod`, `activePeriod` を `MemberDetail` に追加
2. `lib/fs/members.ts` に `getAllGoalPeriods()`, `getGoalsByPeriod()` を新設
3. `getMemberDetail()` を複数期間対応に改修
4. `app/api/members/[name]/goals/route.ts` の `period` パラメータを必須化
5. `components/member/GoalsTab.tsx` に期間セレクターUIを実装
6. `components/member/MemberDetailClient.tsx` の props 更新
7. `app/members/[name]/page.tsx` の `goalsByPeriod`, `activePeriod` 構築
8. `GoalWizardState` に `targetPeriod` を追加
9. `GoalWizard.tsx` のヘッダーに期間ラベル表示
10. `Step7Refinement.tsx` の保存処理で `period` を送信
11. `OneOnOneWizardContextData` の目標参照をアクティブ期間対応
12. `EvaluationWizardState` に `availablePeriods` を追加

#### フェーズ3: 組織方針バージョン管理（見積：1日）

1. `lib/fs/shared-docs.ts` に `loadOrgPolicy()`, `getOrgPolicyYears()` を新設
2. `loadSharedDocs()` の戻り値キーを `policy` → `orgPolicy` に変更
3. `app/api/docs/route.ts` の `year` クエリパラメータ対応
4. `components/docs/DocsTabs.tsx` のタブラベル変更と年度セレクター追加
5. 手動マイグレーション実施: `cp talent-management/shared/department-policy.md talent-management/shared/org-policy-2026.md`。旧ファイルはフォールバック用に残す

#### フェーズ4: 用語置換（見積：0.5日）

1. 全ファイルの `departmentPolicy` → `orgPolicy` 変数名置換
2. UIラベル「部方針」→「組織方針」置換
3. AIプロンプト内テキスト置換
4. NavBar リンクラベル変更

#### フェーズ5: 組織方針ウィザード — 7ステップ分岐フロー（見積：3日）

> v1.9 で旧4ステップ設計から7ステップ分岐フローに再設計。工数を1日増加（旧2日→新3日）。

1. `PolicyStepper.tsx` を実装（7ステップ進捗バー、フローモードに応じたラベル切替）
2. `PolicyWizard.tsx` を実装（useReducer + 7ステップ分岐描画 + フローモード判定）
3. `PolicyStep1Year.tsx` を実装（年度選択 + 前年度方針検出 + フローモード表示）
4. `PolicyStep2AReview.tsx` を実装（前年度振り返り入力、継続モード）
5. `PolicyStep2BCurrentState.tsx` を実装（現在の組織状態入力、初回モード）
6. `PolicyStep3AThemes.tsx` を実装（来期テーマ・環境変化、継続モード）
7. `PolicyStep3BUpperPolicy.tsx` を実装（上位組織方針、初回モード）
8. `PolicyStep4Direction.tsx` を実装（AI方向性提案 + フィードバック + 再生成）
9. `PolicyStep5Draft.tsx` を実装（AIドラフト表示）
10. `PolicyStep6Refine.tsx` を実装（エディタ + AIリファイン）
11. `PolicyStep7Confirm.tsx` を実装（フローモードに応じた差分/全文プレビュー + 保存）
12. `lib/prompts/policy-direction.ts` を実装（方向性提案用プロンプト、継続/初回モード別）
13. `lib/prompts/policy-draft.ts` を実装（ドラフト用プロンプト、継続/初回モード別）
14. `lib/prompts/policy-refine.ts` を実装（リファイン用プロンプト）
15. `app/api/docs/policy/direction/route.ts` を実装
16. `app/api/docs/policy/draft/route.ts` を実装（mode/direction パラメータ対応）
17. `app/api/docs/policy/refine/route.ts` を実装
18. `app/api/docs/policy/save/route.ts` を実装

> ※ 既存の PolicyStep3Refine.tsx と PolicyStep4Confirm.tsx はUIパターンが大きく変更されるため、リネーム再利用ではなく新規作成として実装する。既存ファイルは削除する。

#### フェーズ6: 統合テスト（見積：1日）

> v1.9 で組織方針ウィザードのテストケースが増加（分岐フロー）。工数を0.5日増加（旧0.5日→新1日）。

1. 複数期間の目標切り替え表示テスト
2. 新規期間での目標設定ウィザード → 保存 → 表示の一連テスト
3. 組織方針ウィザード：継続モードの7ステップ遷移テスト（前年度方針あり）
4. 組織方針ウィザード：初回モードの7ステップ遷移テスト（前年度方針なし）
5. 組織方針ウィザード：方向性提案の再生成テスト（最大2回）
6. 組織方針ウィザード：壁打ちの上限テスト（最大3回）
7. 組織方針ウィザード：継続モードの差分プレビュー表示テスト
8. 組織方針ウィザード：初回モードの全文プレビュー表示テスト
9. 組織方針の年度切り替え表示テスト
10. 用語置換の網羅的確認（UI・AIプロンプト・API）
11. 後方互換性テスト（`department-policy.md` のみ存在する環境での動作確認）
12. デモデータに `2025-h2.md`（前期目標サンプル）を追加し、複数期間機能のデモを可能にする

#### 見積合計

| フェーズ | 見積 |
|---------|------|
| フェーズ1: 期間管理基盤 | 0.5日 |
| フェーズ2: 目標の複数期間対応 + ウィザードのアクティブ期間対応 | 1.5日 |
| フェーズ3: 組織方針バージョン管理 | 1日 |
| フェーズ4: 用語置換 | 0.5日 |
| フェーズ5: 組織方針ウィザード（7ステップ分岐フロー） | 3日 |
| フェーズ6: 統合テスト | 1日 |
| **合計** | **7.5日** |

---

---

## 15. 既知の未実装事項（バックログ）

v2.2時点で設計済みだが未実装の項目を以下に記録する。各項目は推奨対応時期に達した段階で実装を検討すること。

| # | 内容 | 優先度 | 推奨対応時期 | 関連セクション |
|---|------|--------|------------|--------------|
| 1 | 評価ウィザードStep1に期間セレクター追加（`availablePeriods`を`EvaluationWizardState`に追加し、目標が存在する期間のみ選択可能にする） | 中 | 2026年9月（次評価サイクル前） | 14.4.3 |
| 2 | 評価ウィザードで`filterOneOnOnesByPeriod()`を適用（選択期間の1on1記録のみをAIに送信） | 中 | 同上 | 14.4.3 |
| 3 | `OneOnOneWizardContextData`に`activePeriod`フィールドを追加 | 低 | 1on1記録の期間フィルタリングが必要になった時点 | 14.4.2 |
| 4 | `GoalWizardState`に`targetPeriod`フィールドを追加（現在は`WizardContextData`経由で代用中） | 低 | 必要時 | 14.4.1 |
| 5 | Goals POST API（`/api/members/[name]/goals`）の`period`パラメータ必須化（現在は`getActivePeriod()`フォールバック） | 低 | 必要時 | 14.3.4 |
| 6 | カオナビAPI v2連携による自己評価自動取得（Consumer Key/Secret発行・シートID確認が前提） | 低 | API環境整備後 | 11.2 |
| 7 | コンディションスコア推移グラフのダッシュボード表示 | 低 | 将来検討 | 10.1 |
| 8 | 評価履歴の推移グラフ表示 | 低 | 将来検討 | 11.1 |

---

## 16. チームマトリクスビュー

### 16.1 概要

チームマトリクスビューは、指定期間における全メンバーの目標設定・1on1実施・評価完了のステータスを一覧で俯瞰するための独立ページ（`/team`）である。既存のダッシュボード（`/`）は変更せず、ナビゲーションバーに新たなリンクを追加して遷移する。

#### 設計方針

- **期間指定による横断確認**：期間セレクターで任意の半期を選択し、その期間における各メンバーの目標有無・月別1on1実施有無・評価有無を確認できる
- **チームフィルター**：既存ダッシュボードと同様のチームフィルターピルで表示メンバーを絞り込む
- **サマリーチップ**：目標未設定数・1on1未実施数・評価未完了数をチップで即座に把握できる
- **既存ページへの影響なし**：`/team` は独立ページとして実装し、既存のダッシュボード・メンバー詳細ページには変更を加えない
- **行クリック遷移**：マトリクスの各行をクリックすると対応するメンバー詳細ページ（`/members/[name]`）に遷移する

### 16.2 画面設計

#### 全体レイアウト

**ファイル**：`app/team/page.tsx`（Server Component）→ `TeamMatrixView`（Client Component）

| 要素 | Tailwind クラス | 備考 |
|------|----------------|------|
| ページコンテナ | `px-8 py-7` | ダッシュボードと同一の余白 |
| ページタイトル | `text-7xl font-bold text-gray-900` | 「チームマトリクス」 |
| サブタイトル | `text-3xl text-gray-500 mt-2` | 「モバイルアプリ開発部 — {選択期間ラベル}」 |
| ツールバー | `flex items-center gap-6 mb-6 flex-wrap` | 期間セレクター + チームフィルター + サマリーチップ |
| テーブルコンテナ | `overflow-x-auto` | 横スクロール対応 |

#### ツールバー

##### 期間セレクター

| 要素 | 仕様 |
|------|------|
| 種類 | `<select>` ドロップダウン |
| デフォルト値 | `getActivePeriod()` で取得したアクティブ期間 |
| 選択肢 | `data/members/` 配下の全期間（goals/ および reviews/ のファイル名から収集）を降順ソート |
| ラベル表示 | `formatPeriodLabel()` で「2026年上期（4月〜9月）」形式 |
| Tailwind | `text-xl border border-gray-300 rounded-lg px-4 py-2` |
| 変更時動作 | 選択期間を state に保存し、`GET /api/team/matrix?period={period}` を再取得 |

##### チームフィルターピル

既存ダッシュボードの `MemberGrid` と同一の仕様。

| 要素 | 仕様 |
|------|------|
| 種類 | ボタンピル群（全員 / Flutter / KMP / Producer / その他） |
| 選択中スタイル | `bg-indigo-600 text-white` |
| 非選択スタイル | `bg-white text-gray-700 border border-gray-300` |
| Tailwind | `text-xl px-4 py-1.5 rounded-full font-medium` |
| 各ボタン | ラベル + メンバー数（例: `Flutter (8)`） |
| 0人のチーム | 非表示 |

##### サマリーチップ

ツールバー右端（`ml-auto`）に配置。フィルタリング後のメンバーに対する集計値を表示する。

| チップ | 表示条件 | スタイル |
|--------|---------|---------|
| 目標未設定 {N}名 | `hasGoal === false` のメンバー数が1以上 | `bg-red-50 text-red-700 border border-red-200 rounded-full px-4 py-1.5 text-xl font-medium` |
| 1on1未実施 {N}名 | 当月までに実施すべき1on1が未実施のメンバー数が1以上 | `bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-4 py-1.5 text-xl font-medium` |
| 評価未完了 {N}名 | `hasReview === false` のメンバー数が1以上 | `bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-4 py-1.5 text-xl font-medium` |
| すべて完了 | 上記すべてが0の場合 | `bg-green-50 text-green-700 border border-green-200 rounded-full px-4 py-1.5 text-xl font-medium` |

#### マトリクステーブル

**コンポーネント**：`TeamMatrixTable`

| 要素 | Tailwind クラス |
|------|----------------|
| テーブル | `w-full border-collapse` |
| ヘッダー行 | `bg-gray-50 border-b border-gray-200` |
| ヘッダーセル | `text-lg font-semibold text-gray-600 px-4 py-3 text-center` |
| データ行 | `border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors` |
| データセル | `text-lg text-gray-900 px-4 py-3 text-center` |
| メンバー名セル | `text-lg font-medium text-gray-900 px-4 py-3 text-left whitespace-nowrap` |

##### 列定義

| # | 列ヘッダー | 幅 | 内容 |
|---|-----------|-----|------|
| 1 | メンバー | `w-40` | メンバー名 + チームバッジ（小） |
| 2 | 目標 | `w-20` | 目標設定済み → ○、未設定 → × |
| 3〜8 | 月別1on1（6列） | 各 `w-16` | 該当月の1on1実施済み → ○、未実施かつ過去月 → ×、未来月 → － |
| 9 | 評価 | `w-20` | 評価完了 → ○、未完了 → × |
| 10 | 完了率 | `w-32` | プログレスバー + パーセンテージ |

##### 月別1on1ヘッダーの年度跨ぎ対応

下期（h2）の場合、月ヘッダーは `10月, 11月, 12月, 1月, 2月, 3月` の順に表示する。上期（h1）の場合は `4月, 5月, 6月, 7月, 8月, 9月` の順に表示する。

```typescript
function getMonthHeaders(period: string): { month: number; label: string }[] {
  const match = period.match(/^(\d{4})-(h[12])$/)
  if (!match) return []
  const [, yearStr, half] = match
  const year = parseInt(yearStr)

  if (half === 'h1') {
    return [4, 5, 6, 7, 8, 9].map(m => ({ month: m, label: `${m}月` }))
  }
  // h2: 10月〜12月は当年、1月〜3月は翌年
  return [10, 11, 12, 1, 2, 3].map(m => ({
    month: m,
    label: `${m}月`,
  }))
}
```

##### セル描画ルール（`MatrixCell`）

**コンポーネント**：`MatrixCell`

| 状態 | 表示 | スタイル |
|------|------|---------|
| 完了（done） | ○ | `text-green-600 font-bold` |
| 未完了（missing） | × | `text-red-500 font-bold` |
| 未来月（future） | － | `text-gray-300` |

##### 未来月の判定ロジック

```typescript
function isFutureMonth(period: string, month: number): boolean {
  const match = period.match(/^(\d{4})-(h[12])$/)
  if (!match) return false
  const [, yearStr, half] = match
  const year = parseInt(yearStr)

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  // 対象月の実際の暦年を算出
  let targetYear: number
  if (half === 'h2') {
    targetYear = month >= 10 ? year : year + 1
  } else {
    targetYear = year
  }

  // 暦年・月の比較
  if (targetYear > currentYear) return true
  if (targetYear === currentYear && month > currentMonth) return true
  return false
}
```

##### 完了率

各メンバーの完了率は以下の式で算出する。

```
完了項目数 = (hasGoal ? 1 : 0) + (過去月のうち1on1実施済み月数) + (hasReview ? 1 : 0)
全項目数 = 1（目標） + 過去月数 + 1（評価）
完了率 = Math.round(完了項目数 / 全項目数 * 100)
```

※ 未来月は完了率の計算対象に含めない。全項目数が0の場合（全て未来月の場合）は完了率0%とする。

| 完了率範囲 | プログレスバー色 | テキスト色 |
|-----------|----------------|-----------|
| 100% | `bg-green-500` | `text-green-700` |
| 50%〜99% | `bg-amber-500` | `text-amber-700` |
| 0%〜49% | `bg-red-500` | `text-red-700` |

プログレスバーの仕様：

| 要素 | Tailwind クラス |
|------|----------------|
| バー外枠 | `w-full bg-gray-200 rounded-full h-2` |
| バー内部 | `h-2 rounded-full transition-all` + 色クラス |
| パーセンテージテキスト | `text-lg font-medium ml-2` + テキスト色クラス |

##### 行クリック遷移

テーブルの各データ行をクリックすると `router.push(\`/members/\${encodeURIComponent(memberName)}\`)` で該当メンバーの詳細ページに遷移する。

#### フォントサイズ規約（既存画面に準拠）

| 要素 | サイズ |
|------|--------|
| ページタイトル | `text-7xl font-bold` |
| サブタイトル | `text-3xl` |
| ツールバーラベル・セレクター | `text-xl` |
| チームフィルターピル | `text-xl font-medium` |
| サマリーチップ | `text-xl font-medium` |
| テーブルヘッダー | `text-lg font-semibold` |
| テーブルデータ | `text-lg` |
| メンバー名 | `text-lg font-medium` |
| 完了率テキスト | `text-lg font-medium` |

### 16.3 データ設計

#### 16.3.1 型定義

`lib/types.ts` に以下の2型を追加する。

```typescript
/** チームマトリクス: メンバー1名分のステータス */
export interface MemberPeriodStatus {
  memberName: string
  team: string
  teamShort: string
  hasGoal: boolean
  oneOnOneMonths: number[]   // 実施済み月のリスト（例: [4, 5, 6]）
  hasReview: boolean
}

/** チームマトリクス: 期間全体のマトリクスデータ */
export interface TeamPeriodMatrix {
  period: string              // 例: "2026-h1"
  members: MemberPeriodStatus[]
}
```

#### 16.3.2 `lib/fs/members.ts` への関数追加

以下の3関数を `members.ts` に追加する。

##### `getMemberPeriodStatus(encodedName: string, period: string): MemberPeriodStatus`

指定メンバーの指定期間におけるステータスを取得する。

```typescript
export function getMemberPeriodStatus(encodedName: string, period: string): MemberPeriodStatus | null {
  const membersDir = getMembersDir()
  const name = decodeURIComponent(encodedName)
  const memberDir = path.join(membersDir, name)
  if (!fs.existsSync(memberDir)) return null

  const profilePath = path.join(memberDir, 'profile.md')
  if (!fs.existsSync(profilePath)) return null
  const rawProfile = fs.readFileSync(profilePath, 'utf-8')
  const profile = parseProfile(rawProfile)

  // 目標の有無（ファイル存在 + 空テンプレートでないことを確認）
  const goalPath = path.join(memberDir, 'goals', `${period}.md`)
  let hasGoal = false
  if (fs.existsSync(goalPath)) {
    const content = fs.readFileSync(goalPath, 'utf-8')
    // ウィザード生成: 「目標①」等を含む / テンプレート: 「- 目標内容：」の後に内容あり
    hasGoal = /目標[①②③④⑤]/.test(content) ||
      (content.includes('- 目標内容：') && /- 目標内容：\S/.test(content))
  }

  // 1on1実施月
  const oneOnOneMonths = getOneOnOneMonthsForPeriod(memberDir, period)

  // 評価の有無
  const reviewPath = path.join(memberDir, 'reviews', `${period}.md`)
  const hasReview = fs.existsSync(reviewPath)

  return {
    memberName: profile.name || name,
    team: profile.team,
    teamShort: profile.teamShort,
    hasGoal,
    oneOnOneMonths,
    hasReview,
  }
}
```

##### `getOneOnOneMonthsForPeriod(memberDir: string, period: string): number[]`

指定期間に属する1on1記録のファイル名から、実施済み月番号のリストを返す。

```typescript
function getOneOnOneMonthsForPeriod(memberDir: string, period: string): number[] {
  const ooDir = path.join(memberDir, 'one-on-one')
  if (!fs.existsSync(ooDir)) return []

  const files = fs.readdirSync(ooDir).filter(f => f.endsWith('.md'))
  const months: number[] = []

  for (const file of files) {
    const dateStr = file.replace('.md', '')
    const filePeriod = getOneOnOnePeriod(dateStr)
    if (filePeriod !== period) continue

    const monthMatch = dateStr.match(/^\d{4}-(\d{2})/)
    if (monthMatch) {
      months.push(parseInt(monthMatch[1]))
    }
  }

  return months.sort((a, b) => a - b)
}
```

**年度跨ぎの考慮**：`getOneOnOnePeriod()` は `lib/utils/period.ts` に既存の関数であり、1on1ファイル名（`YYYY-MM`）からPeriodを自動判定する。下期（h2）の場合、`2025-10`〜`2025-12` と `2026-01`〜`2026-03` はいずれも `2025-h2` に属するため、年度跨ぎの月も正しくフィルタリングされる。

##### `getTeamPeriodMatrix(period: string): TeamPeriodMatrix`

チーム全体のマトリクスデータを構築する。

```typescript
export function getTeamPeriodMatrix(period: string): TeamPeriodMatrix {
  const memberNames = getMemberNames()
  const members: MemberPeriodStatus[] = []

  for (const name of memberNames) {
    const status = getMemberPeriodStatus(name, period)
    if (status) {
      members.push(status)
    }
  }

  return { period, members }
}
```

#### 16.3.3 利用可能期間の収集

期間セレクターの選択肢を構築するため、全メンバーの `goals/` と `reviews/` ディレクトリを走査して利用可能な全期間を収集する。

```typescript
export function getAvailablePeriods(): string[] {
  const membersDir = getMembersDir()
  const memberNames = getMemberNames()
  const periodSet = new Set<string>()

  // アクティブ期間は常に含める
  periodSet.add(getActivePeriod())

  for (const name of memberNames) {
    const goalsDir = path.join(membersDir, name, 'goals')
    if (fs.existsSync(goalsDir)) {
      fs.readdirSync(goalsDir)
        .map(parsePeriodFromFilename)
        .filter((p): p is string => p !== null)
        .forEach(p => periodSet.add(p))
    }
    const reviewsDir = path.join(membersDir, name, 'reviews')
    if (fs.existsSync(reviewsDir)) {
      fs.readdirSync(reviewsDir)
        .map(parsePeriodFromFilename)
        .filter((p): p is string => p !== null)
        .forEach(p => periodSet.add(p))
    }
  }

  return sortPeriods([...periodSet])
}
```

### 16.4 API設計

#### GET /api/team/matrix

**ファイル**：`app/api/team/matrix/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getTeamPeriodMatrix, getAvailablePeriods } from '@/lib/fs/members'
import { getActivePeriod } from '@/lib/utils/period'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || getActivePeriod()
    const matrix = getTeamPeriodMatrix(period)
    const availablePeriods = getAvailablePeriods()

    return NextResponse.json({ matrix, availablePeriods })
  } catch (error) {
    console.error('Team matrix fetch error:', error)
    return NextResponse.json(
      { error: 'チームマトリクスデータの取得に失敗しました' },
      { status: 500 }
    )
  }
}
```

| 項目 | 内容 |
|------|------|
| メソッド | GET |
| クエリパラメータ | `period`（任意。例: `2026-h1`。未指定時は `getActivePeriod()` を使用） |
| レスポンス | `{ matrix: TeamPeriodMatrix, availablePeriods: string[] }` |
| キャッシュ | `force-dynamic`（キャッシュ無効） |
| エラー | 500: ファイル読み取り失敗 |
| AI連携 | なし（ファイルシステム読み取りのみ） |

既存のAPIには変更を加えない。

### 16.5 新規ファイル一覧

| ファイルパス | 種類 | 役割 |
|------------|------|------|
| `web-demo/src/app/api/team/matrix/route.ts` | API Route | チームマトリクスデータ取得（GET） |
| `web-demo/src/app/team/page.tsx` | Server Component | チームマトリクスビューページ。`TeamMatrixView` を描画 |
| `web-demo/src/components/dashboard/TeamMatrixView.tsx` | Client Component | チームマトリクスビューのコンテナ。期間セレクター、チームフィルターピル、サマリーチップ、`TeamMatrixTable` を内包 |
| `web-demo/src/components/dashboard/TeamMatrixTable.tsx` | Client Component | マトリクステーブル本体。メンバー行 × ステータス列のテーブル描画。行クリック遷移 |
| `web-demo/src/components/dashboard/MatrixCell.tsx` | Server Component | マトリクスセル。ステータス（done / missing / future）に応じた ○/×/－ の描画 |

### 16.6 既存ファイル変更

| ファイルパス | 修正内容 |
|------------|---------|
| `web-demo/src/lib/types.ts` | `MemberPeriodStatus`、`TeamPeriodMatrix` の2型を追加 |
| `web-demo/src/lib/fs/members.ts` | `getMemberPeriodStatus()`、`getOneOnOneMonthsForPeriod()`、`getTeamPeriodMatrix()`、`getAvailablePeriods()` の4関数を追加 |
| `web-demo/src/components/layout/NavBar.tsx` | `navItems` 配列に `{ href: '/team', label: 'チームマトリクス' }` を追加 |

#### NavBar.tsx の変更詳細

```typescript
const navItems = [
  { href: '/', label: 'ダッシュボード' },
  { href: '/team', label: 'チームマトリクス' },
  { href: '/docs', label: '組織方針・評価基準' },
]
```

`isActive` 判定は既存ロジック（`pathname === '/'` の場合は完全一致、それ以外は `pathname.startsWith(item.href)`）がそのまま適用される。`/team` は `pathname.startsWith('/team')` で判定されるため追加修正は不要。

### 16.7 実装フェーズ

#### フェーズ1: データ基盤（見積：0.5日）

1. `lib/types.ts` に `MemberPeriodStatus` と `TeamPeriodMatrix` の2型を追加
2. `lib/fs/members.ts` に `getOneOnOneMonthsForPeriod()` を実装（1on1ファイルの期間フィルタリング）
3. `lib/fs/members.ts` に `getMemberPeriodStatus()` を実装（メンバー単位のステータス取得）
4. `lib/fs/members.ts` に `getTeamPeriodMatrix()` を実装（チーム全体のマトリクス構築）
5. `lib/fs/members.ts` に `getAvailablePeriods()` を実装（利用可能期間の収集）

#### フェーズ2: API実装（見積：0.5日）

1. `app/api/team/matrix/route.ts` を実装（GET、`force-dynamic`）
2. クエリパラメータ `period` のバリデーション・デフォルト値処理
3. レスポンス形式の確認テスト

#### フェーズ3: UIコンポーネント（見積：1.5日）

1. `MatrixCell.tsx` を実装（○/×/－ のステータスセル）
2. `TeamMatrixTable.tsx` を実装（テーブル本体 + 月ヘッダー + 完了率 + 行クリック遷移）
3. `TeamMatrixView.tsx` を実装（期間セレクター + チームフィルター + サマリーチップ + テーブル）
4. `app/team/page.tsx` を実装（Server Component、`TeamMatrixView` を描画）

#### フェーズ4: ナビゲーション統合・テスト（見積：0.5日）

1. `NavBar.tsx` の `navItems` に `/team` リンクを追加
2. 期間セレクターの動作確認（アクティブ期間・過去期間の切り替え）
3. チームフィルターの動作確認（各チーム・全員の切り替え）
4. サマリーチップの集計値確認
5. 未来月の－表示確認
6. 完了率の計算・色分け確認
7. 行クリックによるメンバー詳細ページ遷移確認
8. デモモード時のデータ表示確認

---

> 以上
