import { NextRequest, NextResponse } from 'next/server'
import { callClaudeStream, hasApiKey } from '@/lib/ai/call-claude'
import { loadSharedDocs } from '@/lib/fs/shared-docs'
import { buildEvaluationDraftSystemPrompt, buildEvaluationDraftUserMessage } from '@/lib/prompts/evaluation-draft'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function extractJson(text: string): unknown | null {
  try { return JSON.parse(text) } catch {}
  const stripped = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
  try { return JSON.parse(stripped) } catch {}
  const match = stripped.match(/\{[\s\S]*\}/)
  if (match) { try { return JSON.parse(match[0]) } catch {} }
  return null
}

export async function POST(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const t0 = Date.now()
    console.log(`[PERF] reviews/draft 開始`)

    if (!hasApiKey()) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 503 })
    }

    const body = await req.json()
    const shared = loadSharedDocs()
    const systemPrompt = buildEvaluationDraftSystemPrompt()
    const userMessage = buildEvaluationDraftUserMessage({
      memberName: decodeURIComponent(params.name),
      memberProfile: body.memberProfile || '',
      evaluationCriteria: shared.criteria,
      goalsRawMarkdown: body.goalsRawMarkdown || '',
      oneOnOneSummaries: body.oneOnOneSummaries || '',
      selfEvaluation: body.selfEvaluation || { score: '', achievementComment: '', reflectionComment: '' },
      managerSupplementary: body.managerSupplementary || { notableEpisodes: '', environmentChanges: '' },
    })
    console.log(`[PERF] reviews/draft プロンプト構築完了: ${Date.now() - t0}ms`)

    const stream = callClaudeStream({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 4096,
      signal: req.signal,
    })

    // ストリーム全文を蓄積し、テキストチャンクはSSEで逐次送信。
    // 完了後にJSONをパースして final イベントで送信する。
    const encoder = new TextEncoder()
    let fullText = ''

    const sseStream = stream.pipeThrough(
      new TransformStream<string, Uint8Array>({
        transform(chunk, controller) {
          fullText += chunk
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
        },
        flush(controller) {
          const parsed = extractJson(fullText)
          if (parsed) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ draft: parsed })}\n\n`))
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          console.log(`[PERF] reviews/draft ストリーミング完了: ${Date.now() - t0}ms`)
        },
      })
    )

    console.log(`[PERF] reviews/draft ストリーミング開始: ${Date.now() - t0}ms`)
    return new Response(sseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Evaluation draft API error:', error)
    return NextResponse.json({ error: 'Failed to generate evaluation draft' }, { status: 500 })
  }
}
