/**
 * API 通信レイヤーの共有ヘルパ。
 *
 * `customInstance` (Axios) と AI 用 `sseFetch` の両方から参照される。
 * - 既存 API:    `Authorization: Bearer <JWT>` を customInstance interceptor で付与
 * - AI proxy: `X-Bizport-Authorization: Bearer <JWT>` + `x-amz-content-sha256`
 *               を sseFetch の buildHeaders で付与
 *
 * ヘッダ名や `x-amz-content-sha256` 計算は経路依存なので各呼び出し側に残し、
 * ここでは「ベース URL の解決」と「Bearer prefix 付き JWT の組み立て」だけを
 * 共通化している。
 */
import { getValidAccessToken } from "@/lib/auth/getValidAccessToken";

export function getApiBase(): string {
	return (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
}

/**
 * 有効な access token を取得して `Bearer ...` プレフィックスを付けて返す。
 * 未ログイン / refresh 失敗時は null。
 */
export async function getBearerAuth(): Promise<string | null> {
	const token = await getValidAccessToken();
	return token ? `Bearer ${token}` : null;
}
