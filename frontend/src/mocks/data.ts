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
