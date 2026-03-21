'use client'

import type { WizardContextData } from '@/lib/types'

interface Props {
  context: WizardContextData
  onNext: () => void
}

function InfoCard({ label, loaded }: { label: string; loaded: boolean }) {
  return (
    <div className="flex items-center gap-3 p-5 bg-gray-50 rounded-lg border border-gray-200">
      <span className={`text-2xl ${loaded ? 'text-green-500' : 'text-gray-300'}`}>
        {loaded ? '✓' : '○'}
      </span>
      <span className="text-xl text-gray-700">{label}</span>
      <span className={`ml-auto text-lg px-3 py-1 rounded-full ${loaded ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
        {loaded ? '読込済み' : '未読込'}
      </span>
    </div>
  )
}

export function Step1AutoLoad({ context, onNext }: Props) {
  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-3">固定情報の確認</h2>
      <p className="text-xl text-gray-500 mb-8">目標設定に必要な情報が読み込まれていることを確認してください。</p>

      <div className="space-y-4 mb-10">
        <InfoCard label="グループ方針" loaded={!!context.departmentPolicy} />
        <InfoCard label="育成基準・評価基準" loaded={!!context.evaluationCriteria} />
        <InfoCard label={`メンバープロフィール（${context.memberName}）`} loaded={!!context.memberProfile} />
        <InfoCard label="運用ガイドライン" loaded={!!context.guidelines} />
      </div>

      <button
        onClick={onNext}
        className="w-full py-4 text-xl bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
      >
        次へ進む
      </button>
    </div>
  )
}
