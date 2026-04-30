import type { StoredTokens } from "./tokenStore";

export type AuthFlowState =
	| { phase: "idle" }
	| { phase: "starting" }
	| {
			phase: "device-code";
			userCode: string;
			verificationUri: string;
			message: string;
	  }
	| { phase: "waiting-browser" }
	| { phase: "error"; message: string };

export interface LoginArgs {
	onState: (state: AuthFlowState) => void;
	signal: AbortSignal;
}

export interface AuthStrategy {
	login(args: LoginArgs): Promise<StoredTokens>;
	refresh(current: StoredTokens): Promise<StoredTokens>;
}

let cached: AuthStrategy | null = null;
let inflight: Promise<AuthStrategy> | null = null;

// Tauri バンドルでは Vite proxy が消えるため Rust 側の loopback フローに切り替える。
// build-time に判定し、片方の実装を tree-shake で落とす。
export function getAuthStrategy(): Promise<AuthStrategy> {
	if (cached) return Promise.resolve(cached);
	if (!inflight) {
		inflight = loadStrategy().then((s) => {
			cached = s;
			return s;
		});
	}
	return inflight;
}

async function loadStrategy(): Promise<AuthStrategy> {
	// 後続 PR で Tauri 環境向けに loopback strategy をここに追加する。
	const mod = await import("./strategies/deviceCode");
	return new mod.DeviceCodeStrategy();
}
