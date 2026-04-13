import type { MemberDetail, MemberSummary } from "@/lib/types";

export const mockMembers: MemberSummary[] = [
	{
		name: "田中太郎",
		folderName: "tanaka-taro",
		role: "シニアエンジニア",
		team: "Flutter チーム",
		teamShort: "Flutter",
		joinedAt: "2022-04",
		projects: [
			{ name: "ECアプリ", april: 60, may: 60, june: 60, avgPct: 60 },
			{ name: "R＆D", april: 40, may: 40, june: 40, avgPct: 40 },
		],
		mainProject: "ECアプリ",
		rdPct: 40,
	},
	{
		name: "佐藤花子",
		folderName: "sato-hanako",
		role: "エンジニア",
		team: "Flutter チーム",
		teamShort: "Flutter",
		joinedAt: "2023-10",
		projects: [
			{ name: "ヘルスケアアプリ", april: 80, may: 80, june: 80, avgPct: 80 },
			{ name: "R＆D", april: 20, may: 20, june: 20, avgPct: 20 },
		],
		mainProject: "ヘルスケアアプリ",
		rdPct: 20,
	},
	{
		name: "鈴木一郎",
		folderName: "suzuki-ichiro",
		role: "リードエンジニア",
		team: "KMP チーム",
		teamShort: "KMP",
		joinedAt: "2021-04",
		projects: [
			{ name: "金融アプリ", april: 70, may: 70, june: 70, avgPct: 70 },
			{ name: "R＆D", april: 30, may: 30, june: 30, avgPct: 30 },
		],
		mainProject: "金融アプリ",
		rdPct: 30,
	},
	{
		name: "山田美咲",
		folderName: "yamada-misaki",
		role: "エンジニア",
		team: "KMP チーム",
		teamShort: "KMP",
		joinedAt: "2024-04",
		projects: [
			{ name: "物流アプリ", april: 100, may: 100, june: 100, avgPct: 100 },
		],
		mainProject: "物流アプリ",
		rdPct: 0,
	},
	{
		name: "高橋健太",
		folderName: "takahashi-kenta",
		role: "プロデューサー",
		team: "Producer チーム",
		teamShort: "Producer",
		joinedAt: "2020-10",
		projects: [
			{ name: "ECアプリ", april: 50, may: 50, june: 50, avgPct: 50 },
			{ name: "ヘルスケアアプリ", april: 50, may: 50, june: 50, avgPct: 50 },
		],
		mainProject: "ECアプリ",
		rdPct: 0,
	},
	{
		name: "伊藤直樹",
		folderName: "ito-naoki",
		role: "エンジニア",
		team: "Flutter チーム",
		teamShort: "Flutter",
		joinedAt: "2024-10",
		projects: [
			{ name: "教育アプリ", april: 90, may: 90, june: 90, avgPct: 90 },
			{ name: "R＆D", april: 10, may: 10, june: 10, avgPct: 10 },
		],
		mainProject: "教育アプリ",
		rdPct: 10,
	},
];

function buildMemberDetail(summary: MemberSummary): MemberDetail {
	return {
		...summary,
		skills: {
			technical: "Flutter / Dart, Kotlin, Swift",
			experience: "モバイルアプリ開発 3年",
			strengths: "UI実装の速度と品質",
			challenges: "アーキテクチャ設計の経験",
		},
		expectedRole: {
			current: "チーム内の技術リードとして設計判断を主導する",
			longTerm: "モバイルアーキテクトとして複数プロジェクトを横断的に支援",
		},
		rawMarkdown: "",
		goals: {
			period: "2026-h1",
			memberName: summary.name,
			rawMarkdown: `## 目標① （実行）：${summary.mainProject}の品質向上\n\n**達成基準:** ユニットテストカバレッジ80%以上\n\n**アクション:**\n- テスト戦略の策定\n- CI/CDパイプラインの整備\n\n## 目標② （挑戦）：技術発信の強化\n\n**達成基準:** 社内LT 2回以上実施\n\n**アクション:**\n- 月1回の技術ブログ投稿\n- チーム内勉強会の企画`,
		},
		goalsByPeriod: {
			"2026-h1": {
				period: "2026-h1",
				memberName: summary.name,
				rawMarkdown: `## 目標① （実行）：${summary.mainProject}の品質向上\n\n**達成基準:** ユニットテストカバレッジ80%以上\n\n**アクション:**\n- テスト戦略の策定\n- CI/CDパイプラインの整備\n\n## 目標② （挑戦）：技術発信の強化\n\n**達成基準:** 社内LT 2回以上実施\n\n**アクション:**\n- 月1回の技術ブログ投稿\n- チーム内勉強会の企画`,
			},
		},
		activePeriod: "2026-h1",
		oneOnOnes: [
			{
				filename: "2026-04.md",
				date: "2026-04",
				rawMarkdown:
					"## 前回アクション振り返り\n\n- テスト方針のドキュメント作成 → 完了\n\n## 今回の話題\n\n- プロジェクトの進捗は順調\n- 新メンバーのオンボーディングサポートについて相談\n\n## ネクストアクション\n\n- オンボーディング資料を作成する（5月末まで）",
			},
		],
		reviews: [
			{
				period: "2025年度下期",
				filename: "2025-h2.md",
				grade: "G3",
				roleName: "シニアエンジニア",
				h2Eval: "A",
				annualEval: "A",
				promotion: false,
				feedbackPoints:
					"プロジェクトの技術的リードとして安定したアウトプットを継続。\nコードレビューの質が高く、チーム全体の品質向上に貢献。",
				feedbackExpectations:
					"次期はアーキテクチャ設計にも挑戦し、より広い視野での技術判断を期待。",
				evaluatorComments: [
					{
						label: "一次評価",
						evaluator: "マネージャー",
						content:
							"安定した技術力でチームを支えている。次期はリード領域を広げてほしい。",
					},
				],
				rawMarkdown: "",
			},
		],
	};
}

export const mockMemberDetails: Record<string, MemberDetail> =
	Object.fromEntries(
		mockMembers.map((m) => [m.folderName, buildMemberDetail(m)]),
	);

// ---------------------------------------------------------------------------
// AI Mock Response Texts
// ---------------------------------------------------------------------------

export const MOCK_DIAGNOSIS_TEXT = `## 診断サマリー

**対象メンバー**: 田中太郎（シニアエンジニア / Flutter チーム）

### 強み
- UI実装の速度と品質に定評があり、プロジェクトの技術リードとして安定した成果を出している
- コードレビューを通じてチーム全体の品質向上に貢献

### 課題
- 個人作業に偏りがちで、チーム全体をリードする動きへの転換が求められる
- アーキテクチャ設計の経験が不足しており、より広い技術視野の獲得が必要

### 推奨目標の方向性
1. **実行目標**: プロジェクト品質の仕組み化（テスト戦略・CI/CD整備）
2. **挑戦目標**: チームリーダーシップの発揮（設計レビュー主導・技術方針策定）
3. **成長目標**: アーキテクチャ設計スキルの習得（社内勉強会・外部研修）`;

export const MOCK_GENERATED_GOALS = `## 目標①（実行）：ECアプリのテスト基盤構築と品質向上

**達成基準:** ユニットテストカバレッジ80%以上、CIパイプラインでの自動テスト実行

**アクション:**
- テスト戦略ドキュメントの策定（5月末まで）
- 主要モジュールのユニットテスト追加（6月末まで）
- CI/CDパイプラインへのテスト自動実行組み込み（7月末まで）

**検証方法:** カバレッジレポートの定期確認、CI成功率の推移

---

## 目標②（挑戦）：設計レビュー主導によるチームリーダーシップ発揮

**達成基準:** 週1回の設計レビュー会を主催し、チームの技術方針を文書化

**アクション:**
- 設計レビュー会のフォーマット策定（5月中旬まで）
- 週次設計レビューの実施・ファシリテーション
- 技術方針ドキュメントの作成・更新

**検証方法:** レビュー会の実施回数、方針ドキュメントの充実度

---

## 目標③（成長）：アーキテクチャ設計スキルの習得

**達成基準:** 社内LT 2回実施、アーキテクチャ提案書を1件作成

**アクション:**
- Clean Architecture / DDD に関する学習（継続）
- 月1回の社内LTでの発表
- 新規機能のアーキテクチャ提案書作成

**検証方法:** LT実施回数、提案書のレビュー結果`;

export const MOCK_EVALUATION_COMMENT = `## 総合評価コメント

田中太郎さんの今期の取り組みについて、各目標の達成状況と今後の期待をまとめます。

### 目標達成状況
- テスト基盤構築は計画通り進捗し、カバレッジ目標を達成
- 設計レビュー会の主催により、チーム内の技術議論が活性化
- アーキテクチャ学習は継続的に取り組んでおり、LTも実施済み

### 総合所見
技術面での安定した成果に加え、チームリーダーシップの面でも成長が見られた。次期はさらに広い範囲での技術判断を期待する。`;

export const MOCK_HEARING_QUESTIONS: { question: string; intent: string }[] = [
	{
		question: "今期の目標で最も手応えを感じた取り組みは何ですか？",
		intent: "成功体験の言語化と自己効力感の確認",
	},
	{
		question:
			"チーム内での役割について、自分自身ではどう変化したと感じていますか？",
		intent: "リーダーシップの自己認識を確認",
	},
	{
		question: "来期に向けて、最も成長したいスキルや領域はありますか？",
		intent: "本人のキャリア志向を把握し、次期目標に反映",
	},
	{
		question: "現在の業務フローで改善したいと感じている点はありますか？",
		intent: "業務課題の把握と組織改善への意欲確認",
	},
	{
		question:
			"マネージャーやチームに対して、サポートしてほしいことはありますか？",
		intent: "心理的安全性の確認と支援ニーズの把握",
	},
];

export const MOCK_OO_SUMMARY = `## 1on1 サマリー

### 話題のポイント
- プロジェクト進捗は順調で、テスト基盤構築のマイルストーンを予定通り達成
- 新メンバーのオンボーディングに積極的に関わっており、チーム貢献の意識が高い
- アーキテクチャ設計への関心が強まっており、来期の挑戦目標として検討したい

### コンディション
モチベーションは高く維持されている。業務量は適正範囲だが、レビュー対応が増加傾向。

### ネクストアクション
- オンボーディング資料の作成（5月末まで）→ 田中さん担当
- 設計レビュー会のフォーマット検討 → 田中さん・マネージャー共同
- 次回1on1でアーキテクチャ学習の進捗を確認`;

export const MOCK_POLICY_DIRECTION = `## 方針の方向性

### チームの現状分析
- Flutterチームは技術力の高いメンバーが揃い、各プロジェクトで安定した成果を出している
- 一方で、個人の技術力に依存する傾向があり、チーム全体での知見共有に課題がある

### 重点テーマ
1. **技術の組織化**: 個人の暗黙知をチームの形式知に変換する仕組みの構築
2. **品質基準の統一**: プロジェクト横断でのコード品質・テスト基準の標準化
3. **次世代リーダー育成**: 中堅メンバーのリーダーシップ機会の創出`;

export const MOCK_POLICY_DRAFT = `## 2026年度上期 チーム方針

### ビジョン
「個の技術力をチームの競争力に変える」

### 重点施策

#### 1. 技術知見の共有基盤構築
- 週次設計レビュー会の定例化
- 技術ドキュメントのテンプレート整備
- 月次社内LTの実施

#### 2. 品質基準の標準化
- コーディング規約の策定・レビュー
- テストカバレッジ基準の設定（全プロジェクト80%以上）
- CI/CDパイプラインの標準テンプレート提供

#### 3. リーダーシップ開発
- 技術リード候補者へのメンタリング
- プロジェクト横断レビューの実施
- 外部カンファレンスへの登壇支援

### 成功指標
- 設計レビュー会の月間実施回数: 4回以上
- テストカバレッジ平均: 80%以上
- 社内LT実施回数: 月1回以上`;

export const MOCK_ORG_POLICY = `# 組織方針（2026年度上期）

## ミッション
モバイルテクノロジーを通じて、クライアントのビジネス成長を加速させる。

## 重点方針
1. 技術力の組織化と標準化
2. メンバーの自律的成長の支援
3. クライアント満足度の向上

## 行動指針
- 品質に妥協しない
- 学び続ける文化を醸成する
- チームで成果を出す`;

export const MOCK_CRITERIA = `# 育成基準・評価基準

## グレード別期待役割

### G3（シニアエンジニア）
- チーム内の技術リードとして設計判断を主導
- コードレビューを通じたチーム品質の向上
- 後輩エンジニアの技術指導

### G4（リードエンジニア）
- プロジェクト全体のアーキテクチャ設計
- 複数チームを横断した技術支援
- 技術戦略の策定と推進

## 評価基準
- S: 期待を大幅に上回る成果
- A: 期待を上回る成果
- B: 期待通りの成果
- C: 期待をやや下回る
- D: 期待を大幅に下回る`;

export const MOCK_GUIDELINES = `# 運用ガイドライン

## 目標設定
- 目標は3つ設定する（実行・挑戦・成長）
- 各目標に達成基準とアクションプランを明記する
- SMARTの原則に基づいて設定する

## 1on1
- 月1回以上実施する
- コンディション確認を必ず含める
- ネクストアクションを設定して終了する

## 評価
- 半期ごとに実施
- 目標達成度とプロセスの両面で評価
- フィードバックは具体的なエピソードに基づく`;
