interface EmptyStateProps {
	title: string;
	description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
	return (
		<div className="text-center py-12">
			<h3 className="text-sm font-medium text-gray-900 mb-1">{title}</h3>
			{description && <p className="text-sm text-gray-500">{description}</p>}
		</div>
	);
}
