# AIタレントハブ システム設計書

> 文書バージョン：1.6
> 作成日：2026-03-21
> 最終更新：2026-03-21（AIチャットサイドバー廃止、デモモード機能追加、モックレスポンス削除を反映）
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
| マネージャー | 比良津暁（Akiharu Hyuga） |
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
│  │ダッシュボード│  │メンバー詳細    │  │部方針ドキュメント│  │目標設定ウィザード│   │
│  │ (/)       │  │(/members/[name])│  │(/docs)    │  │(モーダル)     │   │
│  └──────────┘  └──────────────┘  └──────────┘  └─────────────┘   │
│                                             ┌─────────────┐        │
│                                             │1on1ウィザード  │        │
│                                             │(モーダル)     │        │
│                                             └─────────────┘        │
│                                             ┌─────────────┐        │
│                                             │評価ウィザード  │        │
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
│   │   ├── department-policy.md    ← 部方針
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
| 概要 | 共有ドキュメント3種を取得 |
| レスポンス | `{ policy: string, criteria: string, guidelines: string }` |

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

### 9.5 ライブラリ（`web-demo/src/lib/`）

| ファイルパス | 役割 |
|------------|------|
| `lib/types.ts` | 型定義一覧（14型） |
| `lib/fs/paths.ts` | ファイルパス定数（PROJECT_ROOT, DATA_ROOT, MEMBERS_DIR, DEMO_MEMBERS_DIR, SHARED_DIR, SHARED_DOCS） + `getMembersDir()`（デモモード状態に応じたディレクトリ切替） |
| `lib/fs/members.ts` | メンバーデータ読み取り（getMemberNames, getAllMemberSummaries, getMemberDetail, parseReview） |
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

> 以上
