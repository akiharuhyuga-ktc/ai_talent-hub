import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Sidebar } from "@/components/layout/Sidebar";
import { DemoModeProvider } from "@/contexts/DemoModeContext";

export const Route = createRootRoute({
	component: () => (
		<DemoModeProvider>
			<div className="flex min-h-screen">
				<Sidebar />
				<main className="flex-1 overflow-y-auto bg-surface">
					<Outlet />
				</main>
				{import.meta.env.DEV && (
					<TanStackRouterDevtools position="bottom-right" />
				)}
			</div>
		</DemoModeProvider>
	),
	notFoundComponent: () => (
		<div className="flex flex-1 items-center justify-center">
			<p className="text-gray-500">ページが見つかりません</p>
		</div>
	),
});
