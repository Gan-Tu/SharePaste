import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const maxMB = Math.max(1, parseInt(process.env.MAX_UPLOAD_MB || '100', 10) || 100)
  return NextResponse.json({ maxUploadMB: maxMB })
}

