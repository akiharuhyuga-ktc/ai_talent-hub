import { loadSharedDocs } from '@/lib/fs/shared-docs'
import { DocsTabs } from '@/components/docs/DocsTabs'

export default function DocsPage() {
  const shared = loadSharedDocs()

  return (
    <main className="px-8 py-7">
      <div className="mb-7">
        <h1 className="text-7xl font-bold text-gray-900">組織方針・評価基準</h1>
        <p className="text-3xl text-gray-500 mt-2">共有ドキュメント — モバイルアプリ開発部</p>
      </div>
      <DocsTabs
        orgPolicy={shared.orgPolicy}
        policyYear={shared.policyYear}
        availableYears={shared.availableYears}
        criteria={shared.criteria}
        guidelines={shared.guidelines}
      />
    </main>
  )
}
