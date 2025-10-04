"use client"
import { useCallback, useEffect, useRef, useState } from 'react'

export default function Editor() {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimer = useRef<NodeJS.Timeout | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/text', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setValue(data.text || '')
    } catch {}
  }, [])

  useEffect(() => { load() }, [load])

  const scheduleSave = (next: string) => {
    setValue(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving('saving')
      try {
        const res = await fetch('/api/text', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: next }) })
        if (!res.ok) throw new Error('failed')
        setSaving('saved')
        setTimeout(() => setSaving('idle'), 1200)
      } catch {
        setSaving('error')
      }
    }, 500)
  }

  return (
    <div className="card p-4 flex flex-col min-h-[50vh] md:min-h-[70vh]">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-slate-800">Shared Notes</h2>
        <div className="text-xs text-slate-500">
          {saving === 'saving' && 'Saving…'}
          {saving === 'saved' && 'Saved'}
          {saving === 'error' && 'Error saving'}
          {saving === 'idle' && ''}
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => scheduleSave(e.target.value)}
        placeholder="Paste or type here…"
        className="input flex-1 min-h-[40vh] md:min-h-[60vh] resize-y font-mono"
      />
      <div className="mt-2 text-xs text-slate-500">Changes are auto-saved and visible to anyone with the page open.</div>
    </div>
  )
}
