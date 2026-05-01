/**
 * デモ / dev モード用 AI 応答スタブの共通実装。
 *
 * ブラウザ dev (MSW handlers) と Tauri / 本番 demo (window.fetch ラッパ) の
 * 両方から参照される。クライアントが付与する `x-demo-use-case` ヘッダから
 * 用途別の固定応答テキストを引き、SSE ストリーム形式で返す。
 */
import { mockDb } from "./db";

export function createSSEStream(
	text: string,
	chunkSize = 20,
	delayMs = 50,
): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	let offset = 0;

	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			if (offset >= text.length) {
				controller.enqueue(encoder.encode("data: [DONE]\n\n"));
				controller.close();
				return;
			}
			const chunk = text.slice(offset, offset + chunkSize);
			offset += chunkSize;
			const payload = JSON.stringify({ text: chunk });
			controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
			await new Promise((r) => setTimeout(r, delayMs));
		},
	});
}

export function sseResponse(text: string): Response {
	return new Response(createSSEStream(text), {
		status: 200,
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	});
}

/**
 * `x-demo-use-case` ヘッダから対応する固定応答テキストを引く。
 * 該当がないキーは chat の既定応答にフォールバックする。
 */
export function lookupDemoText(useCase: string | null): string {
	switch (useCase) {
		case "diagnosis":
			return mockDb.getAiResponse("diagnosis") as string;
		case "goalGeneration":
		case "goalRefinement":
		case "goalEdit":
			return mockDb.getAiResponse("generatedGoals") as string;
		case "evalDraft":
		case "evalComment":
			return mockDb.getAiResponse("evaluationComment") as string;
		case "oneOnOneSummary":
			return mockDb.getAiResponse("oneOnOneSummary") as string;
		case "oneOnOneQuestions":
			return JSON.stringify(mockDb.getHearingQuestions());
		case "policyDirection":
			return mockDb.getAiResponse("policyDirection") as string;
		case "policyDraft":
		case "policyRefine":
			return mockDb.getAiResponse("policyDraft") as string;
		default:
			return mockDb.getAiResponse("chatDefault") as string;
	}
}
