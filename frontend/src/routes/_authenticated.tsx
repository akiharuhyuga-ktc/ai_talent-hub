import {
	createFileRoute,
	Outlet,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { getTokens } from "@/lib/auth/tokenStore";

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: ({ location }) => {
		if (!getTokens()) {
			throw redirect({
				to: "/login",
				search: { redirect: location.href },
			});
		}
	},
	component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
	const { user } = useAuth();
	const navigate = useNavigate();

	useEffect(() => {
		if (!user) {
			navigate({ to: "/login" });
		}
	}, [user, navigate]);

	return (
		<div className="flex min-h-screen">
			<Sidebar />
			<main className="flex-1 overflow-y-auto bg-surface">
				<Outlet />
			</main>
		</div>
	);
}
