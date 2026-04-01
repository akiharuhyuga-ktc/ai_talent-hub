'use client'

import { useState } from 'react'

interface ThemesData {
  envChanges: string
  techChanges: string
  focusThemes: string
}

interface PolicyStep3AThemesProps {
  onNext: (data: ThemesData) => void
  onBack: () => void
}

export function PolicyStep3AThemes({ onNext, onBack }: PolicyStep3AThemesProps) {
  const [envChanges, setEnvChanges] = useState('')
  const [techChanges, setTechChanges] = useState('')
  const [focusThemes, setFocusThemes] = useState('')
  const [error, setError] = useState('')

  const handleNext = () => {
    if (!envChanges.trim()) { setError('「事業環境の変化」は必須です'); return }
    if (!techChanges.trim()) { setError('「技術トレンドの変化」は必須です'); return }
    if (!focusThemes.trim()) { setError('「来期の注力テーマ」は必須です'); return }
    setError('')
    onNext({
      envChanges: envChanges.trim(),
      techChanges: techChanges.trim(),
      focusThemes: focusThemes.trim(),
    })
  }

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-3">来期のテーマ設定</h2>
      <p className="text-xl text-gray-500 mb-8">
        来期に向けた環境変化と注力テーマを入力してください
      </p>

      <div className="space-y-6">
        <div>
          <label className="block text-xl font-medium text-gray-700 mb-2">
            事業環境の変化 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={envChanges}
            onChange={e => { setEnvChanges(e.target.value); setError('') }}
            rows={4}
            placeholder="例: 新規プロダクトのローンチ計画、競合動向の変化、組織再編など"
            className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>

        <div>
          <label className="block text-xl font-medium text-gray-700 mb-2">
            技術トレンドの変化 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={techChanges}
            onChange={e => { setTechChanges(e.target.value); setError('') }}
            rows={4}
            placeholder="例: AI/LLMの進化、新フレームワークの登場、セキュリティ要件の強化など"
            className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>

        <div>
          <label className="block text-xl font-medium text-gray-700 mb-2">
            来期の注力テーマ <span className="text-red-500">*</span>
          </label>
          <textarea
            value={focusThemes}
            onChange={e => { setFocusThemes(e.target.value); setError('') }}
            rows={4}
            placeholder="例: 開発生産性の向上、AI機能の本番投入、チーム間コラボレーション強化など"
            className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>

        {error && (
          <p className="text-xl text-red-600 bg-red-50 border border-red-200 rounded-lg px-5 py-3">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-4 text-xl border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            戻る
          </button>
          <button
            onClick={handleNext}
            className="flex-1 py-4 text-xl bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 transition-colors"
          >
            次へ進む
          </button>
        </div>
      </div>
    </div>
  )
}
