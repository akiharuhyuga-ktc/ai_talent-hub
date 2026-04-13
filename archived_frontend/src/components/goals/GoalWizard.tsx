'use client'

import { useReducer } from 'react'
import { WizardStepper } from './WizardStepper'
import { Step1AutoLoad } from './steps/Step1AutoLoad'
import { Step2ManagerInput } from './steps/Step2ManagerInput'
import { Step3MemberInput } from './steps/Step3MemberInput'
import { Step4PreviousPeriod } from './steps/Step4PreviousPeriod'
import { Step5Diagnosis } from './steps/Step5Diagnosis'
import { Step6GoalGeneration } from './steps/Step6GoalGeneration'
import { Step7Refinement } from './steps/Step7Refinement'
import { formatPeriodLabel } from '@/lib/utils/period'
import type { GoalWizardState, WizardContextData, ManagerInput, MemberInput, PreviousPeriod, ChatMessage } from '@/lib/types'

type Action =
  | { type: 'SET_MANAGER_INPUT'; payload: ManagerInput }
  | { type: 'SET_MEMBER_INPUT'; payload: MemberInput }
  | { type: 'SET_PREVIOUS_PERIOD'; payload: PreviousPeriod }
  | { type: 'SET_DIAGNOSIS'; payload: string }
  | { type: 'CONFIRM_DIAGNOSIS'; payload: string }
  | { type: 'SET_GENERATED_GOALS'; payload: { shortTermGoals: string; capabilityGoals: string } }
  | { type: 'ADD_REFINEMENT'; payload: { messages: ChatMessage[]; shortTermGoals: string; capabilityGoals: string; count: number } }
  | { type: 'SET_FINAL_GOALS'; payload: string }
  | { type: 'GO_TO_STEP'; payload: number }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }

const initialState: GoalWizardState = {
  currentStep: 1,
  managerInput: { expectations: '', biggestChallenge: '' },
  memberInput: { growthArea: '', currentDifficulties: '', oneYearVision: '' },
  previousPeriod: { previousGoals: '', achievementLevel: '', reasonIfNotAchieved: '' },
  diagnosis: null,
  diagnosisConfirmed: false,
  shortTermGoals: null,
  capabilityGoals: null,
  refinementMessages: [],
  refinementCount: 0,
  finalGoals: null,
}

function reducer(state: GoalWizardState, action: Action): GoalWizardState {
  switch (action.type) {
    case 'SET_MANAGER_INPUT':
      return { ...state, managerInput: action.payload, currentStep: 3 }
    case 'SET_MEMBER_INPUT':
      return { ...state, memberInput: action.payload, currentStep: 4 }
    case 'SET_PREVIOUS_PERIOD':
      return { ...state, previousPeriod: action.payload, currentStep: 5, diagnosis: null, diagnosisConfirmed: false }
    case 'SET_DIAGNOSIS':
      return { ...state, diagnosis: action.payload }
    case 'CONFIRM_DIAGNOSIS':
      return { ...state, diagnosis: action.payload, diagnosisConfirmed: true, currentStep: 6, shortTermGoals: null, capabilityGoals: null }
    case 'SET_GENERATED_GOALS':
      return { ...state, shortTermGoals: action.payload.shortTermGoals, capabilityGoals: action.payload.capabilityGoals, currentStep: 7 }
    case 'ADD_REFINEMENT':
      return { ...state, refinementMessages: action.payload.messages, shortTermGoals: action.payload.shortTermGoals, capabilityGoals: action.payload.capabilityGoals, refinementCount: action.payload.count }
    case 'SET_FINAL_GOALS':
      return { ...state, finalGoals: action.payload }
    case 'GO_TO_STEP':
      return { ...state, currentStep: action.payload }
    case 'NEXT_STEP':
      return { ...state, currentStep: state.currentStep + 1 }
    case 'PREV_STEP':
      return { ...state, currentStep: Math.max(1, state.currentStep - 1) }
    default:
      return state
  }
}

interface GoalWizardProps {
  context: WizardContextData
  onClose: () => void
}

export function GoalWizard({ context, onClose }: GoalWizardProps) {
  const targetPeriod = context.targetPeriod
  const [state, dispatch] = useReducer(reducer, initialState)

  const renderStep = () => {
    switch (state.currentStep) {
      case 1:
        return <Step1AutoLoad context={context} onNext={() => dispatch({ type: 'NEXT_STEP' })} />
      case 2:
        return (
          <Step2ManagerInput
            initial={state.managerInput}
            memberName={context.memberName}
            onNext={data => dispatch({ type: 'SET_MANAGER_INPUT', payload: data })}
            onBack={() => dispatch({ type: 'PREV_STEP' })}
          />
        )
      case 3:
        return (
          <Step3MemberInput
            initial={state.memberInput}
            memberName={context.memberName}
            onNext={data => dispatch({ type: 'SET_MEMBER_INPUT', payload: data })}
            onBack={() => dispatch({ type: 'PREV_STEP' })}
          />
        )
      case 4:
        return (
          <Step4PreviousPeriod
            initial={state.previousPeriod}
            onNext={data => dispatch({ type: 'SET_PREVIOUS_PERIOD', payload: data })}
            onSkip={() => dispatch({ type: 'GO_TO_STEP', payload: 5 })}
            onBack={() => dispatch({ type: 'PREV_STEP' })}
          />
        )
      case 5:
        return (
          <Step5Diagnosis
            state={state}
            context={context}
            onConfirm={diag => dispatch({ type: 'CONFIRM_DIAGNOSIS', payload: diag })}
            onBack={() => dispatch({ type: 'PREV_STEP' })}
          />
        )
      case 6:
        return (
          <Step6GoalGeneration
            state={state}
            context={context}
            onGenerated={(shortTermGoals, capabilityGoals) => dispatch({ type: 'SET_GENERATED_GOALS', payload: { shortTermGoals, capabilityGoals } })}
            onBack={() => dispatch({ type: 'GO_TO_STEP', payload: 5 })}
          />
        )
      case 7:
        return (
          <Step7Refinement
            state={state}
            context={context}
            onAddRefinement={(msgs, shortTermGoals, capabilityGoals, count) => dispatch({ type: 'ADD_REFINEMENT', payload: { messages: msgs, shortTermGoals, capabilityGoals, count } })}
            onConfirm={goals => { dispatch({ type: 'SET_FINAL_GOALS', payload: goals }) }}
            onBack={() => dispatch({ type: 'GO_TO_STEP', payload: 6 })}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 left-80 z-50 bg-white flex flex-col border-t-2 border-brand-500">
      {/* Header */}
      <div className="flex items-center justify-between px-10 py-5 border-b border-gray-200 bg-white">
        <h1 className="text-3xl font-bold text-brand-900">
          {context.memberName}さんの目標設定 - {formatPeriodLabel(targetPeriod)}
        </h1>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 transition-colors text-xl font-medium"
        >
          ✕ 閉じる
        </button>
      </div>

      {/* Stepper */}
      <div className="px-10 py-5 border-b border-gray-100 bg-[#FAFBFC]">
        <WizardStepper currentStep={state.currentStep} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-10 py-8">
          {renderStep()}
        </div>
      </div>
    </div>
  )
}
