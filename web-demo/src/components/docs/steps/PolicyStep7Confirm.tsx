'use client'

import { useState } from 'react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import type { PolicyWizardState } from '../PolicyWizard'

interface PolicyStep7ConfirmProps {
  state: PolicyWizardState
  onSave: () => void
  onBack: () => void
}

export function PolicyStep7Confirm({ state, onSave, onBack }: PolicyStep7ConfirmProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false)

  const doSave = async (overwrite: boolean) => {
    setSaving(true)
    setError('')
    setShowOverwriteDialog(false)

    try {
      const res = await fetch('/api/docs/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: state.targetYear, content: state.currentDraft, overwrite }),
      })

      if (res.status === 409) {
        setShowOverwriteDialog(true)
        setSaving(false)
        return
      }

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '保存に失敗しました')
      }

      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-3">確認・保存</h2>
      <p className="text-xl text-gray-500 mb-8">
        {state.targetYear}年度の組織方針を確認してください
      </p>

      <div className="bg-white border border-gray-200 rounded-lg p-8 mb-8 max-h-[500px] overflow-y-auto">
        <MarkdownRenderer content={state.currentDraft} />
      </div>

      {/* Error */}
      {error && (
        <p className="text-xl text-red-600 bg-red-50 border border-red-200 rounded-lg px-5 py-3 mb-6">
          {error}
        </p>
      )}

      {/* Overwrite confirmation dialog */}
      {showOverwriteDialog && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-6 mb-6">
          <p className="text-xl text-amber-800 font-medium mb-4">
            {state.targetYear}年度の組織方針は既に存在します。上書きしますか？
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowOverwriteDialog(false)}
              className="flex-1 py-3 text-xl border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={() => doSave(true)}
              disabled={saving}
              className="flex-1 py-3 text-xl bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              {saving ? '保存中...' : '上書きする'}
            </button>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      {!showOverwriteDialog && (
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-4 text-xl border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            戻る
          </button>
          <button
            onClick={() => doSave(false)}
            disabled={saving}
            className="flex-1 py-4 text-xl bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存する'}
          </button>
        </div>
      )}
    </div>
  )
}
