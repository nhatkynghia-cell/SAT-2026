import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser, USER_COOKIE, USER_ID_PATTERN } from '@/lib/auth';

/**
 * Auth session endpoint (implementation_plan.md §9.3, task #1).
 *
 * GET  → trả về user hiện tại { id, isAuthenticated }.
 * POST → đặt cookie user id (bản stub, phục vụ dev/test nhiều hồ sơ).
 * DELETE → xóa cookie (đăng xuất stub).
 *
 * 🔁 SWAP POINT: khi tích hợp Supabase, POST sẽ được thay bằng luồng đăng nhập
 * thật (OAuth/email) và đặt cookie session của Supabase thay vì cookie stub này.
 */

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json(user);
}

export async function POST(req: Request) {
  let userId: string;
  try {
    ({ userId } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Body JSON không hợp lệ' }, { status: 400 });
  }

  if (typeof userId !== 'string' || !USER_ID_PATTERN.test(userId)) {
    return NextResponse.json(
      { error: 'userId không hợp lệ (chỉ chữ-số, _ , - , tối đa 64 ký tự)' },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(USER_COOKIE, userId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 ngày
  });

  return NextResponse.json({ id: userId, isAuthenticated: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(USER_COOKIE);
  return NextResponse.json({ success: true });
}
