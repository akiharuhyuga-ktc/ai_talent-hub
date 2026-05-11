/**
 * プロンプトテンプレを `/api/ai/prompts` から取得し、フロント内のメモリと
 * localStorage にキャッシュする。stale-while-revalidate 方式:
 *
 *  1. 起動時 (initPrompts): localStorage 復元 → 裏で fetch
 *  2. AI 呼び出し時 (getPrompt): メモリ上の値を即返す
 *  3. fetch 成功時: メモリと localStorage を更新 (次回呼び出しから反映)
 *
 * fetch 失敗時はバンドルされた DEFAULT_PROMPTS で動作継続する。
 */
import { getApiBase, getBearerAuth } from "@/lib/api/config";
import type {
	PromptBundle,
	PromptDictionary,
	PromptKey,
	PromptTemplate,
} from "../types";
import { DEFAULT_PROMPTS } from "./defaults";

const CACHE_KEY = "talent-hub.prompts.v1";

let cached: PromptDictionary = DEFAULT_PROMPTS;
let initialized = false;

export function initPrompts(): void {
	if (initialized) return;
	initialized = true;

	const stored = readLocalCache();
	if (stored) cached = { ...DEFAULT_PROMPTS, ...stored.templates };

	void refreshPrompts();
}

export function getPrompt(key: PromptKey): PromptTemplate {
	return cached[key] ?? DEFAULT_PROMPTS[key];
}

export async function refreshPrompts(): Promise<void> {
	const base = getApiBase();
	if (!base) return;

	const auth = await getBearerAuth();
	if (!auth) return;

	try {
		const res = await fetch(`${base}/api/ai/prompts`, {
			headers: { "X-Bizport-Authorization": auth },
		});
		if (!res.ok) return;
		const json = (await res.json()) as PromptBundle;
		if (!json?.templates) return;

		cached = { ...DEFAULT_PROMPTS, ...json.templates };
		writeLocalCache({ version: json.version, templates: cached });
	} catch {
		// 失敗時はメモリの既存値 (= 起動時に復元したキャッシュ or DEFAULT) を維持
	}
}

/**
 * テンプレ内の `{{var}}` を vars[var] で置換する。
 * - undefined / null は空文字
 * - 文字列はそのまま
 * - その他 (object/array/number 等) は JSON.stringify (整形あり)
 */
export function renderTemplate(
	template: string,
	vars: Record<string, unknown>,
): string {
	return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
		const value = vars[key];
		if (value == null) return "";
		if (typeof value === "string") return value;
		try {
			return JSON.stringify(value, null, 2);
		} catch {
			return String(value);
		}
	});
}

function readLocalCache(): PromptBundle | null {
	if (typeof localStorage === "undefined") return null;
	const raw = localStorage.getItem(CACHE_KEY);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as PromptBundle;
		if (!parsed?.templates) return null;
		return parsed;
	} catch {
		return null;
	}
}

function writeLocalCache(bundle: PromptBundle): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify(bundle));
	} catch {
		// quota 等
	}
}
