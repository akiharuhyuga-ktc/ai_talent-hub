'use client'

import { useState, useEffect } from 'react'
import type {
  EvaluationWizardState,
  EvaluationWizardContextData,
  EvaluationDraft,
  EvaluationGrade,
} from '@/lib/types'

const gradeColorMap: Record<string, { bg: string; text: string; border: string }> = {
  S: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' },
  A: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  B: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-300' },
  C: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-300' },
  D: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-300' },
}

function GradeBadge({ grade, size = 'normal' }: { grade: EvaluationGrade | ''; size?: 'normal' | 'large' }) {
  if (!grade) return null
  const colors = gradeColorMap[grade] || gradeColorMap['B']
  const sizeClasses = size === 'large'
    ? 'w-16 h-16 text-3xl'
    : 'w-10 h-10 text-xl'
  return (
    <span className={`inline-flex items-center justify-center rounded-xl font-bold border-2 ${sizeClasses} ${colors.bg} ${colors.text} ${colors.border}`}>
      {grade}
    </span>
  )
}

interface Props {
  state: EvaluationWizardState
  context: EvaluationWizardContextData
  onDraftGenerated: (draft: EvaluationDraft) => void
  onBack: () => void
}

export function EvalStep2AIDraft({ state, context, onDraftGenerated, onBack }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<EvaluationDraft | null>(state.aiDraft)

  useEffect(() => {
    if (state.aiDraft) {
      setDraft(state.aiDraft)
      setLoading(false)
      return
    }

    const fetchDraft = async () => {
      setLoading(true)
      setError('')
      try {
        const oneOnOneSummaries = context.oneOnOneRecords
          .map(r => r.rawMarkdown)
          .join('\n\n---\n\n')

        const res = await fetch(`/api/members/${encodeURIComponent(context.memberName)}/reviews/draft`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberProfile: context.memberProfile,
            orgPolicy: context.orgPolicy,
            evaluationCriteria: context.evaluationCriteria,
            guidelines: context.guidelines,
            goalsRawMarkdown: context.goalsRawMarkdown,
            oneOnOneSummaries,
            previousReview: context.previousReview,
            selfEvaluation: state.selfEvaluation,
            managerSupplementary: state.managerSupplementary,
          }),
        })

        if (res.status === 503) {
          setError('API未設定のためAI評価を生成できません。手動で評価を入力してください。')
          setLoading(false)
          return
        }

        if (!res.ok) {
          setError('AI評価の生成に失敗しました。もう一度お試しください。')
          setLoading(false)
          return
        }

        const data = await res.json()
        if (data.draft) {
          setDraft(data.draft)
        } else {
          setError('AI評価の生成に失敗しました。')
        }
      } catch {
        setError('AI評価の生成に失敗しました。ネットワーク接続を確認してください。')
      } finally {
        setLoading(false)
      }
    }
    fetchDraft()
  }, [state.aiDraft, context, state.selfEvaluation, state.managerSupplementary])

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-3">AI評価ドラフト</h2>
      <p className="text-xl text-gray-500 mb-8">収集した情報をもとにAIが評価ドラフトを生成しました。</p>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-5" />
          <p className="text-xl text-gray-500">AIが評価ドラフトを生成しています...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-5 mb-8">
          <p className="text-xl text-red-600">{error}</p>
        </div>
      )}

      {draft && !loading && (
        <div className="space-y-8 mb-10">
          {/* Goal evaluations */}
          <div>
            <h3 className="text-xl font-medium text-gray-700 mb-4">目標別評価</h3>
            <div className="space-y-4">
              {draft.goalEvaluations.map((ge, i) => (
                <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center gap-4 mb-3">
                    <GradeBadge grade={ge.grade as EvaluationGrade} />
                    <h4 className="text-xl font-medium text-gray-800">{ge.goalLabel}</h4>
                  </div>
                  <p className="text-xl text-gray-600 leading-relaxed">{ge.rationale}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Overall grade */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
            <div className="flex items-center gap-4 mb-3">
              <h3 className="text-xl font-medium text-gray-700">総合評価</h3>
              <GradeBadge grade={draft.overallGrade as EvaluationGrade} size="large" />
            </div>
            <p className="text-xl text-gray-600 leading-relaxed">{draft.overallRationale}</p>
          </div>

          {/* Self-eval gap */}
          {draft.selfEvalGap && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <h3 className="text-xl font-medium text-amber-700 mb-3">自己評価との乖離分析</h3>
              <p className="text-xl text-gray-700 leading-relaxed">{draft.selfEvalGap}</p>
            </div>
          )}

          {/* Special notes */}
          {draft.specialNotes && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-xl font-medium text-blue-700 mb-3">特記事項</h3>
              <p className="text-xl text-gray-700 leading-relaxed">{draft.specialNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-4 text-xl border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          戻る
        </button>
        {draft && !loading && (
          <button
            onClick={() => onDraftGenerated(draft)}
            className="flex-1 py-4 text-xl bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
          >
            確認・修正へ進む
          </button>
        )}
      </div>
    </div>
  )
}
