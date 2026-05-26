import { isTauri } from "@/lib/data-store/detect";
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
// build-time に `import.meta.env.TAURI_ENV_PLATFORM` で判定していたが、`pnpm tauri build`
// から `vite build` への env 伝播が環境依存で取りこぼされ Web 側 (DeviceCode) が
// 混入する事故があったため、runtime 判定 (`window.__TAURI_INTERNALS__`) に変更。
// 動的 import なので Web では tauriLoopback 側はそもそも fetch されない。
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
	if (isTauri()) {
		const mod = await import("./strategies/tauriLoopback");
		return new mod.TauriLoopbackStrategy();
	}
	const mod = await import("./strategies/deviceCode");
	return new mod.DeviceCodeStrategy();
}
