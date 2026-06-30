-- ============================================================================
--  PHASE 1.5 — PvP server-authoritative + Mistake skill_id (2026-07-01)
--  Chạy trong: Supabase Dashboard → SQL Editor → Run (idempotent, chạy lại an toàn)
--  Convention KHỚP phase1_5_tables.sql: add column if not exists, RLS đã có sẵn
--  trên bảng cha (user_economy / user_mistakes) nên KHÔNG cần policy mới.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────
-- 1) PvP SERVER-AUTHORITATIVE — đóng lỗ "faucet xu"
--    Vấn đề hiện tại: rank chỉ ở client save-data → server KHÔNG kiểm được
--    targetRank hợp lệ; không cooldown/không cap → account giỏi script
--    POST {action:'pvp',targetRank:1} lặp vô hạn ăn 15000 xu/lần.
--    Vá: rank + bộ đếm trận/ngày lưu SERVER trong user_economy.
--      • pvp_rank          = hạng hiện tại (11 = Tân Binh, càng NHỎ càng cao,
--                            1 = đỉnh). Mặc định 11 KHỚP client (pvpRank: 11).
--      • pvp_fights_today  = số trận đã đánh trong ngày (chống farm).
--      • pvp_last_fight_date = ngày YYYY-MM-DD của lần đánh gần nhất (để reset
--                            bộ đếm sang ngày mới — cùng mẫu user_ai_usage.date).
-- ────────────────────────────────────────────────────────────────────────
alter table public.user_economy add column if not exists pvp_rank            integer not null default 11;
alter table public.user_economy add column if not exists pvp_fights_today     integer not null default 0;
alter table public.user_economy add column if not exists pvp_last_fight_date  text    not null default '';

-- ────────────────────────────────────────────────────────────────────────
-- 2) MISTAKE → BIẾN THỂ (Nhóm 7 #6) — cần biết câu sai thuộc skill nào
--    Hiện user_mistakes KHÔNG có skill_id → không thể sinh câu "cùng skill
--    khác số liệu" để ôn lại, cũng không ghi mastery đúng skill khi làm lại.
--    Thêm cột nullable (câu sai cũ để NULL — vẫn hiển thị bình thường).
-- ────────────────────────────────────────────────────────────────────────
alter table public.user_mistakes add column if not exists skill_id text;

-- ============================================================================
--  XONG. Không cần đổi RLS: user_economy + user_mistakes đã có policy
--  auth.uid() = user_id (tạo từ trước) — cột mới tự nằm trong phạm vi đó.
-- ============================================================================
