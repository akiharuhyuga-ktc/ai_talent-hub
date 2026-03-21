'use client'

import { useState } from 'react'

interface CurrentStateData {
  teamInfo: string
  techDomains: string
  challenges: string
  strengths: string
  mission: string
  themes: string
}

interface PolicyStep2BCurrentStateProps {
  onNext: (data: CurrentStateData) => void
  onBack: () => void
}

export function PolicyStep2BCurrentState({ onNext, onBack }: PolicyStep2BCurrentStateProps) {
  const [teamInfo, setTeamInfo] = useState('')
  const [techDomains, setTechDomains] = useState('')
  const [challenges, setChallenges] = useState('')
  const [strengths, setStrengths] = useState('')
  const [mission, setMission] = useState('')
  const [themes, setThemes] = useState('')
  const [error, setError] = useState('')

  const handleNext = () => {
    if (!teamInfo.trim()) { setError('「チーム構成・規模」は必須です'); return }
    if (!techDomains.trim()) { setError('「技術領域・担当プロダクト」は必須です'); return }
    if (!challenges.trim()) { setError('「現在の課題」は必須です'); return }
    if (!strengths.trim()) { setError('「組織の強み」は必須です'); return }
    if (!mission.trim()) { setError('「ミッション・役割」は必須です'); return }
    setError('')
    onNext({
      teamInfo: teamInfo.trim(),
      techDomains: techDomains.trim(),
      challenges: challenges.trim(),
      strengths: strengths.trim(),
      mission: mission.trim(),
      themes: themes.trim(),
    })
  }

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-3">組織の現状把握</h2>
      <p className="text-xl text-gray-500 mb-8">
        組織の現状を入力してください。AIが方針の骨格を提案します。
      </p>

      <div className="space-y-6">
        <div>
          <label className="block text-xl font-medium text-gray-700 mb-2">
            チーム構成・規模 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={teamInfo}
            onChange={e => { setTeamInfo(e.target.value); setError('') }}
            rows={3}
            placeholder="例: 3チーム編成（Flutter/KMP/Producer）、計24名"
            className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div>
          <label className="block text-xl font-medium text-gray-700 mb-2">
            技術領域・担当プロダクト <span className="text-red-500">*</span>
          </label>
          <textarea
            value={techDomains}
            onChange={e => { setTechDomains(e.target.value); setError('') }}
            rows={3}
            placeholder="例: モバイルアプリ開発（Flutter/KMP）、AI機能PoC、販売店DXアプリ"
            className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div>
          <label className="block text-xl font-medium text-gray-700 mb-2">
            現在の課題 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={challenges}
            onChange={e => { setChallenges(e.target.value); setError('') }}
            rows={3}
            placeholder="例: 属人化の解消、テスト自動化の不足、ナレッジ共有の仕組み"
            className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div>
          <label className="block text-xl font-medium text-gray-700 mb-2">
            組織の強み <span className="text-red-500">*</span>
          </label>
          <textarea
            value={strengths}
            onChange={e => { setStrengths(e.target.value); setError('') }}
            rows={3}
            placeholder="例: 多国籍チームの多様性、新技術への積極的な取り組み"
            className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div>
          <label className="block text-xl font-medium text-gray-700 mb-2">
            ミッション・役割 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={mission}
            onChange={e => { setMission(e.target.value); setError('') }}
            rows={3}
            placeholder="例: 全社のモバイル戦略を推進し、ユーザー体験の向上を担う"
            className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div>
          <label className="block text-xl font-medium text-gray-700 mb-2">
            注力したいテーマ <span className="text-lg text-gray-400 font-normal ml-2">（任意）</span>
          </label>
          <textarea
            value={themes}
            onChange={e => setThemes(e.target.value)}
            rows={3}
            placeholder="例: AI活用の推進、開発プロセスの改善、人材育成"
            className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
            className="flex-1 py-4 text-xl bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
          >
            次へ進む
          </button>
        </div>
      </div>
    </div>
  )
}
