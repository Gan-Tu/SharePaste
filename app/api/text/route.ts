import { NextResponse } from 'next/server'
import { getText, setText, deactivateExpiredSession } from '@/lib/store'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await deactivateExpiredSession()
    const text = getText()
    return NextResponse.json({ text })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'No active session' }, { status: e?.status || 410 })
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const text = String(body?.text ?? '')
    setText(text)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to save' }, { status: e?.status || 400 })
  }
}
