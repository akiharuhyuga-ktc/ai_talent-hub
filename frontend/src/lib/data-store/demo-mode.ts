/**
 * デモモードの状態を localStorage から読む。
 *
 * - dev ビルドでのみ有効。本番／Tauri リリースビルドでは常に false を返す
 * - localStorage["demoMode"] === "true" のとき有効
 * - 状態管理の master は DemoModeContext。本モジュールは React 文脈の外
 *   （dataStore 等）から参照できる薄いブリッジ
 */
export function isDemoMode(): boolean {
	if (!import.meta.env.DEV) return false;
	try {
		return localStorage.getItem("demoMode") === "true";
	} catch {
		return false;
	}
}

export function demoQuerySuffix(): string {
	return isDemoMode() ? "?mode=demo" : "";
}

export function demoMembersSubdir(): "members" | "demo-members" {
	return isDemoMode() ? "demo-members" : "members";
}
