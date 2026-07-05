import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { createShareCode, listShareCodes, revokeShareCode } from '@/lib/parent-share-store';
import { isValidCodeFormat } from '@/lib/parent-share';

/**
 * PARENT SHARE — học sinh quản lý mã chia sẻ tiến độ cho phụ huynh.
 *
 * GET                       → list mã của mình (kèm trạng thái revoked/expires).
 * POST {action:'generate'}  → sinh mã mới (rate-limit chống spam mã).
 * POST {action:'revoke', code} → thu hồi 1 mã của mình.
 *
 * Yêu cầu đăng nhập (student). Ghi qua service-role trong store; RLS chỉ cho
 * student đọc/update mã của mình. Không auth → 401 (không tạo mã cho stub user).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: 'Cần đăng nhập' }, { status: 401 });
  }
  const codes = await listShareCodes(user.id);
  return NextResponse.json({ codes });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: 'Cần đăng nhập' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  if (action === 'generate') {
    const rl = rateLimit(`parent-share-gen:${user.id}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Quá nhiều lần tạo mã. Thử lại sau.', retryAfterMs: rl.retryAfterMs }, { status: 429 });
    }
    const code = await createShareCode(user.id);
    if (!code) {
      return NextResponse.json({ error: 'Không thể tạo mã. Vui lòng thử lại.' }, { status: 503 });
    }
    return NextResponse.json({ code });
  }

  if (action === 'revoke') {
    const code = body?.code;
    if (!isValidCodeFormat(code)) {
      return NextResponse.json({ error: 'Mã không hợp lệ' }, { status: 400 });
    }
    const ok = await revokeShareCode(user.id, code);
    if (!ok) {
      return NextResponse.json({ error: 'Không thể thu hồi mã.' }, { status: 503 });
    }
    return NextResponse.json({ revoked: true });
  }

  return NextResponse.json({ error: 'action không hợp lệ' }, { status: 400 });
}
