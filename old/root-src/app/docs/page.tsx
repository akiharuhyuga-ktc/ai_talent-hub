import fs from 'fs'
import { SHARED_DOCS } from '@/lib/fs/paths'
import { DocsTabs } from '@/components/docs/DocsTabs'

export default function DocsPage() {
  const docs = {
    policy: fs.readFileSync(SHARED_DOCS.policy, 'utf-8'),
    criteria: fs.readFileSync(SHARED_DOCS.criteria, 'utf-8'),
    guidelines: fs.readFileSync(SHARED_DOCS.guidelines, 'utf-8'),
  }

  return (
    <main className="px-8 py-7">
      <div className="mb-7">
        <h1 className="text-7xl font-bold text-gray-900">部方針・評価基準</h1>
        <p className="text-3xl text-gray-500 mt-2">共有ドキュメント — モバイルアプリ開発部</p>
      </div>
      <DocsTabs docs={docs} />
    </main>
  )
}
