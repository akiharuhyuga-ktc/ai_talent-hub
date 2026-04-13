import { clsx } from "clsx";
import type { ReactNode } from "react";

interface CardProps {
	children: ReactNode;
	className?: string;
	onClick?: () => void;
	hoverable?: boolean;
}

export function Card({ children, className, onClick, hoverable }: CardProps) {
	const classes = clsx(
		"bg-white rounded-xl border border-gray-200 shadow-sm text-left",
		hoverable &&
			"cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
		className,
	);

	if (onClick) {
		return (
			<button type="button" onClick={onClick} className={classes}>
				{children}
			</button>
		);
	}

	return <div className={classes}>{children}</div>;
}
