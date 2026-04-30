import { getAuthConfig } from "./config";
import type { StoredTokens } from "./tokenStore";

export interface DeviceCodeResponse {
	deviceCode: string;
	userCode: string;
	verificationUri: string;
	expiresIn: number;
	interval: number;
	message: string;
}

export type DeviceCodeErrorCode =
	| "expired"
	| "denied"
	| "config"
	| "network"
	| "unknown";

export class DeviceCodeError extends Error {
	readonly code: DeviceCodeErrorCode;
	constructor(message: string, code: DeviceCodeErrorCode) {
		super(message);
		this.name = "DeviceCodeError";
		this.code = code;
	}
}

interface AzureDeviceCodeRaw {
	device_code: string;
	user_code: string;
	verification_uri: string;
	expires_in: number;
	interval: number;
	message: string;
}

interface AzureTokenSuccessRaw {
	access_token: string;
	refresh_token: string;
	id_token: string;
	expires_in: number;
	token_type: string;
}

interface AzureTokenErrorRaw {
	error: string;
	error_description?: string;
}

export async function startDeviceCodeFlow(): Promise<DeviceCodeResponse> {
	const cfg = getAuthConfig();
	const body = new URLSearchParams({
		client_id: cfg.clientId,
		scope: cfg.scope,
	});
	let res: Response;
	try {
		res = await fetch(cfg.deviceCodeEndpoint, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body,
		});
	} catch (err) {
		throw new DeviceCodeError(
			err instanceof Error ? err.message : "ネットワークエラー",
			"network",
		);
	}
	if (!res.ok) {
		const text = await res.text();
		throw new DeviceCodeError(
			`デバイスコード取得に失敗: ${res.status} ${text}`,
			"config",
		);
	}
	const json = (await res.json()) as AzureDeviceCodeRaw;
	return {
		deviceCode: json.device_code,
		userCode: json.user_code,
		verificationUri: json.verification_uri,
		expiresIn: json.expires_in,
		interval: json.interval,
		message: json.message,
	};
}

export interface PollOptions {
	signal?: AbortSignal;
}

export async function pollForToken(
	device: DeviceCodeResponse,
	options: PollOptions = {},
): Promise<StoredTokens> {
	const cfg = getAuthConfig();
	const deadline = Date.now() + device.expiresIn * 1_000;
	let interval = device.interval;

	while (Date.now() < deadline) {
		if (options.signal?.aborted) {
			throw new DeviceCodeError("中断されました", "unknown");
		}
		await sleep(interval * 1_000, options.signal);

		const body = new URLSearchParams({
			grant_type: "urn:ietf:params:oauth:grant-type:device_code",
			client_id: cfg.clientId,
			device_code: device.deviceCode,
		});
		const res = await fetch(cfg.tokenEndpoint, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body,
			signal: options.signal,
		}).catch((err) => {
			throw new DeviceCodeError(
				err instanceof Error ? err.message : "ネットワークエラー",
				"network",
			);
		});

		if (res.ok) {
			const ok = (await res.json()) as AzureTokenSuccessRaw;
			return {
				accessToken: ok.access_token,
				refreshToken: ok.refresh_token,
				idToken: ok.id_token,
				expiresAt: Date.now() + ok.expires_in * 1_000,
			};
		}

		const errBody = (await res
			.json()
			.catch(() => null)) as AzureTokenErrorRaw | null;
		if (!errBody?.error) {
			throw new DeviceCodeError(`トークン取得に失敗: ${res.status}`, "unknown");
		}
		switch (errBody.error) {
			case "authorization_pending":
				continue;
			case "slow_down":
				interval = Math.min(interval + 5, 60);
				continue;
			case "expired_token":
				throw new DeviceCodeError(
					"デバイスコードの期限が切れました。再度お試しください。",
					"expired",
				);
			case "access_denied":
				throw new DeviceCodeError("ログインがキャンセルされました。", "denied");
			default:
				throw new DeviceCodeError(
					errBody.error_description ?? errBody.error,
					"unknown",
				);
		}
	}
	throw new DeviceCodeError(
		"デバイスコードの期限が切れました。再度お試しください。",
		"expired",
	);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new DeviceCodeError("中断されました", "unknown"));
			return;
		}
		const onAbort = () => {
			clearTimeout(timer);
			signal?.removeEventListener("abort", onAbort);
			reject(new DeviceCodeError("中断されました", "unknown"));
		};
		const timer = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		signal?.addEventListener("abort", onAbort);
	});
}
