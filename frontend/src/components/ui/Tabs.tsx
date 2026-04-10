import { clsx } from "clsx";
import type { ReactNode } from "react";
import { useState } from "react";

interface Tab {
	id: string;
	label: string;
	content: ReactNode;
}

interface TabsProps {
	tabs: Tab[];
	defaultTab?: string;
}

export function Tabs({ tabs, defaultTab }: TabsProps) {
	const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
	const currentTab = tabs.find((t) => t.id === active);

	return (
		<div>
			<div className="flex border-b border-gray-200 mb-6">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						type="button"
						onClick={() => setActive(tab.id)}
						className={clsx(
							"px-5 py-3 text-xl font-medium border-b-2 -mb-px transition-colors",
							active === tab.id
								? "border-brand-600 text-brand-600"
								: "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300",
						)}
					>
						{tab.label}
					</button>
				))}
			</div>
			<div>{currentTab?.content}</div>
		</div>
	);
}
