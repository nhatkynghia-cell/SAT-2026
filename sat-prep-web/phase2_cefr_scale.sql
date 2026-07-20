-- ============================================================================
--  PHASE 2 — CEFR SCALE + RESET PILOT (chuyển SAT → Cambridge KET/PET)
-- ============================================================================
--  CHẠY: Supabase Dashboard → SQL Editor → Run. BACKUP trước khi chạy.
--  App đang PILOT chưa phát hành → reset dữ liệu SAT cũ được chấp nhận
--  (user chốt "Reset sâu" 2026-07-18). Chạy TRƯỚC khi deploy code Phase 2.
--
--  Quy ước dự án: KHÔNG có thư mục supabase/migrations — các .sql ở gốc repo
--  chạy thủ công (giống daily_snapshots.sql, phase1_5_tables.sql).
-- ============================================================================

-- 1) daily_snapshots: bỏ cột SAT sections → thêm Cambridge Scale + CEFR
alter table public.daily_snapshots add column if not exists overall_scale integer not null default 0;
alter table public.daily_snapshots add column if not exists cefr text not null default 'Pre-A1';
alter table public.daily_snapshots drop column if exists math_section;
alter table public.daily_snapshots drop column if exists reading_section;
alter table public.daily_snapshots drop column if exists total_score;

-- 2) user_goals: target_score (int SAT 400-1600) → target_level (text CEFR A1/A2/B1)
alter table public.user_goals add column if not exists target_level text;
alter table public.user_goals drop column if exists target_score;

-- 3) RESET SÂU — dọn dữ liệu tham chiếu skillId/điểm SAT cũ.
--    user_mastery.skills JSONB chứa skillId Toán cũ (algebra.*) + __gates__ key
--    'algebra' mồ côi → isValidSkill=false → summarize bỏ qua, nhưng gây noise.
--    TRUNCATE để pilot bắt đầu sạch với taxonomy Cambridge.
truncate table public.user_mastery;
truncate table public.user_goals;
truncate table public.daily_snapshots;
truncate table public.questions;         -- ngân hàng câu SAT cũ (moduleType math/literature/desmos/vocab)
truncate table public.issued_questions;  -- câu đã phát (skill_id SAT cũ)

-- Reset sâu (user chốt) — bảng tham chiếu skillId Toán:
truncate table public.user_mistakes;     -- sổ tay câu sai (skill_id SAT cũ)
-- speed_quiz: nếu tồn tại bảng lưu lịch sử skillId (bỏ qua lỗi nếu bảng không có).
-- truncate table public.speed_quiz_history;  -- bỏ comment nếu bảng tồn tại

-- GIỮ NGUYÊN (không reset): user_economy, payment/subscription/redemptions,
-- user_progress (streak/inventory), leaderboard — không tham chiếu skillId môn học.

-- LƯU Ý:
-- (a) phase1_5_tables.sql tạo user_goals với 'target_score integer' — file gốc chỉ
--     create-if-not-exists nên KHÔNG tự cập nhật schema đang chạy; migration này alter trực tiếp.
-- (b) Muốn GIỮ backup thay vì DROP cột: đổi 'drop column' thành 'alter column ... drop not null'.
