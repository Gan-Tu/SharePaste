"use client"
import { useEffect, useState } from 'react'
import Editor from '@/components/Editor'
import FileUploader from '@/components/FileUploader'
import { SessionStatus } from '@/components/SessionStatus'

export default function Page() {
  const [showCreate, setShowCreate] = useState(false)
  const [active, setActive] = useState(false)
  const [passcode, setPasscode] = useState('')
  const [remember, setRemember] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const check = async () => {
    const res = await fetch('/api/session', { cache: 'no-store' })
    const data = await res.json()
    setActive(Boolean(data.active))
  }

  useEffect(() => { check() }, [])

  const createSession = async () => {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passcode, remember }) })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.error || 'Failed to create session')
      }
      setShowCreate(false)
      setPasscode('')
      setRemember(true)
      await check()
    } catch (e: any) {
      setError(e?.message || 'Failed to create session')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto w-[90vw] sm:w-[85vw] lg:w-[75vw] py-10">
      <div className="mb-6 px-4 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 lg:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">Share instantly across devices</h1>
          <p className="text-slate-600 mt-1">One active session at a time. Expires after 10 minutes.</p>
        </div>
        <div className="mt-2 lg:mt-0 w-full lg:w-auto">
          <SessionStatus onRequireCreate={() => setShowCreate(true)} />
        </div>
      </div>

      {!active ? (
        <div className="card p-6">
          <button className="btn-primary" onClick={() => setShowCreate(true)}>Create Session</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="order-2 lg:order-none lg:col-span-3"><Editor /></div>
          <div className="order-1 lg:order-none lg:col-span-2"><FileUploader /></div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => !creating && setShowCreate(false)}>
          <div className="card max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">Create New Session</h3>
            <p className="text-sm text-slate-600 mb-4">Enter the passcode to create a new session.</p>
            <input
              type="password"
              className="input mb-3"
              placeholder="Passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-slate-700 mb-4">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Remember me on this device (stores a cookie)</span>
            </label>
            {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
            <div className="flex items-center justify-end gap-2">
              <button className="btn-secondary" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</button>
              <button className="btn-primary" onClick={createSession} disabled={creating}>{creating ? 'Creating…' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
