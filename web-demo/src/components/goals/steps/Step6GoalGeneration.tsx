'use client'

import { useState, useEffect } from 'react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import type { GoalWizardState, WizardContextData } from '@/lib/types'

interface Props {
  state: GoalWizardState
  context: WizardContextData
  onGenerated: (goals: string) => void
  onBack: () => void
}

export function Step6GoalGeneration({ state, context, onGenerated, onBack }: Props) {
  const [goals, setGoals] = useState(state.generatedGoals || '')
  const [loading, setLoading] = useState(!state.generatedGoals)
  const [error, setError] = useState('')

  useEffect(() => {
    if (state.generatedGoals) return
    const fetchGoals = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/members/${encodeURIComponent(context.memberName)}/goals/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberContext: context.memberProfile,
            managerInput: state.managerInput,
            memberInput: state.memberInput,
            previousPeriod: state.previousPeriod.previousGoals ? state.previousPeriod : undefined,
            diagnosis: state.diagnosis,
          }),
        })
        const data = await res.json()
        if (data.goals) {
          setGoals(data.goals)
        } else {
          setError('目標の生成に失敗しました')
        }
      } catch {
        setError('目標の生成に失敗しました')
      } finally {
        setLoading(false)
      }
    }
    fetchGoals()
  }, [state.generatedGoals, state.managerInput, state.memberInput, state.previousPeriod, state.diagnosis, context.memberName, context.memberProfile])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-5" />
        <p className="text-xl text-gray-500">AIが目標を設計しています...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-xl text-red-500 mb-5">{error}</p>
        <button onClick={onBack} className="px-8 py-3 text-xl border border-gray-300 rounded-lg hover:bg-gray-50">戻る</button>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-3">目標案</h2>
      <p className="text-xl text-gray-500 mb-8">
        診断サマリーとインプットをもとにAIが目標を設計しました。次のステップで壁打ち・精緻化ができます。
      </p>

      <div className="bg-white border border-gray-200 rounded-lg p-8 mb-8">
        <MarkdownRenderer content={goals} />
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-4 text-xl border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors">
          戻る
        </button>
        <button
          onClick={() => onGenerated(goals)}
          className="flex-1 py-4 text-xl bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
        >
          壁打ちへ進む
        </button>
      </div>
    </div>
  )
}
