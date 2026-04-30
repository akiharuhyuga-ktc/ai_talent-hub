import { useQueryClient } from "@tanstack/react-query";
import {
	createContext,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	DeviceCodeError,
	type DeviceCodeResponse,
	pollForToken,
	startDeviceCodeFlow,
} from "@/lib/auth/deviceCode";
import { AUTH_EXPIRED_EVENT } from "@/lib/auth/events";
import {
	type AuthUser,
	clearTokens,
	decodeIdToken,
	getTokens,
	saveTokens,
} from "@/lib/auth/tokenStore";

export type DeviceCodeState =
	| { phase: "idle" }
	| { phase: "starting" }
	| {
			phase: "waiting";
			userCode: string;
			verificationUri: string;
			message: string;
	  }
	| { phase: "error"; message: string };

export interface AuthContextValue {
	user: AuthUser | null;
	deviceCode: DeviceCodeState;
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
	const [deviceCode, setDeviceCode] = useState<DeviceCodeState>({
		phase: "idle",
	});
	const abortRef = useRef<AbortController | null>(null);

	useEffect(() => {
		return () => {
			abortRef.current?.abort();
		};
	}, []);

	useEffect(() => {
		const onExpired = () => {
			abortRef.current?.abort();
			setUser(null);
			setDeviceCode({ phase: "idle" });
		};
		window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
		return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
	}, []);

	const login = useCallback(async () => {
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		setDeviceCode({ phase: "starting" });
		let device: DeviceCodeResponse;
		try {
			device = await startDeviceCodeFlow();
		} catch (err) {
			setDeviceCode({
				phase: "error",
				message:
					err instanceof Error ? err.message : "ログインに失敗しました。",
			});
			return;
		}
		setDeviceCode({
			phase: "waiting",
			userCode: device.userCode,
			verificationUri: device.verificationUri,
			message: device.message,
		});

		try {
			const tokens = await pollForToken(device, { signal: controller.signal });
			saveTokens(tokens);
			setUser(decodeIdToken(tokens.idToken));
			setDeviceCode({ phase: "idle" });
		} catch (err) {
			if (controller.signal.aborted) return;
			const message =
				err instanceof DeviceCodeError
					? err.message
					: err instanceof Error
						? err.message
						: "ログインに失敗しました。";
			setDeviceCode({ phase: "error", message });
		}
	}, []);

	const logout = useCallback(() => {
		abortRef.current?.abort();
		clearTokens();
		setUser(null);
		setDeviceCode({ phase: "idle" });
		queryClient.clear();
	}, [queryClient]);

	return (
		<AuthContext value={{ user, deviceCode, login, logout }}>
			{children}
		</AuthContext>
	);
}
