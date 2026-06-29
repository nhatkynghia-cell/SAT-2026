-- ============================================================================
--  FIX + VERIFY RLS — Phase 1.5 / Nhóm 1.3 (chạy MỘT LẦN trên SQL Editor)
--  Chạy trong: Supabase Dashboard → SQL Editor → dán toàn bộ → Run
-- ============================================================================

-- (A) VÁ lỗ hổng: user_mistakes thiếu policy UPDATE → updateMistakeReview (SRS
--     Leitner, mistakes-store.ts) bị RLS chặn âm thầm. Idempotent (drop trước).
drop policy if exists "Users can update their own mistakes" on public.user_mistakes;
create policy "Users can update their own mistakes"
  on public.user_mistakes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- (B) XÁC NHẬN cả 7 bảng đều BẬT RLS (rls_enabled phải = true cho cả 7).
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('user_economy','user_mistakes','test_history',
                    'user_mastery','user_goals','user_ai_usage','user_vocab_srs')
order by c.relname;
