# AIタレントハブ システム設計書

> 文書バージョン：1.1
> 作成日：2026-03-21
> 最終更新：2026-03-21（ウィザードUI仕様・目標生成フォーマット詳細を追記）
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
│                    │ AIチャットサイドバー │                              │
│                    └──────────────────┘                              │
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
    │                  │    │ パス3: モックモード（キーなし）│
    │ talent-management│    │                              │
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
│   └── members/                ← メンバー個別データ（24名分）
│       └── {name}/
│           ├── profile.md      ← プロフィール
│           ├── goals/
│           │   └── 2026-h1.md  ← 半期目標
│           ├── one-on-one/     ← 1on1記録（YYYY-MM.md）
│           └── reviews/        ← 評価（YYYY-h{1|2}.md）
│               └── 2025-h2.md
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

#### AI チャットフロー

```
1. ユーザーがサイドバーにメッセージ入力
2. useChat フックが POST /api/chat を呼び出し
3. API Route で API キーの有無を確認
   - キーなし → getMockResponse() でモック応答を返却
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

**レイアウト**：左側にタブコンテンツ（flex-1）、右側にAIチャットサイドバー（520px固定幅）。

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

### 4.4 AIチャットサイドバー

**ファイル**：`components/chat/ChatSidebar.tsx`

メンバー詳細ページの右側に常時表示される520px幅のチャットパネル。

#### 機能一覧

| 機能 | 説明 |
|------|------|
| クイックアクション | 「1on1の準備をして」「評価ドラフトを作って」「チーム全体を俯瞰して」の3ボタン |
| メッセージ送信 | textarea + 送信ボタン。Enter で改行、Shift+Enter で送信 |
| モード表示 | 「デモモード」（オレンジ）/ 「Claude API 接続中」（グリーン）のバッジ |
| 目標保存 | AI応答に `目標[1-5]` パターンが含まれる場合、「この目標で確定する」ボタンを表示 |
| クリア | メッセージ履歴をリセット |
| 自動スクロール | 新メッセージ追加時に最下部へスクロール |

**目標保存機能**：`isGoalProposal()` で応答内に `目標[1-5丸数字]` パターンを検出。`extractGoalsContent()` で目標部分のみ抽出し、`POST /api/members/[name]/goals` で保存する。

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
| AI なしの場合 | 1秒遅延後にモック診断を返却 |
| AI ありの場合 | `buildDiagnosisSystemPrompt()` + `buildDiagnosisUserMessage()` で Claude に問い合わせ |
| レスポンス | `{ diagnosis: string, mode: 'mock' | 'live' }` |

### 5.5 POST /api/members/[name]/goals/generate

**ファイル**：`app/api/members/[name]/goals/generate/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | AI による目標案を生成（壁打ち対応） |
| リクエスト | `{ memberContext, managerInput, memberInput, previousPeriod?, diagnosis, refinementMessages? }` |
| AI なしの場合 | 1.5秒遅延後にモック目標を返却 |
| AI ありの場合 | `buildGoalGenerationSystemPrompt()` + `buildGoalGenerationUserMessage()` で Claude に問い合わせ。`refinementMessages` がある場合はメッセージ履歴に追加して送信 |
| レスポンス | `{ goals: string, mode: 'mock' | 'live' }` |
| maxTokens | 4096 |

### 5.6 POST /api/chat

**ファイル**：`app/api/chat/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | AIチャット（サイドバー用） |
| リクエスト | `{ messages: ChatMessage[], memberName?: string, memberContext?: string }` |
| AI なしの場合 | 700ms遅延後にモック応答を返却（キーワードマッチング） |
| AI ありの場合 | システムプロンプト（AI秘書定義 + guidelines.md + メンバーコンテキスト）でClaude に問い合わせ |
| レスポンス | `{ content: string, mode: 'mock' | 'live' }` |
| maxTokens | 1024 |

### 5.7 GET /api/docs

**ファイル**：`app/api/docs/route.ts`

| 項目 | 内容 |
|------|------|
| 概要 | 共有ドキュメント3種を取得 |
| レスポンス | `{ policy: string, criteria: string, guidelines: string }` |

---

## 6. AI連携

### 6.1 Azure AI Foundry / Anthropic API デュアルパス

`lib/ai/call-claude.ts` が2つの AI 接続パスを提供する。

#### 優先順位

```
1. ANTHROPIC_FOUNDRY_API_KEY がある場合 → Azure AI Foundry パス
2. ANTHROPIC_API_KEY がある場合 → Anthropic API 直接パス
3. どちらもない場合 → エラー（NO_API_KEY）→ 呼び出し元でモックにフォールバック
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

API キーが設定されていない場合、すべての AI エンドポイントがモックモードで動作する。

| エンドポイント | モック内容 | 遅延 |
|---------------|-----------|------|
| `/api/chat` | キーワードマッチングによる定型応答（目標設定/1on1準備/評価ドラフト/横断分析） | 700ms |
| `/api/.../diagnosis` | 汎用的な診断サマリーテンプレート | 1000ms |
| `/api/.../generate` | 3目標のサンプル（実行/挑戦/インパクト） | 1500ms |

モック応答ライブラリ（`lib/mock/responses.ts`）はキーワード配列でマッチングし、該当しない場合はフォールバック応答（使い方ガイド）を返す。

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
| `api/chat/route.ts` | POST | AIチャット |
| `api/docs/route.ts` | GET | 共有ドキュメント取得 |

### 9.4 コンポーネント（`web-demo/src/components/`）

| ファイルパス | 種類 | 役割 |
|------------|------|------|
| `layout/NavBar.tsx` | Client | グローバルナビゲーション。ダッシュボード / 部方針リンク + デモ版バッジ |
| `layout/TalentHubLogo.tsx` | Server | SVG ロゴ（THモノグラム + 6ノードのハブ図形） |
| `dashboard/StatsBar.tsx` | Server | 統計サマリー（6列グリッド） |
| `dashboard/MemberGrid.tsx` | Client | チームフィルター + メンバーカードグリッド |
| `dashboard/MemberCard.tsx` | Server | メンバーカード（バッジ + プロジェクト配分バー + 詳細リンク） |
| `member/MemberDetailClient.tsx` | Client | メンバー詳細ページの統合レイアウト（タブ + チャットサイドバー + ウィザード制御） |
| `member/ProfileTab.tsx` | Server | プロフィール表示（ヒーローヘッダー + 2列レイアウト） |
| `member/GoalsTab.tsx` | Client | 目標表示 + ウィザード起動ボタン |
| `member/OneOnOneTab.tsx` | Server | 1on1記録一覧表示 |
| `member/ReviewsTab.tsx` | Client | 評価表示（パスワードゲート + 評価カード + アコーディオン） |
| `chat/ChatSidebar.tsx` | Client | AIチャットパネル（クイックアクション + メッセージ履歴 + 目標保存） |
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
| `lib/fs/paths.ts` | ファイルパス定数（PROJECT_ROOT, DATA_ROOT, MEMBERS_DIR, SHARED_DIR, SHARED_DOCS） |
| `lib/fs/members.ts` | メンバーデータ読み取り（getMemberNames, getAllMemberSummaries, getMemberDetail, parseReview） |
| `lib/fs/shared-docs.ts` | 共有ドキュメント読み取り（loadSharedDocs） |
| `lib/parsers/profile.ts` | プロフィールパーサー（extractField, parseProjectLine, deriveTeamShort, parseProfile） |
| `lib/parsers/goals.ts` | 目標パーサー（parseGoals） |
| `lib/ai/call-claude.ts` | Claude API 呼び出し（Azure AI Foundry / Anthropic デュアルパス + hasApiKey） |
| `lib/mock/responses.ts` | モックレスポンス（キーワードマッチング + フォールバック） |
| `lib/prompts/diagnosis.ts` | 診断サマリー用プロンプト（buildDiagnosisSystemPrompt, buildDiagnosisUserMessage） |
| `lib/prompts/goal-generation.ts` | 目標生成用プロンプト（buildGoalGenerationSystemPrompt, buildGoalGenerationUserMessage） |

### 9.6 フック（`web-demo/src/hooks/`）

| ファイルパス | 役割 |
|------------|------|
| `hooks/useChat.ts` | チャット状態管理フック（messages, isLoading, mode, sendMessage, reset） |

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
| `data/members/{name}/one-on-one/` | 1on1記録（現時点では空） |
| `data/archive/` | 元データファイル群（xlsx, pptx, pdf） |

---

> 以上
