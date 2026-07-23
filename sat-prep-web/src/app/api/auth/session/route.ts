import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isE2E } from '@/lib/e2e';

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

export async function POST() {
  if (!isE2E()) {
    return NextResponse.json(
      { error: 'Dev stub session endpoint is disabled outside E2E test mode.' },
      { status: 404 }
    );
  }
  return NextResponse.json({ error: 'Use the E2E auth helper cookie instead of arbitrary userId sessions.' }, { status: 410 });
}

export async function DELETE() {
  if (!isE2E()) {
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ success: true });
}
