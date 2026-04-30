import { jwtDecode } from "jwt-decode";

const STORAGE_KEY = "ktc.auth.tokens";

export interface StoredTokens {
	accessToken: string;
	refreshToken: string;
	idToken: string;
	expiresAt: number;
}

export interface IdTokenClaims {
	name?: string;
	preferred_username?: string;
	oid?: string;
	sub?: string;
}

export interface AuthUser {
	name: string;
	username: string;
	id: string;
}

let cached: StoredTokens | null | undefined;

function readFromStorage(): StoredTokens | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as StoredTokens;
		if (
			typeof parsed?.accessToken !== "string" ||
			typeof parsed?.refreshToken !== "string" ||
			typeof parsed?.idToken !== "string" ||
			typeof parsed?.expiresAt !== "number"
		) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export function saveTokens(tokens: StoredTokens): void {
	cached = tokens;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
	} catch {
		// localStorage 利用不可（プライベートモード等）。メモリのみで動かす道は今回未対応。
	}
}

export function getTokens(): StoredTokens | null {
	if (cached !== undefined) return cached;
	cached = readFromStorage();
	return cached;
}

export function clearTokens(): void {
	cached = null;
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// ignore
	}
}

const EXPIRY_SKEW_MS = 60_000;

export function isExpired(tokens: StoredTokens): boolean {
	return Date.now() >= tokens.expiresAt - EXPIRY_SKEW_MS;
}

export function decodeIdToken(idToken: string): AuthUser | null {
	try {
		const claims = jwtDecode<IdTokenClaims>(idToken);
		return {
			name: claims.name ?? claims.preferred_username ?? "ユーザー",
			username: claims.preferred_username ?? "",
			id: claims.oid ?? claims.sub ?? "",
		};
	} catch {
		return null;
	}
}
