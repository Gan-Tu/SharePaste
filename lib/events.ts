import { EventEmitter } from 'node:events'

// Global singleton EventEmitter so all route handlers share the same bus
const g = globalThis as any
if (!g.__sharepaste_events) {
  g.__sharepaste_events = new EventEmitter()
  // Increase listener limit to avoid warnings with many clients
  g.__sharepaste_events.setMaxListeners(1000)
}

export type ShareEvent =
  | { name: 'text'; data: { text: string } }
  | { name: 'files'; data: { files: any[] } }
  | { name: 'session'; data: { action: 'expired' } }

export function getEventBus(): EventEmitter {
  return g.__sharepaste_events as EventEmitter
}

export function emitEvent(evt: ShareEvent) {
  getEventBus().emit('event', evt)
}
