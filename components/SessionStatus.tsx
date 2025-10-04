"use client"
import { useEffect, useState } from 'react'

export function SessionStatus(props: { onRequireCreate: () => void }) {
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/session', { cache: 'no-store' })
        const data = await res.json()
        if (!mounted) return
        setActive(Boolean(data.active))
        setRemaining(data.remainingSeconds ?? null)
      } catch {
        setActive(false)
      } finally {
        setLoading(false)
      }
    }
    load()
    const t = setInterval(load, 10_000)
    return () => {
      mounted = false
      clearInterval(t)
    }
  }, [])

  // Client-side countdown timer updates remaining every second
  useEffect(() => {
    if (!active) return
    const tick = setInterval(() => {
      setRemaining((r) => (typeof r === 'number' && r > 0 ? r - 1 : r))
    }, 1000)
    return () => clearInterval(tick)
  }, [active])

  // When remaining reaches 0, reflect inactive state until next poll
  useEffect(() => {
    if (typeof remaining === 'number' && remaining <= 0) {
      setActive(false)
    }
  }, [remaining])

  if (loading) return (
    <div className="text-xs text-slate-500">Checking session…</div>
  )

  if (!active) return (
    <div className="flex items-center gap-2 sm:gap-3 text-slate-600">
      <div>No active session</div>
    </div>
  )

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm">
      <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500"/>
      <span className="text-slate-700">Active session</span>
      {remaining !== null && <span className="text-slate-500 whitespace-nowrap">• Expires in {remaining}s</span>}
      <button
        className={`btn-danger ${deactivating ? 'opacity-60 pointer-events-none' : ''} shrink-0`}
        onClick={async () => {
          if (deactivating) return
          const ok = window.confirm('Deactivate this session now? All shared files and text will be cleared.')
          if (!ok) return
          setDeactivating(true)
          try {
            const res = await fetch('/api/session', { method: 'DELETE' })
            if (!res.ok) throw new Error('failed')
            // Reload to ensure all client components reflect the new state
            window.location.reload()
          } catch {
            setDeactivating(false)
          }
        }}
      >{deactivating ? 'Deactivating…' : 'Deactivate'}</button>
    </div>
  )
}
