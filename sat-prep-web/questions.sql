-- ============================================================================
--  TASK 2.1 — Bảng questions (Question Bank: tái sử dụng câu hỏi AI đã sinh)
--  Chạy trong: Supabase Dashboard → SQL Editor → Run
-- ============================================================================
--  Thay cho file `question_bank.json` (file-based → reset mỗi cold-start trên
--  Vercel serverless → pool KHÔNG BAO GIỜ đạt MIN_POOL=8 → hit-rate ≈ 0% →
--  MỌI câu đều gọi OpenAI, chi phí tăng vọt). Bảng này giữ ngân hàng câu hỏi
--  bền vững qua mọi instance → tái dùng thật, cắt chi phí AI.
--
--  ⚠️ GIỐNG ai_chat_cache / ai_cost_ledger, KHÁC 7 bảng user_*: bảng DÙNG CHUNG
--  toàn hệ thống (nội dung tĩnh phục vụ mọi học sinh) → KHÔNG scope theo
--  auth.uid()=user_id. Chỉ chứa câu hỏi SAT, KHÔNG có PII.
--  Policy: mọi user ĐÃ ĐĂNG NHẬP (authenticated) đọc/ghi được; anon thì không.
--
--  🔓 Trước khi chạy SQL này: store `question-bank.ts` FAIL-SAFE (bảng chưa có →
--  poolSize=0 + getFromBank=null → route tự sinh câu qua AI). Sau khi chạy:
--  bank bắt đầu tích lũy & tái dùng. KHÔNG có bước migrate dữ liệu từ file cũ
--  (câu cũ trong question_bank.json ít & sẽ tự sinh lại; bỏ qua cho gọn).
-- ============================================================================

create table if not exists public.questions (
  id          text        primary key,             -- hash nội dung (dedup): sha256(module::question::passage)[:16]
  module_type text        not null,                 -- math | desmos | literature | vocab
  topic       text        not null default '',      -- chủ đề tự do từ UI
  difficulty  text,                                 -- Easy | Medium | Hard (null nếu câu cũ không có)
  data        jsonb       not null,                 -- object câu hỏi y như client cần (giữ nguyên hợp đồng)
  usage_count integer     not null default 0,       -- số lần tái dùng (đo lường)
  created_at  timestamptz not null default now()
);

-- Truy vấn nóng: lọc theo module_type (+ difficulty cho adaptive). Index để nhanh.
create index if not exists idx_questions_module     on public.questions (module_type);
create index if not exists idx_questions_module_diff on public.questions (module_type, difficulty);

alter table public.questions enable row level security;

-- Mọi user đã đăng nhập đọc/ghi ngân hàng câu hỏi chung (KHÔNG ràng theo user_id).
create policy "auth_read_questions"   on public.questions
  for select to authenticated using (true);
create policy "auth_insert_questions" on public.questions
  for insert to authenticated with check (true);
create policy "auth_update_questions" on public.questions
  for update to authenticated using (true) with check (true);
