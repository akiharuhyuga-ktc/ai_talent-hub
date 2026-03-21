'use client'

import { useState, useEffect } from 'react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import type { GoalWizardState, WizardContextData } from '@/lib/types'

interface Props {
  state: GoalWizardState
  context: WizardContextData
  onConfirm: (diagnosis: string) => void
  onBack: () => void
}

export function Step5Diagnosis({ state, context, onConfirm, onBack }: Props) {
  const [diagnosis, setDiagnosis] = useState(state.diagnosis || '')
  const [loading, setLoading] = useState(!state.diagnosis)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (state.diagnosis) return
    const fetchDiagnosis = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/members/${encodeURIComponent(context.memberName)}/goals/diagnosis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberContext: context.memberProfile,
            managerInput: state.managerInput,
            memberInput: state.memberInput,
            previousPeriod: state.previousPeriod.previousGoals ? state.previousPeriod : undefined,
          }),
        })
        const data = await res.json()
        if (data.diagnosis) {
          setDiagnosis(data.diagnosis)
        } else {
          setError('診断の生成に失敗しました')
        }
      } catch {
        setError('診断の生成に失敗しました')
      } finally {
        setLoading(false)
      }
    }
    fetchDiagnosis()
  }, [state.diagnosis, state.managerInput, state.memberInput, state.previousPeriod, context.memberName, context.memberProfile])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-5" />
        <p className="text-xl text-gray-500">AIが診断サマリーを生成しています...</p>
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
      <h2 className="text-4xl font-bold text-gray-800 mb-3">診断サマリー</h2>
      <p className="text-xl text-gray-500 mb-8">
        インプット情報をもとにAIが診断を行いました。内容を確認してください。
      </p>

      {editing ? (
        <textarea
          value={diagnosis}
          onChange={e => setDiagnosis(e.target.value)}
          rows={12}
          className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none mb-8"
        />
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 mb-8">
          <MarkdownRenderer content={diagnosis} />
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-4 text-xl border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors">
          戻る
        </button>
        <button
          onClick={() => setEditing(!editing)}
          className="flex-1 py-4 text-xl border border-amber-300 text-amber-700 bg-amber-50 rounded-lg font-medium hover:bg-amber-100 transition-colors"
        >
          {editing ? 'プレビュー' : '修正する'}
        </button>
        <button
          onClick={() => onConfirm(diagnosis)}
          className="flex-1 py-4 text-xl bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
        >
          この診断で進む
        </button>
      </div>
    </div>
  )
}
