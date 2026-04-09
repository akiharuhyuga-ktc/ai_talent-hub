import { NextRequest, NextResponse } from 'next/server'
import { callClaudeStream, createSSEResponse, hasApiKey } from '@/lib/ai/call-claude'
import { buildPolicyRefineSystemPrompt } from '@/lib/prompts/policy-refine'
import type { ChatMessage } from '@/lib/types'

export const dynamic = 'force-dynamic'

function extractMarkdownBlock(text: string): string | null {
  const match = text.match(/```markdown\n([\s\S]*?)```/)
  return match ? match[1].trim() : null
}

export async function POST(req: NextRequest) {
  try {
    const t0 = Date.now()
    console.log(`[PERF] docs/policy/refine 開始`)

    if (!hasApiKey()) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 503 })
    }

    const { currentContent, messages } = await req.json()
    if (!currentContent || !messages) {
      return NextResponse.json({ error: 'currentContent and messages are required' }, { status: 400 })
    }

    const systemPrompt = buildPolicyRefineSystemPrompt(currentContent)
    console.log(`[PERF] docs/policy/refine プロンプト構築完了: ${Date.now() - t0}ms`)

    const stream = callClaudeStream({
      systemPrompt,
      messages: messages as ChatMessage[],
      maxTokens: 8192,
      signal: req.signal,
    })

    // refineはreply + updatedPolicyの二重出力。
    // ストリーム全文を蓄積し、完了後にupdatedPolicyを抽出して最終イベントで送信する。
    const encoder = new TextEncoder()
    let fullText = ''

    const sseStream = stream.pipeThrough(
      new TransformStream<string, Uint8Array>({
        transform(chunk, controller) {
          fullText += chunk
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
        },
        flush(controller) {
          const updatedPolicy = extractMarkdownBlock(fullText)
          if (updatedPolicy) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ updatedPolicy })}\n\n`))
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          console.log(`[PERF] docs/policy/refine ストリーミング完了: ${Date.now() - t0}ms`)
        },
      })
    )

    console.log(`[PERF] docs/policy/refine ストリーミング開始: ${Date.now() - t0}ms`)
    return new Response(sseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Policy refine API error:', error)
    return NextResponse.json({ error: 'Failed to refine policy' }, { status: 500 })
  }
}
