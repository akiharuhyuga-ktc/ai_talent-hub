import { invoke } from "@tauri-apps/api/core";
import { getAuthConfig } from "../config";
import type { AuthStrategy, LoginArgs } from "../strategy";
import type { StoredTokens } from "../tokenStore";

interface LoginInvokeArgs {
	clientId: string;
	tenantId: string;
	scope: string;
}

interface RefreshInvokeArgs extends LoginInvokeArgs {
	refreshToken: string;
}

export class TauriLoopbackStrategy implements AuthStrategy {
	async login({ onState, signal }: LoginArgs): Promise<StoredTokens> {
		const cfg = getAuthConfig();
		onState({ phase: "waiting-browser" });
		return raceWithAbort(
			invoke<StoredTokens>("auth_login", {
				clientId: cfg.clientId,
				tenantId: cfg.tenantId,
				scope: cfg.scope,
			} satisfies LoginInvokeArgs),
			signal,
		);
	}

	async refresh(current: StoredTokens): Promise<StoredTokens> {
		const cfg = getAuthConfig();
		return invoke<StoredTokens>("auth_refresh", {
			clientId: cfg.clientId,
			tenantId: cfg.tenantId,
			scope: cfg.scope,
			refreshToken: current.refreshToken,
		} satisfies RefreshInvokeArgs);
	}
}

// Tauri 2 の invoke は AbortSignal を直接サポートしない。
// Rust 側の loopback server は AUTHORIZE_TIMEOUT_SECS で必ず終了するので、
// 中断時はフロントで早期に reject し、後から届く結果は破棄する。
function raceWithAbort<T>(
	promise: Promise<T>,
	signal: AbortSignal,
): Promise<T> {
	if (signal.aborted) return Promise.reject(new Error("中断されました"));
	return new Promise<T>((resolve, reject) => {
		const onAbort = () => reject(new Error("中断されました"));
		signal.addEventListener("abort", onAbort, { once: true });
		promise.then(
			(value) => {
				signal.removeEventListener("abort", onAbort);
				resolve(value);
			},
			(err) => {
				signal.removeEventListener("abort", onAbort);
				reject(err);
			},
		);
	});
}
