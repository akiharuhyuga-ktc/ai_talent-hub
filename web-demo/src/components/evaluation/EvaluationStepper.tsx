'use client'

import { Check } from 'lucide-react'

const STEPS = [
  { num: 1, label: '評価材料' },
  { num: 2, label: 'AI評価' },
  { num: 3, label: '確認・修正' },
  { num: 4, label: 'コメント作成' },
]

interface EvaluationStepperProps {
  currentStep: number
}

export function EvaluationStepper({ currentStep }: EvaluationStepperProps) {
  return (
    <div className="flex items-center justify-center gap-1">
      {STEPS.map((step, i) => {
        const isActive = step.num === currentStep
        const isDone = step.num < currentStep
        return (
          <div key={step.num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold border-2 transition-colors ${
                isActive ? 'bg-brand-600 text-white border-brand-600 shadow-[0_0_0_4px_rgba(25,112,140,0.2)]' :
                isDone ? 'bg-brand-100 text-brand-600 border-brand-300' :
                'bg-gray-100 text-gray-400 border-gray-200'
              }`}>
                {isDone ? <Check size={16} /> : step.num}
              </div>
              <span className={`text-lg mt-1 whitespace-nowrap ${isActive ? 'text-brand-600 font-semibold' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-10 h-0.5 mx-1 mb-6 ${step.num < currentStep ? 'bg-brand-300' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
