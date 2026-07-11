-- ============================================================================
--  MIGRATION — thêm cột skill_id vào Question Bank (chuẩn hóa schema, Bước 0)
--  Chạy trong: Supabase SQL Editor hoặc direct pg connect.
-- ============================================================================
--  BỐI CẢNH: mỗi câu AI sinh ra ĐÃ tính skillId (taxonomy chuẩn) ở route
--  generate-practice, nhưng skillId chỉ gắn vào RESPONSE — KHÔNG lưu vào bank.
--  Kết quả: mọi câu trong `questions` không mang skillId → khâu LỌC/tuyển câu
--  (Bước 0: gom đủ 3000 câu rồi curate thành ngân hàng đề chuẩn) muốn nhóm theo
--  skill phải suy lại từ `topic` tự do (lossy). Cột này giữ skillId taxonomy
--  BỀN VỮNG để curation nhóm/cân bằng theo skill chính xác.
--
--  AN TOÀN: cột NULLABLE, thêm mới (additive) → KHÔNG phá code đang chạy
--  (getFromBank select cột cụ thể, không đụng skill_id). Câu CŨ (43 câu tại thời
--  điểm migrate) skill_id = NULL — chấp nhận: câu mới từ giờ mang đủ; câu cũ có
--  thể backfill sau qua resolveSkillId nếu cần (ít & sẽ tự sinh lại).
-- ============================================================================

alter table public.questions add column if not exists skill_id text;

-- Curation nhóm/đếm theo skill → index cho nhanh.
create index if not exists idx_questions_skill on public.questions (skill_id);

-- Đếm phân bố theo skill (nền cho tiêu chí cân bằng lúc curate).
create index if not exists idx_questions_module_skill on public.questions (module_type, skill_id);
