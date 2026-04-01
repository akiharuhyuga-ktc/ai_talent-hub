import { getAllMemberSummaries } from '@/lib/fs/members'
import { MemberGrid } from '@/components/dashboard/MemberGrid'
import { StatsBar } from '@/components/dashboard/StatsBar'

export default function DashboardPage() {
  const members = getAllMemberSummaries()

  return (
    <main className="px-8 py-7">
      <div className="mb-7">
        <h1 className="text-7xl font-bold text-gray-900">チームダッシュボード</h1>
        <p className="text-3xl text-gray-500 mt-2">モバイルアプリ開発部 — 2026年上期</p>
      </div>
      <StatsBar members={members} />
      <MemberGrid members={members} />
    </main>
  )
}
