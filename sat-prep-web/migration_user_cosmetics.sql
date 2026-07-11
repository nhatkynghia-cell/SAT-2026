-- ============================================================================
--  MIGRATION — bảng public.user_cosmetics (nợ kỹ thuật: persist cosmetic OWNERSHIP)
--  Chạy trong: Supabase Dashboard → SQL Editor → Run. Idempotent (chạy lại an toàn).
-- ============================================================================
--  BỐI CẢNH: cosmetic THƯỞNG kiểu 'earned' (khung/danh hiệu Nhà Vô Địch Mùa) trước
--  đây KHÔNG có đường persist — leaderboard "hack" bằng cách coi mọi user Ultimate
--  là đã sở hữu (danh vọng giả). Bảng này lưu quyền-sở-hữu THẬT: chỉ top-3 giải đấu
--  Ultimate mỗi THÁNG được cron cấp (server-authoritative, ROOT A). Món VĨNH VIỄN
--  (một khi thắng, giữ mãi); cột season_key = mùa đã thắng (provenance + idempotency).
--
--  Convention KHỚP user_plans/user_profiles: user_id UUID REFERENCES auth.users(id).
--  KHÁC: RLS chỉ cho SELECT own (đọc túi của mình); GHI CHỈ service-role (cron/route
--  server) — CLONE mẫu khoá-ghi user_economy ở root_e_step2_revoke.sql (chống client
--  tự cấp cosmetic cho mình = tự phong "vô địch").
-- ============================================================================

-- 1 dòng = 1 lần user sở hữu 1 cosmetic ở 1 mùa. PK 3 cột: thắng lại cùng mùa →
-- INSERT ... ON CONFLICT DO NOTHING = idempotent (cron chạy lại không nhân đôi);
-- thắng nhiều mùa = nhiều dòng, nhưng "đang sở hữu" tính theo DISTINCT cosmetic_id.
create table if not exists public.user_cosmetics (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  cosmetic_id text        not null,
  season_key  text        not null,          -- mùa đã thắng (YYYY-MM) — provenance
  granted_at  timestamptz not null default now(),
  primary key (user_id, cosmetic_id, season_key)
);

-- Tra "túi cosmetic của user" nhanh (getEarnedCosmetics đọc theo user_id).
create index if not exists user_cosmetics_user_idx on public.user_cosmetics (user_id);

-- ============================================================================
--  RLS — user chỉ ĐỌC cosmetic của chính mình; KHÔNG được INSERT/UPDATE/DELETE.
--  Cấp cosmetic là quyết định SERVER (cron settle giải đấu), qua service-role
--  (bypass RLS). Chống P2W: không cách nào client tự ghi mình thành "vô địch".
-- ============================================================================
alter table public.user_cosmetics enable row level security;

-- Idempotent: bỏ policy cũ trước khi tạo lại (create policy không có "if not exists").
drop policy if exists "own_cosmetics_select" on public.user_cosmetics;
create policy "own_cosmetics_select" on public.user_cosmetics
  for select
  using (auth.uid() = user_id);

-- Khoá cứng đường GHI khỏi client (anon/authenticated). service_role bypass RLS nên
-- cron/route server vẫn ghi được. (REVOKE bổ sung cho RLS: kể cả nếu lỡ thêm policy
-- ghi, quyền bảng vẫn chặn — mẫu root_e_step2_revoke.sql cho user_economy.)
revoke insert, update, delete on public.user_cosmetics from anon, authenticated;
