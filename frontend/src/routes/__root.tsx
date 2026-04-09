import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRoute({
	component: () => (
		<div className="flex min-h-screen flex-col">
			<header className="border-b bg-white px-6 py-4">
				<h1 className="text-xl font-bold text-gray-900">KTC Talent Hub</h1>
			</header>
			<main className="flex-1">
				<Outlet />
			</main>
			{import.meta.env.DEV && (
				<TanStackRouterDevtools position="bottom-right" />
			)}
		</div>
	),
	notFoundComponent: () => (
		<div className="flex flex-1 items-center justify-center">
			<p className="text-gray-500">ページが見つかりません</p>
		</div>
	),
});
