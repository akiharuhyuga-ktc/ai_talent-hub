const clientId = import.meta.env.VITE_AZURE_CLIENT_ID as string | undefined;
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID as string | undefined;
const apiScope = import.meta.env.VITE_API_SCOPE as string | undefined;

export interface AuthConfig {
	clientId: string;
	tenantId: string;
	deviceCodeEndpoint: string;
	tokenEndpoint: string;
	scope: string;
}

export function isAuthConfigured(): boolean {
	return Boolean(clientId && tenantId);
}

export function getAuthConfig(): AuthConfig {
	if (!clientId || !tenantId) {
		throw new Error(
			"Azure AD の設定が見つかりません。.env.local に VITE_AZURE_CLIENT_ID と VITE_AZURE_TENANT_ID を設定してください。",
		);
	}
	// Microsoft の /devicecode は CORS を許可していないため、ブラウザからは直接叩けない。
	// dev では Vite の proxy を経由する（vite.config.ts の "/auth/ms" ルール）。
	// 本番（Tauri）では Rust 側 or バックエンドプロキシで中継する想定。
	const authority = `/auth/ms/${tenantId}`;
	const scope = ["openid", "profile", "offline_access", apiScope]
		.filter(Boolean)
		.join(" ");
	return {
		clientId,
		tenantId,
		deviceCodeEndpoint: `${authority}/oauth2/v2.0/devicecode`,
		tokenEndpoint: `${authority}/oauth2/v2.0/token`,
		scope,
	};
}
