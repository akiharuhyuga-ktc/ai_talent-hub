import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useState } from "react";
import { isDemoToggleEnabled } from "@/lib/data-store/demo-mode";

interface DemoModeContextValue {
	enabled: boolean;
	toggle: () => void;
}

const DemoModeContext = createContext<DemoModeContextValue | null>(null);

export function DemoModeProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();

	const [enabled, setEnabled] = useState(() => {
		// 本番リリースビルドではデモモードを必ず無効。
		// dev / デバッグビルド (VITE_DEMO_MODE=true) でのみ localStorage から復元する。
		if (!isDemoToggleEnabled()) return false;
		try {
			return localStorage.getItem("demoMode") === "true";
		} catch {
			return false;
		}
	});

	const toggle = useCallback(() => {
		if (!isDemoToggleEnabled()) return;
		setEnabled((prev) => {
			const next = !prev;
			try {
				localStorage.setItem("demoMode", String(next));
			} catch {
				// ignore
			}
			// 切替時は React Query キャッシュを全 invalidate。
			// dataStore は demoMode を都度 localStorage から読むため、
			// キャッシュをクリアしないと旧モードのデータが表示され続ける。
			queryClient.invalidateQueries();
			return next;
		});
	}, [queryClient]);

	return (
		<DemoModeContext value={{ enabled, toggle }}>{children}</DemoModeContext>
	);
}

export function useDemoMode() {
	const ctx = useContext(DemoModeContext);
	if (!ctx) {
		throw new Error("useDemoMode must be used within DemoModeProvider");
	}
	return ctx;
}
