-- ============================================================================
--  TASK 4.1 — Bảng user_progress (streak/inventory/quests theo user)
--  Chạy trong: Supabase Dashboard → SQL Editor → Run
-- ============================================================================
--  Sổ tiến trình "nền" mỗi user: streak, shield, inventory, quests,
--  practice-history, pet... — TẤT CẢ số liệu KHÔNG-đổi-ra-tiền-thật (coins/xp/
--  level đã server-authoritative ở user_economy + skill-tree từ T7). Thay cho
--  file `data/users/<id>/streak_data.json` (fs → reset mỗi cold-start
--  serverless → mất streak/inventory sau mỗi deploy Vercel).
--
--  🔐 Cột `data_json` là TEXT (KHÔNG jsonb): chứa NGUYÊN chuỗi JSON đã ký
--  HMAC-SHA256. jsonb sẽ chuẩn hóa lại số/thứ tự key → chuỗi đọc ra khác chuỗi
--  đã ký → HMAC lệch → app tưởng gian lận → XÓA sạch tiến trình mỗi reload.
--  Lưu raw text giữ chữ ký khớp byte-cho-byte. Xem progress-store.ts.
--
--  Đây là bảng THEO USER (khác questions/ai_chat_cache/ai_cost_ledger dùng
--  chung) → RLS scope auth.uid()=user_id giống 4 bảng user_* Nhóm 1.
--
--  🔓 Trước khi chạy: routes save/load-data FAIL-SAFE fallback về FILE (bảng
--  chưa có → ghi/đọc file như cũ, 0 regression). Sau khi chạy: tiến trình bền
--  vững qua deploy. KHÔNG migrate dữ liệu file cũ (chỉ 1 file seed mặc định).
-- ============================================================================

create table if not exists public.user_progress (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  data_json  text        not null,                 -- CHUỖI JSON đã ký HMAC (raw, KHÔNG jsonb)
  updated_at timestamptz not null default now()
);

alter table public.user_progress enable row level security;

-- Mỗi user chỉ đọc/ghi tiến trình CỦA MÌNH (giống 4 bảng user_* Nhóm 1).
create policy "user_progress_all" on public.user_progress
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
