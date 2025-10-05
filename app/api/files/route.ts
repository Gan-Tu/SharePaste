import { NextResponse } from 'next/server'
import { addFile, ensureActiveSession, ensureUploadsDir, listFiles } from '@/lib/store'
import { uploadToGCS } from '@/lib/gcs'
import fs from 'node:fs/promises'
import path from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    ensureActiveSession()
    const files = listFiles()
    return NextResponse.json({ files })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'No active session' }, { status: e?.status || 410 })
  }
}

export async function POST(req: Request) {
  try {
    ensureActiveSession()
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })
    const maxMB = Math.max(1, parseInt(process.env.MAX_UPLOAD_MB || '100', 10) || 100)
    const MAX_BYTES = maxMB * 1024 * 1024
    if (typeof file.size === 'number' && file.size > MAX_BYTES) {
      return NextResponse.json({ error: `File too large. Max ${maxMB} MB.` }, { status: 413 })
    }
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const id = crypto.randomUUID()
    const originalName = file.name
    const contentType = file.type || 'application/octet-stream'
    const size = buffer.byteLength

    const preferGcs = process.env.USE_GCS !== 'false' && !!process.env.GCS_BUCKET
    if (preferGcs) {
      try {
        const ref = await uploadToGCS({ buffer, contentType, destName: id, originalName })
        addFile({ id, originalName, size, contentType, storage: 'gcs', gcsBucket: ref.bucket, gcsName: ref.name, uploadedAt: Date.now() })
        return NextResponse.json({ ok: true, id })
      } catch (e) {
        // fallthrough to local
      }
    }

    const dir = ensureUploadsDir()
    const fullPath = path.join(dir, id)
    await fs.writeFile(fullPath, buffer)
    addFile({ id, originalName, size, contentType, storage: 'local', localPath: fullPath, uploadedAt: Date.now() })
    return NextResponse.json({ ok: true, id })
  } catch (e: any) {
    const status = e?.status || 400
    return NextResponse.json({ error: e?.message || 'Failed to upload' }, { status })
  }
}

export const maxDuration = 30
