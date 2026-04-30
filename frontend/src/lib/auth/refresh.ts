import { getAuthConfig } from "./config";
import type { StoredTokens } from "./tokenStore";

interface AzureTokenSuccessRaw {
	access_token: string;
	refresh_token?: string;
	id_token?: string;
	expires_in: number;
}

export class RefreshError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RefreshError";
	}
}

export async function refreshAccessToken(
	current: StoredTokens,
): Promise<StoredTokens> {
	const cfg = getAuthConfig();
	const body = new URLSearchParams({
		grant_type: "refresh_token",
		client_id: cfg.clientId,
		refresh_token: current.refreshToken,
		scope: cfg.scope,
	});
	const res = await fetch(cfg.tokenEndpoint, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
	});
	if (!res.ok) {
		const text = await res.text();
		throw new RefreshError(`refresh に失敗: ${res.status} ${text}`);
	}
	const json = (await res.json()) as AzureTokenSuccessRaw;
	return {
		accessToken: json.access_token,
		refreshToken: json.refresh_token ?? current.refreshToken,
		idToken: json.id_token ?? current.idToken,
		expiresAt: Date.now() + json.expires_in * 1_000,
	};
}
