'use client'

import { useReducer, useCallback } from 'react'
import { OneOnOneStepper } from './OneOnOneStepper'
import { OOStep1ActionReview } from './steps/OOStep1ActionReview'
import { OOStep2GoalProgress } from './steps/OOStep2GoalProgress'
import { OOStep3Condition } from './steps/OOStep3Condition'
import { OOStep4Hearing } from './steps/OOStep4Hearing'
import { OOStep5NextActions } from './steps/OOStep5NextActions'
import { OOCompletionScreen } from './OOCompletionScreen'
import { parseGoalEntries } from '@/lib/parsers/goals-entries'
import type {
  OneOnOneWizardState,
  OneOnOneWizardContextData,
  ActionItemReview,
  GoalProgressEntry,
  ConditionScore,
  HearingQuestion,
  ActionItem,
} from '@/lib/types'

type Action =
  | { type: 'SET_ACTION_REVIEWS'; payload: ActionItemReview[] }
  | { type: 'SET_GOAL_PROGRESS'; payload: GoalProgressEntry[] }
  | { type: 'SET_CONDITION'; payload: ConditionScore }
  | { type: 'SET_HEARING'; payload: { questions: HearingQuestion[]; additionalMemo: string } }
  | { type: 'SET_NEXT_ACTIONS'; payload: ActionItem[] }
  | { type: 'SET_PREFETCHED_QUESTIONS'; payload: HearingQuestion[] }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'GO_TO_STEP'; payload: number }

interface WizardInternalState extends OneOnOneWizardState {
  prefetchedQuestions: HearingQuestion[] | null
}

function createInitialState(context: OneOnOneWizardContextData): WizardInternalState {
  const isFirstTime = context.previousOneOnOne === null

  const actionReviews: ActionItemReview[] = context.previousActionItems.map(a => ({
    content: a.content,
    assignee: a.assignee,
    status: '' as const,
    comment: '',
  }))

  return {
    currentStep: 1,
    yearMonth: new Date().toISOString().slice(0, 7),
    actionReviews,
    goalProgress: [],
    condition: { motivation: null, workload: null, teamRelations: null, comment: '' },
    hearingQuestions: [],
    additionalMemo: '',
    nextActions: [],
    aiSummary: null,
    isFirstTime,
    prefetchedQuestions: null,
  }
}

function reducer(state: WizardInternalState, action: Action): WizardInternalState {
  switch (action.type) {
    case 'SET_ACTION_REVIEWS':
      return { ...state, actionReviews: action.payload, currentStep: 2 }
    case 'SET_GOAL_PROGRESS':
      return { ...state, goalProgress: action.payload, currentStep: 3 }
    case 'SET_CONDITION':
      return { ...state, condition: action.payload, currentStep: 4 }
    case 'SET_HEARING':
      return { ...state, hearingQuestions: action.payload.questions, additionalMemo: action.payload.additionalMemo, currentStep: 5 }
    case 'SET_NEXT_ACTIONS':
      return { ...state, nextActions: action.payload, currentStep: 6 }
    case 'SET_PREFETCHED_QUESTIONS':
      return { ...state, prefetchedQuestions: action.payload }
    case 'NEXT_STEP':
      return { ...state, currentStep: state.currentStep + 1 }
    case 'PREV_STEP':
      return { ...state, currentStep: Math.max(1, state.currentStep - 1) }
    case 'GO_TO_STEP':
      return { ...state, currentStep: action.payload }
    default:
      return state
  }
}

function buildPriorityMessage(goals: GoalProgressEntry[]): string | null {
  // Find goals with milestones that may need attention
  const withMilestone = goals.filter(g => g.milestone)
  if (withMilestone.length === 0) return null
  const first = withMilestone[0]
  return `${first.goalLabel}：中間確認基準「${first.milestone}」の進捗を優先確認してください`
}

interface OneOnOneWizardProps {
  context: OneOnOneWizardContextData
  onClose: () => void
}

export function OneOnOneWizard({ context, onClose }: OneOnOneWizardProps) {
  const goalProgress = parseGoalEntries(context.goalsRawMarkdown)
  const priorityMessage = buildPriorityMessage(goalProgress)
  const [state, dispatch] = useReducer(reducer, context, createInitialState)

  // Prefetch AI questions when Step 3 completes (condition is set)
  const prefetchQuestions = useCallback(async (condition: ConditionScore) => {
    try {
      const res = await fetch(`/api/members/${encodeURIComponent(context.memberName)}/one-on-one/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalProgress: state.goalProgress,
          actionReviews: state.actionReviews,
          condition,
          previousCondition: context.previousCondition,
          previousSummary: context.previousSummary,
          orgPolicy: context.orgPolicy,
        }),
      })
      const data = await res.json()
      if (data.questions && Array.isArray(data.questions)) {
        const questions: HearingQuestion[] = data.questions.map((q: { question: string; intent: string }) => ({
          question: q.question,
          intent: q.intent,
          memo: '',
        }))
        dispatch({ type: 'SET_PREFETCHED_QUESTIONS', payload: questions })
      }
    } catch {
      // Prefetch failure is non-critical; Step4 will retry
    }
  }, [context, state.goalProgress, state.actionReviews])

  const handleConditionNext = (condition: ConditionScore) => {
    dispatch({ type: 'SET_CONDITION', payload: condition })
    prefetchQuestions(condition)
  }

  const renderStep = () => {
    switch (state.currentStep) {
      case 1:
        return (
          <OOStep1ActionReview
            actionReviews={state.actionReviews}
            isFirstTime={state.isFirstTime}
            priorityMessage={priorityMessage}
            onNext={reviews => dispatch({ type: 'SET_ACTION_REVIEWS', payload: reviews })}
          />
        )
      case 2:
        return (
          <OOStep2GoalProgress
            goalProgress={goalProgress.length > 0 ? (state.goalProgress.length > 0 ? state.goalProgress : goalProgress) : state.goalProgress}
            onNext={progress => dispatch({ type: 'SET_GOAL_PROGRESS', payload: progress })}
            onBack={() => dispatch({ type: 'PREV_STEP' })}
          />
        )
      case 3:
        return (
          <OOStep3Condition
            initial={state.condition}
            previousCondition={context.previousCondition}
            onNext={handleConditionNext}
            onBack={() => dispatch({ type: 'PREV_STEP' })}
          />
        )
      case 4:
        return (
          <OOStep4Hearing
            state={state}
            context={context}
            onNext={(questions, additionalMemo) => dispatch({ type: 'SET_HEARING', payload: { questions, additionalMemo } })}
            onBack={() => dispatch({ type: 'PREV_STEP' })}
            prefetchedQuestions={state.prefetchedQuestions}
          />
        )
      case 5:
        return (
          <OOStep5NextActions
            onComplete={actions => dispatch({ type: 'SET_NEXT_ACTIONS', payload: actions })}
            onBack={() => dispatch({ type: 'PREV_STEP' })}
          />
        )
      case 6:
        return (
          <OOCompletionScreen
            state={state}
            context={context}
            onClose={onClose}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-16 py-5 border-b border-gray-200 bg-gray-50">
        <h1 className="text-4xl font-bold text-gray-800">
          {context.memberName}さんとの1on1
        </h1>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors text-2xl"
        >
          ✕ 閉じる
        </button>
      </div>

      {/* Stepper */}
      {state.currentStep <= 5 && (
        <div className="px-16 py-5 border-b border-gray-100">
          <OneOnOneStepper currentStep={state.currentStep} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-16 py-8">
          {renderStep()}
        </div>
      </div>
    </div>
  )
}
