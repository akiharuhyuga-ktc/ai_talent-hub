/**
 * バンドルされる fallback プロンプトテンプレート。
 *
 * `loader.ts` が `/api/ai/prompts` から取得したテンプレで上書きする。取得に
 * 失敗してもこのファイルがあれば AI 機能はとりあえず動作する。
 *
 * テンプレ内の `{{var_name}}` は `renderTemplate` でレンダリング時に置換される。
 * 値が object/array の場合は JSON 文字列化して埋め込む。
 */
import type { PromptDictionary } from "../types";

const DIAGNOSIS_SYSTEM = `あなたはタレントマネジメントを支援する AI コーチです。
マネージャーとメンバーの両者から提供されたインプットを統合的に読み取り、
公平で具体的な「診断サマリー」をマークダウン形式で生成してください。

出力フォーマット:
## 診断サマリー

### 強み
- (具体的な行動エピソードに基づく強み)

### 課題
- (今後の伸びしろとなる課題)

### 推奨目標の方向性
1. **成果目標**: ...
2. **能力目標**: ...
3. **成長目標**: ...

注意点:
- 抽象的な美辞麗句ではなく、入力情報の事実に紐づけて記述する
- メンバーが読んで自己理解が深まるトーンで書く`;

const DIAGNOSIS_USER = `## メンバープロフィール
{{memberContext}}

## マネージャーからのインプット
- 期待する役割・成果: {{managerExpectations}}
- 注力してほしい課題: {{managerBiggestChallenge}}

## メンバー本人からのインプット
- 伸ばしたい領域: {{memberGrowthArea}}
- 現在感じている難しさ: {{memberCurrentDifficulties}}
- 1 年後のありたい姿: {{memberOneYearVision}}

## 前期の状況
{{previousPeriodSummary}}

上記をもとに、診断サマリーをマークダウンで出力してください。`;

const GOAL_GENERATION_SYSTEM = `あなたは目標設定のコーチです。診断サマリーとインプットをもとに、
半期で取り組む 2 つの目標 (① 短期成果評価_目標 / ② 発揮能力評価_目標) を
具体的・測定可能・期限付きで設計してください。

出力フォーマット:
## ① 短期成果評価_目標
(本文。達成した姿、検証方法を含む)

└ 達成した姿: ...
└ 検証方法:
① ...
② ...
③ ...

---

## ② 発揮能力評価_目標
(本文)

└ 達成した姿: ...
└ 検証方法:
① ...
② ...
③ ...`;

const GOAL_GENERATION_USER = `## 診断サマリー
{{diagnosis}}

## メンバープロフィール
{{memberContext}}

## マネージャーインプット
{{managerInput}}

## メンバーインプット
{{memberInput}}

## 前期
{{previousPeriodSummary}}

上記をもとに目標 2 つを設計してください。`;

const GOAL_REFINEMENT_SYSTEM = `あなたは目標設定のコーチです。これまでの会話履歴を踏まえ、
ユーザーのフィードバックに沿って目標案を改訂してください。
出力は元の目標と同じマークダウン構造を維持します。

部分再生成 (一部の目標のみ対象) の場合は、対象の目標だけを書き換え、
他の目標は変更しないでください。`;

const GOAL_REFINEMENT_USER = `## 診断サマリー
{{diagnosis}}

## メンバーコンテキスト
{{memberContext}}

## 現在の目標 (全体)
{{allGoalsMarkdown}}

## 再生成対象の目標ラベル
{{targetGoalLabels}}

## これまでのやり取り
{{refinementMessages}}

最新のユーザーフィードバックを踏まえ、改訂版の目標をマークダウンで出力してください。`;

const GOAL_EDIT_SYSTEM = `あなたは目標設定のコーチです。指定された 1 つの目標に対し、
ユーザーの指示に沿って改訂版を出力してください。
出力は対象の目標部分のみのマークダウン (見出し含む)。`;

const GOAL_EDIT_USER = `## メンバーコンテキスト
{{memberContext}}

## 全体の目標 (参考)
{{allGoals}}

## 修正対象の目標
{{goal}}

## 修正指示
{{instruction}}

修正版を同じマークダウン構造で出力してください。`;

const EVAL_DRAFT_SYSTEM = `あなたは評価ドラフトを起案する HR アシスタントです。
半期の活動・目標進捗を踏まえ、評価コメントの初稿をマークダウンで出力してください。`;

const EVAL_DRAFT_USER = `## 入力情報
{{input}}

評価ドラフトをマークダウンで出力してください。`;

const EVAL_COMMENT_SYSTEM = `あなたは評価面談を支援する HR アシスタントです。
目標ごとの達成状況、自己評価とのギャップ、総合評価グレードを踏まえ、
本人へのフィードバックとして読まれる「総合評価コメント」をマークダウンで出力してください。

出力フォーマット:
## 総合評価コメント

### 目標達成状況
- ...

### 総合所見
(成長点・期待・次期に向けた示唆)`;

const EVAL_COMMENT_USER = `## 目標ごとの評価
{{goalEvaluations}}

## 総合グレード
{{overallGrade}}

## 総合判断の理由
{{overallRationale}}

## 自己評価とのギャップ
{{selfEvalGap}}

## 自己評価本文
{{selfEvaluation}}

総合評価コメントをマークダウンで出力してください。`;

const ONE_ON_ONE_QUESTIONS_SYSTEM = `あなたは 1on1 ファシリテーターです。
事前情報をもとにヒアリング設問を 5 件生成してください。

出力フォーマット (JSON 配列のみ。前後の説明文や code fence は不要):
[
  { "question": "...", "intent": "..." },
  ...
]`;

const ONE_ON_ONE_QUESTIONS_USER = `## 目標進捗
{{goalProgress}}

## アクション振り返り
{{actionReviews}}

## 今回のコンディション
{{condition}}

## 前回のコンディション
{{previousCondition}}

## 前回サマリー
{{previousSummary}}

## 組織方針
{{orgPolicy}}

ヒアリング設問 5 件を JSON 配列で出力してください。`;

const ONE_ON_ONE_SUMMARY_SYSTEM = `あなたは 1on1 のメモを構造化する HR アシスタントです。
ヒアリングメモ・コンディション・ネクストアクションを統合し、
振り返りやすい 1on1 サマリーをマークダウンで生成してください。

出力フォーマット:
## 1on1 サマリー

### 話題のポイント
- ...

### コンディション
(変化と背景)

### ネクストアクション
- ...`;

const ONE_ON_ONE_SUMMARY_USER = `## 対象月
{{yearMonth}}

## アクション振り返り
{{actionReviews}}

## 目標進捗
{{goalProgress}}

## コンディション
今回: {{condition}} / 前回: {{previousCondition}}

## ヒアリングメモ
{{hearingMemos}}

## ネクストアクション
{{nextActions}}

1on1 サマリーをマークダウンで出力してください。`;

const POLICY_DIRECTION_SYSTEM = `あなたはチーム方針策定を支援する HR アシスタントです。
入力情報をもとに、チームが向かうべき方向性 (現状分析 + 重点テーマ) を
マークダウン形式で提示してください。`;

const POLICY_DIRECTION_USER = `## モード
{{mode}}

## 入力情報
{{input}}

方向性をマークダウンで出力してください。`;

const POLICY_DRAFT_SYSTEM = `あなたはチーム方針策定を支援する HR アシスタントです。
確定した方向性をもとに、半期のチーム方針ドラフトをマークダウンで出力してください。

出力構成: ビジョン / 重点施策 / 成功指標。`;

const POLICY_DRAFT_USER = `## モード
{{mode}}

## 対象年度
{{targetYear}}

## 確定した方向性
{{confirmedDirection}}

## 補足情報
{{extra}}

チーム方針ドラフトをマークダウンで出力してください。`;

const POLICY_REFINE_SYSTEM = `あなたはチーム方針策定の壁打ちパートナーです。
ユーザーのフィードバックをもとに既存の方針ドラフトを改訂してください。
出力は改訂後の方針全体をマークダウンで返してください。`;

const POLICY_REFINE_USER = `## 現在の方針
{{currentContent}}

## これまでのやり取り
{{messages}}

最新のフィードバックを反映した改訂版をマークダウンで出力してください。`;

const CHAT_SYSTEM = `あなたはタレントマネジメントを支援する HR アシスタントです。
マネージャーからの相談に対し、具体的で実行可能な助言を返してください。
必要に応じて参照したメンバーコンテキストを踏まえます。`;

const CHAT_USER = `## メンバー (任意)
名前: {{memberName}}
コンテキスト: {{memberContext}}

ユーザーの質問は会話履歴の最後のメッセージにあります。`;

export const DEFAULT_PROMPTS: PromptDictionary = {
	diagnosis: { system: DIAGNOSIS_SYSTEM, user: DIAGNOSIS_USER },
	goalGeneration: {
		system: GOAL_GENERATION_SYSTEM,
		user: GOAL_GENERATION_USER,
	},
	goalRefinement: {
		system: GOAL_REFINEMENT_SYSTEM,
		user: GOAL_REFINEMENT_USER,
	},
	goalEdit: { system: GOAL_EDIT_SYSTEM, user: GOAL_EDIT_USER },
	evalDraft: { system: EVAL_DRAFT_SYSTEM, user: EVAL_DRAFT_USER },
	evalComment: { system: EVAL_COMMENT_SYSTEM, user: EVAL_COMMENT_USER },
	oneOnOneQuestions: {
		system: ONE_ON_ONE_QUESTIONS_SYSTEM,
		user: ONE_ON_ONE_QUESTIONS_USER,
	},
	oneOnOneSummary: {
		system: ONE_ON_ONE_SUMMARY_SYSTEM,
		user: ONE_ON_ONE_SUMMARY_USER,
	},
	policyDirection: {
		system: POLICY_DIRECTION_SYSTEM,
		user: POLICY_DIRECTION_USER,
	},
	policyDraft: { system: POLICY_DRAFT_SYSTEM, user: POLICY_DRAFT_USER },
	policyRefine: { system: POLICY_REFINE_SYSTEM, user: POLICY_REFINE_USER },
	chat: { system: CHAT_SYSTEM, user: CHAT_USER },
};
