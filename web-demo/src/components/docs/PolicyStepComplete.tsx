'use client'

interface PolicyStepCompleteProps {
  targetYear: number
  onClose: () => void
}

export function PolicyStepComplete({ targetYear, onClose }: PolicyStepCompleteProps) {
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
        <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-4xl font-bold text-gray-800 mb-4">
        {targetYear}年度の組織方針を保存しました
      </h2>
      <p className="text-xl text-gray-500 mb-10">
        組織方針タブから確認できます
      </p>
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={onClose}
          className="px-10 py-4 text-xl bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
        >
          組織方針を確認する
        </button>
        <button
          onClick={onClose}
          className="text-xl text-gray-500 hover:text-gray-700 transition-colors"
        >
          閉じる
        </button>
      </div>
    </div>
  )
}
