import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: HomePage,
});

function HomePage() {
	return (
		<div className="flex items-center justify-center p-8">
			<div className="text-center">
				<h2 className="text-3xl font-bold text-gray-900">
					Welcome to KTC Talent Hub
				</h2>
				<p className="mt-4 text-gray-600">AI を活用したタレントマネジメント</p>
			</div>
		</div>
	);
}
