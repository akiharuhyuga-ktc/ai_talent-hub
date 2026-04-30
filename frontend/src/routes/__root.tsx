import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { DemoModeProvider } from "@/contexts/DemoModeContext";

export const Route = createRootRoute({
	component: () => (
		<DemoModeProvider>
			<Outlet />
			{import.meta.env.DEV && (
				<TanStackRouterDevtools position="bottom-right" />
			)}
		</DemoModeProvider>
	),
	notFoundComponent: () => (
		<div className="flex min-h-screen items-center justify-center">
			<p className="text-gray-500">ページが見つかりません</p>
		</div>
	),
});
