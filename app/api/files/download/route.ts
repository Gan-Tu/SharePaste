import { NextResponse } from 'next/server'
import archiver from 'archiver'
import fs from 'node:fs'
import path from 'node:path'
import { PassThrough, Readable } from 'node:stream'
import { createGCSReadStream } from '@/lib/gcs'
import { ensureActiveSession, listFiles, type FileItem } from '@/lib/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sanitizeArchiveName(name: string) {
  const base = path.basename(name).replaceAll('\\', '/').split('/').pop() || 'attachment'
  const cleaned = base.replace(/[\x00-\x1f\x7f]/g, '').trim()
  return cleaned || 'attachment'
}

function uniqueArchiveName(name: string, seen: Map<string, number>) {
  const safeName = sanitizeArchiveName(name)
  const count = seen.get(safeName) || 0
  seen.set(safeName, count + 1)
  if (count === 0) return safeName

  const ext = path.extname(safeName)
  const stem = ext ? safeName.slice(0, -ext.length) : safeName
  return `${stem} (${count + 1})${ext}`
}

function formatArchiveFilename(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '00'
  const year = get('year')
  const month = get('month')
  const day = get('day')
  const hour = get('hour')
  const minute = get('minute')
  return `${year}-${month}-${day}-${hour}-${minute}.zip`
}

async function appendFile(archive: archiver.Archiver, file: FileItem, name: string) {
  if (file.storage === 'local' && file.localPath) {
    archive.append(fs.createReadStream(file.localPath), { name })
    return
  }

  if (file.storage === 'gcs' && file.gcsBucket && file.gcsName) {
    archive.append(await createGCSReadStream({ bucket: file.gcsBucket, name: file.gcsName }), { name })
    return
  }

  throw new Error(`File is unavailable: ${file.originalName}`)
}

export async function GET() {
  try {
    ensureActiveSession()
    const files = [...listFiles()]
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files to download' }, { status: 404 })
    }

    const output = new PassThrough()
    const archive = archiver('zip', { zlib: { level: 9 } })

    archive.on('error', (error) => {
      output.destroy(error)
    })
    archive.pipe(output)

    const seen = new Map<string, number>()
    void (async () => {
      try {
        for (const file of files) {
          await appendFile(archive, file, uniqueArchiveName(file.originalName, seen))
        }
        await archive.finalize()
      } catch (error) {
        archive.destroy(error as Error)
        output.destroy(error as Error)
      }
    })()

    return new Response(Readable.toWeb(output) as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${formatArchiveFilename()}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create archive' }, { status: e?.status || 500 })
  }
}
