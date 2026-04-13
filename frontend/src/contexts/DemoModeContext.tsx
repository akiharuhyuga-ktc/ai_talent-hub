import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useState } from "react";

interface DemoModeContextValue {
	enabled: boolean;
	toggle: () => void;
}

const DemoModeContext = createContext<DemoModeContextValue | null>(null);

export function DemoModeProvider({ children }: { children: ReactNode }) {
	const [enabled, setEnabled] = useState(() => {
		try {
			return localStorage.getItem("demoMode") === "true";
		} catch {
			return false;
		}
	});

	const toggle = useCallback(() => {
		setEnabled((prev) => {
			const next = !prev;
			try {
				localStorage.setItem("demoMode", String(next));
			} catch {
				// ignore
			}
			return next;
		});
	}, []);

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
