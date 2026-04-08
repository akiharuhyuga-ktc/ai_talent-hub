import type { ChatMessage } from '@/lib/types'

interface CallClaudeParams {
  systemPrompt: string
  messages: ChatMessage[]
  maxTokens?: number
  model?: string
}

export async function callClaude({
  systemPrompt,
  messages,
  maxTokens = 2048,
  model,
}: CallClaudeParams): Promise<{ content: string; mode: 'live' | 'mock' }> {
  const foundryApiKey = process.env.ANTHROPIC_FOUNDRY_API_KEY
  const foundryBaseUrl = process.env.ANTHROPIC_FOUNDRY_BASE_URL
  const deploymentName = process.env.DEPLOYMENT_NAME
  const apiKey = foundryApiKey || process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error('NO_API_KEY')
  }

  const resolvedModel = model || deploymentName || 'claude-sonnet-4-20250514'
  const formattedMessages = messages.map(m => ({ role: m.role, content: m.content }))

  let content = ''

  if (foundryApiKey) {
    const resource = process.env.ANTHROPIC_FOUNDRY_RESOURCE
    const baseUrl = foundryBaseUrl || `https://${resource}.services.ai.azure.com/anthropic/`
    const endpoint = `${baseUrl.replace(/\/$/, '')}/v1/messages`
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': foundryApiKey,
        'x-api-key': foundryApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: resolvedModel,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: formattedMessages,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('Foundry API error:', err)
      throw new Error(`Foundry API error: ${res.status}`)
    }
    const data = await res.json()
    content = data.content?.[0]?.text ?? ''
  } else {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: resolvedModel,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: formattedMessages,
    })
    content = response.content[0].type === 'text' ? response.content[0].text : ''
  }

  return { content, mode: 'live' }
}

export function hasApiKey(): boolean {
  return !!(process.env.ANTHROPIC_FOUNDRY_API_KEY || process.env.ANTHROPIC_API_KEY)
}

// ── ストリーミング対応 ──────────────────────────────────

interface CallClaudeStreamParams {
  systemPrompt: string
  messages: ChatMessage[]
  maxTokens?: number
  model?: string
  signal?: AbortSignal
}

/**
 * Claude APIをストリーミングモードで呼び出し、テキストデルタのReadableStreamを返す。
 * Azure Foundry / Anthropic SDK の両パスに対応。
 */
export function callClaudeStream({
  systemPrompt,
  messages,
  maxTokens = 2048,
  model,
  signal,
}: CallClaudeStreamParams): ReadableStream<string> {
  const foundryApiKey = process.env.ANTHROPIC_FOUNDRY_API_KEY
  const foundryBaseUrl = process.env.ANTHROPIC_FOUNDRY_BASE_URL
  const deploymentName = process.env.DEPLOYMENT_NAME
  const apiKey = foundryApiKey || process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error('NO_API_KEY')
  }

  const resolvedModel = model || deploymentName || 'claude-sonnet-4-20250514'
  const formattedMessages = messages.map(m => ({ role: m.role, content: m.content }))

  return new ReadableStream<string>({
    async start(controller) {
      try {
        if (foundryApiKey) {
          // ── Azure AI Foundry パス ──
          const resource = process.env.ANTHROPIC_FOUNDRY_RESOURCE
          const baseUrl = foundryBaseUrl || `https://${resource}.services.ai.azure.com/anthropic/`
          const endpoint = `${baseUrl.replace(/\/$/, '')}/v1/messages`
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'api-key': foundryApiKey,
              'x-api-key': foundryApiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: resolvedModel,
              max_tokens: maxTokens,
              stream: true,
              system: systemPrompt,
              messages: formattedMessages,
            }),
            signal,
          })

          if (!res.ok) {
            const err = await res.text()
            console.error('Foundry API stream error:', err)
            controller.error(new Error(`Foundry API error: ${res.status}`))
            return
          }

          const reader = res.body!.getReader()
          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            if (signal?.aborted) { reader.cancel(); break }
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
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  controller.enqueue(parsed.delta.text)
                }
              } catch {}
            }
          }
        } else {
          // ── Anthropic SDK パス ──
          const Anthropic = (await import('@anthropic-ai/sdk')).default
          const client = new Anthropic({ apiKey })
          const stream = client.messages.stream({
            model: resolvedModel,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: formattedMessages,
          })

          if (signal) {
            signal.addEventListener('abort', () => stream.abort(), { once: true })
          }

          stream.on('text', (text) => {
            controller.enqueue(text)
          })

          await stream.finalMessage()
        }

        controller.close()
      } catch (err) {
        if (signal?.aborted) {
          controller.close()
        } else {
          controller.error(err)
        }
      }
    },
  })
}

/**
 * ReadableStream<string> をSSE形式のResponseに変換するヘルパー。
 * APIルートの末尾で `return createSSEResponse(stream)` として使う。
 */
export function createSSEResponse(stream: ReadableStream<string>): Response {
  const encoder = new TextEncoder()

  const sseStream = stream.pipeThrough(
    new TransformStream<string, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
      },
      flush(controller) {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      },
    })
  )

  return new Response(sseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
