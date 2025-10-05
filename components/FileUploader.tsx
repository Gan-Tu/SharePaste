"use client"
import { useEffect, useRef, useState } from 'react'

type FileItem = {
  id: string
  originalName: string
  size: number
  contentType: string
  storage: 'gcs' | 'local'
  uploadedAt: number
}

function formatBytes(bytes: number) {
  const sizes = ['B','KB','MB','GB']
  if (bytes === 0) return '0 B'
  const i = Math.floor(Math.log(bytes)/Math.log(1024))
  const value = bytes / Math.pow(1024,i)
  return `${value.toFixed(value > 9 ? 0 : 1)} ${sizes[i]}`
}

export default function FileUploader() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [busy, setBusy] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [maxUploadMB, setMaxUploadMB] = useState<number>(100)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const refresh = async () => {
    try {
      const res = await fetch('/api/files', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setFiles(data.files || [])
    } catch {}
  }

  useEffect(() => { refresh() }, [])
  useEffect(() => {
    // Load config (max upload size)
    const load = async () => {
      try {
        const res = await fetch('/api/config', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (typeof data?.maxUploadMB === 'number') setMaxUploadMB(Math.max(1, data.maxUploadMB))
      } catch {}
    }
    load()
  }, [])
  useEffect(() => {
    // Subscribe to server-sent events for live file list updates
    const es = new EventSource('/api/events')
    const onFiles = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data)
        if (Array.isArray(data?.files)) {
          setFiles(data.files)
        }
      } catch {}
    }
    const onExpired = (_e: MessageEvent) => {
      setExpired(true)
    }
    es.addEventListener('files', onFiles as any)
    es.addEventListener('session', onExpired as any)
    return () => {
      es.close()
    }
  }, [])

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    if (!selected.length) return
    const MAX_BYTES = maxUploadMB * 1024 * 1024
    const tooLarge = selected.filter(f => f.size > MAX_BYTES)
    const toUpload = selected.filter(f => f.size <= MAX_BYTES)
    if (tooLarge.length) {
      setError(`These files exceed ${maxUploadMB} MB and were skipped: ${tooLarge.map(f => '“' + f.name + '”').join(', ')}`)
    } else {
      setError(null)
    }
    if (!toUpload.length) {
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    setBusy(true)
    try {
      for (const file of toUpload) {
        const fd = new FormData()
        fd.set('file', file)
        const res = await fetch('/api/files', { method: 'POST', body: fd })
        if (!res.ok) {
          const msg = await res.json().catch(() => ({}))
          throw new Error(msg?.error || 'upload failed')
        }
      }
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Failed to upload')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const onDelete = async (id: string, name: string) => {
    if (deletingId) return
    const ok = typeof window !== 'undefined' ? window.confirm(`Delete “${name}”?`) : true
    if (!ok) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/files/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      await refresh()
    } catch {}
    finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="card p-4">
      <div className="mb-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-800 truncate">Shared Files</h2>
          <div className="md:mt-1">
            <label className={`btn-success cursor-pointer ${busy || expired ? 'opacity-60 pointer-events-none' : ''}`}>
              {busy ? 'Uploading…' : 'Upload'}
              <input ref={inputRef} type="file" multiple className="hidden" onChange={onPick} disabled={expired} />
            </label>
          </div>
        </div>
      </div>
      {error && (
        <div className="mb-2 text-xs text-red-600">{error}</div>
      )}
      {files.length === 0 ? (
        <div className="text-sm text-slate-500">No files uploaded yet.</div>
      ) : (
        <ul className="divide-y divide-slate-200/70">
          {files.map(f => (
            <li key={f.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-normal text-slate-700">{f.originalName}</div>
                <div className="text-xs text-slate-500">{formatBytes(f.size)} • {f.storage === 'gcs' ? 'Cloud' : 'Local'}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  className="icon-btn-secondary"
                  href={`/api/files/${f.id}`}
                  title="Download"
                  aria-label={`Download ${f.originalName}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                    <path d="M12 16a1 1 0 0 1-.7-.29l-4-4a1 1 0 1 1 1.4-1.42L11 12.59V4a1 1 0 1 1 2 0v8.59l2.3-2.3a1 1 0 0 1 1.4 1.42l-4 4c-.18.19-.43.29-.7.29Z"/>
                    <path d="M5 20a1 1 0 1 1 0-2h14a1 1 0 1 1 0 2H5Z"/>
                  </svg>
                </a>
                <button
                  className={`icon-btn-danger ${deletingId === f.id || expired ? 'opacity-70' : ''}`}
                  onClick={() => onDelete(f.id, f.originalName)}
                  disabled={deletingId === f.id || expired}
                  title="Delete"
                  aria-label={`Delete ${f.originalName}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {expired && <div className="mt-2 text-xs text-slate-500">Session expired. Upload and delete disabled.</div>}
    </div>
  )
}
