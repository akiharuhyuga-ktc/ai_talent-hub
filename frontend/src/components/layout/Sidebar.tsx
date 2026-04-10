import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { clsx } from "clsx";
import {
	Calendar,
	FileText,
	Grid3X3,
	LayoutDashboard,
	Power,
} from "lucide-react";
import { useDemoMode } from "@/contexts/DemoModeContext";

const navItems = [
	{ href: "/", label: "ダッシュボード", icon: LayoutDashboard },
	{ href: "/team", label: "チームマトリクス", icon: Grid3X3 },
	{ href: "/docs", label: "組織方針・評価基準", icon: FileText },
] as const;

export function Sidebar() {
	const { pathname } = useLocation();
	const navigate = useNavigate();
	const { enabled: demoMode, toggle: toggleDemoMode } = useDemoMode();

	const handleToggle = () => {
		toggleDemoMode();
		if (pathname !== "/") {
			navigate({ to: "/" });
		}
	};

	return (
		<aside className="w-80 shrink-0 bg-brand-800 flex flex-col h-screen sticky top-0">
			{/* Logo */}
			<div className="w-full overflow-hidden">
				<img
					src="/logo.png"
					alt="KTC Talent Hub"
					className="w-full scale-125"
				/>
			</div>

			{/* Navigation */}
			<nav className="flex-1 flex flex-col gap-1 px-5">
				{navItems.map((item) => {
					const isActive =
						item.href === "/"
							? pathname === "/"
							: pathname.startsWith(item.href);
					const Icon = item.icon;
					return (
						<Link
							key={item.href}
							to={item.href}
							className={clsx(
								"flex items-center gap-3 px-6 py-4 rounded-[10px] text-lg font-medium transition-colors",
								isActive
									? "bg-brand-600 text-white"
									: "text-brand-200 hover:bg-brand-700 hover:text-white",
							)}
						>
							<Icon size={22} />
							{item.label}
						</Link>
					);
				})}
			</nav>

			{/* Bottom section */}
			<div className="px-6 pb-6 space-y-4">
				<div className="border-t border-brand-700 pt-4" />

				{/* Demo toggle */}
				<button
					type="button"
					onClick={handleToggle}
					className={clsx(
						"flex items-center gap-2 w-full px-4 py-2.5 rounded-lg text-base font-medium transition-colors",
						demoMode
							? "bg-orange-500/20 text-orange-300"
							: "text-brand-300 hover:text-brand-200",
					)}
				>
					<Power size={18} />
					<span>デモモード</span>
					<span
						className={clsx(
							"ml-auto w-8 h-5 rounded-full relative transition-colors",
							demoMode ? "bg-orange-400" : "bg-brand-600",
						)}
					>
						<span
							className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
							style={{ left: demoMode ? "14px" : "2px" }}
						/>
					</span>
				</button>

				{demoMode && (
					<div className="text-sm text-orange-300/80 bg-orange-500/10 rounded-md px-4 py-2">
						デモデータを表示中
					</div>
				)}

				{/* Period */}
				<div className="flex items-center gap-2 px-2">
					<Calendar size={18} className="text-brand-400" />
					<span className="text-base text-brand-300">2026年上期</span>
				</div>
			</div>
		</aside>
	);
}
