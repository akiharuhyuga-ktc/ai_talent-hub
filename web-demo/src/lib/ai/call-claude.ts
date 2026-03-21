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
