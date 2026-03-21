'use client'

import { useState } from 'react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import type {
  EvaluationWizardState,
  EvaluationWizardContextData,
  SelfEvaluation,
  ManagerSupplementary,
  EvaluationGrade,
} from '@/lib/types'

const GRADE_OPTIONS: { value: EvaluationGrade; label: string }[] = [
  { value: 'S', label: 'S' },
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
  { value: 'D', label: 'D' },
]

interface Props {
  state: EvaluationWizardState
  context: EvaluationWizardContextData
  onNext: (selfEval: SelfEvaluation, supplement: ManagerSupplementary) => void
}

export function EvalStep1Materials({ state, context, onNext }: Props) {
  const [selfEval, setSelfEval] = useState<SelfEvaluation>(
    state.selfEvaluation.score
      ? state.selfEvaluation
      : { score: '', achievementComment: '', reflectionComment: '' }
  )
  const [supplement, setSupplement] = useState<ManagerSupplementary>(
    state.managerSupplementary.notableEpisodes
      ? state.managerSupplementary
      : { notableEpisodes: '', environmentChanges: '' }
  )

  const hasNoOneOnOnes = context.oneOnOneRecords.length === 0

  const latestCondition = (() => {
    if (context.oneOnOneRecords.length === 0) return null
    const latest = context.oneOnOneRecords[0]
    const lines = latest.rawMarkdown.split('\n')
    let inCondition = false
    const scores: { label: string; value: string }[] = []
    for (const line of lines) {
      if (line.startsWith('## コンディション')) { inCondition = true; continue }
      if (inCondition && line.startsWith('## ')) break
      if (!inCondition) continue
      const match = line.match(/^- (.+?)[：:](.+)/)
      if (match) scores.push({ label: match[1], value: match[2].trim() })
    }
    return scores.length > 0 ? scores : null
  })()

  const isValid =
    selfEval.score !== '' &&
    selfEval.achievementComment.trim() !== '' &&
    selfEval.reflectionComment.trim() !== ''

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-3">評価材料の確認・入力</h2>
      <p className="text-xl text-gray-500 mb-8">自動収集されたデータを確認し、自己評価とマネージャー補足を入力してください。</p>

      {/* Auto-collected data cards */}
      <div className="space-y-6 mb-10">
        {/* Goals summary */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-xl font-medium text-gray-700 mb-3">目標情報</h3>
          {context.goalsRawMarkdown ? (
            <div className="max-h-48 overflow-y-auto bg-white border border-gray-100 rounded-lg p-4">
              <MarkdownRenderer content={context.goalsRawMarkdown} />
            </div>
          ) : (
            <p className="text-lg text-gray-400">目標データがありません。</p>
          )}
        </div>

        {/* 1on1 records */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-xl font-medium text-gray-700 mb-3">1on1記録</h3>
          {hasNoOneOnOnes ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-lg text-amber-700">
                1on1記録がありません。マネージャー補足情報に詳しい情報を入力してください。
              </p>
            </div>
          ) : (
            <div>
              <p className="text-lg text-gray-600 mb-2">
                記録数：<span className="font-semibold">{context.oneOnOneRecords.length}件</span>
              </p>
              {latestCondition && (
                <div>
                  <p className="text-lg text-gray-500 mb-2">最新のコンディションスコア：</p>
                  <div className="flex flex-wrap gap-3">
                    {latestCondition.map((s, i) => (
                      <span key={i} className="text-lg bg-white border border-gray-200 rounded-lg px-4 py-2">
                        {s.label}：<span className="font-semibold text-indigo-600">{s.value}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Member profile grade */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-xl font-medium text-gray-700 mb-3">メンバープロフィール</h3>
          {context.memberProfile ? (
            <div className="max-h-48 overflow-y-auto bg-white border border-gray-100 rounded-lg p-4">
              <MarkdownRenderer content={context.memberProfile} />
            </div>
          ) : (
            <p className="text-lg text-gray-400">プロフィールデータがありません。</p>
          )}
        </div>
      </div>

      {/* Self-evaluation form */}
      <div className="mb-10">
        <h3 className="text-xl font-medium text-gray-700 mb-2">自己評価</h3>
        <p className="text-lg text-gray-400 mb-4">カオナビの自己評価を参照して入力してください</p>

        <div className="space-y-5">
          <div>
            <label className="block text-xl font-medium text-gray-700 mb-2">
              自己評価スコア <span className="text-red-500">*</span>
            </label>
            <select
              value={selfEval.score}
              onChange={e => setSelfEval({ ...selfEval, score: e.target.value as EvaluationGrade | '' })}
              className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">選択してください</option>
              {GRADE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xl font-medium text-gray-700 mb-2">
              達成状況コメント <span className="text-red-500">*</span>
            </label>
            <textarea
              value={selfEval.achievementComment}
              onChange={e => setSelfEval({ ...selfEval, achievementComment: e.target.value })}
              rows={4}
              placeholder="目標に対する達成状況を記入してください"
              className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>

          <div>
            <label className="block text-xl font-medium text-gray-700 mb-2">
              振り返りコメント <span className="text-red-500">*</span>
            </label>
            <textarea
              value={selfEval.reflectionComment}
              onChange={e => setSelfEval({ ...selfEval, reflectionComment: e.target.value })}
              rows={4}
              placeholder="期間を振り返っての所感を記入してください"
              className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Manager supplementary */}
      <div className="mb-10">
        <h3 className="text-xl font-medium text-gray-700 mb-4">マネージャー補足情報</h3>

        <div className="space-y-5">
          <div>
            <label className="block text-xl font-medium text-gray-700 mb-2">特筆すべきエピソード</label>
            <textarea
              value={supplement.notableEpisodes}
              onChange={e => setSupplement({ ...supplement, notableEpisodes: e.target.value })}
              rows={3}
              placeholder="評価に影響する具体的なエピソードがあれば入力してください"
              className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>

          <div>
            <label className="block text-xl font-medium text-gray-700 mb-2">環境変化・特殊事情</label>
            <p className="text-lg text-gray-400 mb-2">評価の文脈を正確に読むために重要です</p>
            <textarea
              value={supplement.environmentChanges}
              onChange={e => setSupplement({ ...supplement, environmentChanges: e.target.value })}
              rows={3}
              placeholder="組織変更、プロジェクト変動、本人の事情など"
              className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Next button */}
      <div className="flex gap-3">
        <button
          onClick={() => onNext(selfEval as SelfEvaluation, supplement)}
          disabled={!isValid}
          className="flex-1 py-4 text-xl bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          次へ進む
        </button>
      </div>
    </div>
  )
}
