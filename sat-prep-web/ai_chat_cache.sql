-- ============================================================================
--  TASK 5.3 — Bảng ai_chat_cache (cache câu trả lời Gia sư AI dùng chung)
--  Chạy trong: Supabase Dashboard → SQL Editor → Run
-- ============================================================================
--  ⚠️ KHÁC 7 bảng user_*: bảng này DÙNG CHUNG toàn hệ thống (1 câu trả lời phục
--  vụ mọi học sinh hỏi cùng câu hỏi SAT) → KHÔNG scope theo auth.uid()=user_id.
--  Chỉ chứa lời giải câu hỏi SAT, KHÔNG có PII → chia sẻ an toàn.
--  Policy: mọi user ĐÃ ĐĂNG NHẬP (authenticated) đọc/ghi được; anon thì không.
-- ============================================================================

create table if not exists public.ai_chat_cache (
  cache_hash  text        primary key,             -- SHA256(question+answer+userMessage)
  question_id text,                                 -- tham chiếu ngân hàng câu hỏi (tùy chọn)
  user_query  text        not null,                 -- câu học sinh hỏi (để debug/đánh giá)
  ai_response text        not null,                 -- câu trả lời AI đã lưu
  hit_count   integer     not null default 1,       -- số lần tái dùng (đo lường tiết kiệm token)
  created_at  timestamptz not null default now()
);

alter table public.ai_chat_cache enable row level security;

-- Mọi user đã đăng nhập đều đọc/ghi cache chung (KHÔNG ràng theo user_id).
create policy "auth_read_chat_cache"   on public.ai_chat_cache
  for select to authenticated using (true);
create policy "auth_insert_chat_cache" on public.ai_chat_cache
  for insert to authenticated with check (true);
create policy "auth_update_chat_cache" on public.ai_chat_cache
  for update to authenticated using (true) with check (true);
