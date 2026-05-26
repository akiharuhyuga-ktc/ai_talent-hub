import {
	MutationCache,
	QueryCache,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { initPrompts } from "./lib/ai/prompts/loader";
import { showApiErrorToast } from "./lib/api/errorToast";
import { isTauri } from "./lib/data-store/detect";
import { routeTree } from "./routeTree.gen";
import "./index.css";

const queryClient = new QueryClient({
	queryCache: new QueryCache({ onError: showApiErrorToast }),
	mutationCache: new MutationCache({ onError: showApiErrorToast }),
});

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
	//   - VITE_DEMO_MODE=true → 必ずモック (AI も demo 応答)
	//   - dev                 → MSW を起動。AI handler は VITE_DEMO_MODE 次第で
	//                            外れ、AI だけ Vite proxy 経由で実 Lambda に流れる
	//   - Tauri (本番含む)    → demo-mock を起動。組織方針等は mockDb が master
	//                            なので Tauri 本番でもこれが必要。AI は demo-mock
	//                            内で isDemoMode() OFF なら素通りして実 Lambda へ
	//   - production browser  → MSW 起動しない (実 API へ)
	const demoExplicit = import.meta.env.VITE_DEMO_MODE === "true";
	const useMock = demoExplicit || import.meta.env.DEV || isTauri();

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
				<Toaster position="bottom-right" richColors closeButton />
			</QueryClientProvider>
		</StrictMode>,
	);
}

bootstrap();
