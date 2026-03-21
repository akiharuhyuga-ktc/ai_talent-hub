'use client'

const STEPS = [
  { num: 1, label: '情報確認' },
  { num: 2, label: 'マネージャー' },
  { num: 3, label: 'メンバー' },
  { num: 4, label: '前期実績' },
  { num: 5, label: '診断' },
  { num: 6, label: '目標生成' },
  { num: 7, label: '精緻化' },
]

interface WizardStepperProps {
  currentStep: number
  skippedSteps?: number[]
}

export function WizardStepper({ currentStep, skippedSteps = [] }: WizardStepperProps) {
  const visibleSteps = STEPS.filter(s => !skippedSteps.includes(s.num))

  return (
    <div className="flex items-center justify-center gap-1">
      {visibleSteps.map((step, i) => {
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
                {isDone ? '✓' : visibleSteps.indexOf(step) + 1}
              </div>
              <span className={`text-lg mt-1 whitespace-nowrap ${isActive ? 'text-indigo-600 font-semibold' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
            {i < visibleSteps.length - 1 && (
              <div className={`w-10 h-0.5 mx-1 mb-6 ${step.num < currentStep ? 'bg-indigo-300' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
