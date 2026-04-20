'use client'

import { useState, useRef, useMemo } from 'react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatPeriodLabel, sortPeriods } from '@/lib/utils/period'
import { parseGoalsToSections, mergeGoalSections, stripGoalHeading } from '@/lib/parsers/goals'
import { parseGoalFields, assembleGoalMarkdown } from '@/lib/goals/field-parser'
import { GoalFieldContent } from '@/components/member/GoalFieldContent'
import { Trash2 } from 'lucide-react'
import type { GoalsData, SingleGoal } from '@/lib/types'

interface GoalsTabProps {
  goalsByPeriod: Record<string, GoalsData>
  activePeriod: string
  memberName: string
  memberProfile: string
  onStartWizard?: (period: string) => void
  isWizardOpen?: boolean
  onGoalsUpdated?: () => void
}

type EditMode = { type: 'manual'; label: string; draft: string }
  | { type: 'ai'; label: string; instruction: string; preview: string | null; streaming: boolean }
  | null

export function GoalsTab({
  goalsByPeriod,
  activePeriod,
  memberName,
  memberProfile,
  onStartWizard,
  isWizardOpen = false,
  onGoalsUpdated,
}: GoalsTabProps) {
  const periods = Object.keys(goalsByPeriod)
  const activeMatch = activePeriod.match(/^(\d{4})-(h[12])$/)
  const nextPeriod = activeMatch
    ? activeMatch[2] === 'h1' ? `${activeMatch[1]}-h2` : `${parseInt(activeMatch[1]) + 1}-h1`
    : null
  const periodSet = new Set(periods)
  periodSet.add(activePeriod)
  if (nextPeriod) periodSet.add(nextPeriod)
  const allPeriods = sortPeriods(Array.from(periodSet))

  const [selectedPeriod, setSelectedPeriod] = useState(activePeriod)
  const [editMode, setEditMode] = useState<EditMode>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [copyMsg, setCopyMsg] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const stripMarkdown = (text: string): string =>
    text
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/^---+$/gm, '')
      .replace(/^\s*[-*]\s+/gm, '・')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

  const goals = goalsByPeriod[selectedPeriod] ?? null

  // 新フォーマット判定（## ① 短期成果評価_目標 ヘッダーの有無）
  const isNewFormat = !!goals && goals.rawMarkdown.includes('## ① 短期成果評価_目標')

  // 旧フォーマット用パース
  const parsed = useMemo(() => {
    if (!goals || isNewFormat) return null
    return parseGoalsToSections(goals.rawMarkdown)
  }, [goals, isNewFormat])

  // 新フォーマット用パース
  const parsedFields = useMemo(() => {
    if (!goals || !isNewFormat) return null
    return parseGoalFields(goals.rawMarkdown)
  }, [goals, isNewFormat])

  // テンプレートプレースホルダー検出
  const TEMPLATE_PLACEHOLDER = '（上長とのすり合わせ後'
  const isEmpty = !goals || (
    isNewFormat
      ? !parsedFields?.shortTerm || parsedFields.shortTerm.trim().startsWith(TEMPLATE_PLACEHOLDER)
      : (!goals.rawMarkdown.includes('目標内容') && !goals.rawMarkdown.includes('目標①'))
  )

  const hasGoalSections = isNewFormat
    ? !!(parsedFields?.shortTerm || parsedFields?.capability)
    : !!(parsed && parsed.goals.length > 0)

  // --- 保存 ---

  const saveRawContent = async (content: string) => {
    setSaving(true)
    setSaveMsg('')
    try {
      const res = await fetch(`/api/members/${encodeURIComponent(memberName)}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, period: selectedPeriod }),
      })
      if (!res.ok) throw new Error()
      setSaveMsg('保存しました')
      setEditMode(null)
      onGoalsUpdated?.()
      setTimeout(() => setSaveMsg(''), 3000)
    } catch {
      setSaveMsg('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const saveGoals = async (updatedGoals: SingleGoal[], footer: string) => {
    await saveRawContent(mergeGoalSections(updatedGoals, footer))
  }

  // --- コピー ---

  const handleCopyField = async (text: string, label: string) => {
    await navigator.clipboard.writeText(stripMarkdown(text))
    setCopyMsg(`${label}をコピーしました`)
    setTimeout(() => setCopyMsg(''), 2000)
  }

  const handleCopyGoal = async (goal: SingleGoal) => {
    await navigator.clipboard.writeText(stripMarkdown(goal.content))
    setCopyMsg(`目標${goal.label}をコピーしました`)
    setTimeout(() => setCopyMsg(''), 2000)
  }

  const handleCopyAll = async () => {
    let allText = ''
    if (isNewFormat && parsedFields) {
      allText = [stripMarkdown(parsedFields.shortTerm), stripMarkdown(parsedFields.capability)]
        .filter(Boolean)
        .join('\n\n')
    } else if (parsed && parsed.goals.length > 0) {
      allText = parsed.goals.map(g => stripMarkdown(g.content)).join('\n\n')
    }
    if (!allText) return
    await navigator.clipboard.writeText(allText)
    setCopyMsg('全目標をコピーしました')
    setTimeout(() => setCopyMsg(''), 2000)
  }

  // --- 旧フォーマット用ハンドラー ---

  const handleManualSaveOld = (label: string, newContent: string) => {
    if (!parsed) return
    const updated = parsed.goals.map(g => g.label === label ? { ...g, content: newContent } : g)
    saveGoals(updated, parsed.footer)
  }

  const handleDeleteGoal = (label: string) => {
    if (!parsed) return
    const goal = parsed.goals.find(g => g.label === label)
    if (!goal) return
    if (!confirm(`目標${label}「${goal.title}」を削除しますか？この操作は元に戻せません。`)) return
    const remaining = parsed.goals.filter(g => g.label !== label)
    saveGoals(remaining, parsed.footer)
  }

  const handleAiSubmitOld = async (label: string, instruction: string) => {
    if (!parsed || !instruction.trim()) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const goal = parsed.goals.find(g => g.label === label)
    if (!goal) return

    setEditMode({ type: 'ai', label, instruction, preview: null, streaming: true })

    try {
      const res = await fetch(`/api/members/${encodeURIComponent(memberName)}/goals/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal,
          instruction,
          memberContext: memberProfile,
          allGoals: mergeGoalSections(parsed.goals, parsed.footer),
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream')) {
        setEditMode({ type: 'ai', label, instruction, preview: null, streaming: false })
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const j = JSON.parse(data)
            if (j.text) {
              fullText += j.text
              setEditMode(prev => prev?.type === 'ai' ? { ...prev, preview: fullText } : prev)
            }
          } catch {}
        }
      }

      setEditMode(prev => prev?.type === 'ai' ? { ...prev, preview: fullText, streaming: false } : prev)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setEditMode({ type: 'ai', label, instruction, preview: null, streaming: false })
    } finally {
      abortRef.current = null
    }
  }

  const handleAiAcceptOld = (label: string, newContent: string) => {
    if (!parsed) return
    const aiParsed = parseGoalsToSections(newContent)
    const aiGoal = aiParsed.goals[0]
    if (!aiGoal) return
    const updated = parsed.goals.map(g =>
      g.label === label ? { ...g, content: aiGoal.content, type: aiGoal.type, title: aiGoal.title } : g
    )
    saveGoals(updated, parsed.footer)
  }

  // --- 新フォーマット用ハンドラー ---

  const handleAiSubmitNew = async (field: 'shortTerm' | 'capability', instruction: string) => {
    if (!parsedFields || !instruction.trim()) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const fieldContent = field === 'shortTerm' ? parsedFields.shortTerm : parsedFields.capability

    setEditMode({ type: 'ai', label: field, instruction, preview: null, streaming: true })

    try {
      const res = await fetch(`/api/members/${encodeURIComponent(memberName)}/goals/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: {
            index: field === 'shortTerm' ? 1 : 2,
            label: field === 'shortTerm' ? '①' : '②',
            type: field === 'shortTerm' ? '短期成果評価' : '発揮能力評価',
            title: field === 'shortTerm' ? '短期成果評価_目標' : '発揮能力評価_目標',
            content: fieldContent,
          },
          instruction,
          memberContext: memberProfile,
          allGoals: assembleGoalMarkdown(parsedFields.shortTerm, parsedFields.capability),
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream')) {
        setEditMode({ type: 'ai', label: field, instruction, preview: null, streaming: false })
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const j = JSON.parse(data)
            if (j.text) {
              fullText += j.text
              setEditMode(prev => prev?.type === 'ai' ? { ...prev, preview: fullText } : prev)
            }
          } catch {}
        }
      }

      setEditMode(prev => prev?.type === 'ai' ? { ...prev, preview: fullText, streaming: false } : prev)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setEditMode({ type: 'ai', label: field, instruction, preview: null, streaming: false })
    } finally {
      abortRef.current = null
    }
  }

  const handleAiAcceptNew = (field: 'shortTerm' | 'capability', newContent: string) => {
    if (!parsedFields) return
    const newShortTerm = field === 'shortTerm' ? newContent : parsedFields.shortTerm
    const newCapability = field === 'capability' ? newContent : parsedFields.capability
    saveRawContent(assembleGoalMarkdown(newShortTerm, newCapability))
  }

  // --- 新フォーマット パネルレンダラー ---

  const renderNewFormatPanel = (
    field: 'shortTerm' | 'capability',
    content: string,
    displayLabel: string,
    headerBg: string,
    headerTextColor: string,
  ) => {
    const isEditing = editMode?.label === field

    return (
      <div key={field} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className={`flex items-center justify-between px-8 py-4 ${headerBg} border-b border-gray-100`}>
          <h4 className={`text-2xl font-semibold ${headerTextColor}`}>{displayLabel}</h4>
          <div className="flex gap-2">
            <button
              onClick={() => handleCopyField(content, displayLabel)}
              className="text-sm px-3 py-1.5 border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-100 transition-colors"
            >
              コピー
            </button>
            {!isWizardOpen && !isEditing && (
              <>
                <button
                  onClick={() => setEditMode({ type: 'manual', label: field, draft: content })}
                  className="text-sm px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  編集
                </button>
                <button
                  onClick={() => setEditMode({ type: 'ai', label: field, instruction: '', preview: null, streaming: false })}
                  className="text-sm px-3 py-1.5 border border-brand-300 text-brand-600 rounded-lg hover:bg-brand-50 transition-colors"
                >
                  AIで修正
                </button>
              </>
            )}
          </div>
        </div>

        <div className="px-8 py-6">
          {isEditing && editMode.type === 'manual' ? (
            <div>
              <textarea
                value={editMode.draft}
                onChange={e => setEditMode({ ...editMode, draft: e.target.value })}
                rows={15}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base font-mono focus:outline-none focus:ring-2 focus:ring-brand-400 resize-vertical"
              />
              <div className="flex gap-2 mt-3 justify-end">
                <button
                  onClick={() => setEditMode(null)}
                  className="px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => {
                    if (!parsedFields) return
                    const newShortTerm = field === 'shortTerm' ? editMode.draft : parsedFields.shortTerm
                    const newCapability = field === 'capability' ? editMode.draft : parsedFields.capability
                    saveRawContent(assembleGoalMarkdown(newShortTerm, newCapability))
                  }}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          ) : isEditing && editMode.type === 'ai' ? (
            <div>
              {editMode.preview === null && !editMode.streaming ? (
                <div>
                  <div className="mb-3">
                    <MarkdownRenderer content={content} />
                  </div>
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">修正の意図</label>
                    <textarea
                      value={editMode.instruction}
                      onChange={e => setEditMode({ ...editMode, instruction: e.target.value })}
                      rows={3}
                      placeholder="例: 進捗を踏まえて達成基準を引き上げたい"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                    />
                    <div className="flex gap-2 mt-3 justify-end">
                      <button
                        onClick={() => setEditMode(null)}
                        className="px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={() => handleAiSubmitNew(field as 'shortTerm' | 'capability', editMode.instruction)}
                        disabled={!editMode.instruction.trim()}
                        className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50"
                      >
                        AIに依頼
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-500 mb-2">修正前</p>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-[200px] overflow-y-auto">
                      <MarkdownRenderer content={content} />
                    </div>
                  </div>
                  <div className="mb-4">
                    <p className="text-sm font-medium text-brand-600 mb-2">修正後{editMode.streaming ? '（生成中...）' : ''}</p>
                    <div className="bg-brand-50 border border-brand-200 rounded-lg p-4 max-h-[300px] overflow-y-auto">
                      {editMode.preview ? (
                        <MarkdownRenderer content={editMode.preview} />
                      ) : (
                        <div className="flex items-center gap-3 text-brand-500 py-4 justify-center">
                          <div className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                          <span>生成中...</span>
                        </div>
                      )}
                      {editMode.streaming && editMode.preview && (
                        <span className="inline-block w-2 h-4 bg-brand-500 animate-pulse ml-1" />
                      )}
                    </div>
                  </div>
                  {!editMode.streaming && editMode.preview && (
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditMode(null)}
                        className="px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={() => setEditMode({ ...editMode, preview: null, streaming: false })}
                        className="px-4 py-2 text-sm border border-amber-300 text-amber-600 rounded-lg hover:bg-amber-50"
                      >
                        やり直し
                      </button>
                      <button
                        onClick={() => handleAiAcceptNew(field as 'shortTerm' | 'capability', editMode.preview!)}
                        disabled={saving}
                        className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50"
                      >
                        {saving ? '保存中...' : '採用して保存'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <GoalFieldContent content={content} />
          )}
        </div>
      </div>
    )
  }

  // --- 旧フォーマット カードレンダラー ---

  const renderGoalCard = (goal: SingleGoal) => {
    const isEditing = editMode?.label === goal.label

    return (
      <div key={goal.label} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-8 py-4 bg-gray-50 border-b border-gray-100">
          <h4 className="text-xl font-semibold text-gray-700">
            目標{goal.label}（{goal.type}）：{goal.title}
          </h4>
          <div className="flex gap-2">
            <button
              onClick={() => handleCopyGoal(goal)}
              className="text-sm px-3 py-1.5 border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-100 transition-colors"
            >
              コピー
            </button>
            {!isWizardOpen && !isEditing && (
              <>
                <button
                  onClick={() => setEditMode({ type: 'manual', label: goal.label, draft: goal.content })}
                  className="text-sm px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  編集
                </button>
                <button
                  onClick={() => setEditMode({ type: 'ai', label: goal.label, instruction: '', preview: null, streaming: false })}
                  className="text-sm px-3 py-1.5 border border-brand-300 text-brand-600 rounded-lg hover:bg-brand-50 transition-colors"
                >
                  AIで修正
                </button>
                {parsed && parsed.goals.length > 1 && (
                  <button
                    onClick={() => handleDeleteGoal(goal.label)}
                    disabled={saving}
                    className="text-sm px-3 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={14} className="inline mr-1" />
                    削除
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="px-8 py-6">
          {isEditing && editMode.type === 'manual' ? (
            <div>
              <textarea
                value={editMode.draft}
                onChange={e => setEditMode({ ...editMode, draft: e.target.value })}
                rows={15}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base font-mono focus:outline-none focus:ring-2 focus:ring-brand-400 resize-vertical"
              />
              <div className="flex gap-2 mt-3 justify-end">
                <button
                  onClick={() => setEditMode(null)}
                  className="px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => handleManualSaveOld(goal.label, editMode.draft)}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          ) : isEditing && editMode.type === 'ai' ? (
            <div>
              {editMode.preview === null && !editMode.streaming ? (
                <div>
                  <div className="mb-3">
                    <MarkdownRenderer content={goal.content} />
                  </div>
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">修正の意図</label>
                    <textarea
                      value={editMode.instruction}
                      onChange={e => setEditMode({ ...editMode, instruction: e.target.value })}
                      rows={3}
                      placeholder="例: 進捗を踏まえて達成基準を引き上げたい"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                    />
                    <div className="flex gap-2 mt-3 justify-end">
                      <button
                        onClick={() => setEditMode(null)}
                        className="px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={() => handleAiSubmitOld(goal.label, editMode.instruction)}
                        disabled={!editMode.instruction.trim()}
                        className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50"
                      >
                        AIに依頼
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-500 mb-2">修正前</p>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-[200px] overflow-y-auto">
                      <MarkdownRenderer content={goal.content} />
                    </div>
                  </div>
                  <div className="mb-4">
                    <p className="text-sm font-medium text-brand-600 mb-2">修正後{editMode.streaming ? '（生成中...）' : ''}</p>
                    <div className="bg-brand-50 border border-brand-200 rounded-lg p-4 max-h-[300px] overflow-y-auto">
                      {editMode.preview ? (
                        <MarkdownRenderer content={editMode.preview} />
                      ) : (
                        <div className="flex items-center gap-3 text-brand-500 py-4 justify-center">
                          <div className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                          <span>生成中...</span>
                        </div>
                      )}
                      {editMode.streaming && editMode.preview && (
                        <span className="inline-block w-2 h-4 bg-brand-500 animate-pulse ml-1" />
                      )}
                    </div>
                  </div>
                  {!editMode.streaming && editMode.preview && (
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditMode(null)}
                        className="px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={() => setEditMode({ ...editMode, preview: null, streaming: false })}
                        className="px-4 py-2 text-sm border border-amber-300 text-amber-600 rounded-lg hover:bg-amber-50"
                      >
                        やり直し
                      </button>
                      <button
                        onClick={() => handleAiAcceptOld(goal.label, editMode.preview!)}
                        disabled={saving}
                        className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50"
                      >
                        {saving ? '保存中...' : '採用して保存'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <MarkdownRenderer content={stripGoalHeading(goal.content)} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h3 className="text-3xl font-semibold text-gray-800">半期目標</h3>
          {allPeriods.length > 1 ? (
            <select
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value)}
              className="text-xl border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {allPeriods.map(p => {
                const hasGoal = !!goalsByPeriod[p]
                const isActive = p === activePeriod
                const suffix = isActive && !hasGoal ? '（アクティブ・未設定）' : isActive ? '（アクティブ）' : !hasGoal ? '（未設定）' : ''
                return (
                  <option key={p} value={p}>
                    {formatPeriodLabel(p)}{suffix}
                  </option>
                )
              })}
            </select>
          ) : (
            <span className="text-2xl text-gray-500">{formatPeriodLabel(selectedPeriod)}</span>
          )}
          {selectedPeriod === activePeriod && (
            <span className="text-lg bg-green-100 text-green-700 px-3 py-1 rounded-full border border-green-200 font-medium">
              アクティブ
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isEmpty && (
            <span className="text-xl bg-amber-50 text-amber-600 px-5 py-2 rounded-full border border-amber-200 font-medium">
              未記入
            </span>
          )}
          {hasGoalSections && (
            <button
              onClick={handleCopyAll}
              className="text-lg border border-gray-300 text-gray-600 px-5 py-2.5 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              全体コピー
            </button>
          )}
          {onStartWizard && (
            <button
              onClick={() => onStartWizard(selectedPeriod)}
              className="text-lg bg-brand-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand-700 transition-colors"
            >
              目標設定ウィザード
            </button>
          )}
        </div>
      </div>

      {(saveMsg || copyMsg) && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${saveMsg?.includes('失敗') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
          {saveMsg || copyMsg}
        </div>
      )}

      {goals ? (
        hasGoalSections ? (
          isNewFormat && parsedFields ? (
            <div className="space-y-6">
              {renderNewFormatPanel('shortTerm', parsedFields.shortTerm, '① 短期成果評価_目標', 'bg-blue-50', 'text-blue-800')}
              {renderNewFormatPanel('capability', parsedFields.capability, '② 発揮能力評価_目標', 'bg-green-50', 'text-green-800')}
            </div>
          ) : (
            <div className="space-y-6">
              {parsed!.goals.map(renderGoalCard)}
              {parsed!.footer.trim() && (
                <div className="bg-white border border-gray-200 rounded-xl p-10">
                  <MarkdownRenderer content={parsed!.footer} />
                </div>
              )}
            </div>
          )
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-10">
            <MarkdownRenderer content={goals.rawMarkdown} />
          </div>
        )
      ) : (
        <EmptyState
          title="この期間の目標はまだ設定されていません"
          description="ウィザードから目標を作成できます"
          icon="🎯"
        />
      )}
    </div>
  )
}
