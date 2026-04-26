import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { dataStore } from "@/lib/data-store";

interface DeleteMemberDialogProps {
	open: boolean;
	memberId: string;
	memberName: string;
	onClose: () => void;
}

export function DeleteMemberDialog({
	open,
	memberId,
	memberName,
	onClose,
}: DeleteMemberDialogProps) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const mutation = useMutation({
		mutationFn: () => dataStore.members.remove(memberId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["members"] });
			queryClient.removeQueries({ queryKey: ["members", memberId] });
			onClose();
			navigate({ to: "/" });
		},
	});

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center">
			<div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full mx-4">
				<h3 className="text-xl font-bold text-gray-800 mb-3">
					{memberName} さんを削除しますか？
				</h3>
				<p className="text-lg text-gray-500 mb-2">この操作は取り消せません。</p>
				<p className="text-lg text-gray-500 mb-6">
					プロジェクト配分・目標・1on1・評価データもすべて削除されます。
				</p>

				{mutation.isError && (
					<p className="mb-4 text-lg text-red-500">
						削除に失敗しました。もう一度お試しください。
					</p>
				)}

				<div className="flex gap-3">
					<button
						type="button"
						onClick={onClose}
						disabled={mutation.isPending}
						className="flex-1 py-3 text-xl border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
					>
						キャンセル
					</button>
					<button
						type="button"
						onClick={() => mutation.mutate()}
						disabled={mutation.isPending}
						className="flex-1 py-3 text-xl bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
					>
						{mutation.isPending ? "削除中..." : "削除する"}
					</button>
				</div>
			</div>
		</div>
	);
}
