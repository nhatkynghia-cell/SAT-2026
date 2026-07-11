-- ============================================================================
--  MIGRATION — RPC increment_question_usage (đo lường tái dùng, Bước 0)
--  Chạy trong: Supabase SQL Editor hoặc direct pg connect.
-- ============================================================================
--  BỐI CẢNH: cột questions.usage_count (schema: "số lần tái dùng") CHƯA BAO GIỜ
--  được tăng — getFromBank chỉ SELECT. usage_count là TÍN HIỆU CHẤT LƯỢNG chính
--  cho curation (Bước 0): câu tái dùng nhiều = phổ biến/hữu ích → ưu tiên tuyển
--  vào ngân hàng đề chuẩn.
--
--  Tăng qua RPC để ATOMIC (usage_count = usage_count + 1 trong 1 statement, không
--  read-modify-write từ JS → không race khi nhiều user bốc trúng cùng 1 câu).
--  KHÁC coin/money: đây là ĐO LƯỜNG non-critical → route gọi fire-and-forget,
--  lỗi KHÔNG ảnh hưởng câu trả về (chỉ mất 1 nhịp đếm).
--
--  SECURITY DEFINER + search_path cố định: chạy quyền owner nhưng CHỈ tăng đếm 1
--  cột đo lường trên bảng nội dung chung (không PII, không money). No-op nếu id
--  không tồn tại (where khớp 0 dòng).
-- ============================================================================

create or replace function public.increment_question_usage(p_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.questions set usage_count = usage_count + 1 where id = p_id;
$$;

-- Cho phép client đã đăng nhập gọi (giống quyền update bảng questions sẵn có).
grant execute on function public.increment_question_usage(text) to authenticated;
