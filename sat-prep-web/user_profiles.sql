-- ============================================================================
--  LEADERBOARD — Bảng user_profiles (BÍ DANH + opt-in hiển thị bảng xếp hạng)
--  Chạy trong: Supabase Dashboard → SQL Editor → Run (idempotent, chạy lại an toàn)
-- ============================================================================
--  TÁCH KHỎI user_economy (money-core, ROOT A): định danh/PII KHÔNG trộn vào
--  đường ghi xu. User là học sinh VỊ THÀNH NIÊN → privacy tối đa:
--    • CHỈ lưu BÍ DANH tự chọn (nickname) — KHÔNG tên thật, KHÔNG email.
--    • opt_in_leaderboard MẶC ĐỊNH false → KHÔNG lên bảng trừ khi tự bật.
--
--  🔴 BẢO MẬT — RLS: user CHỈ đọc/tạo/sửa profile CỦA MÌNH (auth.uid()=user_id).
--  Bảng xếp hạng đọc cross-user CHỈ qua service-role (createAdminClient) trong
--  leaderboard-store — KHÔNG mở SELECT công khai (tránh client tự crawl map
--  nickname↔user_id). Store là điểm kiểm soát DUY NHẤT: chỉ trả nickname +
--  basePower ra ngoài, KHÔNG bao giờ serialize user_id/email.
--  FAIL-SAFE: bảng chưa có → store trả []/null → UI "Bảng xếp hạng sắp ra mắt".
-- ============================================================================

create table if not exists public.user_profiles (
  user_id             uuid        primary key references auth.users(id) on delete cascade,
  nickname            text,                                 -- BÍ DANH tự chọn (null = chưa đặt)
  opt_in_leaderboard  boolean     not null default false,   -- OPT-IN: mặc định KHÔNG lên bảng
  nickname_updated_at timestamptz,                          -- chống đổi nickname liên tục (cooldown)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- Ràng buộc độ dài ở tầng DB (phòng thủ chiều sâu; validate chính ở app/nickname.ts).
  constraint user_profiles_nickname_len
    check (nickname is null or char_length(nickname) between 3 and 20)
);

-- Chỉ index các dòng đã opt-in (bảng xếp hạng chỉ quét nhóm này).
create index if not exists user_profiles_optin_idx
  on public.user_profiles (opt_in_leaderboard) where opt_in_leaderboard = true;

alter table public.user_profiles enable row level security;

-- User đọc profile CỦA MÌNH (để hiện nickname/opt-in đã đặt).
drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own" on public.user_profiles
  for select to authenticated
  using (auth.uid() = user_id);

-- User tạo profile CỦA MÌNH.
drop policy if exists "user_profiles_insert_own" on public.user_profiles;
create policy "user_profiles_insert_own" on public.user_profiles
  for insert to authenticated
  with check (auth.uid() = user_id);

-- User sửa profile CỦA MÌNH (đổi nickname / bật-tắt opt-in).
drop policy if exists "user_profiles_update_own" on public.user_profiles;
create policy "user_profiles_update_own" on public.user_profiles
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
