# 目標の個別管理・ブラッシュアップ改善 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 目標のブラッシュアップ時に未変更の目標が消える問題を修正し、確定後の個別編集機能を追加する。

**Architecture:** Markdownを `## 目標[丸数字]` セクション単位でパースする共通パーサーを追加し、Step7のブラッシュアップUI（チェックボックス選択＋マージ）とGoalsTabの個別編集UI（手動＋AI修正）の両方で利用する。保存APIは既存を再利用し、`mergeGoalSections()` はヘッダーなしの本文のみを返すことで二重付与を防ぐ。

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Claude API (Azure AI Foundry経由SSE)

**Spec:** `docs/superpowers/specs/2026-03-31-goal-individual-management-design.md`

---

## ファイル構成

| ファイル | 操作 | 責務 |
|---------|------|------|
| `web-demo/src/lib/parsers/goals.ts` | 修正 | `SingleGoal` 型、`parseGoalsToSections()`, `mergeGoalSections()` 追加 |
| `web-demo/src/lib/types.ts` | 修正 | `SingleGoal` 型のexport |
| `web-demo/src/components/goals/steps/Step7Refinement.tsx` | 修正 | チェックボックスUI、カード表示、マージロジック |
| `web-demo/src/app/api/members/[name]/goals/generate/route.ts` | 修正 | `targetGoalLabels` パラメータ対応 |
| `web-demo/src/lib/prompts/goal-edit.ts` | 新規 | 個別目標修正用プロンプト |
| `web-demo/src/app/api/members/[name]/goals/edit/route.ts` | 新規 | 個別目標AI修正エンドポイント |
| `web-demo/src/components/member/GoalsTab.tsx` | 修正 | 個別カード表示、編集・AI修正UI |

---

### Task 1: SingleGoal型とパーサー関数の追加

**Files:**
- Modify: `web-demo/src/lib/types.ts`
- Modify: `web-demo/src/lib/parsers/goals.ts`

- [ ] **Step 1: `SingleGoal` 型を `types.ts` に追加**

`web-demo/src/lib/types.ts` の `GoalsData` インターフェースの直後に追加:

```typescript
export interface SingleGoal {
  index: number        // 1, 2, 3...
  label: string        // "①", "②", "③"
  type: string         // "実行", "挑戦", "インパクト", "挑戦／インパクト統合" 等
  title: string        // "クロスプラットフォーム実装の品質安定化"
  content: string      // セクション全体のMarkdown（## 見出し行含む）
}

export interface ParsedGoals {
  header: string
  goals: SingleGoal[]
  footer: string
}
```

- [ ] **Step 2: `parseGoalsToSections()` と `mergeGoalSections()` を `goals.ts` に追加**

`web-demo/src/lib/parsers/goals.ts` に以下を追加（既存の `parseGoals` はそのまま残す）:

```typescript
import type { GoalsData, SingleGoal, ParsedGoals } from '../types'

// 丸数字 → 数値のマッピング
const CIRCLE_NUM_MAP: Record<string, number> = {
  '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5,
}

// 目標セクション見出しの正規表現
const GOAL_HEADING_RE = /^## 目標([①②③④⑤])[（(](.+?)[）)][：:](.+)$/

/**
 * 目標Markdownをヘッダー・目標配列・フッターに分割する。
 * ヘッダー: ファイル先頭から最初の `## 目標[丸数字]` の直前まで
 * フッター: 最後の目標セクション終了後〜ファイル末尾
 */
export function parseGoalsToSections(markdown: string): ParsedGoals {
  const lines = markdown.split('\n')

  // 目標セクションの開始行インデックスを検出
  const goalStarts: { lineIndex: number; label: string; type: string; title: string }[] = []
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(GOAL_HEADING_RE)
    if (match) {
      goalStarts.push({ lineIndex: i, label: match[1], type: match[2], title: match[3].trim() })
    }
  }

  // 目標セクションが0個の場合
  if (goalStarts.length === 0) {
    return { header: markdown, goals: [], footer: '' }
  }

  // ヘッダー: 先頭から最初の目標見出しの直前まで
  const header = lines.slice(0, goalStarts[0].lineIndex).join('\n')

  // 各目標セクションの範囲を決定
  const goals: SingleGoal[] = goalStarts.map((start, idx) => {
    const endLine = idx < goalStarts.length - 1
      ? goalStarts[idx + 1].lineIndex
      : findFooterStart(lines, start.lineIndex + 1)
    const content = lines.slice(start.lineIndex, endLine).join('\n').trimEnd()
    return {
      index: CIRCLE_NUM_MAP[start.label] ?? idx + 1,
      label: start.label,
      type: start.type,
      title: start.title,
      content,
    }
  })

  // フッター: 最後の目標セクション終了後〜ファイル末尾
  const lastGoalEnd = goalStarts.length > 1
    ? findFooterStart(lines, goalStarts[goalStarts.length - 1].lineIndex + 1)
    : findFooterStart(lines, goalStarts[0].lineIndex + 1)
  const footer = lines.slice(lastGoalEnd).join('\n').trimStart()

  return { header, goals, footer }
}

/**
 * 指定行以降で、目標セクションではない見出し行（フッター開始）を探す。
 * 見つからなければファイル末尾のインデックスを返す。
 */
function findFooterStart(lines: string[], fromLine: number): number {
  for (let i = fromLine; i < lines.length; i++) {
    const line = lines[i]
    // 目標見出しはスキップ
    if (GOAL_HEADING_RE.test(line)) continue
    // `##` または `#` で始まる見出し行がフッター開始
    if (/^#{1,2}\s/.test(line)) return i
  }
  return lines.length
}

/**
 * 目標配列とフッターを結合して本文Markdownを返す。
 * ヘッダーは含まない（保存APIが自動付与するため）。
 */
export function mergeGoalSections(goals: SingleGoal[], footer: string): string {
  const parts = goals.map(g => g.content)
  if (footer.trim()) {
    parts.push(footer.trim())
  }
  return parts.join('\n\n')
}
```

- [ ] **Step 3: 既存データで動作確認**

ブラウザのdevtoolsやNode REPLでの手動確認用。方・保坂のファイルが正しくパースできることを確認する。

Run: `cd /Users/akiharu.hyuga/Documents/Talent_Management_AI/web-demo && npx tsx -e "
const fs = require('fs');
const { parseGoalsToSections, mergeGoalSections } = require('./src/lib/parsers/goals');
const kata = fs.readFileSync('../data/members/方/goals/2026-h1.md', 'utf-8');
const hosaka = fs.readFileSync('../data/members/保坂/goals/2026-h1.md', 'utf-8');
const r1 = parseGoalsToSections(kata);
console.log('方: goals=' + r1.goals.length + ' labels=' + r1.goals.map(g=>g.label).join(','));
console.log('方 footer starts with:', r1.footer.slice(0,30));
const r2 = parseGoalsToSections(hosaka);
console.log('保坂: goals=' + r2.goals.length + ' labels=' + r2.goals.map(g=>g.label).join(','));
console.log('保坂 footer starts with:', r2.footer.slice(0,30));
"`

Expected: 方は3目標（①②③）、保坂は2目標（①②）が検出され、フッターが正しく分離される。

- [ ] **Step 4: コミット**

```bash
git add web-demo/src/lib/types.ts web-demo/src/lib/parsers/goals.ts
git commit -m "feat: add SingleGoal type and parseGoalsToSections/mergeGoalSections parsers"
```

---

### Task 2: generate APIの `targetGoalLabels` 対応

**Files:**
- Modify: `web-demo/src/app/api/members/[name]/goals/generate/route.ts`
- Modify: `web-demo/src/lib/prompts/goal-generation.ts`

- [ ] **Step 1: `goal-generation.ts` にターゲット目標指示を追加するヘルパー関数を追加**

`web-demo/src/lib/prompts/goal-generation.ts` のファイル末尾に追加:

```typescript
/**
 * ブラッシュアップ時に特定の目標のみ再設計する指示をプロンプトに追加する。
 * targetLabels: ["②", "③"] のような丸数字の配列
 * allGoalsMarkdown: 全目標のMarkdown（コンテキスト用）
 */
export function buildRefinementTargetInstruction(targetLabels: string[], allGoalsMarkdown: string): string {
  const labels = targetLabels.join('、')
  return `
━━━━━━━━━━━━━━━━━━━━━━
【重要：部分的ブラッシュアップ指示】

今回は以下の目標のみを再設計してください: ${labels}

■ 出力ルール
・対象目標（${labels}）のみを出力してください
・対象外の目標は一切出力しないでください
・ただし、末尾の整合確認テーブルは全目標分を含めて出力してください（対象外の目標は現状の内容をそのまま反映）

■ 参考：現在の全目標
${allGoalsMarkdown}
━━━━━━━━━━━━━━━━━━━━━━`
}
```

- [ ] **Step 2: `generate/route.ts` で `targetGoalLabels` を処理する**

`web-demo/src/app/api/members/[name]/goals/generate/route.ts` を修正。`body.targetGoalLabels` が存在する場合、プロンプトに追記する。

`import` 行を修正:
```typescript
import { buildGoalGenerationSystemPrompt, buildGoalGenerationUserMessage, buildRefinementTargetInstruction } from '@/lib/prompts/goal-generation'
```

`messages` 配列構築の直後（`if (body.refinementMessages ...` ブロックの後）に追加:

```typescript
    // 部分的ブラッシュアップ指示の追加
    if (body.targetGoalLabels && body.targetGoalLabels.length > 0 && body.allGoalsMarkdown) {
      const targetInstruction = buildRefinementTargetInstruction(
        body.targetGoalLabels,
        body.allGoalsMarkdown,
      )
      messages.push({ role: 'user', content: targetInstruction })
    }
```

- [ ] **Step 3: コミット**

```bash
git add web-demo/src/lib/prompts/goal-generation.ts web-demo/src/app/api/members/[name]/goals/generate/route.ts
git commit -m "feat: add targetGoalLabels support for selective goal refinement"
```

---

### Task 3: Step7Refinementのチェックボックス＋マージUI

**Files:**
- Modify: `web-demo/src/components/goals/steps/Step7Refinement.tsx`

- [ ] **Step 1: Step7Refinement.tsx を全面書き換え**

`web-demo/src/components/goals/steps/Step7Refinement.tsx` を以下に置き換える:

```typescript
'use client'

import { useState, useRef, useMemo } from 'react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { parseGoalsToSections, mergeGoalSections } from '@/lib/parsers/goals'
import type { GoalWizardState, WizardContextData, ChatMessage, SingleGoal } from '@/lib/types'

interface Props {
  state: GoalWizardState
  context: WizardContextData
  onAddRefinement: (messages: ChatMessage[], newGoals: string, count: number) => void
  onConfirm: (goals: string) => void
  onBack: () => void
}

export function Step7Refinement({ state, context, onAddRefinement, onConfirm, onBack }: Props) {
  const [feedback, setFeedback] = useState('')
  const [currentGoals, setCurrentGoals] = useState(state.generatedGoals || '')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingLabels, setStreamingLabels] = useState<Set<string>>(new Set())
  const [count, setCount] = useState(state.refinementCount)
  const [messages, setMessages] = useState<ChatMessage[]>(state.refinementMessages)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  // 目標を個別セクションにパース
  const parsed = useMemo(() => parseGoalsToSections(currentGoals), [currentGoals])

  // チェックボックス状態（デフォルト: 全選択）
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(() =>
    new Set(parsed.goals.map(g => g.label))
  )

  // パース結果が変わったら選択状態を更新（新しい目標が増えた場合に対応）
  const toggleLabel = (label: string) => {
    setSelectedLabels(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const handleSendFeedback = async () => {
    if (!feedback.trim() || isStreaming || selectedLabels.size === 0) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsStreaming(true)
    setStreamingLabels(new Set(selectedLabels))

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'assistant' as const, content: currentGoals },
      { role: 'user' as const, content: feedback },
    ]

    const selectedArray = Array.from(selectedLabels)
    const isPartial = selectedArray.length < parsed.goals.length

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
          refinementMessages: newMessages,
          // 部分ブラッシュアップ用パラメータ
          ...(isPartial ? {
            targetGoalLabels: selectedArray,
            allGoalsMarkdown: currentGoals,
          } : {}),
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream')) {
        setIsStreaming(false)
        setStreamingLabels(new Set())
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
            if (j.text) fullText += j.text
          } catch {}
        }
      }

      if (fullText) {
        let mergedGoals: string
        if (isPartial) {
          // AIレスポンスをパースして対象目標だけ差し替え
          const aiParsed = parseGoalsToSections(fullText)
          const aiGoalMap = new Map(aiParsed.goals.map(g => [g.label, g]))
          const mergedGoalsList = parsed.goals.map(g =>
            aiGoalMap.has(g.label) ? aiGoalMap.get(g.label)! : g
          )
          // フッターはAI出力のものを採用（整合確認テーブル更新のため）
          const newFooter = aiParsed.footer || parsed.footer
          mergedGoals = mergeGoalSections(mergedGoalsList, newFooter)
        } else {
          // 全目標ブラッシュアップ: AI出力をそのまま使用
          mergedGoals = fullText
        }

        setCurrentGoals(mergedGoals)
        const newCount = count + 1
        setMessages(newMessages)
        setCount(newCount)
        setFeedback('')
        onAddRefinement(newMessages, mergedGoals, newCount)
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
    } finally {
      setIsStreaming(false)
      setStreamingLabels(new Set())
      abortRef.current = null
    }
  }

  const handleConfirm = async () => {
    setSaving(true)
    setSaveError('')
    try {
      // mergeGoalSections でヘッダーなしの本文を生成して保存APIに渡す
      const bodyContent = mergeGoalSections(parsed.goals, parsed.footer)
      const res = await fetch(`/api/members/${encodeURIComponent(context.memberName)}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: bodyContent, period: context.targetPeriod }),
      })
      if (!res.ok) throw new Error('保存に失敗しました')
      setSaved(true)
      onConfirm(currentGoals)
    } catch {
      setSaveError('目標の保存に失敗しました。再度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 className="text-4xl font-bold text-gray-800 mb-3">壁打ち・精緻化</h2>
      <p className="text-xl text-gray-500 mb-5">
        ブラッシュアップしたい目標にチェックを入れ、フィードバックを入力してください。
        <span className="ml-2 text-lg bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
          フィードバック: {count}/2回目
        </span>
      </p>

      {/* 目標カード一覧 */}
      <div className="space-y-4 mb-8">
        {parsed.goals.length > 0 ? (
          parsed.goals.map(goal => {
            const isTarget = streamingLabels.has(goal.label)
            return (
              <div key={goal.label} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {/* チェックボックス＋ヘッダー */}
                <div className="flex items-center gap-3 px-6 py-3 bg-gray-50 border-b border-gray-100">
                  <input
                    type="checkbox"
                    checked={selectedLabels.has(goal.label)}
                    onChange={() => toggleLabel(goal.label)}
                    disabled={isStreaming}
                    className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-lg font-semibold text-gray-700">
                    目標{goal.label}（{goal.type}）：{goal.title}
                  </span>
                </div>
                {/* 本体 */}
                <div className="px-8 py-4 max-h-[250px] overflow-y-auto">
                  {isTarget && isStreaming ? (
                    <div className="flex items-center gap-3 text-indigo-500 py-8 justify-center">
                      <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-lg">再生成中...</span>
                    </div>
                  ) : (
                    <MarkdownRenderer content={goal.content} />
                  )}
                </div>
              </div>
            )
          })
        ) : (
          /* パース不能な場合はフォールバック表示 */
          <div className="bg-white border border-gray-200 rounded-lg p-8 max-h-[400px] overflow-y-auto">
            <MarkdownRenderer content={currentGoals} />
            {isStreaming && (
              <span className="inline-block w-2 h-5 bg-indigo-500 animate-pulse ml-1" />
            )}
          </div>
        )}

        {/* フッター（整合確認テーブル等）があれば表示 */}
        {parsed.footer.trim() && (
          <div className="bg-white border border-gray-200 rounded-lg p-8">
            <MarkdownRenderer content={parsed.footer} />
          </div>
        )}
      </div>

      {saveError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {saveError}
        </div>
      )}

      {saved ? (
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 text-xl text-green-600 bg-green-50 border border-green-200 rounded-lg px-8 py-4 font-semibold">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            目標として保存しました
          </div>
          <p className="text-lg text-gray-400 mt-4">「目標」タブに反映されています。ウィザードを閉じてください。</p>
        </div>
      ) : (
        <>
          {count < 2 && (
            <div className="mb-8">
              <label className="block text-xl font-medium text-gray-700 mb-2">フィードバック</label>
              <div className="flex gap-3">
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  rows={3}
                  placeholder="修正してほしい点やもっと具体的にしたい部分を入力してください"
                  className="flex-1 border border-gray-300 rounded-lg px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                />
                <button
                  onClick={handleSendFeedback}
                  disabled={!feedback.trim() || isStreaming || selectedLabels.size === 0}
                  className="self-end px-6 py-4 text-xl bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isStreaming ? '再生成中...' : '再生成'}
                </button>
              </div>
              {selectedLabels.size === 0 && (
                <p className="text-sm text-amber-600 mt-2">ブラッシュアップする目標を1つ以上選択してください</p>
              )}
            </div>
          )}
          {count >= 2 && (
            <p className="text-lg text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-5 py-3 mb-8">
              推奨回数の2回に達しました。この目標で確定することをお勧めします。
            </p>
          )}

          <div className="flex gap-3">
            <button onClick={onBack} className="flex-1 py-4 text-xl border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors">
              戻る
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving || isStreaming}
              className="flex-1 py-4 text-xl bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saving ? '保存中...' : 'この目標で確定する'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: ビルド確認**

Run: `cd /Users/akiharu.hyuga/Documents/Talent_Management_AI/web-demo && rm -rf .next && npx next build 2>&1 | tail -20`

Expected: ビルドが成功すること。

- [ ] **Step 3: コミット**

```bash
git add web-demo/src/components/goals/steps/Step7Refinement.tsx
git commit -m "feat: add checkbox-based selective goal refinement with merge logic in Step7"
```

---

### Task 4: 個別目標AI修正のプロンプトとAPIルート

**Files:**
- Create: `web-demo/src/lib/prompts/goal-edit.ts`
- Create: `web-demo/src/app/api/members/[name]/goals/edit/route.ts`

- [ ] **Step 1: `goal-edit.ts` プロンプトファイルを新規作成**

`web-demo/src/lib/prompts/goal-edit.ts`:

```typescript
import type { SingleGoal } from '@/lib/types'

interface GoalEditPromptParams {
  goal: SingleGoal
  instruction: string
  memberContext: string
  orgPolicy: string
  evaluationCriteria: string
  allGoals: string
}

export function buildGoalEditSystemPrompt(): string {
  return `あなたは人材育成の専門コンサルタントです。
確定済みの目標を、マネージャーの修正指示に従って書き換えてください。

━━━━━━━━━━━━━━━━━━━━━━
【出力ルール】

1. 修正対象の目標セクションのみを出力すること
2. 以下の出力フォーマットを厳密に維持すること:

## 目標[丸数字]（種別）：[目標タイトル]

**目標文：**
[目標本文]

---

**└ 達成した姿：**
[変化・状態で終わる1文]

**└ 検証方法：**
[客観的な判断基準]

**└ 中間確認（3ヶ月時点）：**
[確認基準]

**└ 根拠：**
[方針・期待・本人情報との紐づけ]

3. 修正指示で言及されていない項目は、できるだけ変更しないこと
4. 他の目標との重複を避けること

出力は日本語で行うこと。`
}

export function buildGoalEditUserMessage(params: GoalEditPromptParams): string {
  return `## 修正対象の目標

${params.goal.content}

## 修正指示

${params.instruction}

## メンバープロフィール

${params.memberContext}

## 組織方針

${params.orgPolicy}

## 評価基準

${params.evaluationCriteria}

## 他の目標（参考・重複回避用）

${params.allGoals}

上記の修正指示に従って、修正対象の目標を書き換えてください。`
}
```

- [ ] **Step 2: `goals/edit/route.ts` APIルートを新規作成**

`web-demo/src/app/api/members/[name]/goals/edit/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { callClaudeStream, createSSEResponse, hasApiKey } from '@/lib/ai/call-claude'
import { loadSharedDocs } from '@/lib/fs/shared-docs'
import { buildGoalEditSystemPrompt, buildGoalEditUserMessage } from '@/lib/prompts/goal-edit'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    if (!hasApiKey()) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 503 })
    }

    const body = await req.json()
    const { goal, instruction, memberContext, allGoals } = body

    if (!goal || !instruction) {
      return NextResponse.json({ error: 'goal and instruction are required' }, { status: 400 })
    }

    const shared = loadSharedDocs()
    const systemPrompt = buildGoalEditSystemPrompt()
    const userMessage = buildGoalEditUserMessage({
      goal,
      instruction,
      memberContext: memberContext || '',
      orgPolicy: body.orgPolicy || shared.policy,
      evaluationCriteria: body.evaluationCriteria || shared.criteria,
      allGoals: allGoals || '',
    })

    const stream = callClaudeStream({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 2048,
      signal: req.signal,
    })

    return createSSEResponse(stream)
  } catch (error) {
    console.error('Goal edit API error:', error)
    return NextResponse.json({ error: 'Failed to edit goal' }, { status: 500 })
  }
}
```

- [ ] **Step 3: ビルド確認**

Run: `cd /Users/akiharu.hyuga/Documents/Talent_Management_AI/web-demo && rm -rf .next && npx next build 2>&1 | tail -20`

Expected: ビルドが成功すること。

- [ ] **Step 4: コミット**

```bash
git add web-demo/src/lib/prompts/goal-edit.ts web-demo/src/app/api/members/[name]/goals/edit/route.ts
git commit -m "feat: add goal edit API route and prompt for individual goal AI revision"
```

---

### Task 5: GoalsTabに個別編集UI（手動編集＋AI修正）を追加

**Files:**
- Modify: `web-demo/src/components/member/GoalsTab.tsx`

- [ ] **Step 1: GoalsTab.tsx を書き換え**

`web-demo/src/components/member/GoalsTab.tsx` を以下に置き換える:

```typescript
'use client'

import { useState, useRef, useMemo } from 'react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatPeriodLabel, sortPeriods } from '@/lib/utils/period'
import { parseGoalsToSections, mergeGoalSections } from '@/lib/parsers/goals'
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
  const abortRef = useRef<AbortController | null>(null)

  const goals = goalsByPeriod[selectedPeriod] ?? null
  const isEmpty = !goals || (!goals.rawMarkdown.includes('目標内容') && !goals.rawMarkdown.includes('目標①'))

  // 目標をセクション単位にパース
  const parsed = useMemo(() => {
    if (!goals) return null
    return parseGoalsToSections(goals.rawMarkdown)
  }, [goals])

  const hasGoalSections = parsed && parsed.goals.length > 0

  // ── 保存処理 ──
  const saveGoals = async (updatedGoals: SingleGoal[], footer: string) => {
    setSaving(true)
    setSaveMsg('')
    try {
      const content = mergeGoalSections(updatedGoals, footer)
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

  // ── 手動編集の保存 ──
  const handleManualSave = (label: string, newContent: string) => {
    if (!parsed) return
    const updated = parsed.goals.map(g => g.label === label ? { ...g, content: newContent } : g)
    saveGoals(updated, parsed.footer)
  }

  // ── AI修正の送信 ──
  const handleAiSubmit = async (label: string, instruction: string) => {
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
              setEditMode(prev =>
                prev?.type === 'ai' ? { ...prev, preview: fullText } : prev
              )
            }
          } catch {}
        }
      }

      setEditMode(prev =>
        prev?.type === 'ai' ? { ...prev, preview: fullText, streaming: false } : prev
      )
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setEditMode({ type: 'ai', label, instruction, preview: null, streaming: false })
    } finally {
      abortRef.current = null
    }
  }

  // ── AI修正の採用 ──
  const handleAiAccept = (label: string, newContent: string) => {
    if (!parsed) return
    // AI出力をパースして対象目標のcontentを取得
    const aiParsed = parseGoalsToSections(newContent)
    const aiGoal = aiParsed.goals[0]
    if (!aiGoal) return
    const updated = parsed.goals.map(g => g.label === label ? { ...g, content: aiGoal.content, type: aiGoal.type, title: aiGoal.title } : g)
    saveGoals(updated, parsed.footer)
  }

  // ── 目標カードのレンダリング ──
  const renderGoalCard = (goal: SingleGoal) => {
    const isEditing = editMode?.label === goal.label

    return (
      <div key={goal.label} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-8 py-4 bg-gray-50 border-b border-gray-100">
          <h4 className="text-xl font-semibold text-gray-700">
            目標{goal.label}（{goal.type}）：{goal.title}
          </h4>
          {!isWizardOpen && !isEditing && (
            <div className="flex gap-2">
              <button
                onClick={() => setEditMode({ type: 'manual', label: goal.label, draft: goal.content })}
                className="text-sm px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                編集
              </button>
              <button
                onClick={() => setEditMode({ type: 'ai', label: goal.label, instruction: '', preview: null, streaming: false })}
                className="text-sm px-3 py-1.5 border border-indigo-300 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                AIで修正
              </button>
            </div>
          )}
        </div>

        {/* 本体 */}
        <div className="px-8 py-6">
          {isEditing && editMode.type === 'manual' ? (
            /* 手動編集モード */
            <div>
              <textarea
                value={editMode.draft}
                onChange={e => setEditMode({ ...editMode, draft: e.target.value })}
                rows={15}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-vertical"
              />
              <div className="flex gap-2 mt-3 justify-end">
                <button
                  onClick={() => setEditMode(null)}
                  className="px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => handleManualSave(goal.label, editMode.draft)}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          ) : isEditing && editMode.type === 'ai' ? (
            /* AI修正モード */
            <div>
              {editMode.preview === null && !editMode.streaming ? (
                /* 修正指示入力 */
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
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                    />
                    <div className="flex gap-2 mt-3 justify-end">
                      <button
                        onClick={() => setEditMode(null)}
                        className="px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={() => handleAiSubmit(goal.label, editMode.instruction)}
                        disabled={!editMode.instruction.trim()}
                        className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
                      >
                        AIに依頼
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* プレビュー表示 */
                <div>
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-500 mb-2">修正前</p>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-[200px] overflow-y-auto">
                      <MarkdownRenderer content={goal.content} />
                    </div>
                  </div>
                  <div className="mb-4">
                    <p className="text-sm font-medium text-indigo-600 mb-2">修正後{editMode.streaming ? '（生成中...）' : ''}</p>
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 max-h-[300px] overflow-y-auto">
                      {editMode.preview ? (
                        <MarkdownRenderer content={editMode.preview} />
                      ) : (
                        <div className="flex items-center gap-3 text-indigo-500 py-4 justify-center">
                          <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                          <span>生成中...</span>
                        </div>
                      )}
                      {editMode.streaming && editMode.preview && (
                        <span className="inline-block w-2 h-4 bg-indigo-500 animate-pulse ml-1" />
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
                        onClick={() => handleAiAccept(goal.label, editMode.preview!)}
                        disabled={saving}
                        className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {saving ? '保存中...' : '採用して保存'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* 通常表示 */
            <MarkdownRenderer content={goal.content} />
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
              className="text-xl border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
          {onStartWizard && (
            <button
              onClick={() => onStartWizard(selectedPeriod)}
              className="text-lg bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
            >
              目標設定ウィザード
            </button>
          )}
        </div>
      </div>

      {saveMsg && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${saveMsg.includes('失敗') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
          {saveMsg}
        </div>
      )}

      {goals ? (
        hasGoalSections ? (
          <div className="space-y-6">
            {parsed!.goals.map(renderGoalCard)}
            {/* フッター */}
            {parsed!.footer.trim() && (
              <div className="bg-white border border-gray-200 rounded-xl p-10">
                <MarkdownRenderer content={parsed!.footer} />
              </div>
            )}
          </div>
        ) : (
          /* パース不能な場合のフォールバック */
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
```

- [ ] **Step 2: GoalsTab呼び出し元でpropsを追加**

GoalsTabに `memberName`, `memberProfile`, `isWizardOpen`, `onGoalsUpdated` の新しいpropsを渡す必要がある。呼び出し元のメンバー詳細ページを確認し、propsを追加する。

呼び出し元を確認するコマンド:
Run: `cd /Users/akiharu.hyuga/Documents/Talent_Management_AI/web-demo && grep -rn "GoalsTab" src/ --include="*.tsx" | grep -v "GoalsTab.tsx"`

呼び出し元で以下のpropsを追加:
- `memberName={detail.name}`
- `memberProfile={detail.rawMarkdown}`
- `isWizardOpen={/* ウィザード表示中フラグ */}`
- `onGoalsUpdated={/* データ再読み込み関数 */}`

注意: 呼び出し元の具体的な構造は実装時に確認すること。`onGoalsUpdated` は `router.refresh()` やstateの再フェッチで実現する。

- [ ] **Step 3: ビルド確認**

Run: `cd /Users/akiharu.hyuga/Documents/Talent_Management_AI/web-demo && rm -rf .next && npx next build 2>&1 | tail -20`

Expected: ビルドが成功すること。

- [ ] **Step 4: コミット**

```bash
git add web-demo/src/components/member/GoalsTab.tsx
git commit -m "feat: add individual goal editing (manual + AI revision) to GoalsTab"
```

---

### Task 6: 結合テスト・動作確認

**Files:** なし（手動確認）

- [ ] **Step 1: 開発サーバー起動**

Run: `cd /Users/akiharu.hyuga/Documents/Talent_Management_AI/web-demo && npm run dev`

- [ ] **Step 2: Step7ブラッシュアップの確認**

1. 任意のメンバーで目標設定ウィザードを開く
2. Step6まで進み目標生成
3. Step7で目標①のチェックを外し、目標②③のみ選択
4. フィードバックを入力して再生成
5. **確認**: 目標①がそのまま残り、②③だけが再生成されること
6. 「この目標で確定する」を押して保存
7. **確認**: ファイルに全目標（①②③）が書き込まれていること

- [ ] **Step 3: GoalsTab手動編集の確認**

1. 方さんまたは保坂さんのメンバー詳細ページを開く
2. 目標タブで各目標カードに「編集」「AIで修正」ボタンが表示されていることを確認
3. 「編集」をクリック → テキストエリアが表示 → 軽微な変更 → 保存
4. **確認**: 変更した目標のみが更新され、他の目標はそのままであること

- [ ] **Step 4: GoalsTab AI修正の確認**

1. 「AIで修正」をクリック → 修正意図を入力 → 「AIに依頼」
2. **確認**: ストリーミングで修正後プレビューが表示されること
3. 「採用して保存」をクリック
4. **確認**: 修正した目標のみが更新され、他の目標はそのままであること

- [ ] **Step 5: 既存データの互換性確認**

1. 方さんの目標ページ: 3目標（①②③）がカード表示されること
2. 保坂さんの目標ページ: 2目標（①②）がカード表示されること
3. 両方のフッター（整合確認テーブル / 設計サマリー）が正しく表示されること
