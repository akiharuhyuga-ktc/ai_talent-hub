import { getActivePeriod } from '@/lib/utils/period'
import { TeamMatrixView } from '@/components/dashboard/TeamMatrixView'

export default function TeamMatrixPage() {
  const activePeriod = getActivePeriod()
  const today = new Date().toISOString().split('T')[0]
  return (
    <main className="px-8 py-7">
      <div className="mb-7">
        <h1 className="text-5xl font-bold text-gray-900">チームマトリクス</h1>
        <p className="text-xl text-gray-500 mt-2">半期ごとのメンバー進捗状況</p>
      </div>
      <TeamMatrixView activePeriod={activePeriod} today={today} />
    </main>
  )
}
