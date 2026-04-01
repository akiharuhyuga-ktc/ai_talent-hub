# Code Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 critical/high issues and 7 quality issues found during code review, without changing existing behavior.

**Architecture:** Minimal targeted fixes. A2 (hardcoded path) unblocks portability, B1 (path traversal) adds a `safeMemberDir` guard in `lib/fs/members.ts`, A1 (field mismatch) aligns the EvalStep4Comment component with the existing API contract. C1-C7 are small surgical fixes.

**Tech Stack:** Next.js 14 App Router, TypeScript, React hooks

---

## File Map

| Task | File | Action |
|------|------|--------|
| A2 | `web-demo/src/lib/fs/paths.ts` | Modify line 4 |
| B1 | `web-demo/src/lib/fs/members.ts` | Add `safeMemberDir`, modify `getMemberDetail` |
| B1 | `web-demo/src/app/api/members/[name]/goals/route.ts` | Add path guard |
| B1 | `web-demo/src/app/api/members/[name]/one-on-one/route.ts` | Add path guard |
| B1 | `web-demo/src/app/api/members/[name]/reviews/route.ts` | Add path guard |
| A1 | `web-demo/src/components/evaluation/steps/EvalStep4Comment.tsx` | Fix request body fields |
| C1 | `web-demo/src/hooks/useChat.ts` | Fix stale closure |
| C2 | `web-demo/src/app/api/members/[name]/goals/generate/route.ts` | Validate role |
| C3 | `web-demo/src/app/api/members/[name]/reviews/draft/route.ts` | Add maxDuration |
| C4 | `web-demo/src/components/goals/steps/Step7Refinement.tsx` | Add error feedback |
| C5 | `web-demo/src/app/api/chat/route.ts` | Add force-dynamic |
| C6 | `web-demo/src/app/api/members/[name]/reviews/draft/route.ts` | Fix regex |
| C7 | `web-demo/src/app/api/chat/route.ts` | Add orgPolicy to prompt |
| C7 | `web-demo/src/app/api/members/[name]/one-on-one/summary/route.ts` | Add orgPolicy to prompt |
| C7 | `web-demo/src/app/api/members/[name]/reviews/comment/route.ts` | Add orgPolicy to prompt |

---

### Task 1: A2 — ハードコードされた絶対パスを修正

**Files:**
- Modify: `web-demo/src/lib/fs/paths.ts:4`

- [ ] **Step 1: Modify paths.ts to use environment variable or cwd**

Replace line 4 in `web-demo/src/lib/fs/paths.ts`:

```typescript
// Before (line 4):
const PROJECT_ROOT = '/Users/akiharu.hyuga/Documents/Talent_Management_AI'

// After:
const PROJECT_ROOT = process.env.TALENT_DATA_ROOT
  ?? path.resolve(process.cwd(), '..')
```

This uses `TALENT_DATA_ROOT` env var if set, otherwise resolves to the parent of the Next.js app's working directory (`web-demo/..` = project root).

- [ ] **Step 2: Verify the app starts and dashboard loads**

Run:
```bash
cd web-demo && rm -rf .next && npm run build 2>&1 | tail -20
```

Expected: Build succeeds without errors. The resolved `PROJECT_ROOT` should point to `/Users/akiharu.hyuga/Documents/Talent_Management_AI` since `cwd()` in `web-demo/` resolves `..` to the project root.

- [ ] **Step 3: Commit**

```bash
git add web-demo/src/lib/fs/paths.ts
git commit -m "fix(A2): replace hardcoded absolute path with env var / cwd fallback"
```

---

### Task 2: B1 — パストラバーサル脆弱性の修正

**Files:**
- Modify: `web-demo/src/lib/fs/members.ts:53-56` (add `safeMemberDir`, update `getMemberDetail`)
- Modify: `web-demo/src/app/api/members/[name]/goals/route.ts:14-15`
- Modify: `web-demo/src/app/api/members/[name]/one-on-one/route.ts:13-14`
- Modify: `web-demo/src/app/api/members/[name]/reviews/route.ts:14-15`

- [ ] **Step 1: Add `safeMemberDir` helper to `members.ts`**

Add this function after the existing imports (before `getMemberNames`) in `web-demo/src/lib/fs/members.ts`:

```typescript
/**
 * Decode + resolve member name to a safe directory path.
 * Throws if the resolved path escapes the members base directory.
 */
export function safeMemberDir(encodedName: string): string {
  const membersDir = getMembersDir()
  const name = decodeURIComponent(encodedName)
  const resolved = path.resolve(membersDir, name)
  const base = path.resolve(membersDir)

  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error('Invalid member name')
  }
  return resolved
}
```

- [ ] **Step 2: Update `getMemberDetail` to use `safeMemberDir`**

Replace lines 53-57 in `web-demo/src/lib/fs/members.ts`:

```typescript
// Before:
export function getMemberDetail(encodedName: string): MemberDetail | null {
  const membersDir = getMembersDir()
  const name = decodeURIComponent(encodedName)
  const memberDir = path.join(membersDir, name)
  if (!fs.existsSync(memberDir)) return null

// After:
export function getMemberDetail(encodedName: string): MemberDetail | null {
  let memberDir: string
  try {
    memberDir = safeMemberDir(encodedName)
  } catch {
    return null
  }
  if (!fs.existsSync(memberDir)) return null
```

- [ ] **Step 3: Update `goals/route.ts` to use `safeMemberDir`**

Replace lines 1-18 in `web-demo/src/app/api/members/[name]/goals/route.ts`:

```typescript
import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { safeMemberDir } from '@/lib/fs/members'
import { getActivePeriod, formatPeriodLabel } from '@/lib/utils/period'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    let memberDir: string
    try {
      memberDir = safeMemberDir(params.name)
    } catch {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
    }
    if (!fs.existsSync(memberDir)) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    const memberName = decodeURIComponent(params.name)
```

The rest of the function remains unchanged — it already uses `memberDir` and `memberName` correctly from this point.

- [ ] **Step 4: Update `one-on-one/route.ts` to use `safeMemberDir`**

Replace lines 1-17 in `web-demo/src/app/api/members/[name]/one-on-one/route.ts`:

```typescript
import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { safeMemberDir } from '@/lib/fs/members'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    let memberDir: string
    try {
      memberDir = safeMemberDir(params.name)
    } catch {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
    }
    if (!fs.existsSync(memberDir)) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    const memberName = decodeURIComponent(params.name)
```

The rest of the function remains unchanged.

- [ ] **Step 5: Update `reviews/route.ts` to use `safeMemberDir`**

Replace lines 1-18 in `web-demo/src/app/api/members/[name]/reviews/route.ts`:

```typescript
import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { safeMemberDir } from '@/lib/fs/members'
import { getActivePeriod } from '@/lib/utils/period'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    let memberDir: string
    try {
      memberDir = safeMemberDir(params.name)
    } catch {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
    }
    if (!fs.existsSync(memberDir)) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    const memberName = decodeURIComponent(params.name)
```

The rest of the function remains unchanged.

- [ ] **Step 6: Add filename sanitization for `period` and `yearMonth` parameters**

In the same three route files, also add guards on the `period`/`yearMonth` values used in file paths:

In `goals/route.ts`, after `const targetPeriod = period || getActivePeriod()`:
```typescript
if (!/^\d{4}-h[12]$/.test(targetPeriod)) {
  return NextResponse.json({ error: 'Invalid period format' }, { status: 400 })
}
```

In `one-on-one/route.ts`, after `const filename = yearMonth || ...`:
```typescript
if (!/^\d{4}-\d{2}$/.test(filename)) {
  return NextResponse.json({ error: 'Invalid yearMonth format' }, { status: 400 })
}
```

In `reviews/route.ts`, after `const filename = period || getActivePeriod()`:
```typescript
if (!/^\d{4}-h[12]$/.test(filename)) {
  return NextResponse.json({ error: 'Invalid period format' }, { status: 400 })
}
```

- [ ] **Step 7: Verify build succeeds**

Run:
```bash
cd web-demo && rm -rf .next && npm run build 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add web-demo/src/lib/fs/members.ts \
  web-demo/src/app/api/members/\[name\]/goals/route.ts \
  web-demo/src/app/api/members/\[name\]/one-on-one/route.ts \
  web-demo/src/app/api/members/\[name\]/reviews/route.ts
git commit -m "fix(B1): add path traversal guard with safeMemberDir + filename validation"
```

---

### Task 3: A1 — EvalStep4Comment とAPIのフィールド不整合を修正

**Files:**
- Modify: `web-demo/src/components/evaluation/steps/EvalStep4Comment.tsx:36-44`

- [ ] **Step 1: Fix the request body in EvalStep4Comment.tsx**

The API route (`reviews/comment/route.ts` lines 21-28) expects: `goalEvaluations`, `overallGrade`, `overallRationale`, `selfEvalGap`, `selfEvaluation`. The component currently sends `confirmedDraft` as an opaque object.

The type `EvaluationDraft` has fields: `goalEvaluations`, `overallGrade`, `overallRationale`, `selfEvalGap`, `specialNotes`.

Replace lines 36-44 in `web-demo/src/components/evaluation/steps/EvalStep4Comment.tsx`:

```typescript
          body: JSON.stringify({
            goalEvaluations: state.confirmedDraft?.goalEvaluations ?? [],
            overallGrade: state.confirmedDraft?.overallGrade ?? '',
            overallRationale: state.confirmedDraft?.overallRationale ?? '',
            selfEvalGap: state.confirmedDraft?.selfEvalGap ?? '',
            selfEvaluation: state.selfEvaluation,
          }),
```

This sends exactly the fields the API route expects, destructured from `state.confirmedDraft`.

- [ ] **Step 2: Verify build succeeds**

Run:
```bash
cd web-demo && rm -rf .next && npm run build 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add web-demo/src/components/evaluation/steps/EvalStep4Comment.tsx
git commit -m "fix(A1): align EvalStep4Comment request body with reviews/comment API contract"
```

---

### Task 4: C1 — useChat stale closure 修正

**Files:**
- Modify: `web-demo/src/hooks/useChat.ts`

- [ ] **Step 1: Fix stale closure by using a ref for messages**

Replace the relevant section of `web-demo/src/hooks/useChat.ts`. The fix uses a `messagesRef` to always read the latest value:

Add after line 15 (`const abortRef = ...`):
```typescript
  const messagesRef = useRef(messages)
  messagesRef.current = messages
```

Then replace line 23 (`const nextMessages = [...messages, userMessage]`):
```typescript
    const nextMessages = [...messagesRef.current, userMessage]
```

And update the dependency array on line 87 to remove `messages`:
```typescript
  }, [memberName, memberContext])
```

- [ ] **Step 2: Verify build succeeds**

Run:
```bash
cd web-demo && rm -rf .next && npm run build 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add web-demo/src/hooks/useChat.ts
git commit -m "fix(C1): use messagesRef to prevent stale closure in useChat sendMessage"
```

---

### Task 5: C2 — refinementMessages のrole検証

**Files:**
- Modify: `web-demo/src/app/api/members/[name]/goals/generate/route.ts:38-42`

- [ ] **Step 1: Add role validation**

Replace lines 38-42 in `web-demo/src/app/api/members/[name]/goals/generate/route.ts`:

```typescript
    if (body.refinementMessages && body.refinementMessages.length > 0) {
      for (const msg of body.refinementMessages) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: String(msg.content) })
        }
      }
    }
```

- [ ] **Step 2: Commit**

```bash
git add web-demo/src/app/api/members/\[name\]/goals/generate/route.ts
git commit -m "fix(C2): validate refinementMessages role to prevent system prompt injection"
```

---

### Task 6: C3 + C6 — reviews/draft のタイムアウト対策 + 正規表現修正

**Files:**
- Modify: `web-demo/src/app/api/members/[name]/reviews/draft/route.ts`

- [ ] **Step 1: Add maxDuration and fix extractJson regex**

In `web-demo/src/app/api/members/[name]/reviews/draft/route.ts`:

After `export const dynamic = 'force-dynamic'` (line 6), add:
```typescript
export const maxDuration = 120
```

Replace lines 8-13 (`extractJson` function):
```typescript
function extractJson(text: string): unknown | null {
  try { return JSON.parse(text) } catch {}
  // Match the last complete JSON object (most likely the intended output)
  const matches = [...text.matchAll(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g)]
  if (matches.length > 0) {
    for (let i = matches.length - 1; i >= 0; i--) {
      try { return JSON.parse(matches[i][0]) } catch {}
    }
  }
  return null
}
```

- [ ] **Step 2: Commit**

```bash
git add web-demo/src/app/api/members/\[name\]/reviews/draft/route.ts
git commit -m "fix(C3,C6): add maxDuration=120 and fix greedy JSON extraction regex"
```

---

### Task 7: C4 — Step7Refinement の保存エラーフィードバック追加

**Files:**
- Modify: `web-demo/src/components/goals/steps/Step7Refinement.tsx:100-117`

- [ ] **Step 1: Add error state and user feedback**

First, find the existing state declarations (around line 14-17) and add:
```typescript
  const [saveError, setSaveError] = useState('')
```

Replace lines 100-117 (`handleConfirm`):
```typescript
  const handleConfirm = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch(`/api/members/${encodeURIComponent(context.memberName)}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: currentGoals, period: context.targetPeriod }),
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
```

Then add error display in the JSX. Find the area just before the `{saved ? (` block (around line 136) and add before it:
```typescript
      {saveError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {saveError}
        </div>
      )}
```

- [ ] **Step 2: Commit**

```bash
git add web-demo/src/components/goals/steps/Step7Refinement.tsx
git commit -m "fix(C4): show error message when goal save fails in Step7Refinement"
```

---

### Task 8: C5 + C7 — chat/route.ts に force-dynamic 追加 + orgPolicy をプロンプトに含める

**Files:**
- Modify: `web-demo/src/app/api/chat/route.ts`
- Modify: `web-demo/src/app/api/members/[name]/one-on-one/summary/route.ts`
- Modify: `web-demo/src/app/api/members/[name]/reviews/comment/route.ts`

- [ ] **Step 1: Fix chat/route.ts — add force-dynamic and orgPolicy**

In `web-demo/src/app/api/chat/route.ts`:

After line 4 (`import type { ChatRequest } ...`), add:
```typescript

export const dynamic = 'force-dynamic'
```

Replace line 21 (the `shared.guidelines` line in the systemPrompt array):
```typescript
      shared.orgPolicy ? `\n## 組織方針\n${shared.orgPolicy.slice(0, 2000)}` : '',
      shared.guidelines ? `\n## 運用ガイドライン（必ず遵守）\n${shared.guidelines}` : '',
```

- [ ] **Step 2: Fix one-on-one/summary/route.ts — add orgPolicy context**

In `web-demo/src/app/api/members/[name]/one-on-one/summary/route.ts`:

Add import for `loadSharedDocs` after line 2:
```typescript
import { loadSharedDocs } from '@/lib/fs/shared-docs'
```

After `const body = await req.json()` (line 19), add:
```typescript
    const shared = loadSharedDocs()
```

Replace the `buildSummarySystemPrompt()` call on line 20:
```typescript
    const baseSystemPrompt = buildSummarySystemPrompt()
    const systemPrompt = shared.orgPolicy
      ? `${baseSystemPrompt}\n\n## 参考：組織方針（要点のみ参照）\n${shared.orgPolicy.slice(0, 1000)}`
      : baseSystemPrompt
```

- [ ] **Step 3: Fix reviews/comment/route.ts — add orgPolicy context**

In `web-demo/src/app/api/members/[name]/reviews/comment/route.ts`:

Add import for `loadSharedDocs` after line 2:
```typescript
import { loadSharedDocs } from '@/lib/fs/shared-docs'
```

After `const body = await req.json()` (line 19), add:
```typescript
    const shared = loadSharedDocs()
```

Replace the `buildEvaluationCommentSystemPrompt()` call on line 20:
```typescript
    const baseSystemPrompt = buildEvaluationCommentSystemPrompt()
    const systemPrompt = shared.orgPolicy
      ? `${baseSystemPrompt}\n\n## 参考：組織方針\n${shared.orgPolicy.slice(0, 1000)}`
      : baseSystemPrompt
```

- [ ] **Step 4: Verify build succeeds**

Run:
```bash
cd web-demo && rm -rf .next && npm run build 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add web-demo/src/app/api/chat/route.ts \
  web-demo/src/app/api/members/\[name\]/one-on-one/summary/route.ts \
  web-demo/src/app/api/members/\[name\]/reviews/comment/route.ts
git commit -m "fix(C5,C7): add force-dynamic to chat route + include orgPolicy in AI prompts"
```

---

### Task 9: Final verification

- [ ] **Step 1: Clean build (ビルドエラーがないこと)**

```bash
cd web-demo && rm -rf .next && npm run build 2>&1 | tail -30
```

Expected: Build completes with no errors.

- [ ] **Step 2: A1修正確認 — 評価ウィザードStep4のAIコメント生成が正常に動作すること**

dev serverを起動して手動で確認する:
```bash
cd web-demo && npm run dev
```

確認手順:
1. ブラウザで任意のメンバーの評価ウィザードを開く
2. Step1-3を進めてStep4（評価者コメント生成）に到達する
3. AIコメントがストリーミング生成されること（空やエラーではないこと）を確認
4. 生成されたコメントに目標評価の内容（goalEvaluations, overallGrade等）が反映されていることを確認

Expected: コメントが正常に生成され、評価内容を踏まえた具体的なコメントが出力される。

- [ ] **Step 3: B1修正確認 — パストラバーサルガードが400を返すこと**

dev serverが起動した状態で:
```bash
# パストラバーサル攻撃のリクエスト → 400が返ることを確認
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/members/%2F..%2F..%2Fetc%2Fpasswd"
```

Expected: `400`

追加検証:
```bash
# 正常なメンバー名 → 200が返ることを確認（既存動作が壊れていないこと）
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/members/%E5%B1%B1%E7%94%B0(%E5%89%9B)"
```

Expected: `200` (メンバーが存在する場合) or `404` (存在しない場合)

- [ ] **Step 4: Verify git log**

```bash
git log --oneline -10
```

Expected: 8 new commits corresponding to Tasks 1-8.
