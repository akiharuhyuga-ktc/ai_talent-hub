/**
 * AI クライアント / プロンプト関連の共通型。
 *
 * API 契約に紐づく型 (AnthropicMessage / AnthropicInvokeRequest / PromptBundle /
 * PromptTemplate) は openapi.json から orval が生成する型を流用する。フロント
 * 内部のみで使う `PromptKey` などはここで補強する。
 */
import type {
	AnthropicInvokeRequest,
	AnthropicMessage,
	PromptBundle,
	PromptTemplate,
} from "@/api/generated/types";

export type {
	AnthropicInvokeRequest,
	AnthropicMessage,
	PromptBundle,
	PromptTemplate,
};

/**
 * アプリ内で扱うテンプレキーの type-safe union。
 *
 * spec (PromptBundle.templates) は `{[key: string]: PromptTemplate}` として
 * 任意キーを許容するが、フロント側の呼び出しは決まった用途しか無いのでここで
 * union として絞り、typo を防ぐ。
 */
export type PromptKey =
	| "diagnosis"
	| "goalGeneration"
	| "goalRefinement"
	| "goalEdit"
	| "evalDraft"
	| "evalComment"
	| "oneOnOneQuestions"
	| "oneOnOneSummary"
	| "policyDirection"
	| "policyDraft"
	| "policyRefine"
	| "chat";

export type PromptDictionary = Record<PromptKey, PromptTemplate>;
