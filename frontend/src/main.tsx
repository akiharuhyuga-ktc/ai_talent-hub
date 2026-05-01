import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "./contexts/AuthContext";
import { initPrompts } from "./lib/ai/prompts/loader";
import { isTauri } from "./lib/data-store/detect";
import { routeTree } from "./routeTree.gen";
import "./index.css";

const queryClient = new QueryClient();

const router = createRouter({
	routeTree,
	defaultPreload: "intent",
	context: { queryClient },
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

async function bootstrap() {
	// モック動作の判定:
	//   - VITE_DEMO_MODE=true        → 必ずモック
	//   - dev かつ VITE_DEMO_MODE!=="false" → デフォルトでモック (従来挙動維持)
	//   - それ以外 (Tauri prod / browser prod) → 実 proxy へ
	// Tauri は Service Worker が動かないので demo-mock (window.fetch ラッパ) を、
	// ブラウザは MSW を使う。
	const demoExplicit = import.meta.env.VITE_DEMO_MODE === "true";
	const demoDevDefault =
		import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE !== "false";
	const useMock = demoExplicit || demoDevDefault;

	if (useMock) {
		if (isTauri()) {
			const { enableDemoMock } = await import("./mocks/demo-mock");
			enableDemoMock();
		} else {
			const { worker } = await import("./mocks/browser");
			await worker.start({ onUnhandledRequest: "bypass" });
		}
	}

	// プロンプトテンプレを起動時に裏でリフレッシュ (失敗時はバンドル既定値で動作)。
	initPrompts();

	createRoot(document.getElementById("root") as HTMLElement).render(
		<StrictMode>
			<QueryClientProvider client={queryClient}>
				<AuthProvider>
					<RouterProvider router={router} />
				</AuthProvider>
			</QueryClientProvider>
		</StrictMode>,
	);
}

bootstrap();
