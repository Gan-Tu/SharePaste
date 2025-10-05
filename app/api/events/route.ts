import { NextResponse } from 'next/server'
import { emitEvent, getEventBus, type ShareEvent } from '@/lib/events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sseEncode(evt: ShareEvent) {
  return `event: ${evt.name}\n` + `data: ${JSON.stringify(evt.data)}\n\n`
}

export async function GET() {
  const encoder = new TextEncoder()
  const bus = getEventBus()
  let keepAliveTimer: NodeJS.Timeout | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const onEvent = (evt: ShareEvent) => {
        try {
          controller.enqueue(encoder.encode(sseEncode(evt)))
        } catch {}
      }
      bus.on('event', onEvent)

      // Initial ping to open the stream on proxies
      controller.enqueue(encoder.encode('event: ping\n' + 'data: {}\n\n'))

      // Periodic heartbeat to keep connections alive on certain hosts
      keepAliveTimer = setInterval(() => {
        try { controller.enqueue(encoder.encode(': keep-alive\n\n')) } catch {}
      }, 20000)

      // When the stream is canceled/closed, clean up
      const cleanup = () => {
        bus.off('event', onEvent)
        if (keepAliveTimer) clearInterval(keepAliveTimer)
      }
      // @ts-ignore - expose for cancel()/error() hooks
      ;(controller as any)._cleanup = cleanup
    },
    cancel() {
      // @ts-ignore
      const cleanup = (this as any)?._cleanup as (() => void) | undefined
      if (cleanup) cleanup()
    },
  })

  const headers = new Headers({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // CORS permissive for simplicity; tighten if needed
    'Access-Control-Allow-Origin': '*',
  })

  return new NextResponse(stream as any, { headers })
}

