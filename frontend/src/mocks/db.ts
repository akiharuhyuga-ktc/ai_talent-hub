/**
 * MockDatabase — AI 応答モックと組織ドキュメントのみを提供する in-memory ストア
 *
 * Phase 2 時点の役割:
 *   - Members / Goals / OneOnOnes / Reviews は dataStore (data/v1 ファイル) が master。本クラスは触らない。
 *   - AI 応答モックと組織ドキュメントは default-responses.ts を既定値とし、
 *     data/ai-responses.json / data/org-docs.json があれば上書きする
 *   - localStorage は使用しない（永続化は dataStore 側で FS に書き込む）
 *
 * 将来: AI 応答もバックエンドに移す段階で本クラスは不要になる
 */

import {
	type AiResponses,
	DEFAULT_AI_RESPONSES,
	DEFAULT_ORG_DOCS,
	type OrgDocs,
} from "./default-responses";

// ---------------------------------------------------------------------------
// ローカル上書きファイルの読み込み
//
// data/ai-responses.json / data/org-docs.json があれば既定値を上書きする。
// これらは frontend/src/mocks/data/ に置かれる想定で、無くても動作する。
// ---------------------------------------------------------------------------

const aiResponsesModules = import.meta.glob<AiResponses>(
	"./data/ai-responses.json",
	{ eager: true, import: "default" },
);
const orgDocsModules = import.meta.glob<OrgDocs>("./data/org-docs.json", {
	eager: true,
	import: "default",
});

const loadedAiResponses =
	Object.values(aiResponsesModules)[0] ?? DEFAULT_AI_RESPONSES;
const loadedOrgDocs = Object.values(orgDocsModules)[0] ?? DEFAULT_ORG_DOCS;

function deepClone<T>(obj: T): T {
	return JSON.parse(JSON.stringify(obj));
}

class MockDatabase {
	private aiResponses: AiResponses;
	private orgDocs: OrgDocs;

	constructor() {
		this.aiResponses = deepClone(loadedAiResponses);
		this.orgDocs = deepClone(loadedOrgDocs);
		// 旧形式の localStorage が残っていたら破棄する（Phase 2 以降は不使用）
		try {
			localStorage.removeItem("mockDb");
		} catch {
			// localStorage が使えない環境 (SSR 等) では無視
		}
	}

	getAiResponse(key: keyof AiResponses): unknown {
		return this.aiResponses[key];
	}

	getHearingQuestions(): { question: string; intent: string }[] {
		return this.aiResponses.hearingQuestions;
	}

	getOrgDocs(): OrgDocs {
		return this.orgDocs;
	}
}

export const mockDb = new MockDatabase();
