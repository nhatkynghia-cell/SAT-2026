-- ============================================================================
--  TASK 5.1 — Bảng ai_cost_ledger (sổ cái chi phí AI toàn hệ thống theo ngày)
--  Chạy trong: Supabase Dashboard → SQL Editor → Run
-- ============================================================================
--  Thay cho file `ai_cost_global.json` (file-based → reset mỗi cold-start trên
--  Vercel serverless → kill-switch ngân sách MẤT TÁC DỤNG cộng dồn). Bảng này
--  giữ tổng chi phí AI bền vững qua mọi instance serverless.
--
--  ⚠️ GIỐNG ai_chat_cache, KHÁC 7 bảng user_*: bảng DÙNG CHUNG toàn hệ thống
--  (1 dòng/ngày, không thuộc về user nào) → KHÔNG scope theo auth.uid()=user_id.
--  Chỉ chứa số liệu vận hành (token/chi phí), KHÔNG có PII.
--  Policy: mọi user ĐÃ ĐĂNG NHẬP (authenticated) đọc/ghi được; anon thì không.
--
--  🔓 Trước khi chạy SQL này: store `cost-ledger-store.ts` FAIL-OPEN (bảng chưa
--  có → ledger rỗng → checkBudget cho phép). Sau khi chạy: kill-switch bắt đầu
--  cộng dồn bền vững. ⚠️ Nếu deploy prod mà QUÊN chạy → KHÔNG có trần chi phí.
-- ============================================================================

create table if not exists public.ai_cost_ledger (
  ledger_date text        primary key,             -- YYYY-MM-DD (1 dòng/ngày)
  calls       integer     not null default 0,       -- số lượt gọi AI trong ngày
  tokens_in   bigint      not null default 0,       -- tổng token input
  tokens_out  bigint      not null default 0,       -- tổng token output
  cost_usd    numeric     not null default 0,       -- chi phí USD ước tính cộng dồn
  updated_at  timestamptz not null default now()
);

alter table public.ai_cost_ledger enable row level security;

-- Mọi user đã đăng nhập đọc/ghi sổ cái chung (KHÔNG ràng theo user_id).
create policy "auth_read_cost_ledger"   on public.ai_cost_ledger
  for select to authenticated using (true);
create policy "auth_insert_cost_ledger" on public.ai_cost_ledger
  for insert to authenticated with check (true);
create policy "auth_update_cost_ledger" on public.ai_cost_ledger
  for update to authenticated using (true) with check (true);
