'use client'

import { useState } from 'react'
import type { PreviousPeriod } from '@/lib/types'

interface Props {
  initial: PreviousPeriod
  onNext: (data: PreviousPeriod) => void
  onSkip: () => void
  onBack: () => void
}

export function Step4PreviousPeriod({ initial, onNext, onSkip, onBack }: Props) {
  const [form, setForm] = useState<PreviousPeriod>(initial)

  const isValid = form.previousGoals.trim() && form.achievementLevel !== ''

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-3">前期実績データ</h2>
      <p className="text-xl text-gray-500 mb-8">
        前期の実績を入力してください。情報がない場合はスキップできます。
      </p>

      <div className="space-y-6 mb-10">
        <div>
          <label className="block text-xl font-medium text-gray-700 mb-2">
            前期の主な目標 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.previousGoals}
            onChange={e => setForm({ ...form, previousGoals: e.target.value })}
            rows={5}
            placeholder="前期に設定していた主要な目標を記入してください"
            className="w-full border border-gray-200 rounded-xl bg-[#fafbfc] px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
          />
        </div>
        <div>
          <label className="block text-xl font-medium text-gray-700 mb-2">
            達成レベル <span className="text-red-500">*</span>
          </label>
          <select
            value={form.achievementLevel}
            onChange={e => setForm({ ...form, achievementLevel: e.target.value as PreviousPeriod['achievementLevel'] })}
            className="w-full border border-gray-200 rounded-xl px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-brand-400 bg-[#fafbfc]"
          >
            <option value="">選択してください</option>
            <option value="achieved">達成</option>
            <option value="mostly-achieved">概ね達成</option>
            <option value="not-achieved">未達</option>
          </select>
        </div>
        {form.achievementLevel === 'not-achieved' && (
          <div>
            <label className="block text-xl font-medium text-gray-700 mb-2">
              未達の理由
            </label>
            <textarea
              value={form.reasonIfNotAchieved}
              onChange={e => setForm({ ...form, reasonIfNotAchieved: e.target.value })}
              rows={2}
              placeholder="未達となった主な理由を記入してください"
              className="w-full border border-gray-200 rounded-xl bg-[#fafbfc] px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-4">
        <button onClick={onBack} className="px-10 py-3.5 text-xl border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors">
          戻る
        </button>
        <button onClick={onSkip} className="px-8 py-3.5 text-xl border border-gray-200 text-gray-500 rounded-xl font-medium hover:bg-gray-50 transition-colors">
          スキップ
        </button>
        <button
          onClick={() => onNext(form)}
          disabled={!isValid}
          className="px-10 py-3.5 text-xl bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-glow disabled:opacity-40 disabled:cursor-not-allowed"
        >
          次へ進む
        </button>
      </div>
    </div>
  )
}
