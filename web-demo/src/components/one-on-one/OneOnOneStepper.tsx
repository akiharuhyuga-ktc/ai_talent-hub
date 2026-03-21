'use client'

const STEPS = [
  { num: 1, label: 'アクション振返り' },
  { num: 2, label: '目標進捗' },
  { num: 3, label: 'コンディション' },
  { num: 4, label: 'ヒアリング' },
  { num: 5, label: 'アクション設定' },
]

interface OneOnOneStepperProps {
  currentStep: number
}

export function OneOnOneStepper({ currentStep }: OneOnOneStepperProps) {
  return (
    <div className="flex items-center justify-center gap-1">
      {STEPS.map((step, i) => {
        const isActive = step.num === currentStep
        const isDone = step.num < currentStep
        return (
          <div key={step.num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold border-2 transition-colors ${
                isActive ? 'bg-indigo-600 text-white border-indigo-600' :
                isDone ? 'bg-indigo-100 text-indigo-600 border-indigo-300' :
                'bg-gray-100 text-gray-400 border-gray-200'
              }`}>
                {isDone ? '✓' : step.num}
              </div>
              <span className={`text-lg mt-1 whitespace-nowrap ${isActive ? 'text-indigo-600 font-semibold' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-10 h-0.5 mx-1 mb-6 ${step.num < currentStep ? 'bg-indigo-300' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
