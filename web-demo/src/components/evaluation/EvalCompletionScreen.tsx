'use client'

import { useState, useEffect } from 'react'
import type { EvaluationWizardState, EvaluationWizardContextData } from '@/lib/types'

function buildReviewMarkdown(state: EvaluationWizardState, context: EvaluationWizardContextData): string {
  const draft = state.confirmedDraft!
  const today = new Date().toISOString().split('T')[0]
  const lines: string[] = []

  lines.push(`# 評価記録 ${state.period}`)
  lines.push('')
  lines.push(`- 対象期間：${state.period}`)
  lines.push(`- 作成日：${today}`)
  lines.push(`- メンバー：${context.memberName}`)
  lines.push(`- 総合評価：**${draft.overallGrade}**`)
  lines.push('')

  // Goal evaluations
  lines.push('## 目標別評価')
  lines.push('')
  for (const ge of draft.goalEvaluations) {
    lines.push(`### ${ge.goalLabel}`)
    lines.push(`- 達成度：**${ge.grade}**`)
    lines.push(`- 判定根拠：${ge.rationale}`)
    if (ge.changeReason) {
      lines.push(`- マネージャー変更理由：${ge.changeReason}`)
    }
    lines.push('')
  }

  // Overall comment
  lines.push('## 総合コメント')
  lines.push('')
  lines.push(draft.overallRationale)
  lines.push('')

  // Self-eval gap
  if (draft.selfEvalGap) {
    lines.push('## 自己評価との乖離分析')
    lines.push('')
    lines.push(draft.selfEvalGap)
    lines.push('')
  }

  // Evaluator comment
  if (state.evaluatorComment) {
    lines.push('## 評価者コメント')
    lines.push('')
    lines.push(state.evaluatorComment)
    lines.push('')
  }

  // Manager change log
  const changes = draft.goalEvaluations.filter(ge => ge.changeReason)
  if (changes.length > 0) {
    lines.push('## マネージャー変更履歴')
    lines.push('')
    for (const ge of changes) {
      const aiGrade = state.aiDraft?.goalEvaluations.find(a => a.goalLabel === ge.goalLabel)?.grade || '?'
      lines.push(`- ${ge.goalLabel}：AI評価 ${aiGrade} → 確定 ${ge.grade}（理由：${ge.changeReason}）`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

interface Props {
  state: EvaluationWizardState
  context: EvaluationWizardContextData
  onClose: () => void
}

export function EvalCompletionScreen({ state, context, onClose }: Props) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (saving || saved) return

    const saveRecord = async () => {
      setSaving(true)
      setSaveError('')
      try {
        const content = buildReviewMarkdown(state, context)

        const res = await fetch(`/api/members/${encodeURIComponent(context.memberName)}/reviews`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, period: state.period }),
        })

        if (res.ok) {
          setSaved(true)
        } else {
          setSaveError('保存に失敗しました。もう一度お試しください。')
        }
      } catch {
        setSaveError('保存に失敗しました。ネットワーク接続を確認してください。')
      } finally {
        setSaving(false)
      }
    }
    saveRecord()
  }, [saving, saved, state, context])

  const draft = state.confirmedDraft!

  const gradeColorMap: Record<string, { bg: string; text: string; border: string }> = {
    S: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' },
    A: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
    B: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-300' },
    C: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-300' },
    D: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-300' },
  }

  const overallColors = draft.overallGrade ? (gradeColorMap[draft.overallGrade] || gradeColorMap['B']) : gradeColorMap['B']

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-3">評価完了</h2>
      <p className="text-xl text-gray-500 mb-8">評価記録を保存しています。</p>

      {/* Summary */}
      <div className="mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-4 mb-6">
            <span className={`inline-flex items-center justify-center w-20 h-20 rounded-xl text-4xl font-bold border-2 ${overallColors.bg} ${overallColors.text} ${overallColors.border}`}>
              {draft.overallGrade}
            </span>
            <div>
              <p className="text-xl font-medium text-gray-800">{context.memberName}さんの総合評価</p>
              <p className="text-lg text-gray-500">{state.period}</p>
            </div>
          </div>

          <div className="space-y-3">
            {draft.goalEvaluations.map((ge, i) => {
              const colors = ge.grade ? (gradeColorMap[ge.grade] || gradeColorMap['B']) : gradeColorMap['B']
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-lg font-bold border-2 ${colors.bg} ${colors.text} ${colors.border}`}>
                    {ge.grade}
                  </span>
                  <span className="text-xl text-gray-700">{ge.goalLabel}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Save status */}
      {saving && (
        <div className="flex items-center gap-3 text-xl text-gray-500 mb-6">
          <div className="w-6 h-6 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          保存中...
        </div>
      )}

      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-5 mb-8">
          <p className="text-xl text-red-600">{saveError}</p>
        </div>
      )}

      {saved && (
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 text-xl text-green-600 bg-green-50 border border-green-200 rounded-lg px-8 py-4 font-semibold">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            保存完了
          </div>
          <p className="text-lg text-gray-400 mt-4">評価記録が保存されました。</p>
        </div>
      )}

      {(saved || saveError) && (
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-4 text-xl bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
          >
            閉じる
          </button>
        </div>
      )}
    </div>
  )
}
