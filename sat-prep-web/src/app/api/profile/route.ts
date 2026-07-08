import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { loadMyProfile, saveMyProfile } from '@/lib/leaderboard-store';
import { validateNickname, nicknameReasonMessage } from '@/lib/nickname';

/**
 * PROFILE API — BÍ DANH + opt-in leaderboard của user hiện tại.
 *
 * GET  → { nickname, optIn, canChangeNickname, available }.
 * POST → đặt/đổi nickname và/hoặc bật-tắt opt-in.
 *   • Validate nickname (400 nếu bậy/sai định dạng).
 *   • Cooldown 24h giữa 2 lần ĐỔI nickname (chống spam đổi tên mạo danh).
 *   • CHẶN bật opt-in khi chưa có nickname (không lên bảng với tên rỗng).
 *   • available:false (not_ready) = bảng chưa migrate → UI ẩn tính năng, KHÔNG crash.
 *
 * Yêu cầu ĐÃ ĐĂNG NHẬP (không cho guest stub đặt profile).
 */

const NICKNAME_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h

export async function GET() {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: 'Cần đăng nhập' }, { status: 401 });
  }

  const profile = await loadMyProfile(user.id);
  if (profile === null) {
    // Bảng chưa migrate.
    return NextResponse.json({ available: false, nickname: null, optIn: false, canChangeNickname: true });
  }

  const canChangeNickname =
    !profile.nicknameUpdatedAt ||
    Date.now() - new Date(profile.nicknameUpdatedAt).getTime() >= NICKNAME_COOLDOWN_MS;

  return NextResponse.json({
    available: true,
    nickname: profile.nickname,
    optIn: profile.optIn,
    canChangeNickname,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user.isAuthenticated) {
    return NextResponse.json({ error: 'Cần đăng nhập' }, { status: 401 });
  }

  const rl = rateLimit(`profile:${user.id}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Quá nhiều thay đổi. Thử lại sau.', retryAfterMs: rl.retryAfterMs },
      { status: 429 }
    );
  }

  let body: { nickname?: unknown; optIn?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 });
  }

  const current = await loadMyProfile(user.id);
  if (current === null) {
    // Bảng chưa migrate → không thể lưu.
    return NextResponse.json({ error: 'Tính năng sắp ra mắt.', code: 'not_ready' }, { status: 503 });
  }

  const save: { nickname?: string; optIn?: boolean } = {};

  // 1) Đổi nickname (nếu gửi).
  if (typeof body.nickname === 'string') {
    const check = validateNickname(body.nickname);
    if (!check.ok) {
      return NextResponse.json(
        { error: nicknameReasonMessage(check.reason), code: check.reason },
        { status: 400 }
      );
    }
    // Cooldown chỉ áp khi THỰC SỰ đổi sang tên khác (đặt lại y hệt không tính).
    const isChanging = check.normalized !== current.nickname;
    if (isChanging && current.nicknameUpdatedAt) {
      const elapsed = Date.now() - new Date(current.nicknameUpdatedAt).getTime();
      if (elapsed < NICKNAME_COOLDOWN_MS) {
        const hoursLeft = Math.ceil((NICKNAME_COOLDOWN_MS - elapsed) / (60 * 60 * 1000));
        return NextResponse.json(
          { error: `Chỉ đổi bí danh mỗi 24 giờ. Thử lại sau ~${hoursLeft} giờ.`, code: 'cooldown' },
          { status: 429 }
        );
      }
    }
    if (isChanging) save.nickname = check.normalized;
  }

  // 2) Toggle opt-in (nếu gửi). CHẶN bật khi chưa có nickname (kể cả vừa gửi).
  if (typeof body.optIn === 'boolean') {
    const willHaveNickname = save.nickname ?? current.nickname;
    if (body.optIn && !willHaveNickname) {
      return NextResponse.json(
        { error: 'Hãy đặt bí danh trước khi hiển thị trên bảng xếp hạng.', code: 'need_nickname' },
        { status: 400 }
      );
    }
    save.optIn = body.optIn;
  }

  if (save.nickname === undefined && save.optIn === undefined) {
    // Không có gì để đổi (vd gửi lại tên cũ) — trả trạng thái hiện tại, không lỗi.
    return NextResponse.json({ success: true, nickname: current.nickname, optIn: current.optIn });
  }

  const ok = await saveMyProfile(user.id, save);
  if (!ok) {
    return NextResponse.json({ error: 'Không thể lưu lúc này.', code: 'save_failed' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    nickname: save.nickname ?? current.nickname,
    optIn: save.optIn ?? current.optIn,
  });
}
