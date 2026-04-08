'use client'

import { useState } from 'react'

interface ReviewData {
  whatWorked: string
  whatDidntWork: string
  leftBehind: string
}

interface PolicyStep2AReviewProps {
  onNext: (data: ReviewData) => void
  onBack: () => void
}

export function PolicyStep2AReview({ onNext, onBack }: PolicyStep2AReviewProps) {
  const [whatWorked, setWhatWorked] = useState('')
  const [whatDidntWork, setWhatDidntWork] = useState('')
  const [leftBehind, setLeftBehind] = useState('')
  const [error, setError] = useState('')

  const handleNext = () => {
    if (!whatWorked.trim()) {
      setError('「うまくいったこと」は必須です')
      return
    }
    if (!whatDidntWork.trim()) {
      setError('「うまくいかなかったこと」は必須です')
      return
    }
    setError('')
    onNext({ whatWorked: whatWorked.trim(), whatDidntWork: whatDidntWork.trim(), leftBehind: leftBehind.trim() })
  }

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-3">前年度の振り返り</h2>
      <p className="text-xl text-gray-500 mb-8">
        前年度の活動を振り返り、来期の方針策定に活かします
      </p>

      <div className="space-y-6">
        <div>
          <label className="block text-xl font-medium text-gray-700 mb-2">
            うまくいったこと <span className="text-red-500">*</span>
          </label>
          <textarea
            value={whatWorked}
            onChange={e => { setWhatWorked(e.target.value); setError('') }}
            rows={6}
            placeholder="チームで成功した取り組み、達成できた目標など"
            className="w-full border border-gray-200 rounded-xl bg-[#fafbfc] px-5 py-4 text-xl resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>

        <div>
          <label className="block text-xl font-medium text-gray-700 mb-2">
            うまくいかなかったこと <span className="text-red-500">*</span>
          </label>
          <textarea
            value={whatDidntWork}
            onChange={e => { setWhatDidntWork(e.target.value); setError('') }}
            rows={6}
            placeholder="課題が残った点、改善が必要な領域など"
            className="w-full border border-gray-200 rounded-xl bg-[#fafbfc] px-5 py-4 text-xl resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>

        <div>
          <label className="block text-xl font-medium text-gray-700 mb-2">
            やり残したこと <span className="text-lg text-gray-400 font-normal ml-2">（任意）</span>
          </label>
          <textarea
            value={leftBehind}
            onChange={e => setLeftBehind(e.target.value)}
            rows={5}
            placeholder="着手できなかったこと、来期に持ち越す課題など"
            className="w-full border border-gray-200 rounded-xl bg-[#fafbfc] px-5 py-4 text-xl resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>

        {error && (
          <p className="text-xl text-red-600 bg-red-50 border border-red-200 rounded-lg px-5 py-3">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-4">
          <button
            onClick={onBack}
            className="px-10 py-3.5 text-xl border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            戻る
          </button>
          <button
            onClick={handleNext}
            className="px-10 py-3.5 text-xl bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-glow"
          >
            次へ進む
          </button>
        </div>
      </div>
    </div>
  )
}
