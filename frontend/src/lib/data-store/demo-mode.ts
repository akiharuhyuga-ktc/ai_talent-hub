/**
 * デモモードの状態を localStorage から読む。
 *
 * - dev または `VITE_DEMO_MODE=true` でビルドした「デバッグビルド」(make desktop-demo)
 *   でのみ有効。通常の `make desktop` (本番リリース) では常に false を返す
 * - localStorage["demoMode"] === "true" のとき有効
 * - 状態管理の master は DemoModeContext。本モジュールは React 文脈の外
 *   （dataStore 等）から参照できる薄いブリッジ
 */
export function isDemoMode(): boolean {
	if (!isDemoToggleEnabled()) return false;
	try {
		return localStorage.getItem("demoMode") === "true";
	} catch {
		return false;
	}
}

/**
 * デモトグル UI を表示するか / トグル操作を受け付けるかの条件。
 * dev か、`VITE_DEMO_MODE=true` でビルドしたデバッグビルドのときだけ true。
 */
export function isDemoToggleEnabled(): boolean {
	return import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === "true";
}

export function demoQuerySuffix(): string {
	return isDemoMode() ? "?mode=demo" : "";
}

export function demoMembersSubdir(): "members" | "demo-members" {
	return isDemoMode() ? "demo-members" : "members";
}
