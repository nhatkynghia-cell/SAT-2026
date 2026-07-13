import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** Chỉ nhận path nội bộ (bắt đầu '/' nhưng không '//') — chống open-redirect. */
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw
  return '/'
}

/**
 * OAuth / email-confirm callback: Supabase redirect về đây kèm `?code=...`.
 * Đổi code lấy session (ghi cookie qua server client), rồi redirect tới `next`.
 * Public route (khai báo ở middleware PUBLIC_PREFIXES '/auth').
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Sau proxy/load-balancer (Vercel) origin có thể sai → ưu tiên x-forwarded-host.
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Thiếu code hoặc đổi thất bại → về login báo lỗi.
  return NextResponse.redirect(`${origin}/login?error=auth_callback`)
}
