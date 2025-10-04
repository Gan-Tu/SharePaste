import fs from 'node:fs'
import path from 'node:path'
import { deleteFromGCS } from './gcs'

export type FileItem = {
  id: string
  originalName: string
  size: number
  contentType: string
  storage: 'gcs' | 'local'
  gcsBucket?: string
  gcsName?: string
  localPath?: string
  uploadedAt: number
}

export type Session = {
  id: string
  createdAt: number
  expiresAt: number
  active: boolean
  text: string
  files: FileItem[]
}

// Keep session state on the global object to survive hot reloads and
// allow all route handlers in the same process to share one instance.
// This keeps behavior consistent in development and in single-process
// deployments while remaining in-memory (no external DB required).
const g = globalThis as any
if (!g.__sharepaste_state) {
  g.__sharepaste_state = { currentSession: null as Session | null }
}

function getState() {
  return g.__sharepaste_state as { currentSession: Session | null }
}

let currentSession: Session | null = getState().currentSession

function syncFromGlobal() {
  currentSession = getState().currentSession
  return currentSession
}

export function now() {
  return Date.now()
}

export function isActive(session: Session | null) {
  if (!session) return false
  return session.active && now() < session.expiresAt
}

export function getActiveSession(): Session | null {
  syncFromGlobal()
  if (!isActive(currentSession)) return null
  return currentSession
}

export function getOrNullSession(): Session | null {
  return syncFromGlobal()
}

export function createSessionOrThrow(passcode: string): Session {
  const required = process.env.SESSION_CREATION_PASSCODE
  if (!required) {
    throw new Error('SESSION_CREATION_PASSCODE env not set')
  }
  if (passcode !== required) {
    const e: any = new Error('Invalid passcode')
    e.status = 401
    throw e
  }
  const id = crypto.randomUUID()
  const createdAt = now()
  const ttlMinutes = parseInt(process.env.SESSION_TTL_MINUTES || '10', 10)
  currentSession = {
    id,
    createdAt,
    expiresAt: createdAt + ttlMinutes * 60_000,
    active: true,
    text: '',
    files: [],
  }
  // Persist to global state for other route handlers
  getState().currentSession = currentSession
  return currentSession
}

// Create a session without validating a passcode (used for trusted flows
// like a valid remember-me cookie).
export function createSessionTrusted(): Session {
  const id = crypto.randomUUID()
  const createdAt = now()
  const ttlMinutes = parseInt(process.env.SESSION_TTL_MINUTES || '10', 10)
  currentSession = {
    id,
    createdAt,
    expiresAt: createdAt + ttlMinutes * 60_000,
    active: true,
    text: '',
    files: [],
  }
  getState().currentSession = currentSession
  return currentSession
}

export async function deactivateExpiredSession() {
  syncFromGlobal()
  if (currentSession && now() >= currentSession.expiresAt) {
    currentSession.active = false
    getState().currentSession = currentSession
    // Best-effort cleanup of any stored files once session expires
    await clearFilesLocalArtifacts()
  }
}

export function ensureActiveSession() {
  syncFromGlobal()
  deactivateExpiredSession()
  if (!isActive(currentSession)) {
    const e: any = new Error('No active session')
    e.status = 410
    throw e
  }
  return currentSession as Session
}

export function setText(text: string) {
  const s = ensureActiveSession()
  s.text = text
  getState().currentSession = s
}

export function getText() {
  const s = ensureActiveSession()
  return s.text
}

export function listFiles() {
  const s = ensureActiveSession()
  return s.files
}

export function addFile(item: FileItem) {
  const s = ensureActiveSession()
  s.files.unshift(item)
  getState().currentSession = s
}

export function getFileById(id: string) {
  const s = ensureActiveSession()
  return s.files.find((f) => f.id === id) || null
}

export function removeFileById(id: string) {
  const s = ensureActiveSession()
  const idx = s.files.findIndex((f) => f.id === id)
  if (idx >= 0) {
    s.files.splice(idx, 1)
    getState().currentSession = s
    return true
  }
  return false
}

export async function clearFilesLocalArtifacts() {
  // best-effort cleanup of local files when a session expires or is replaced
  if (!currentSession) return
  for (const f of currentSession.files) {
    if (f.storage === 'local' && f.localPath) {
      try {
        if (fs.existsSync(f.localPath)) fs.rmSync(f.localPath)
      } catch {}
    } else if (f.storage === 'gcs' && f.gcsBucket && f.gcsName) {
      try {
        await deleteFromGCS({ bucket: f.gcsBucket, name: f.gcsName })
      } catch {}
    }
  }
}

export function deactivateSessionNow() {
  syncFromGlobal()
  if (currentSession) {
    currentSession.active = false
    getState().currentSession = currentSession
  }
}

export function ensureUploadsDir() {
  const dir = path.join(process.cwd(), 'uploads')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}
