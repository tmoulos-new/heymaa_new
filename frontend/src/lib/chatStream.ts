/** SSE client for POST /chat/stream */

export type ChatStreamDone = {
  reply: string
  provider?: string
  promo?: unknown
  memory_suggestion?: unknown
  message_id?: string
  sources?: unknown
  places?: unknown
  [key: string]: unknown
}

export type ChatStreamHandlers = {
  onStatus?: (phase: string) => void
  onDelta?: (text: string) => void
  onDone?: (payload: ChatStreamDone) => void
  onError?: (err: { status?: number; detail: string }) => void
}

function parseSseChunk(buffer: string): { events: string[]; rest: string } {
  const parts = buffer.split('\n\n')
  const rest = parts.pop() ?? ''
  const events: string[] = []
  for (const block of parts) {
    const lines = block.split('\n')
    const dataLines: string[] = []
    for (const line of lines) {
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
    }
    if (dataLines.length) events.push(dataLines.join('\n'))
  }
  return { events, rest }
}

export async function streamChat(
  apiBase: string,
  token: string,
  payload: unknown,
  handlers: ChatStreamHandlers,
  opts?: { signal?: AbortSignal },
): Promise<ChatStreamDone> {
  const url = `${apiBase.replace(/\/$/, '')}/chat/stream`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'x-token': token,
    },
    body: JSON.stringify(payload),
    signal: opts?.signal,
  })

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const j = await res.json()
      if (typeof j?.detail === 'string') detail = j.detail
      else if (typeof j?.friendly_message === 'string') detail = j.friendly_message
    } catch {
      /* ignore */
    }
    const err = { status: res.status, detail }
    handlers.onError?.(err)
    throw Object.assign(new Error(detail), { response: { status: res.status, data: { detail } } })
  }

  if (!res.body) {
    const err = { status: 500, detail: 'Empty stream body' }
    handlers.onError?.(err)
    throw new Error(err.detail)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let donePayload: ChatStreamDone | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parsed = parseSseChunk(buffer)
    buffer = parsed.rest
    for (const raw of parsed.events) {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(raw) as Record<string, unknown>
      } catch {
        continue
      }
      const type = String(msg.type || '')
      if (type === 'status' && typeof msg.phase === 'string') {
        handlers.onStatus?.(msg.phase)
      } else if (type === 'delta' && typeof msg.text === 'string' && msg.text) {
        handlers.onDelta?.(msg.text)
      } else if (type === 'done') {
        const { type: _t, ...rest } = msg
        donePayload = rest as ChatStreamDone
        if (typeof donePayload.reply !== 'string') {
          donePayload.reply = String(donePayload.reply || '')
        }
        handlers.onDone?.(donePayload)
      } else if (type === 'error') {
        const err = {
          status: typeof msg.status === 'number' ? msg.status : 503,
          detail: typeof msg.detail === 'string' ? msg.detail : 'Chat stream failed',
        }
        handlers.onError?.(err)
        throw Object.assign(new Error(err.detail), {
          response: { status: err.status, data: { detail: err.detail } },
        })
      }
    }
  }

  if (!donePayload) {
    const err = { status: 502, detail: 'Stream ended without a reply' }
    handlers.onError?.(err)
    throw new Error(err.detail)
  }
  return donePayload
}
