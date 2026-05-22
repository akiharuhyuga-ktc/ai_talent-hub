import { useQueryClient } from "@tanstack/react-query";
import {
	createContext,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { DeviceCodeError } from "@/lib/auth/deviceCode";
import { AUTH_EXPIRED_EVENT } from "@/lib/auth/events";
import {
	type AuthFlowState,
	type AuthStrategy,
	getAuthStrategy,
} from "@/lib/auth/strategy";
import {
	type AuthUser,
	clearTokens,
	decodeIdToken,
	getTokens,
	saveTokens,
} from "@/lib/auth/tokenStore";

export interface AuthContextValue {
	user: AuthUser | null;
	flow: AuthFlowState;
	login: () => Promise<void>;
	logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();
	const [user, setUser] = useState<AuthUser | null>(() => {
		const tokens = getTokens();
		return tokens ? decodeIdToken(tokens.idToken) : null;
	});
	const [flow, setFlow] = useState<AuthFlowState>({ phase: "idle" });
	const abortRef = useRef<AbortController | null>(null);
	const strategyRef = useRef<AuthStrategy | null>(null);

	useEffect(() => {
		let cancelled = false;
		getAuthStrategy().then((s) => {
			if (!cancelled) strategyRef.current = s;
		});
		return () => {
			cancelled = true;
			abortRef.current?.abort();
		};
	}, []);

	useEffect(() => {
		const onExpired = () => {
			abortRef.current?.abort();
			setUser(null);
			setFlow({ phase: "idle" });
		};
		window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
		return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
	}, []);

	const login = useCallback(async () => {
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		setFlow({ phase: "starting" });
		try {
			const strategy = strategyRef.current ?? (await getAuthStrategy());
			strategyRef.current = strategy;
			const tokens = await strategy.login({
				onState: (s) => setFlow(s),
				signal: controller.signal,
			});
			saveTokens(tokens);
			setUser(decodeIdToken(tokens.idToken));
			setFlow({ phase: "idle" });
		} catch (err) {
			if (controller.signal.aborted) return;
			// Tauri の invoke() は Rust 側の Err(String) を「文字列」のまま reject するため、
			// Error/DeviceCodeError 以外に「素の string」もメッセージとして拾う。
			console.error("auth login failed:", err);
			const message =
				err instanceof DeviceCodeError
					? err.message
					: err instanceof Error
						? err.message
						: typeof err === "string" && err.length > 0
							? err
							: "ログインに失敗しました。";
			setFlow({ phase: "error", message });
		}
	}, []);

	const logout = useCallback(() => {
		abortRef.current?.abort();
		clearTokens();
		setUser(null);
		setFlow({ phase: "idle" });
		queryClient.clear();
	}, [queryClient]);

	return (
		<AuthContext value={{ user, flow, login, logout }}>{children}</AuthContext>
	);
}
