import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import axios from "axios";
import { DocsTabs } from "@/components/docs/DocsTabs";

interface DocsResponse {
	orgPolicy: string;
	criteria: string;
	guidelines: string;
	policyYear?: number;
	availableYears?: number[];
}

export const Route = createFileRoute("/docs")({
	component: DocsPage,
});

function DocsPage() {
	const { data, isLoading } = useQuery({
		queryKey: ["docs"],
		queryFn: async () => {
			const res = await axios.get<DocsResponse>("/api/docs");
			return res.data;
		},
	});

	return (
		<main className="px-10 py-8">
			<div className="mb-8">
				<h1 className="text-4xl font-bold text-gray-900 tracking-tight">
					組織方針・評価基準
				</h1>
				<p className="text-xl text-gray-400 mt-1">
					部方針と評価基準のドキュメント
				</p>
			</div>

			{isLoading ? (
				<div className="text-xl text-gray-400">読み込み中...</div>
			) : data ? (
				<DocsTabs
					orgPolicy={data.orgPolicy}
					policyYear={data.policyYear ?? null}
					availableYears={data.availableYears ?? []}
					criteria={data.criteria}
					guidelines={data.guidelines}
				/>
			) : (
				<div className="text-xl text-gray-500">
					ドキュメントの読み込みに失敗しました
				</div>
			)}
		</main>
	);
}
