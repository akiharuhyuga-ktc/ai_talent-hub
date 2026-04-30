import { refreshAccessToken } from "./refresh";
import {
	clearTokens,
	getTokens,
	isExpired,
	type StoredTokens,
	saveTokens,
} from "./tokenStore";

let inflightRefresh: Promise<StoredTokens | null> | null = null;

/**
 * 期限内なら現在のアクセストークン、期限切れなら refresh を試みる。
 * refresh も失敗した場合は localStorage をクリアして null を返す。
 * 同時呼び出しは 1 本にデデュープする。
 */
export async function getValidAccessToken(): Promise<string | null> {
	const current = getTokens();
	if (!current) return null;
	if (!isExpired(current)) return current.accessToken;

	if (!inflightRefresh) {
		inflightRefresh = refreshAccessToken(current)
			.then((next) => {
				saveTokens(next);
				return next;
			})
			.catch(() => {
				clearTokens();
				return null;
			})
			.finally(() => {
				inflightRefresh = null;
			});
	}
	const refreshed = await inflightRefresh;
	return refreshed?.accessToken ?? null;
}
