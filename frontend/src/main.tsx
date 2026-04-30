import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "./contexts/AuthContext";
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
	// Tauri は Service Worker を使えないため demo-mock (window.fetch ラッパ) を使う。
	// ブラウザ dev は MSW で /api/* を傍受する。
	if (isTauri()) {
		const { enableDemoMock } = await import("./mocks/demo-mock");
		enableDemoMock();
	} else if (import.meta.env.DEV) {
		const { worker } = await import("./mocks/browser");
		await worker.start({ onUnhandledRequest: "bypass" });
	} else if (import.meta.env.VITE_DEMO_MODE === "true") {
		const { enableDemoMock } = await import("./mocks/demo-mock");
		enableDemoMock();
	}

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
