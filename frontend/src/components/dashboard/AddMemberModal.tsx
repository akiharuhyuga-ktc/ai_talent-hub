import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import customInstance from "@/api/custom-instance";
import type { MemberRecord } from "@/api/generated/types";

interface AddMemberModalProps {
	open: boolean;
	onClose: () => void;
}

const TEAM_SHORT_OPTIONS = ["Flutter", "KMP", "Producer", "Manager"] as const;
type TeamShort = (typeof TEAM_SHORT_OPTIONS)[number];

interface FormState {
	name: string;
	role: string;
	team: string;
	teamShort: TeamShort;
	joinedAt: string;
	mainProject: string;
	rdPct: string;
}

const INITIAL_FORM: FormState = {
	name: "",
	role: "",
	team: "",
	teamShort: "Flutter",
	joinedAt: "",
	mainProject: "",
	rdPct: "",
};

export function AddMemberModal({ open, onClose }: AddMemberModalProps) {
	const queryClient = useQueryClient();
	const [form, setForm] = useState<FormState>(INITIAL_FORM);

	const mutation = useMutation({
		mutationFn: async (payload: Record<string, unknown>) => {
			return customInstance<MemberRecord>({
				method: "post",
				url: "/api/members",
				data: payload,
				headers: { "Content-Type": "application/json" },
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["members"] });
			setForm(INITIAL_FORM);
			onClose();
		},
	});

	if (!open) return null;

	const trimmed = {
		name: form.name.trim(),
		role: form.role.trim(),
		team: form.team.trim(),
		joinedAt: form.joinedAt.trim(),
	};
	const canSubmit =
		trimmed.name !== "" &&
		trimmed.role !== "" &&
		trimmed.team !== "" &&
		/^\d{4}-\d{2}$/.test(trimmed.joinedAt);

	return (
		<div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center">
			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (!canSubmit || mutation.isPending) return;
					const rdPctNum = Number.parseInt(form.rdPct, 10);
					mutation.mutate({
						name: trimmed.name,
						role: trimmed.role,
						team: trimmed.team,
						teamShort: form.teamShort,
						joinedAt: trimmed.joinedAt,
						mainProject: form.mainProject.trim() || undefined,
						rdPct: Number.isFinite(rdPctNum) ? rdPctNum : undefined,
					});
				}}
				className="bg-white rounded-xl shadow-xl p-8 max-w-lg w-full mx-4"
			>
				<h3 className="text-xl font-bold text-gray-800 mb-1">メンバーを追加</h3>
				<p className="text-lg text-gray-500 mb-6">
					詳細情報（スキル・期待役割など）は追加後に詳細画面から編集できます。
				</p>

				<div className="space-y-4">
					<Field label="氏名" required>
						<input
							type="text"
							value={form.name}
							onChange={(e) => setForm({ ...form, name: e.target.value })}
							placeholder="例: 田中 太郎"
							className="w-full px-4 py-2 text-lg border border-gray-200 rounded-lg focus:border-brand-500 focus:outline-none"
						/>
					</Field>

					<Field label="役職" required>
						<input
							type="text"
							value={form.role}
							onChange={(e) => setForm({ ...form, role: e.target.value })}
							placeholder="例: エンジニア（Flutter / iOS）"
							className="w-full px-4 py-2 text-lg border border-gray-200 rounded-lg focus:border-brand-500 focus:outline-none"
						/>
					</Field>

					<div className="grid grid-cols-2 gap-4">
						<Field label="チーム" required>
							<input
								type="text"
								value={form.team}
								onChange={(e) => setForm({ ...form, team: e.target.value })}
								placeholder="例: モバイルアプリ開発G"
								className="w-full px-4 py-2 text-lg border border-gray-200 rounded-lg focus:border-brand-500 focus:outline-none"
							/>
						</Field>
						<Field label="チーム分類" required>
							<select
								value={form.teamShort}
								onChange={(e) =>
									setForm({
										...form,
										teamShort: e.target.value as TeamShort,
									})
								}
								className="w-full px-4 py-2 text-lg border border-gray-200 rounded-lg focus:border-brand-500 focus:outline-none bg-white"
							>
								{TEAM_SHORT_OPTIONS.map((opt) => (
									<option key={opt} value={opt}>
										{opt}
									</option>
								))}
							</select>
						</Field>
					</div>

					<Field label="入社年月 (YYYY-MM)" required>
						<input
							type="month"
							value={form.joinedAt}
							onChange={(e) => setForm({ ...form, joinedAt: e.target.value })}
							className="w-full px-4 py-2 text-lg border border-gray-200 rounded-lg focus:border-brand-500 focus:outline-none"
						/>
					</Field>

					<div className="grid grid-cols-2 gap-4">
						<Field label="メインプロジェクト">
							<input
								type="text"
								value={form.mainProject}
								onChange={(e) =>
									setForm({ ...form, mainProject: e.target.value })
								}
								placeholder="任意"
								className="w-full px-4 py-2 text-lg border border-gray-200 rounded-lg focus:border-brand-500 focus:outline-none"
							/>
						</Field>
						<Field label="R&D 配分 (%)">
							<input
								type="number"
								min={0}
								max={100}
								value={form.rdPct}
								onChange={(e) => setForm({ ...form, rdPct: e.target.value })}
								placeholder="任意"
								className="w-full px-4 py-2 text-lg border border-gray-200 rounded-lg focus:border-brand-500 focus:outline-none"
							/>
						</Field>
					</div>
				</div>

				{mutation.isError && (
					<p className="mt-4 text-lg text-red-500">
						追加に失敗しました。もう一度お試しください。
					</p>
				)}

				<div className="flex gap-3 mt-8">
					<button
						type="button"
						onClick={() => {
							setForm(INITIAL_FORM);
							onClose();
						}}
						disabled={mutation.isPending}
						className="flex-1 py-3 text-xl border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
					>
						キャンセル
					</button>
					<button
						type="submit"
						disabled={!canSubmit || mutation.isPending}
						className="flex-1 py-3 text-xl bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
					>
						{mutation.isPending ? "追加中..." : "追加する"}
					</button>
				</div>
			</form>
		</div>
	);
}

function Field({
	label,
	required,
	children,
}: {
	label: string;
	required?: boolean;
	children: React.ReactNode;
}) {
	return (
		<label className="block">
			<span className="block text-lg font-medium text-gray-600 mb-1">
				{label}
				{required && <span className="text-red-500 ml-1">*</span>}
			</span>
			{children}
		</label>
	);
}
