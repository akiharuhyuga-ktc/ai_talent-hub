'use client'

import { useState } from 'react'
import type { ActionItem } from '@/lib/types'

const ASSIGNEE_OPTIONS = [
  { value: '', label: '-- 選択 --' },
  { value: 'member', label: 'メンバー' },
  { value: 'manager', label: 'マネージャー' },
  { value: 'both', label: '両方' },
]

function emptyAction(): ActionItem {
  return { content: '', assignee: 'member', deadline: '' }
}

interface Props {
  onComplete: (actions: ActionItem[]) => void
  onBack: () => void
}

export function OOStep5NextActions({ onComplete, onBack }: Props) {
  const [actions, setActions] = useState<ActionItem[]>([emptyAction()])

  const updateAction = (index: number, field: keyof ActionItem, value: string) => {
    const updated = [...actions]
    updated[index] = { ...updated[index], [field]: value }
    setActions(updated)
  }

  const addAction = () => {
    setActions([...actions, emptyAction()])
  }

  const removeAction = (index: number) => {
    if (actions.length <= 1) return
    setActions(actions.filter((_, i) => i !== index))
  }

  const isValid = actions.some(a => a.content.trim() !== '' && a.deadline !== '')

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-3">アクション設定</h2>
      <p className="text-xl text-gray-500 mb-8">次回までのアクションを設定してください。</p>

      <div className="space-y-6 mb-8">
        {actions.map((action, i) => (
          <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-medium text-gray-700">アクション {i + 1}</h3>
              {actions.length > 1 && (
                <button
                  onClick={() => removeAction(i)}
                  className="text-gray-400 hover:text-red-500 transition-colors text-2xl leading-none"
                  title="削除"
                >
                  x
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xl font-medium text-gray-700 mb-2">
                  内容 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={action.content}
                  onChange={e => updateAction(i, 'content', e.target.value)}
                  placeholder="具体的なアクションを入力してください"
                  className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xl font-medium text-gray-700 mb-2">
                    担当 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={action.assignee}
                    onChange={e => updateAction(i, 'assignee', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                  >
                    {ASSIGNEE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xl font-medium text-gray-700 mb-2">
                    期限 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={action.deadline}
                    onChange={e => updateAction(i, 'deadline', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-10">
        <button
          onClick={addAction}
          className="w-full py-3 text-xl border-2 border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-indigo-400 hover:text-indigo-600 transition-colors"
        >
          + アクションを追加
        </button>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-4 text-xl border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors">
          戻る
        </button>
        <button
          onClick={() => onComplete(actions.filter(a => a.content.trim() !== ''))}
          disabled={!isValid}
          className="flex-1 py-4 text-xl bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          完了する
        </button>
      </div>
    </div>
  )
}
