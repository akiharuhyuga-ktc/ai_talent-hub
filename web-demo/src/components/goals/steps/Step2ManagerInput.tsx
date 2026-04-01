'use client'

import { useState } from 'react'
import type { ManagerInput } from '@/lib/types'

interface Props {
  initial: ManagerInput
  memberName: string
  onNext: (data: ManagerInput) => void
  onBack: () => void
}

export function Step2ManagerInput({ initial, memberName, onNext, onBack }: Props) {
  const [form, setForm] = useState<ManagerInput>(initial)

  const isValid = form.expectations.trim() && form.biggestChallenge.trim()

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-3">マネージャーインプット</h2>
      <p className="text-xl text-gray-500 mb-8">{memberName}さんに対する期待と課題認識を入力してください。</p>

      <div className="space-y-6 mb-10">
        <div>
          <label className="block text-xl font-medium text-gray-700 mb-2">
            このメンバーへの期待 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.expectations}
            onChange={e => setForm({ ...form, expectations: e.target.value })}
            rows={4}
            placeholder="来期に期待する役割・成果・成長の方向性を具体的に記入してください"
            className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
          />
        </div>
        <div>
          <label className="block text-xl font-medium text-gray-700 mb-2">
            このメンバーの最大の課題（一言で） <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.biggestChallenge}
            onChange={e => setForm({ ...form, biggestChallenge: e.target.value })}
            placeholder="例：個人作業から脱却し、チーム全体をリードする動きへの転換"
            className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-4 text-xl border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors">
          戻る
        </button>
        <button
          onClick={() => onNext(form)}
          disabled={!isValid}
          className="flex-1 py-4 text-xl bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          次へ進む
        </button>
      </div>
    </div>
  )
}
