# カオナビ目標フォーマット対応 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 目標生成・保存のフォーマットをカオナビの「① 短期成果評価_目標 / ② 発揮能力評価_目標」2フィールド形式に統一する

**Architecture:** プロンプトの出力形式を変更し、フロントエンドでストリームを2パネルに振り分ける。GoalWizardStateの型を2フィールドに更新し、Step6/7のUIを対応させる。既存データは移行スクリプトでバックアップ後に変換する。

**Tech Stack:** Next.js 14 (App Router), TypeScript, React, Tailwind CSS, @anthropic-ai/sdk, SSE streaming

---

## ファイルマップ

| ファイル | 変更種別 | 役割 |
|---|---|---|
| `web-demo/src/lib/types.ts` | 修正 | GoalWizardState: generatedGoals→shortTermGoals/capabilityGoals、RefinementTarget型追加 |
| `web-demo/src/lib/prompts/goal-generation.ts` | 修正 | 出力フォーマットを2フィールド化、refinement指示を2フィールド対応 |
| `web-demo/src/lib/goals/field-parser.ts` | 新規 | ストリームテキストを① / ② 2フィールドに分割するユーティリティ |
| `web-demo/src/app/api/members/[name]/goals/generate/route.ts` | 修正 | refinement params: targetGoalLabels/allGoalsMarkdown → targetField/shortTermGoals/capabilityGoals |
| `web-demo/src/app/api/members/[name]/goals/route.ts` | 修正 | 保存テンプレートを2フィールド形式に更新 |
| `web-demo/src/components/goals/GoalWizard.tsx` | 修正 | reducerのaction/stateを2フィールド対応 |
| `web-demo/src/components/goals/steps/Step6GoalGeneration.tsx` | 修正 | 2パネル表示 + コピーボタン |
| `web-demo/src/components/goals/steps/Step7Refinement.tsx` | 修正 | 2フィールド選択UI + 2フィールド対応の保存処理 |
| `scripts/migrate-goals-to-kaonavi-format.ts` | 新規 | 既存24名の目標データをバックアップ後に新形式へ変換 |

---

## Task 1: types.ts — GoalWizardState更新

**Files:**
- Modify: `web-demo/src/lib/types.ts`

- [ ] **Step 1: GoalWizardState の generatedGoals を2フィールドに置き換え、RefinementTarget型を追加**

`GoalWizardState` インターフェースを見つけて以下に書き換える：

```typescript
// 変更前
export interface GoalWizardState {
  currentStep: number
  managerInput: ManagerInput
  memberInput: MemberInput
  previousPeriod: PreviousPeriod
  diagnosis: string | null
  diagnosisConfirmed: boolean
  generatedGoals: string | null
  refinementMessages: ChatMessage[]
  refinementCount: number
  finalGoals: string | null
}

// 変更後
export interface GoalWizardState {
  currentStep: number
  managerInput: ManagerInput
  memberInput: MemberInput
  previousPeriod: PreviousPeriod
  diagnosis: string | null
  diagnosisConfirmed: boolean
  shortTermGoals: string | null    // ① 短期成果評価_目標
  capabilityGoals: string | null   // ② 発揮能力評価_目標
  refinementMessages: ChatMessage[]
  refinementCount: number
  finalGoals: string | null        // 保存完了後の確定済みmarkdown
}
```

また、インターフェース定義の末尾（`ParsedGoals` の前あたり）に以下を追加：

```typescript
export type RefinementTarget = 'shortTerm' | 'capability' | 'both'
```

- [ ] **Step 2: ビルドエラーがないか確認**

```bash
cd /Users/akiharu.hyuga/Documents/Talent_Management_AI/web-demo
npx tsc --noEmit 2>&1 | head -30
```

型エラーが出る箇所をメモしておく（後のタスクで修正する）。この時点でエラーが出るのは正常。

- [ ] **Step 3: commit**

```bash
git add web-demo/src/lib/types.ts
git commit -m "feat: GoalWizardState を2フィールド形式(shortTermGoals/capabilityGoals)に更新"
```

---

## Task 2: goal-generation.ts — プロンプト2フィールド化

**Files:**
- Modify: `web-demo/src/lib/prompts/goal-generation.ts`

- [ ] **Step 1: buildGoalGenerationSystemPrompt() を2フィールド出力に書き換え**

`buildGoalGenerationSystemPrompt()` 関数全体を以下に置き換える：

```typescript
export function buildGoalGenerationSystemPrompt(): string {
  return `あなたは人材育成の専門コンサルタントです。
以下の情報と診断サマリーをもとに、カオナビの評価フォーマットに沿ったメンバーの目標を設計してください。

━━━━━━━━━━━━━━━━━━━━━━
【Step1：設計前の確認】
診断サマリーの内容を設計の軸として使うこと
・現在地と次ステージのギャップ
・発揮されていない強み
・今期の最大課題

━━━━━━━━━━━━━━━━━━━━━━
【Step2：2フィールドの設計方針】

① 短期成果評価_目標（What）
・半期で「何を達成するか」を問うフィールド
・期末に成果物・数値・状態の達成で評価できる内容
・賞与額に影響する
・例：「9月末までに〇〇を達成し、△△を実証する」

② 発揮能力評価_目標（How）
・「どう動いたか・どんな能力を発揮したか」を問うフィールド
・キャリアラダーに対する行動・姿勢・再現性で評価できる内容
・昇降格（基本給）に影響する
・例：「〇〇の能力を発揮し、組織に△△の変化をもたらす」

振り分け判断テスト：
「期末に成果物や数値が出ていれば達成と言える目標か？」
→ YES: ①短期成果評価　→ NO（行動・能力の発揮を問う）: ②発揮能力評価

━━━━━━━━━━━━━━━━━━━━━━
【Step3：各フィールドの必須要素】

■ 数値と期限
　× 「効率化する」
　○ 「上期末までに現状比25%削減する」

■ 達成基準は「状態・変化」で終わること
　× 「勉強会を実施する」
　○ 「チームの開発習慣が変わっている状態」

■ この人でなければならない理由を含めること
　○ このメンバーの強み・課題・キャリアステージに紐づいていなければならない

■ 検証方法を含めること
　○ 数値・比較・第三者の評価など客観的に判断できる基準が明示されていること

━━━━━━━━━━━━━━━━━━━━━━
【Step4：絶対禁止事項】

・Markdownの太字記法（**太字**）を使うこと
・「実施する」「共有する」「展開する」で文章を終わらせること
・各フィールド内に「目標1」「目標2」のように番号を振ること
・行動の列挙を目標と呼ぶこと
・誰に差し替えても違和感がない汎用的な目標を書くこと
・R&D関連目標に特定のプロダクト名を含めること

━━━━━━━━━━━━━━━━━━━━━━
【出力フォーマット】

必ず以下の2フィールドをこの順番で出力すること：

## ① 短期成果評価_目標

[半期で達成する具体的な成果を1つの文章ブロックとして記述]

└ 達成した姿：[変化・状態で終わる1文]
└ 検証方法：[客観的な判断基準。複数観点は①②③で列挙]
└ 中間確認（3ヶ月時点）：[6月末時点での確認基準]
└ 根拠：[方針・期待・本人情報との紐づけ]

---

## ② 発揮能力評価_目標

[キャリアラダーに対する能力の発揮を1つの文章ブロックとして記述]

└ 達成した姿：[変化・状態で終わる1文]
└ 検証方法：[客観的な判断基準]
└ 中間確認（3ヶ月時点）：[6月末時点での確認基準]
└ 根拠：[キャリアラダー・方針との紐づけ]

出力は日本語で行うこと。`
}
```

- [ ] **Step 2: buildRefinementTargetInstruction() を2フィールド対応に書き換え**

`buildRefinementTargetInstruction` 関数全体を以下に置き換える：

```typescript
export function buildRefinementTargetInstruction(
  targetField: 'shortTerm' | 'capability' | 'both',
  shortTermGoals: string,
  capabilityGoals: string,
): string {
  const fieldLabel = {
    shortTerm: '① 短期成果評価_目標',
    capability: '② 発揮能力評価_目標',
    both: '① 短期成果評価_目標と② 発揮能力評価_目標の両方',
  }[targetField]

  return `
━━━━━━━━━━━━━━━━━━━━━━
【重要：部分的ブラッシュアップ指示】

今回は ${fieldLabel} のみを再設計してください。

■ 出力ルール
・対象フィールドのみを出力フォーマット通りに出力してください
・非対象のフィールドは出力しないでください

■ 参考：現在の全フィールド
## ① 短期成果評価_目標

${shortTermGoals}

---

## ② 発揮能力評価_目標

${capabilityGoals}
━━━━━━━━━━━━━━━━━━━━━━`
}
```

- [ ] **Step 3: commit**

```bash
git add web-demo/src/lib/prompts/goal-generation.ts
git commit -m "feat: 目標生成プロンプトをカオナビ2フィールド形式に変更"
```

---

## Task 3: field-parser.ts — ストリームパーサー作成

**Files:**
- Create: `web-demo/src/lib/goals/field-parser.ts`

- [ ] **Step 1: ディレクトリを作成し、パーサーを実装**

```bash
mkdir -p /Users/akiharu.hyuga/Documents/Talent_Management_AI/web-demo/src/lib/goals
```

`web-demo/src/lib/goals/field-parser.ts` を新規作成：

```typescript
/**
 * ゴール生成ストリームを2フィールドに分割するユーティリティ
 *
 * AI出力フォーマット:
 *   ## ① 短期成果評価_目標
 *   （内容）
 *   ---
 *   ## ② 発揮能力評価_目標
 *   （内容）
 */

export const SHORT_TERM_MARKER = '## ① 短期成果評価_目標'
export const CAPABILITY_MARKER = '## ② 発揮能力評価_目標'

export interface ParsedGoalFields {
  shortTerm: string
  capability: string
}

/**
 * テキスト全体から2フィールドを抽出する。
 * ストリーミング中（② がまだ来ていない）でも呼び出し可能。
 */
export function parseGoalFields(text: string): ParsedGoalFields {
  const shortTermIdx = text.indexOf(SHORT_TERM_MARKER)
  const capabilityIdx = text.indexOf(CAPABILITY_MARKER)

  if (shortTermIdx === -1) {
    return { shortTerm: '', capability: '' }
  }

  if (capabilityIdx === -1) {
    // ② がまだ来ていない（ストリーミング中）
    const shortTerm = text
      .slice(shortTermIdx + SHORT_TERM_MARKER.length)
      .replace(/^\n+/, '')
    return { shortTerm, capability: '' }
  }

  const shortTerm = text
    .slice(shortTermIdx + SHORT_TERM_MARKER.length, capabilityIdx)
    .replace(/^\n+/, '')
    .replace(/\n+---\n+$/, '')
    .trim()

  const capability = text
    .slice(capabilityIdx + CAPABILITY_MARKER.length)
    .replace(/^\n+/, '')
    .trim()

  return { shortTerm, capability }
}

/**
 * 2フィールドを保存用markdownに組み立てる。
 */
export function assembleGoalMarkdown(
  shortTerm: string,
  capability: string,
): string {
  return `${SHORT_TERM_MARKER}\n\n${shortTerm}\n\n---\n\n${CAPABILITY_MARKER}\n\n${capability}`
}
```

- [ ] **Step 2: パーサーの動作を手動確認**

`web-demo/src/lib/goals/field-parser.ts` が正しく動作するか、コンソールで確認：

```bash
cd /Users/akiharu.hyuga/Documents/Talent_Management_AI/web-demo
node -e "
const { parseGoalFields, assembleGoalMarkdown } = require('./src/lib/goals/field-parser.ts')
" 2>&1 | head -5
```

※ ts-node が不要なため、TypeScript のビルドエラーを確認する：

```bash
npx tsc --noEmit 2>&1 | grep field-parser
```

エラーがなければOK。

- [ ] **Step 3: commit**

```bash
git add web-demo/src/lib/goals/field-parser.ts
git commit -m "feat: ゴールストリームを2フィールドに分割するパーサーを追加"
```

---

## Task 4: generate/route.ts — refinementパラメーター更新

**Files:**
- Modify: `web-demo/src/app/api/members/[name]/goals/generate/route.ts`

- [ ] **Step 1: refinement部分のパラメーターを2フィールド対応に変更**

`route.ts` の `body.targetGoalLabels` / `body.allGoalsMarkdown` の処理箇所を探して書き換える。

現在のコード（末尾付近）：
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

書き換え後：
```typescript
// 2フィールド部分ブラッシュアップ指示の追加
if (body.targetField && body.shortTermGoals != null && body.capabilityGoals != null) {
  const targetInstruction = buildRefinementTargetInstruction(
    body.targetField,
    body.shortTermGoals,
    body.capabilityGoals,
  )
  messages.push({ role: 'user', content: targetInstruction })
}
```

- [ ] **Step 2: import文に RefinementTarget が不要なことを確認（型はprompt側で管理）**

`route.ts` の import を確認し、不要なものがあれば削除する。

- [ ] **Step 3: ビルドエラー確認**

```bash
cd /Users/akiharu.hyuga/Documents/Talent_Management_AI/web-demo
npx tsc --noEmit 2>&1 | grep generate/route
```

エラーがなければOK。

- [ ] **Step 4: commit**

```bash
git add web-demo/src/app/api/members/[name]/goals/generate/route.ts
git commit -m "feat: generate APIのrefinementパラメーターを2フィールド形式に変更"
```

---

## Task 5: goals/route.ts — 保存テンプレート更新

**Files:**
- Modify: `web-demo/src/app/api/members/[name]/goals/route.ts`

- [ ] **Step 1: 保存時のmarkdownテンプレートを新形式に変更**

現在のファイルを読み、ファイル生成部分を探す。現在のテンプレート（`## 目標一覧` を含む）を以下に変更する。

現在のコード（概ね以下の形）：
```typescript
const fileContent = `# 半期目標設定

- 対象期間：${formatPeriodLabel(period)}
- 作成日：${new Date().toISOString().split('T')[0]}
- メンバー：${memberName}

## 目標一覧

${content}
`
```

書き換え後：
```typescript
const fileContent = `# 半期目標設定

- 対象期間：${formatPeriodLabel(period)}
- 作成日：${new Date().toISOString().split('T')[0]}
- メンバー：${memberName}

${content}
`
```

`## 目標一覧` の行を削除するだけ。`content` の中にすでに `## ① 短期成果評価_目標` などのヘッダーが含まれるようになるため。

- [ ] **Step 2: ビルドエラー確認**

```bash
npx tsc --noEmit 2>&1 | grep "goals/route"
```

- [ ] **Step 3: commit**

```bash
git add web-demo/src/app/api/members/[name]/goals/route.ts
git commit -m "feat: goal保存テンプレートから '## 目標一覧' ヘッダーを削除"
```

---

## Task 6: GoalWizard.tsx — reducer更新

**Files:**
- Modify: `web-demo/src/components/goals/GoalWizard.tsx`

- [ ] **Step 1: ファイルを読む**

`web-demo/src/components/goals/GoalWizard.tsx` を読み、reducer の初期状態と各actionを把握する。

- [ ] **Step 2: 初期状態を更新**

`generatedGoals: null` を 2フィールドに変更：

```typescript
// 変更前
const initialState: GoalWizardState = {
  // ...
  generatedGoals: null,
  // ...
}

// 変更後
const initialState: GoalWizardState = {
  // ...
  shortTermGoals: null,
  capabilityGoals: null,
  // ...
}
```

- [ ] **Step 3: SET_GENERATED_GOALS アクションを更新**

```typescript
// 変更前
case 'SET_GENERATED_GOALS':
  return { ...state, generatedGoals: action.payload, currentStep: 7 }

// 変更後
case 'SET_GENERATED_GOALS':
  return {
    ...state,
    shortTermGoals: action.payload.shortTermGoals,
    capabilityGoals: action.payload.capabilityGoals,
    currentStep: 7,
  }
```

- [ ] **Step 4: ADD_REFINEMENT アクションを更新**

`ADD_REFINEMENT` で `generatedGoals` を更新している箇所を探して変更：

```typescript
// 変更前
case 'ADD_REFINEMENT':
  return {
    ...state,
    generatedGoals: action.payload.newGoals,
    refinementMessages: action.payload.messages,
    refinementCount: action.payload.count,
  }

// 変更後
case 'ADD_REFINEMENT':
  return {
    ...state,
    shortTermGoals: action.payload.shortTermGoals,
    capabilityGoals: action.payload.capabilityGoals,
    refinementMessages: action.payload.messages,
    refinementCount: action.payload.count,
  }
```

- [ ] **Step 5: Step6 と Step7 への props を更新**

GoalWizard 内で Step6 に渡している `onGenerated` コールバックのシグネチャを変更：

```typescript
// Step6 への onGenerated コールバック
// 変更前
onGenerated={(goals) => dispatch({ type: 'SET_GENERATED_GOALS', payload: goals })}

// 変更後
onGenerated={(shortTermGoals, capabilityGoals) =>
  dispatch({ type: 'SET_GENERATED_GOALS', payload: { shortTermGoals, capabilityGoals } })
}
```

Step7 への `onAddRefinement` コールバックを変更：

```typescript
// 変更前
onAddRefinement={(messages, newGoals, count) =>
  dispatch({ type: 'ADD_REFINEMENT', payload: { messages, newGoals, count } })
}

// 変更後
onAddRefinement={(messages, shortTermGoals, capabilityGoals, count) =>
  dispatch({ type: 'ADD_REFINEMENT', payload: { messages, shortTermGoals, capabilityGoals, count } })
}
```

- [ ] **Step 6: ビルドエラー確認**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7: commit**

```bash
git add web-demo/src/components/goals/GoalWizard.tsx
git commit -m "feat: GoalWizard reducerを2フィールド(shortTermGoals/capabilityGoals)対応に更新"
```

---

## Task 7: Step6GoalGeneration.tsx — 2パネルUI

**Files:**
- Modify: `web-demo/src/components/goals/steps/Step6GoalGeneration.tsx`

- [ ] **Step 1: Props インターフェースを更新**

```typescript
// 変更前
interface Props {
  state: GoalWizardState
  context: WizardContextData
  onGenerated: (goals: string) => void
  onBack: () => void
}

// 変更後
interface Props {
  state: GoalWizardState
  context: WizardContextData
  onGenerated: (shortTermGoals: string, capabilityGoals: string) => void
  onBack: () => void
}
```

- [ ] **Step 2: コンポーネント内のstateを2フィールドに変更**

```typescript
// 変更前
const [goals, setGoals] = useState(state.generatedGoals || '')

// 変更後
import { parseGoalFields } from '@/lib/goals/field-parser'

const [fullText, setFullText] = useState('')
const [shortTerm, setShortTerm] = useState(state.shortTermGoals || '')
const [capability, setCapability] = useState(state.capabilityGoals || '')
const [isStreaming, setIsStreaming] = useState(!state.shortTermGoals)
const [copied, setCopied] = useState<'shortTerm' | 'capability' | null>(null)
```

- [ ] **Step 3: useEffect のストリーミング処理を更新**

```typescript
useEffect(() => {
  if (state.shortTermGoals) return  // 既に生成済みならスキップ

  const controller = new AbortController()
  abortRef.current = controller

  ;(async () => {
    setIsStreaming(true)
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
        signal: controller.signal,
      })

      if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream')) {
        setError('目標の生成に失敗しました')
        setIsStreaming(false)
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''

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
            const parsed = JSON.parse(data)
            if (parsed.text) {
              accumulated += parsed.text
              // フィールドパーサーで随時更新
              const fields = parseGoalFields(accumulated)
              setShortTerm(fields.shortTerm)
              setCapability(fields.capability)
            }
          } catch {}
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('目標の生成に失敗しました')
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsStreaming(false)
      }
    }
  })()

  return () => { controller.abort() }
}, [state.shortTermGoals, state.managerInput, state.memberInput, state.previousPeriod, state.diagnosis, context.memberName, context.memberProfile])
```

- [ ] **Step 4: コピーボタンのハンドラーを追加**

```typescript
const handleCopy = async (text: string, field: 'shortTerm' | 'capability') => {
  await navigator.clipboard.writeText(text)
  setCopied(field)
  setTimeout(() => setCopied(null), 2000)
}
```

- [ ] **Step 5: JSXを2パネルレイアウトに書き換え**

ローディング状態（`!shortTerm && isStreaming`）はそのままで、メインのreturnを以下に変更：

```tsx
return (
  <div>
    <h2 className="text-4xl font-bold text-gray-800 mb-3">目標案</h2>
    <p className="text-xl text-gray-500 mb-8">
      {isStreaming ? 'AIが目標を生成中...' : '診断サマリーをもとにAIが目標を設計しました。次のステップで壁打ち・精緻化ができます。'}
    </p>

    {/* ① 短期成果評価パネル */}
    <div className="border border-gray-200 rounded-xl mb-6 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 bg-blue-50 border-b border-gray-200">
        <span className="text-lg font-semibold text-blue-800">① 短期成果評価_目標</span>
        <button
          onClick={() => handleCopy(shortTerm, 'shortTerm')}
          disabled={!shortTerm || isStreaming}
          className="px-4 py-1.5 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-40 transition-colors"
        >
          {copied === 'shortTerm' ? 'コピーしました ✓' : 'コピー'}
        </button>
      </div>
      <div className="p-6 bg-white min-h-[120px]">
        <MarkdownRenderer content={shortTerm} />
        {isStreaming && !capability && (
          <span className="inline-block w-2 h-5 bg-brand-500 animate-pulse ml-1" />
        )}
      </div>
    </div>

    {/* ② 発揮能力評価パネル */}
    <div className="border border-gray-200 rounded-xl mb-8 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 bg-green-50 border-b border-gray-200">
        <span className="text-lg font-semibold text-green-800">② 発揮能力評価_目標</span>
        <button
          onClick={() => handleCopy(capability, 'capability')}
          disabled={!capability || isStreaming}
          className="px-4 py-1.5 text-sm border border-green-300 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-40 transition-colors"
        >
          {copied === 'capability' ? 'コピーしました ✓' : 'コピー'}
        </button>
      </div>
      <div className="p-6 bg-white min-h-[120px]">
        <MarkdownRenderer content={capability} />
        {isStreaming && capability && (
          <span className="inline-block w-2 h-5 bg-brand-500 animate-pulse ml-1" />
        )}
      </div>
    </div>

    {!isStreaming && (
      <div className="flex justify-end gap-4">
        <button onClick={onBack} className="px-10 py-3.5 text-xl border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors">
          戻る
        </button>
        <button
          onClick={() => onGenerated(shortTerm, capability)}
          className="px-10 py-3.5 text-xl bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-glow"
        >
          壁打ちへ進む
        </button>
      </div>
    )}
  </div>
)
```

- [ ] **Step 6: dev server を起動して目標生成画面を確認**

```bash
cd /Users/akiharu.hyuga/Documents/Talent_Management_AI/web-demo
npm run dev
```

任意のメンバーで目標生成ウィザードをStep6まで進める。2パネルが表示されること、コピーボタンが動作することを確認する。

- [ ] **Step 7: commit**

```bash
git add web-demo/src/components/goals/steps/Step6GoalGeneration.tsx
git commit -m "feat: Step6目標生成を2パネルUI(短期成果/発揮能力)+コピーボタンに変更"
```

---

## Task 8: Step7Refinement.tsx — 2フィールド精緻化UI

**Files:**
- Modify: `web-demo/src/components/goals/steps/Step7Refinement.tsx`

- [ ] **Step 1: Props インターフェースを更新**

```typescript
// 変更前
interface Props {
  state: GoalWizardState
  context: WizardContextData
  onAddRefinement: (messages: ChatMessage[], newGoals: string, count: number) => void
  onConfirm: (goals: string) => void
  onBack: () => void
}

// 変更後
interface Props {
  state: GoalWizardState
  context: WizardContextData
  onAddRefinement: (
    messages: ChatMessage[],
    shortTermGoals: string,
    capabilityGoals: string,
    count: number,
  ) => void
  onConfirm: (goals: string) => void
  onBack: () => void
}
```

- [ ] **Step 2: import文を更新**

```typescript
import { parseGoalFields, assembleGoalMarkdown } from '@/lib/goals/field-parser'
import type { RefinementTarget } from '@/lib/types'
```

- [ ] **Step 3: 内部stateを2フィールドに変更**

```typescript
// 変更前（currentGoals: string）
const [currentGoals, setCurrentGoals] = useState(state.generatedGoals || '')

// 変更後
const [currentShortTerm, setCurrentShortTerm] = useState(state.shortTermGoals || '')
const [currentCapability, setCurrentCapability] = useState(state.capabilityGoals || '')
const [targetField, setTargetField] = useState<RefinementTarget>('both')
const [feedback, setFeedback] = useState('')
const [isStreaming, setIsStreaming] = useState(false)
const [count, setCount] = useState(state.refinementCount)
const [messages, setMessages] = useState<ChatMessage[]>(state.refinementMessages)
const [saving, setSaving] = useState(false)
const [saved, setSaved] = useState(false)
const [saveError, setSaveError] = useState('')
const [copied, setCopied] = useState<'shortTerm' | 'capability' | null>(null)
```

- [ ] **Step 4: handleSendFeedback を2フィールド対応に書き換え**

```typescript
const handleSendFeedback = async () => {
  if (!feedback.trim() || isStreaming) return

  const userMessage: ChatMessage = { role: 'user', content: feedback }
  const updatedMessages = [...messages, userMessage]

  setIsStreaming(true)
  setFeedback('')

  try {
    const res = await fetch(
      `/api/members/${encodeURIComponent(context.memberName)}/goals/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberContext: context.memberProfile,
          managerInput: state.managerInput,
          memberInput: state.memberInput,
          previousPeriod: state.previousPeriod.previousGoals ? state.previousPeriod : undefined,
          diagnosis: state.diagnosis,
          refinementMessages: updatedMessages,
          targetField,
          shortTermGoals: currentShortTerm,
          capabilityGoals: currentCapability,
        }),
      },
    )

    if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream')) {
      setIsStreaming(false)
      return
    }

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let accumulated = ''

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
          const parsed = JSON.parse(data)
          if (parsed.text) {
            accumulated += parsed.text
            const fields = parseGoalFields(accumulated)
            // 対象フィールドのみ更新、非対象は現状維持
            if (targetField === 'shortTerm' || targetField === 'both') {
              if (fields.shortTerm) setCurrentShortTerm(fields.shortTerm)
            }
            if (targetField === 'capability' || targetField === 'both') {
              if (fields.capability) setCurrentCapability(fields.capability)
            }
          }
        } catch {}
      }
    }

    const assistantMessage: ChatMessage = { role: 'assistant', content: accumulated }
    const finalMessages = [...updatedMessages, assistantMessage]
    const newCount = count + 1

    setMessages(finalMessages)
    setCount(newCount)
    onAddRefinement(finalMessages, currentShortTerm, currentCapability, newCount)
  } finally {
    setIsStreaming(false)
  }
}
```

- [ ] **Step 5: handleConfirm を2フィールド対応に書き換え**

```typescript
const handleConfirm = async () => {
  setSaving(true)
  setSaveError('')
  try {
    const fullMarkdown = assembleGoalMarkdown(currentShortTerm, currentCapability)
    const res = await fetch(
      `/api/members/${encodeURIComponent(context.memberName)}/goals`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: fullMarkdown,
          period: context.targetPeriod,
        }),
      },
    )
    if (!res.ok) throw new Error('save failed')
    setSaved(true)
    onConfirm(fullMarkdown)
  } catch {
    setSaveError('保存に失敗しました。もう一度お試しください。')
  } finally {
    setSaving(false)
  }
}
```

- [ ] **Step 6: handleCopy ヘルパーを追加**

```typescript
const handleCopy = async (text: string, field: 'shortTerm' | 'capability') => {
  await navigator.clipboard.writeText(text)
  setCopied(field)
  setTimeout(() => setCopied(null), 2000)
}
```

- [ ] **Step 7: JSXを2フィールドUIに書き換え**

コンポーネントのmain return を以下に変更。`saved` 状態は既存のものを流用：

```tsx
return (
  <div>
    <h2 className="text-4xl font-bold text-gray-800 mb-3">壁打ち・精緻化</h2>
    <p className="text-xl text-gray-500 mb-8">
      内容を確認し、修正が必要な場合はフィードバックを送ってください。（推奨 {count}/2回）
    </p>

    {/* ① 短期成果評価パネル */}
    <div className="border border-gray-200 rounded-xl mb-6 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 bg-blue-50 border-b border-gray-200">
        <span className="text-lg font-semibold text-blue-800">① 短期成果評価_目標</span>
        <button
          onClick={() => handleCopy(currentShortTerm, 'shortTerm')}
          disabled={!currentShortTerm}
          className="px-4 py-1.5 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-40 transition-colors"
        >
          {copied === 'shortTerm' ? 'コピーしました ✓' : 'コピー'}
        </button>
      </div>
      <div className="p-6 bg-white min-h-[100px]">
        <MarkdownRenderer content={currentShortTerm} />
        {isStreaming && (targetField === 'shortTerm' || targetField === 'both') && (
          <span className="inline-block w-2 h-5 bg-brand-500 animate-pulse ml-1" />
        )}
      </div>
    </div>

    {/* ② 発揮能力評価パネル */}
    <div className="border border-gray-200 rounded-xl mb-8 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 bg-green-50 border-b border-gray-200">
        <span className="text-lg font-semibold text-green-800">② 発揮能力評価_目標</span>
        <button
          onClick={() => handleCopy(currentCapability, 'capability')}
          disabled={!currentCapability}
          className="px-4 py-1.5 text-sm border border-green-300 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-40 transition-colors"
        >
          {copied === 'capability' ? 'コピーしました ✓' : 'コピー'}
        </button>
      </div>
      <div className="p-6 bg-white min-h-[100px]">
        <MarkdownRenderer content={currentCapability} />
        {isStreaming && (targetField === 'capability' || targetField === 'both') && (
          <span className="inline-block w-2 h-5 bg-brand-500 animate-pulse ml-1" />
        )}
      </div>
    </div>

    {/* フィードバックエリア */}
    {count < 2 && !saved && (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-6">
        <p className="text-lg font-medium text-gray-700 mb-4">修正するフィールドを選んでください</p>
        <div className="flex gap-4 mb-5">
          {(['both', 'shortTerm', 'capability'] as RefinementTarget[]).map((field) => (
            <button
              key={field}
              onClick={() => setTargetField(field)}
              className={`px-5 py-2.5 text-base rounded-xl border transition-colors ${
                targetField === field
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {field === 'both' ? '両方' : field === 'shortTerm' ? '① 短期成果' : '② 発揮能力'}
            </button>
          ))}
        </div>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="修正の方向性や具体的な要望を入力してください..."
          rows={3}
          className="w-full border border-gray-200 rounded-xl bg-white px-5 py-3 text-xl focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none mb-4"
        />
        <div className="flex justify-end">
          <button
            onClick={handleSendFeedback}
            disabled={!feedback.trim() || isStreaming}
            className="px-10 py-3 text-xl bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {isStreaming ? '再生成中...' : '再生成する'}
          </button>
        </div>
      </div>
    )}

    {count >= 2 && !saved && (
      <p className="text-base text-amber-600 mb-6 text-center">
        推奨回数（2回）に達しました。内容を確認して確定してください。
      </p>
    )}

    {saveError && <p className="text-red-500 text-center mb-4">{saveError}</p>}

    {!saved && (
      <div className="flex justify-end gap-4">
        <button onClick={onBack} className="px-10 py-3.5 text-xl border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors">
          戻る
        </button>
        <button
          onClick={handleConfirm}
          disabled={saving || !currentShortTerm || !currentCapability}
          className="px-10 py-3.5 text-xl bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-glow"
        >
          {saving ? '保存中...' : '確定・保存する'}
        </button>
      </div>
    )}

    {saved && (
      <div className="text-center py-10">
        <p className="text-3xl text-green-600 font-bold mb-3">目標を保存しました</p>
        <p className="text-xl text-gray-500">カオナビへのコピーが完了したらウィザードを閉じてください。</p>
      </div>
    )}
  </div>
)
```

※ `onClose` は GoalWizard から `context` または追加 prop で渡す必要があれば追加する。

- [ ] **Step 8: ビルドエラーが解消されているか確認**

```bash
npx tsc --noEmit 2>&1 | head -20
```

エラーがゼロになっていること。

- [ ] **Step 9: dev server で Step7 まで動作確認**

`npm run dev` を起動し、任意メンバーでウィザードをStep7まで進める。
- 2パネルが表示される
- フィールド選択で「両方 / ① / ②」が切り替わる
- 再生成が動作する
- 確定・保存が動作する

- [ ] **Step 10: commit**

```bash
git add web-demo/src/components/goals/steps/Step7Refinement.tsx
git commit -m "feat: Step7精緻化UIを2フィールド対応(フィールド選択+コピーボタン)に変更"
```

---

## Task 9: 移行スクリプト作成・実行

**Files:**
- Create: `scripts/migrate-goals-to-kaonavi-format.ts`

- [ ] **Step 1: scripts ディレクトリを作成し、スクリプトを実装**

```bash
mkdir -p /Users/akiharu.hyuga/Documents/Talent_Management_AI/scripts
```

`scripts/migrate-goals-to-kaonavi-format.ts` を新規作成：

```typescript
/**
 * 既存の目標ファイル（旧3目標形式）をカオナビ2フィールド形式に移行するスクリプト
 *
 * 実行方法:
 *   cd /Users/akiharu.hyuga/Documents/Talent_Management_AI
 *   npx ts-node --project web-demo/tsconfig.json scripts/migrate-goals-to-kaonavi-format.ts
 *
 * 必要な環境変数（web-demo/.env.local から読み込み）:
 *   ANTHROPIC_API_KEY  または  ANTHROPIC_FOUNDRY_API_KEY + ANTHROPIC_FOUNDRY_BASE_URL
 */

import * as fs from 'fs'
import * as path from 'path'

// .env.local を手動ロード（dotenvなしでも動作）
const envPath = path.join(__dirname, '../web-demo/.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const match = line.match(/^([^#=][^=]*)=(.*)$/)
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
  }
}

const DATA_DIR = path.join(__dirname, '../data/members')
const PERIOD = '2026-h1'

// テンプレートかどうかの判定：旧フォーマットの目標セクションが含まれるか
function hasGoalContent(content: string): boolean {
  return content.includes('## 目標①') || content.includes('## 目標①（実行）') ||
         (content.includes('目標文：') && content.length > 300)
}

// テンプレートファイル用の新フォーマット
function buildEmptyTemplate(memberName: string, period: string): string {
  const periodLabel = period === '2026-h1' ? '2026年上期（4月〜9月）' : period
  return `# 半期目標設定

- 対象期間：${periodLabel}
- 作成日：
- メンバー：${memberName}

## ① 短期成果評価_目標

（上長とのすり合わせ後、今期の目標を記載してください）

---

## ② 発揮能力評価_目標

（上長とのすり合わせ後、今期の目標を記載してください）
`
}

// Claude API を使って旧→新フォーマットに変換
async function convertWithClaude(oldContent: string, memberName: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_FOUNDRY_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY or ANTHROPIC_FOUNDRY_API_KEY が設定されていません')

  const foundryBaseUrl = process.env.ANTHROPIC_FOUNDRY_BASE_URL
  const foundryResource = process.env.ANTHROPIC_FOUNDRY_RESOURCE
  const deploymentName = process.env.DEPLOYMENT_NAME || 'claude-sonnet-4-20250514'

  const isFoundry = !!process.env.ANTHROPIC_FOUNDRY_API_KEY
  const endpoint = isFoundry
    ? `${(foundryBaseUrl || `https://${foundryResource}.services.ai.azure.com/anthropic/`).replace(/\/$/, '')}/v1/messages`
    : 'https://api.anthropic.com/v1/messages'

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  }
  if (isFoundry) {
    headers['api-key'] = apiKey
    headers['x-api-key'] = apiKey
  } else {
    headers['x-api-key'] = apiKey
  }

  const systemPrompt = `あなたは人材育成の専門コンサルタントです。
旧フォーマットの目標設定を、カオナビの2フィールド形式に変換してください。

【振り分け基準】
- 短期成果評価_目標（① What）: 期末に成果物・数値・状態の達成で評価できる内容
  → 通常、旧フォーマットの「実行目標」「挑戦目標」がここに来る
- 発揮能力評価_目標（② How）: キャリアラダーに対する行動・能力・再現性
  → 通常、旧フォーマットの「インパクト目標」がここに来る

【構造維持】
- 各フィールドは「目標文 + └ 達成した姿 + └ 検証方法 + └ 中間確認（3ヶ月時点） + └ 根拠」の構造を保つ
- フィールド内に「目標1」「目標2」など番号は振らない（1ブロックとして統合）
- 内容は変更しない（情報の損失・追加なし）
- 整合確認テーブルは削除する

【出力フォーマット（必ずこの形式で）】
# 半期目標設定

- 対象期間：{元のデータから}
- 作成日：{元のデータから}
- メンバー：{元のデータから}

## ① 短期成果評価_目標

{短期成果の内容}

---

## ② 発揮能力評価_目標

{発揮能力の内容}`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: deploymentName,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `以下の旧フォーマット目標設定を新フォーマットに変換してください。\n\nメンバー名: ${memberName}\n\n---\n${oldContent}`,
        },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API error ${res.status}: ${err}`)
  }

  const json = await res.json()
  return json.content[0].text
}

async function main() {
  console.log('=== カオナビ目標フォーマット移行スクリプト ===\n')

  const memberDirs = fs.readdirSync(DATA_DIR).filter((d) =>
    fs.statSync(path.join(DATA_DIR, d)).isDirectory()
  )

  let converted = 0
  let templated = 0
  let skipped = 0
  const errors: string[] = []

  for (const memberName of memberDirs) {
    const goalPath = path.join(DATA_DIR, memberName, 'goals', `${PERIOD}.md`)
    const backupPath = `${goalPath}.bak`

    if (!fs.existsSync(goalPath)) {
      console.log(`⏭  ${memberName}: goalファイルなし、スキップ`)
      skipped++
      continue
    }

    const original = fs.readFileSync(goalPath, 'utf-8')

    // すでに新形式なら何もしない
    if (original.includes('## ① 短期成果評価_目標')) {
      console.log(`✅ ${memberName}: すでに新形式、スキップ`)
      skipped++
      continue
    }

    // バックアップ作成
    fs.copyFileSync(goalPath, backupPath)
    console.log(`📦 ${memberName}: バックアップを作成 (${PERIOD}.md.bak)`)

    if (hasGoalContent(original)) {
      // Claude APIで変換
      try {
        console.log(`🤖 ${memberName}: AI変換中...`)
        const converted_content = await convertWithClaude(original, memberName)
        fs.writeFileSync(goalPath, converted_content, 'utf-8')
        console.log(`✅ ${memberName}: AI変換完了`)
        converted++
      } catch (err) {
        const errMsg = `${memberName}: 変換失敗 - ${(err as Error).message}`
        console.error(`❌ ${errMsg}`)
        errors.push(errMsg)
        // バックアップから元に戻す
        fs.copyFileSync(backupPath, goalPath)
      }
    } else {
      // テンプレートを新形式に置き換え
      const newTemplate = buildEmptyTemplate(memberName, PERIOD)
      fs.writeFileSync(goalPath, newTemplate, 'utf-8')
      console.log(`📝 ${memberName}: テンプレートを新形式に更新`)
      templated++
    }
  }

  console.log('\n=== 完了 ===')
  console.log(`AI変換: ${converted}名`)
  console.log(`テンプレート更新: ${templated}名`)
  console.log(`スキップ: ${skipped}名`)
  if (errors.length > 0) {
    console.log(`エラー: ${errors.length}件`)
    errors.forEach((e) => console.log(`  - ${e}`))
  }
}

main().catch(console.error)
```

- [ ] **Step 2: ドライランで動作確認（1名だけテスト）**

スクリプトを実行する前に、テスト用に1名だけ試す。`main()` の `memberDirs` を一時的に1名に絞って確認：

```bash
cd /Users/akiharu.hyuga/Documents/Talent_Management_AI
# まず .bak がないことを確認
ls data/members/方/goals/

# スクリプト実行（全メンバー対象）
npx ts-node --esm --project web-demo/tsconfig.json scripts/migrate-goals-to-kaonavi-format.ts
```

※ `ts-node` が使えない場合：
```bash
cd web-demo && npx tsx ../scripts/migrate-goals-to-kaonavi-format.ts
```

- [ ] **Step 3: 変換結果をマネージャーが確認**

変換されたファイルをいくつか開いて、内容が正しく2フィールドに変換されているか確認する：

```bash
cat /Users/akiharu.hyuga/Documents/Talent_Management_AI/data/members/方/goals/2026-h1.md | head -30
cat /Users/akiharu.hyuga/Documents/Talent_Management_AI/data/members/梁/goals/2026-h1.md | head -30
```

期待値：
- `## ① 短期成果評価_目標` セクションが存在する
- `## ② 発揮能力評価_目標` セクションが存在する
- 旧フォーマットの `## 目標①（実行）` が消えている
- 内容（目標文・検証方法など）が維持されている

- [ ] **Step 4: バックアップの存在を確認**

```bash
ls /Users/akiharu.hyuga/Documents/Talent_Management_AI/data/members/方/goals/
# 2026-h1.md と 2026-h1.md.bak が両方あること
```

- [ ] **Step 5: commit**

```bash
cd /Users/akiharu.hyuga/Documents/Talent_Management_AI
git add scripts/migrate-goals-to-kaonavi-format.ts
git add data/members/
git commit -m "feat: 既存目標データをカオナビ2フィールド形式に移行（バックアップあり）"
```

---

## Task 10: 最終確認

- [ ] **Step 1: 全体ビルドが通ることを確認**

```bash
cd /Users/akiharu.hyuga/Documents/Talent_Management_AI/web-demo
npx tsc --noEmit
```

エラーがゼロであること。

- [ ] **Step 2: dev server でエンドツーエンド動作確認**

```bash
npm run dev
```

以下のフローを全て確認する：
1. 任意のメンバーで目標設定ウィザードを開く
2. Step2〜4 でデータ入力（変更なし）
3. Step5 診断が表示される（変更なし）
4. Step6 で2パネル（① 短期成果 / ② 発揮能力）が表示される
5. 各パネルの「コピー」ボタンが動作する
6. Step7 で「両方 / ① / ②」フィールド選択ができる
7. フィードバックを入力して再生成が動作する
8. 「確定・保存する」でファイルが保存される
9. 保存されたファイルが新形式になっている

- [ ] **Step 3: 移行済みデータが目標詳細ページで正しく表示されることを確認**

既存の目標を持つメンバー（方、梁など）の詳細ページを開き、目標タブが正しく表示されることを確認する。

- [ ] **Step 4: 最終 commit**

```bash
git add -p  # 未コミットのものがあれば
git commit -m "feat: カオナビ目標フォーマット対応 完了"
```
