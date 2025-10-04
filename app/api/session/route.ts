import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSessionOrThrow, createSessionTrusted, deactivateExpiredSession, getActiveSession, getOrNullSession, clearFilesLocalArtifacts, deactivateSessionNow } from '@/lib/store'
import crypto from 'node:crypto'

export const runtime = 'nodejs'

function computeRememberToken() {
  const pass = process.env.SESSION_CREATION_PASSCODE || ''
  return crypto.createHash('sha256').update(`sharepaste:v1:${pass}`).digest('hex')
}

function isRememberCookieValid(): boolean {
  try {
    const c = cookies()
    const token = c.get('sp_remember')?.value || ''
    return token.length > 0 && token === computeRememberToken()
  } catch {
    return false
  }
}

export async function GET() {
  await deactivateExpiredSession()
  let active = getActiveSession()
  if (active) {
    const remaining = Math.max(0, Math.floor((active.expiresAt - Date.now()) / 1000))
    return NextResponse.json({
      active: true,
      sessionId: active.id,
      createdAt: active.createdAt,
      expiresAt: active.expiresAt,
      remainingSeconds: remaining,
    })
  }
  // If no active session but a valid remember cookie exists, create a new trusted session automatically
  if (isRememberCookieValid()) {
    await clearFilesLocalArtifacts()
    const s = createSessionTrusted()
    const remaining = Math.max(0, Math.floor((s.expiresAt - Date.now()) / 1000))
    return NextResponse.json({
      active: true,
      sessionId: s.id,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      remainingSeconds: remaining,
    })
  }
  const last = getOrNullSession()
  return NextResponse.json({ active: false, lastExpiredAt: last?.expiresAt ?? null })
}

export async function POST(req: Request) {
  try {
    // If an active session exists, reuse it without passcode
    await deactivateExpiredSession()
    const active = getActiveSession()
    if (active) {
      const remaining = Math.max(0, Math.floor((active.expiresAt - Date.now()) / 1000))
      return NextResponse.json({
        active: true,
        sessionId: active.id,
        createdAt: active.createdAt,
        expiresAt: active.expiresAt,
        remainingSeconds: remaining,
      })
    }

    const body = await req.json().catch(() => ({}))
    const passcode = String((body as any)?.passcode || '')
    const remember = (body as any)?.remember !== false // default true
    // cleanup any prior files before rotating session
    await clearFilesLocalArtifacts()
    let s = null as any
    if (passcode) {
      s = createSessionOrThrow(passcode)
    } else if (isRememberCookieValid()) {
      s = createSessionTrusted()
    } else {
      const e: any = new Error('Invalid passcode')
      e.status = 401
      throw e
    }
    const remaining = Math.max(0, Math.floor((s.expiresAt - Date.now()) / 1000))
    const res = NextResponse.json({
      active: true,
      sessionId: s.id,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      remainingSeconds: remaining,
    })
    if (remember) {
      const rememberDays = parseInt(process.env.REMEMBER_DAYS || '30', 10)
      res.cookies.set('sp_remember', computeRememberToken(), {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * Math.max(1, rememberDays),
      })
    }
    return res
  } catch (e: any) {
    const status = e?.status || 400
    return NextResponse.json({ error: e?.message || 'Failed to create session' }, { status })
  }
}

export async function DELETE() {
  try {
    await deactivateExpiredSession()
    const active = getActiveSession()
    if (!active) {
      // idempotent: treat as success if nothing to deactivate
      const res = NextResponse.json({ ok: true })
      // also ensure cookie is cleared
      res.cookies.set('sp_remember', '', { path: '/', maxAge: 0 })
      return res
    }
    await clearFilesLocalArtifacts()
    deactivateSessionNow()
    const res = NextResponse.json({ ok: true })
    res.cookies.set('sp_remember', '', { path: '/', maxAge: 0 })
    return res
  } catch (e: any) {
    const status = e?.status || 400
    return NextResponse.json({ error: e?.message || 'Failed to deactivate session' }, { status })
  }
}
