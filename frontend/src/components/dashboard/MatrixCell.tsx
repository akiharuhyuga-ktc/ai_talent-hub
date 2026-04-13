import { clsx } from "clsx";

interface MatrixCellProps {
	variant: "ok" | "ng" | "future";
}

const variantStyles = {
	ok: "bg-green-100 text-green-600",
	ng: "bg-red-100 text-red-600",
	future: "bg-gray-100 text-gray-400",
};

const variantLabels = {
	ok: "◯",
	ng: "×",
	future: "−",
};

export function MatrixCell({ variant }: MatrixCellProps) {
	return (
		<div className="flex items-center justify-center">
			<span
				className={clsx(
					"inline-flex items-center justify-center w-8 h-8 rounded-full text-base font-bold",
					variantStyles[variant],
				)}
			>
				{variantLabels[variant]}
			</span>
		</div>
	);
}
