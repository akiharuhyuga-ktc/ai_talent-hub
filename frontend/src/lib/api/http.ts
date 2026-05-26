/**
 * fetch ラッパー。
 *
 * Tauri 環境では `@tauri-apps/plugin-http` の fetch（Rust 側 reqwest で実 HTTP を投げる）
 * を使い、WebView の CORS 制約を回避する。Web 環境では通常の `window.fetch` をそのまま
 * 使う（dev は Vite proxy、本番は同一オリジンの想定）。
 *
 * plugin-http は標準 fetch API 互換で `response.body` も ReadableStream を返すため、
 * 上位の SSE パーサ等はそのまま動く。
 */
import { isTauri } from "@/lib/data-store/detect";

type TauriHttpModule = typeof import("@tauri-apps/plugin-http");

let cachedTauriHttp: TauriHttpModule | null = null;

async function getTauriHttp(): Promise<TauriHttpModule> {
	if (!cachedTauriHttp) {
		cachedTauriHttp = await import("@tauri-apps/plugin-http");
	}
	return cachedTauriHttp;
}

export async function httpFetch(
	input: RequestInfo | URL,
	init?: RequestInit,
): Promise<Response> {
	if (isTauri()) {
		const { fetch: tauriFetch } = await getTauriHttp();
		return tauriFetch(input as string | URL, init);
	}
	return globalThis.fetch(input, init);
}
