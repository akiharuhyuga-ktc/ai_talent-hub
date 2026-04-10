import { Badge, teamBadgeVariant } from "@/components/ui/Badge";
import { teamGradients } from "@/lib/team-colors";
import type { MemberDetail } from "@/lib/types";

interface ProfileTabProps {
	member: MemberDetail;
}

function SkillRow({ label, value }: { label: string; value: string }) {
	const isEmpty = !value || value.includes("未入力");
	return (
		<div className="flex gap-5 py-4 border-b border-gray-100 last:border-0">
			<dt className="text-xl font-medium text-gray-400 w-32 shrink-0">
				{label}
			</dt>
			<dd
				className={`text-xl leading-relaxed ${isEmpty ? "text-gray-300" : "text-gray-800"}`}
			>
				{isEmpty ? "—" : value}
			</dd>
		</div>
	);
}

export function ProfileTab({ member }: ProfileTabProps) {
	const gradient =
		teamGradients[member.teamShort] || "from-gray-500 to-gray-700";

	return (
		<div className="space-y-8">
			{/* Hero header */}
			<section className="bg-gradient-to-r from-brand-50 to-purple-50 rounded-radius-2xl p-8 border border-brand-100">
				<div className="flex items-center gap-7">
					<div
						className={`w-24 h-24 rounded-radius-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-glow`}
					>
						<span className="text-white font-bold text-5xl">
							{member.name.slice(0, 1)}
						</span>
					</div>
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-3 flex-wrap mb-2">
							<h2 className="text-4xl font-bold text-gray-900">
								{member.name}
							</h2>
							<Badge
								label={member.teamShort}
								variant={teamBadgeVariant(member.teamShort)}
							/>
						</div>
						<p className="text-2xl text-gray-600">{member.role}</p>
						<p className="text-xl text-gray-400 mt-1">
							{member.team} ｜ 入社：{member.joinedAt}
						</p>
					</div>
				</div>
			</section>

			{/* 2-column grid */}
			<div className="grid grid-cols-1 xl:grid-cols-2 gap-7">
				{/* Left column: Skills + Expected role */}
				<div className="space-y-7">
					<section>
						<h3 className="text-2xl font-semibold text-gray-800 mb-3">
							スキル・経験
						</h3>
						<dl className="bg-white rounded-radius-xl shadow-card px-6">
							<SkillRow label="技術スキル" value={member.skills.technical} />
							<SkillRow label="業務経験" value={member.skills.experience} />
							<SkillRow label="強み" value={member.skills.strengths} />
							<SkillRow label="成長課題" value={member.skills.challenges} />
						</dl>
					</section>

					{(member.expectedRole.current || member.expectedRole.longTerm) && (
						<section>
							<h3 className="text-2xl font-semibold text-gray-800 mb-3">
								期待する役割
							</h3>
							<div className="space-y-3">
								{member.expectedRole.current && (
									<div className="bg-brand-50 rounded-radius-xl p-5 border border-brand-100">
										<p className="text-lg font-semibold text-brand-600 uppercase tracking-wide mb-2">
											現在の期待役割
										</p>
										<p className="text-xl text-gray-800 whitespace-pre-line leading-relaxed">
											{member.expectedRole.current}
										</p>
									</div>
								)}
								{member.expectedRole.longTerm && (
									<div className="bg-purple-50 rounded-radius-xl p-5 border border-purple-100">
										<p className="text-lg font-semibold text-purple-600 uppercase tracking-wide mb-2">
											中長期キャリア方向性
										</p>
										<p className="text-xl text-gray-800 whitespace-pre-line leading-relaxed">
											{member.expectedRole.longTerm}
										</p>
									</div>
								)}
							</div>
						</section>
					)}
				</div>

				{/* Right column: Project allocation */}
				<div>
					{member.projects.length > 0 ? (
						<section>
							<h3 className="text-2xl font-semibold text-gray-800 mb-3">
								担当プロジェクト（2026年4〜6月）
							</h3>
							<div className="space-y-4">
								{member.projects.map((proj) => (
									<div
										key={proj.name}
										className="bg-white rounded-radius-xl shadow-card p-5"
									>
										<div className="flex justify-between items-start mb-3">
											<span className="text-2xl font-semibold text-gray-900 leading-snug">
												{proj.name}
											</span>
											<span className="text-3xl font-bold text-brand-600 ml-4 shrink-0">
												{proj.avgPct}%
											</span>
										</div>
										<div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
											<div
												className="bg-gradient-to-r from-brand-300 to-brand-600 h-1.5 rounded-full transition-all"
												style={{ width: `${proj.avgPct}%` }}
											/>
										</div>
										<div className="grid grid-cols-3 gap-3">
											{[
												{ label: "4月", value: proj.april },
												{ label: "5月", value: proj.may },
												{ label: "6月", value: proj.june },
											].map(({ label, value }) => (
												<div
													key={label}
													className="bg-surface rounded-lg p-3 text-center"
												>
													<div className="text-lg text-gray-400">{label}</div>
													<div className="text-2xl font-bold text-gray-800 mt-0.5">
														{value}%
													</div>
												</div>
											))}
										</div>
									</div>
								))}
							</div>
						</section>
					) : (
						<div className="bg-surface rounded-radius-xl p-10 text-center text-gray-400 text-2xl">
							プロジェクト情報が登録されていません
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
