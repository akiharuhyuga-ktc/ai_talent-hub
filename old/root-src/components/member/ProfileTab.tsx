import { Badge, teamBadgeVariant } from '@/components/ui/Badge'
import type { MemberDetail } from '@/lib/types'

interface ProfileTabProps {
  member: MemberDetail
}

function SkillRow({ label, value }: { label: string; value: string }) {
  const isEmpty = !value || value.includes('未入力')
  return (
    <div className="flex gap-6 py-5 border-b border-gray-100 last:border-0">
      <dt className="text-xl font-medium text-gray-500 w-40 shrink-0">{label}</dt>
      <dd className={`text-xl leading-relaxed ${isEmpty ? 'text-gray-300 italic' : 'text-gray-900'}`}>
        {isEmpty ? '未記入' : value}
      </dd>
    </div>
  )
}

export function ProfileTab({ member }: ProfileTabProps) {
  return (
    <div className="space-y-8">
      {/* Hero header — full width */}
      <section className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-10 border border-indigo-100">
        <div className="flex items-center gap-8">
          <div className="w-32 h-32 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-6xl shrink-0 shadow-sm">
            {member.name.slice(0, 1)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-4 flex-wrap mb-3">
              <h2 className="text-6xl font-bold text-gray-900">{member.name}</h2>
              <Badge label={member.teamShort} variant={teamBadgeVariant(member.teamShort)} />
            </div>
            <p className="text-3xl text-gray-700">{member.role}</p>
            <p className="text-2xl text-gray-500 mt-2">{member.team} ｜ 入社：{member.joinedAt}</p>
          </div>
        </div>
      </section>

      {/* 2-column grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

        {/* Left column: Skills + Expected role */}
        <div className="space-y-8">
          {/* Skills */}
          <section>
            <h3 className="text-3xl font-semibold text-gray-800 mb-4">スキル・経験</h3>
            <dl className="bg-white border border-gray-200 rounded-xl px-6">
              <SkillRow label="技術スキル" value={member.skills.technical} />
              <SkillRow label="業務経験" value={member.skills.experience} />
              <SkillRow label="強み" value={member.skills.strengths} />
              <SkillRow label="成長課題" value={member.skills.challenges} />
            </dl>
          </section>

          {/* Expected role */}
          {(member.expectedRole.current || member.expectedRole.longTerm) && (
            <section>
              <h3 className="text-3xl font-semibold text-gray-800 mb-4">期待する役割</h3>
              <div className="space-y-4">
                {member.expectedRole.current && (
                  <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-100">
                    <p className="text-lg font-semibold text-indigo-600 uppercase tracking-wide mb-3">現在の期待役割</p>
                    <p className="text-xl text-gray-800 whitespace-pre-line leading-relaxed">
                      {member.expectedRole.current}
                    </p>
                  </div>
                )}
                {member.expectedRole.longTerm && (
                  <div className="bg-purple-50 rounded-xl p-6 border border-purple-100">
                    <p className="text-lg font-semibold text-purple-600 uppercase tracking-wide mb-3">中長期キャリア方向性</p>
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
              <h3 className="text-3xl font-semibold text-gray-800 mb-4">担当プロジェクト（2026年4〜6月）</h3>
              <div className="space-y-5">
                {member.projects.map(proj => (
                  <div key={proj.name} className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-2xl font-semibold text-gray-900 leading-snug">{proj.name}</span>
                      <span className="text-4xl font-bold text-indigo-600 ml-4 shrink-0">{proj.avgPct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-4 mb-4">
                      <div
                        className="bg-indigo-500 h-4 rounded-full transition-all"
                        style={{ width: `${proj.avgPct}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: '4月', value: proj.april },
                        { label: '5月', value: proj.may },
                        { label: '6月', value: proj.june },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-gray-50 rounded-lg p-4 text-center">
                          <div className="text-lg text-gray-500">{label}</div>
                          <div className="text-3xl font-bold text-gray-800 mt-1">{value}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <div className="bg-gray-50 rounded-xl p-10 text-center text-gray-400 text-2xl">
              プロジェクト情報が登録されていません
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
