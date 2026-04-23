export function isTauri(): boolean {
	if (typeof window === "undefined") return false;
	return (
		typeof (window as unknown as { __TAURI_INTERNALS__?: unknown })
			.__TAURI_INTERNALS__ !== "undefined"
	);
}
