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
        <InfoCard label="組織方針" loaded={!!context.orgPolicy} />
        <InfoCard label="育成基準・評価基準" loaded={!!context.evaluationCriteria} />
        <InfoCard label={`メンバープロフィール（${context.memberName}）`} loaded={!!context.memberProfile} />
        <InfoCard label="運用ガイドライン" loaded={!!context.guidelines} />
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          className="px-10 py-3.5 text-xl bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-glow"
        >
          次へ進む
        </button>
      </div>
    </div>
  )
}
