'use client'

import { useState } from 'react'
import type {
  EvaluationWizardState,
  EvaluationDraft,
  GoalEvaluation,
  EvaluationGrade,
} from '@/lib/types'

const GRADE_OPTIONS: EvaluationGrade[] = ['S', 'A', 'B', 'C', 'D']

const gradeColorMap: Record<string, { bg: string; text: string; border: string }> = {
  S: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' },
  A: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  B: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-300' },
  C: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-300' },
  D: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-300' },
}

interface Props {
  state: EvaluationWizardState
  onConfirm: (draft: EvaluationDraft) => void
  onBack: () => void
}

export function EvalStep3Review({ state, onConfirm, onBack }: Props) {
  const aiDraft = state.aiDraft!

  const [goalEvals, setGoalEvals] = useState<GoalEvaluation[]>(
    state.confirmedDraft
      ? state.confirmedDraft.goalEvaluations
      : aiDraft.goalEvaluations.map(ge => ({ ...ge, changeReason: '' }))
  )
  const [overallGrade, setOverallGrade] = useState<EvaluationGrade | ''>(
    state.confirmedDraft ? state.confirmedDraft.overallGrade : aiDraft.overallGrade
  )
  const [overallRationale, setOverallRationale] = useState(
    state.confirmedDraft ? state.confirmedDraft.overallRationale : aiDraft.overallRationale
  )
  const [selfEvalGap, setSelfEvalGap] = useState(
    state.confirmedDraft ? state.confirmedDraft.selfEvalGap : aiDraft.selfEvalGap
  )

  const updateGoalEval = (index: number, updates: Partial<GoalEvaluation>) => {
    setGoalEvals(prev => prev.map((ge, i) => i === index ? { ...ge, ...updates } : ge))
  }

  const isGradeChanged = (index: number) => {
    return goalEvals[index].grade !== aiDraft.goalEvaluations[index]?.grade
  }

  const isValid = (() => {
    // All goals must have grades
    if (goalEvals.some(ge => ge.grade === '')) return false
    // Changed grades must have reasons
    for (let i = 0; i < goalEvals.length; i++) {
      if (isGradeChanged(i) && goalEvals[i].changeReason.trim() === '') return false
    }
    // Overall grade required
    if (overallGrade === '') return false
    return true
  })()

  const handleConfirm = () => {
    const confirmed: EvaluationDraft = {
      goalEvaluations: goalEvals,
      overallGrade,
      overallRationale,
      selfEvalGap,
      specialNotes: aiDraft.specialNotes,
    }
    onConfirm(confirmed)
  }

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-3">評価の確認・修正</h2>
      <p className="text-xl text-gray-500 mb-8">AIドラフトを確認し、必要に応じて修正してください。評価を変更した場合は変更理由の入力が必要です。</p>

      {/* Goal evaluations */}
      <div className="space-y-6 mb-10">
        <h3 className="text-xl font-medium text-gray-700">目標別評価</h3>
        {goalEvals.map((ge, i) => {
          const changed = isGradeChanged(i)
          const colors = ge.grade ? (gradeColorMap[ge.grade] || gradeColorMap['B']) : null
          return (
            <div key={i} className={`border rounded-lg p-6 ${changed ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200 bg-gray-50'}`}>
              <h4 className="text-xl font-medium text-gray-800 mb-4">{ge.goalLabel}</h4>

              <div className="mb-4">
                <label className="block text-xl font-medium text-gray-700 mb-2">評価</label>
                <div className="flex gap-3">
                  {GRADE_OPTIONS.map(g => {
                    const gc = gradeColorMap[g]
                    const isSelected = ge.grade === g
                    return (
                      <button
                        key={g}
                        onClick={() => updateGoalEval(i, { grade: g })}
                        className={`w-14 h-14 rounded-xl text-xl font-bold border-2 transition-colors ${
                          isSelected
                            ? `${gc.bg} ${gc.text} ${gc.border} ring-2 ring-offset-1 ring-indigo-400`
                            : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                        }`}
                      >
                        {g}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xl font-medium text-gray-700 mb-2">判定根拠</label>
                <textarea
                  value={ge.rationale}
                  onChange={e => updateGoalEval(i, { rationale: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                />
              </div>

              {changed && (
                <div>
                  <label className="block text-xl font-medium text-amber-700 mb-2">
                    変更理由 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={ge.changeReason}
                    onChange={e => updateGoalEval(i, { changeReason: e.target.value })}
                    rows={2}
                    placeholder="AIの評価から変更した理由を入力してください"
                    className="w-full border border-amber-300 rounded-lg px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none bg-white"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Overall grade */}
      <div className="mb-8">
        <h3 className="text-xl font-medium text-gray-700 mb-4">総合評価</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="mb-4">
            <label className="block text-xl font-medium text-gray-700 mb-2">総合評価</label>
            <div className="flex gap-3">
              {GRADE_OPTIONS.map(g => {
                const gc = gradeColorMap[g]
                const isSelected = overallGrade === g
                return (
                  <button
                    key={g}
                    onClick={() => setOverallGrade(g)}
                    className={`w-14 h-14 rounded-xl text-xl font-bold border-2 transition-colors ${
                      isSelected
                        ? `${gc.bg} ${gc.text} ${gc.border} ring-2 ring-offset-1 ring-indigo-400`
                        : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    {g}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xl font-medium text-gray-700 mb-2">総合コメント</label>
            <textarea
              value={overallRationale}
              onChange={e => setOverallRationale(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Self-eval gap */}
      <div className="mb-10">
        <h3 className="text-xl font-medium text-gray-700 mb-4">自己評価との乖離分析</h3>
        <textarea
          value={selfEvalGap}
          onChange={e => setSelfEvalGap(e.target.value)}
          rows={3}
          placeholder="自己評価との乖離についての分析"
          className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-4 text-xl border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          戻る
        </button>
        <button
          onClick={handleConfirm}
          disabled={!isValid}
          className="flex-1 py-4 text-xl bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          評価を確定する
        </button>
      </div>
    </div>
  )
}
