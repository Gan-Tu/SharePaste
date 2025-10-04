import { NextResponse } from 'next/server'
import { getFileById, ensureActiveSession, removeFileById } from '@/lib/store'
import { getGCSPublicUrl, deleteFromGCS } from '@/lib/gcs'
import fs from 'node:fs/promises'

export const runtime = 'nodejs'

export async function GET(_: Request, ctx: { params: { id: string } }) {
  try {
    const file = getFileById(ctx.params.id)
    if (!file) return NextResponse.json({ error: 'Not found or expired' }, { status: 404 })
    const disposition = `attachment; filename="${file.originalName.replaceAll('"', '')}"`
    if (file.storage === 'gcs') {
      const url = getGCSPublicUrl({ bucket: file.gcsBucket!, name: file.gcsName! })
      return NextResponse.redirect(url)
    }
    if (file.storage === 'local' && file.localPath) {
      const data = await fs.readFile(file.localPath)
      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': file.contentType,
          'Content-Length': String(file.size),
          'Content-Disposition': disposition,
        },
      })
    }
    return NextResponse.json({ error: 'Unavailable' }, { status: 500 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

export async function DELETE(_: Request, ctx: { params: { id: string } }) {
  try {
    ensureActiveSession()
    const file = getFileById(ctx.params.id)
    if (!file) return NextResponse.json({ error: 'Not found or expired' }, { status: 404 })
    if (file.storage === 'local' && file.localPath) {
      try { await fs.unlink(file.localPath) } catch {}
    } else if (file.storage === 'gcs' && file.gcsBucket && file.gcsName) {
      await deleteFromGCS({ bucket: file.gcsBucket, name: file.gcsName })
    }
    removeFileById(file.id)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete' }, { status: e?.status || 400 })
  }
}
