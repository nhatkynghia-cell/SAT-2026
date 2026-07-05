-- ============================================================================
--  PARENT DASHBOARD — Bảng parent_share_codes (mã chia sẻ tiến độ cho phụ huynh)
--  Chạy trong: Supabase Dashboard → SQL Editor → Run (hoặc direct pg)
-- ============================================================================
--  Học sinh sinh 1 mã → phụ huynh mở /parent?code=XXX xem tiến độ READ-ONLY,
--  KHÔNG cần tài khoản (Hướng A "mã chia sẻ", chốt 2026-07-05). Mã đóng vai trò
--  bearer token nên phải ĐỦ DÀI + rate-limit ở route (chống brute-force).
--
--  🔴 BẢO MẬT — RLS:
--    • Học sinh SELECT + UPDATE dòng CỦA MÌNH (list mã + thu hồi qua cột revoked).
--      KHÔNG cho INSERT/DELETE từ authenticated → mã chỉ sinh qua service-role
--      (route /api/parent-share) để đảm bảo code do server random, không giả.
--    • resolveShareCode (đọc cross-user khi phụ huynh nhập mã) đi qua service-role
--      (admin client bypass RLS) — vì phụ huynh KHÔNG có auth session.
--  FAIL-SAFE: bảng chưa có → store trả [] / null → UI báo "chưa có mã" / 404,
--  KHÔNG vỡ.
-- ============================================================================

create table if not exists public.parent_share_codes (
  code             text        primary key,
  student_user_id  uuid        not null references auth.users(id) on delete cascade,
  revoked          boolean     not null default false,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz
);

-- Tra mã của 1 học sinh nhanh (list + thu hồi).
create index if not exists parent_share_codes_student_idx
  on public.parent_share_codes (student_user_id);

alter table public.parent_share_codes enable row level security;

-- Học sinh đọc mã CỦA MÌNH (để hiển thị + copy link).
create policy "parent_share_select_own" on public.parent_share_codes
  for select to authenticated
  using (auth.uid() = student_user_id);

-- Học sinh cập nhật mã CỦA MÌNH (chỉ để đặt revoked=true). Không INSERT/DELETE →
-- sinh mã chỉ qua service-role (server random code, không để client tự đặt).
create policy "parent_share_update_own" on public.parent_share_codes
  for update to authenticated
  using (auth.uid() = student_user_id)
  with check (auth.uid() = student_user_id);
