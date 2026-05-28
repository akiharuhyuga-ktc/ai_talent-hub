/**
 * AI クライアント — 用途別の関数群。
 *
 * 各関数はドメイン JSON を受け取り、プロンプトテンプレを取得 → レンダリング →
 * `aiSseRun` で proxy に投げる、という薄いラッパ。フロント側コンポーネントは
 * これを呼ぶだけで AI ストリーミングを使えるようにする。
 */
import type { HearingQuestionItem } from "@/api/generated/types";
import type { ActionItem } from "@/lib/types";
import { getPrompt, renderTemplate } from "./prompts/loader";
import { aiSseRun } from "./sseFetch";
import type { AnthropicMessage, PromptKey } from "./types";

export type StreamHandler = (cumulative: string) => void;

interface BaseOpts {
	signal?: AbortSignal;
	onText?: StreamHandler;
}

// ---------------------------------------------------------------------------
// Goal Wizard
// ---------------------------------------------------------------------------

export interface DiagnosisArgs {
	memberContext: string;
	managerInput: { expectations: string; biggestChallenge: string };
	memberInput: {
		growthArea: string;
		currentDifficulties: string;
		oneYearVision: string;
	};
	previousPeriod?: {
		previousGoals: string;
		achievementLevel?: string;
		reasonIfNotAchieved?: string;
	};
}

export function requestDiagnosis(
	args: DiagnosisArgs,
	opts: BaseOpts,
): Promise<string> {
	return runSinglePrompt("diagnosis", opts, {
		memberContext: args.memberContext,
		managerExpectations: args.managerInput.expectations,
		managerBiggestChallenge: args.managerInput.biggestChallenge,
		memberGrowthArea: args.memberInput.growthArea,
		memberCurrentDifficulties: args.memberInput.currentDifficulties,
		memberOneYearVision: args.memberInput.oneYearVision,
		previousPeriodSummary: args.previousPeriod
			? formatPreviousPeriod(args.previousPeriod)
			: "(前期情報なし / 新規メンバー)",
	});
}

export interface GoalGenerationArgs extends DiagnosisArgs {
	diagnosis: string;
}

export function requestGoalGeneration(
	args: GoalGenerationArgs,
	opts: BaseOpts,
): Promise<string> {
	return runSinglePrompt("goalGeneration", opts, {
		diagnosis: args.diagnosis,
		memberContext: args.memberContext,
		managerInput: args.managerInput,
		memberInput: args.memberInput,
		previousPeriodSummary: args.previousPeriod
			? formatPreviousPeriod(args.previousPeriod)
			: "(前期情報なし / 新規メンバー)",
	});
}

export interface GoalRefinementArgs {
	diagnosis: string;
	memberContext: string;
	allGoalsMarkdown: string;
	targetGoalLabels?: string[];
	refinementMessages: AnthropicMessage[];
}

export function requestGoalRefinement(
	args: GoalRefinementArgs,
	opts: BaseOpts,
): Promise<string> {
	const tmpl = getPrompt("goalRefinement");
	const userIntro = renderTemplate(tmpl.user, {
		diagnosis: args.diagnosis,
		memberContext: args.memberContext,
		allGoalsMarkdown: args.allGoalsMarkdown,
		targetGoalLabels: args.targetGoalLabels?.join(", ") ?? "(全体を再生成)",
		refinementMessages: "(下記 messages に格納)",
	});

	const messages: AnthropicMessage[] = [
		{ role: "user", content: userIntro },
		...args.refinementMessages,
	];

	return aiSseRun({
		messages,
		system: tmpl.system,
		signal: opts.signal,
		onText: opts.onText,
		demoKey: "goalRefinement",
	});
}

export interface GoalEditArgs {
	memberContext: string;
	allGoals: string;
	goal: {
		index: number;
		label: string;
		type: string;
		title: string;
		content: string;
	};
	instruction: string;
}

export function requestGoalEdit(
	args: GoalEditArgs,
	opts: BaseOpts,
): Promise<string> {
	return runSinglePrompt("goalEdit", opts, {
		memberContext: args.memberContext,
		allGoals: args.allGoals,
		goal: args.goal,
		instruction: args.instruction,
	});
}

// ---------------------------------------------------------------------------
// Evaluation Wizard
// ---------------------------------------------------------------------------

export interface EvalDraftArgs {
	input: unknown;
}

export function requestEvalDraft(
	args: EvalDraftArgs,
	opts: BaseOpts,
): Promise<string> {
	return runSinglePrompt("evalDraft", opts, { input: args.input });
}

export interface EvalCommentArgs {
	goalEvaluations: unknown;
	overallGrade: string;
	overallRationale: string;
	selfEvalGap: string;
	selfEvaluation: unknown;
}

export function requestEvalComment(
	args: EvalCommentArgs,
	opts: BaseOpts,
): Promise<string> {
	return runSinglePrompt("evalComment", opts, {
		goalEvaluations: args.goalEvaluations,
		overallGrade: args.overallGrade,
		overallRationale: args.overallRationale,
		selfEvalGap: args.selfEvalGap,
		selfEvaluation: args.selfEvaluation,
	});
}

// ---------------------------------------------------------------------------
// 1on1 Wizard
// ---------------------------------------------------------------------------

export interface OneOnOneQuestionsArgs {
	goalProgress: unknown;
	actionReviews: unknown;
	condition: unknown;
	previousCondition: unknown;
	previousSummary: string;
	orgPolicy: string;
}

export async function requestOneOnOneQuestions(
	args: OneOnOneQuestionsArgs,
	opts?: Omit<BaseOpts, "onText">,
): Promise<HearingQuestionItem[]> {
	const fullText = await runSinglePrompt(
		"oneOnOneQuestions",
		{ signal: opts?.signal },
		{
			goalProgress: args.goalProgress,
			actionReviews: args.actionReviews,
			condition: args.condition,
			previousCondition: args.previousCondition,
			previousSummary: args.previousSummary || "(初回)",
			orgPolicy: args.orgPolicy || "(未設定)",
		},
	);
	return parseHearingQuestions(fullText);
}

export interface OneOnOneNextActionsArgs {
	goalProgress: unknown;
	actionReviews: unknown;
	condition: unknown;
	hearingMemos: unknown;
	previousSummary: string;
}

export async function requestOneOnOneNextActions(
	args: OneOnOneNextActionsArgs,
	opts?: Omit<BaseOpts, "onText">,
): Promise<ActionItem[]> {
	const fullText = await runSinglePrompt(
		"oneOnOneNextActions",
		{ signal: opts?.signal },
		{
			goalProgress: args.goalProgress,
			actionReviews: args.actionReviews,
			condition: args.condition,
			hearingMemos: args.hearingMemos,
			previousSummary: args.previousSummary || "(初回)",
		},
	);
	return parseNextActions(fullText);
}

export interface OneOnOneSummaryArgs {
	yearMonth: string;
	actionReviews: unknown;
	goalProgress: unknown;
	condition: unknown;
	previousCondition: unknown;
	hearingMemos: unknown;
	nextActions: unknown;
}

export function requestOneOnOneSummary(
	args: OneOnOneSummaryArgs,
	opts: BaseOpts,
): Promise<string> {
	return runSinglePrompt("oneOnOneSummary", opts, {
		yearMonth: args.yearMonth,
		actionReviews: args.actionReviews,
		goalProgress: args.goalProgress,
		condition: args.condition,
		previousCondition: args.previousCondition,
		hearingMemos: args.hearingMemos,
		nextActions: args.nextActions,
	});
}

// ---------------------------------------------------------------------------
// Policy Wizard
// ---------------------------------------------------------------------------

export interface PolicyDirectionArgs {
	mode: string;
	input: unknown;
}

export function requestPolicyDirection(
	args: PolicyDirectionArgs,
	opts: BaseOpts,
): Promise<string> {
	return runSinglePrompt("policyDirection", opts, {
		mode: args.mode,
		input: args.input,
	});
}

export interface PolicyDraftArgs {
	mode: string;
	targetYear: string;
	confirmedDirection: string;
	extra?: unknown;
}

export function requestPolicyDraft(
	args: PolicyDraftArgs,
	opts: BaseOpts,
): Promise<string> {
	return runSinglePrompt("policyDraft", opts, {
		mode: args.mode,
		targetYear: args.targetYear,
		confirmedDirection: args.confirmedDirection,
		extra: args.extra ?? "(なし)",
	});
}

export interface PolicyRefineArgs {
	currentContent: string;
	messages: AnthropicMessage[];
}

export function requestPolicyRefine(
	args: PolicyRefineArgs,
	opts: BaseOpts,
): Promise<string> {
	const tmpl = getPrompt("policyRefine");
	const userIntro = renderTemplate(tmpl.user, {
		currentContent: args.currentContent,
		messages: "(下記 messages に格納)",
	});

	return aiSseRun({
		messages: [{ role: "user", content: userIntro }, ...args.messages],
		system: tmpl.system,
		signal: opts.signal,
		onText: opts.onText,
		demoKey: "policyRefine",
	});
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatArgs {
	messages: AnthropicMessage[];
	memberName?: string;
	memberContext?: string;
}

export function requestChat(args: ChatArgs, opts: BaseOpts): Promise<string> {
	const tmpl = getPrompt("chat");
	const userIntro = renderTemplate(tmpl.user, {
		memberName: args.memberName ?? "(指定なし)",
		memberContext: args.memberContext ?? "(指定なし)",
	});

	return aiSseRun({
		messages: [
			{ role: "user", content: userIntro },
			{
				role: "assistant",
				content: "了解しました。質問をどうぞ。",
			},
			...args.messages,
		],
		system: tmpl.system,
		signal: opts.signal,
		onText: opts.onText,
		demoKey: "chat",
	});
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function runSinglePrompt(
	key: PromptKey,
	opts: BaseOpts,
	vars: Record<string, unknown>,
): Promise<string> {
	const tmpl = getPrompt(key);
	const userPrompt = renderTemplate(tmpl.user, vars);
	return aiSseRun({
		messages: [{ role: "user", content: userPrompt }],
		system: tmpl.system,
		signal: opts.signal,
		onText: opts.onText,
		demoKey: key,
	});
}

function formatPreviousPeriod(p: {
	previousGoals: string;
	achievementLevel?: string;
	reasonIfNotAchieved?: string;
}): string {
	const lines = [`目標: ${p.previousGoals}`];
	if (p.achievementLevel) lines.push(`達成度: ${p.achievementLevel}`);
	if (p.reasonIfNotAchieved) lines.push(`未達理由: ${p.reasonIfNotAchieved}`);
	return lines.join("\n");
}

function parseHearingQuestions(text: string): HearingQuestionItem[] {
	const trimmed = stripCodeFence(text).trim();
	const start = trimmed.indexOf("[");
	const end = trimmed.lastIndexOf("]");
	if (start < 0 || end <= start) return [];
	try {
		const arr = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
		if (!Array.isArray(arr)) return [];
		return arr
			.filter((x): x is HearingQuestionItem => {
				if (!x || typeof x !== "object") return false;
				const obj = x as Record<string, unknown>;
				return (
					typeof obj.question === "string" && typeof obj.intent === "string"
				);
			})
			.slice(0, 10);
	} catch {
		return [];
	}
}

function parseNextActions(text: string): ActionItem[] {
	const trimmed = stripCodeFence(text).trim();
	const start = trimmed.indexOf("[");
	const end = trimmed.lastIndexOf("]");
	if (start < 0 || end <= start) return [];
	try {
		const arr = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
		if (!Array.isArray(arr)) return [];
		return arr
			.filter((x): x is ActionItem => {
				if (!x || typeof x !== "object") return false;
				const obj = x as Record<string, unknown>;
				return (
					typeof obj.content === "string" &&
					["manager", "member", "both"].includes(obj.assignee as string) &&
					typeof obj.deadline === "string"
				);
			})
			.slice(0, 5);
	} catch {
		return [];
	}
}

function stripCodeFence(text: string): string {
	return text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, "$1");
}
