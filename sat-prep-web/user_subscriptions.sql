-- ============================================================================
--  PHASE 2 — Bảng user_subscriptions (gói trả phí theo user)
--  Chạy trong: Supabase Dashboard → SQL Editor → Run
-- ============================================================================
--  Nguồn sự thật về GÓI (tier) của user. Trước Phase 2, route AI hardcode
--  tier:'free'. Nay getUserTier() (subscription-store.ts) tra bảng này để quyết
--  quyền lợi (hiện: AI quota — free=5 lượt/ngày, premium/ultimate=không giới hạn).
--
--  🔴 BẢO MẬT — RLS CHỈ CHO ĐỌC (KHÁC user_progress dùng `for all`):
--    Gói = quyền lợi TRẢ PHÍ. Nếu cho authenticated INSERT/UPDATE (dù check
--    auth.uid()=user_id) thì user tự chèn dòng premium cho CHÍNH MÌNH = faucet
--    quyền lợi (giống lỗ hổng ROOT E). Vì vậy policy CHỈ có SELECT dòng của
--    mình. GHI chỉ qua service-role (admin client bypass RLS) — do webhook
--    thanh toán gọi grantSubscription() SAU khi xác nhận giao dịch server-side.
--
--  Nhiều dòng/user cho phép (lịch sử gia hạn); getActiveSubscription lấy dòng
--  expires_at MỚI NHẤT. FAIL-SAFE: bảng chưa có / lỗi đọc → getUserTier trả
--  'free' (KHÔNG vô tình mở khóa quyền lợi) → 0 regression khi chưa chạy SQL.
-- ============================================================================

create table if not exists public.user_subscriptions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  tier       text        not null check (tier in ('premium', 'ultimate')),
  period     text        not null check (period in ('monthly', 'yearly')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Tra gói còn-hạn của user nhanh (getActiveSubscription order by expires_at desc).
create index if not exists user_subscriptions_user_expires_idx
  on public.user_subscriptions (user_id, expires_at desc);

alter table public.user_subscriptions enable row level security;

-- 🔓 CHỈ SELECT: user đọc gói CỦA MÌNH. KHÔNG có policy insert/update/delete →
-- authenticated KHÔNG ghi được (chỉ service-role bypass RLS mới ghi). Đây là
-- chốt chống user tự cấp gói premium cho mình.
create policy "user_subscriptions_select_own" on public.user_subscriptions
  for select to authenticated
  using (auth.uid() = user_id);
