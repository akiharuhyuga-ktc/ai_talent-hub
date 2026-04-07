import { getAllMemberSummaries, isMemberDataDirectoryError } from '@/lib/fs/members'
import { MemberGrid } from '@/components/dashboard/MemberGrid'
import { StatsBar } from '@/components/dashboard/StatsBar'

export default function DashboardPage() {
  try {
    const members = getAllMemberSummaries()

    return (
      <main className="px-10 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">ダッシュボード</h1>
          <p className="text-xl text-gray-400 mt-1">モバイルアプリ開発部 — チーム全体の状況を把握</p>
        </div>
        <div className="space-y-8">
          <StatsBar members={members} />
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">メンバー</h2>
            <MemberGrid members={members} />
          </div>
        </div>
      </main>
    )
  } catch (error) {
    if (!isMemberDataDirectoryError(error)) {
      throw error
    }

    return (
      <main className="px-10 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">ダッシュボード</h1>
          <p className="text-xl text-gray-400 mt-1">モバイルアプリ開発部 — チーム全体の状況を把握</p>
        </div>
        <section className="rounded-radius-xl border border-amber-200 bg-amber-50 p-6 text-gray-800">
          <h2 className="text-2xl font-semibold text-amber-900">メンバーデータを読み込めません</h2>
          <p className="mt-3 text-base leading-7">{error.hint}</p>
          <dl className="mt-4 space-y-2 text-sm text-amber-900/90">
            <div>
              <dt className="font-semibold">参照モード</dt>
              <dd>{error.mode === 'demo' ? 'demo' : 'standard'}</dd>
            </div>
            <div>
              <dt className="font-semibold">参照先ディレクトリ</dt>
              <dd>{error.directoryPath}</dd>
            </div>
          </dl>
        </section>
      </main>
    )
  }
}
