-- ============================================================================
--  MIGRATION — RESERVE-BEFORE-CALL cho quota AI (đóng C1 TOCTOU, backlog #8)
-- ============================================================================
--  VẤN ĐỀ (audit 2026-07-09, C1): chat/route.ts + generate-practice/route.ts theo
--  mẫu check→fetch OpenAI→record. N request đồng thời ĐỀU đọc used<limit TRƯỚC khi
--  bất kỳ record nào ghi → cả N gọi OpenAI thật dù cap 3/ngày (Free) → đốt tiền
--  OpenAI vượt trần. increment_ai_usage (migration_ai_quota_split) ghi SAU khi gọi
--  nên không chặn được.
--
--  CÁCH SỬA: RESERVE (kiểm + tăng count 1 transaction có khóa dòng) NGAY TRƯỚC khi
--  gọi OpenAI. Chỉ gọi OpenAI khi reserve.allowed. Nếu OpenAI LỖI → refund (trả lại
--  slot, không phạt quota người dùng vì lỗi hạ tầng). Thành công → add_ai_tokens
--  (chỉ cộng token, count đã reserve rồi).
--
--  3 hàm mới (KHÔNG đụng increment_ai_usage cũ — vẫn dùng cho đường fallback
--  pre-migration của store, 0 regression):
--    • reserve_ai_usage(kind, date, limit)  → jsonb {allowed, used, limit}
--    • refund_ai_usage(kind, date)          → void  (giảm 1, sàn 0, chỉ khi cùng ngày)
--    • add_ai_tokens(date, tin, tout)       → void  (cộng token sau khi gọi xong)
--
--  Quy ước theo migration_ai_quota_split.sql: security invoker, chỉ grant
--  service_role (store gọi qua admin client + truyền p_user_id tường minh; auth.uid()
--  chỉ là default khi client authenticated tự gọi — không dùng ở store). Bảng
--  user_ai_usage đã có gen_count/chat_count (migration_ai_quota_split đã chạy).
-- ============================================================================

-- ── 1. RESERVE: kiểm hạn mức + tăng count NGUYÊN TỬ (khóa dòng) ──────────────
create or replace function public.reserve_ai_usage(
  p_kind    text,
  p_date    text,
  p_limit   integer,               -- -1 = không giới hạn (premium/ultimate)
  p_user_id uuid default auth.uid()
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_gen     integer;
  v_chat    integer;
  v_tin     integer;
  v_tout    integer;
  v_date    text;
  v_used    integer;
  v_allowed boolean;
begin
  -- Bảo đảm CÓ dòng để SELECT..FOR UPDATE khóa (DO NOTHING không đụng dòng cũ).
  insert into public.user_ai_usage (user_id, date, gen_count, chat_count, tokens_in, tokens_out, updated_at)
  values (p_user_id, p_date, 0, 0, 0, 0, now())
  on conflict (user_id) do nothing;

  -- Khóa dòng của user này → tuần tự hóa mọi reserve đồng thời (đóng TOCTOU).
  select date, gen_count, chat_count, tokens_in, tokens_out
    into v_date, v_gen, v_chat, v_tin, v_tout
  from public.user_ai_usage
  where user_id = p_user_id
  for update;

  -- Reset đếm khi sang ngày mới (so với p_date server cấp).
  if v_date is distinct from p_date then
    v_gen := 0; v_chat := 0; v_tin := 0; v_tout := 0;
  end if;

  v_used := case when p_kind = 'gen' then v_gen else v_chat end;
  v_allowed := (p_limit < 0) or (v_used < p_limit);

  if v_allowed then
    if p_kind = 'gen' then v_gen := v_gen + 1; else v_chat := v_chat + 1; end if;
    v_used := v_used + 1;
  end if;

  -- Ghi lại (kể cả khi không allowed nhưng vừa reset ngày → persist reset + count đã tăng nếu allowed).
  update public.user_ai_usage
     set gen_count = v_gen, chat_count = v_chat, tokens_in = v_tin, tokens_out = v_tout,
         date = p_date, updated_at = now()
   where user_id = p_user_id;

  return jsonb_build_object('allowed', v_allowed, 'used', v_used, 'limit', p_limit);
end;
$$;

-- ── 2. REFUND: trả lại 1 slot khi OpenAI lỗi (không phạt quota vì lỗi hạ tầng) ─
--  Chỉ giảm khi CÙNG ngày với reservation (p_date). Nếu đã sang ngày mới, count
--  vốn reset → không có gì để hoàn; greatest(0,…) chặn âm khi refund thừa.
create or replace function public.refund_ai_usage(
  p_kind    text,
  p_date    text,
  p_user_id uuid default auth.uid()
) returns void
language plpgsql
security invoker
as $$
begin
  update public.user_ai_usage
     set gen_count  = case when p_kind = 'gen'  and date = p_date then greatest(0, gen_count  - 1) else gen_count  end,
         chat_count = case when p_kind = 'chat' and date = p_date then greatest(0, chat_count - 1) else chat_count end,
         updated_at = now()
   where user_id = p_user_id;
end;
$$;

-- ── 3. ADD TOKENS: cộng token sau khi gọi xong (count đã reserve từ bước 1) ──
create or replace function public.add_ai_tokens(
  p_date       text,
  p_tokens_in  integer,
  p_tokens_out integer,
  p_user_id    uuid default auth.uid()
) returns void
language plpgsql
security invoker
as $$
begin
  update public.user_ai_usage
     set tokens_in  = case when date = p_date then tokens_in  + p_tokens_in  else p_tokens_in  end,
         tokens_out = case when date = p_date then tokens_out + p_tokens_out else p_tokens_out end,
         updated_at = now()
   where user_id = p_user_id;
end;
$$;

-- ── GRANTS: chỉ service_role (store gọi qua admin client) ────────────────────
revoke all on function public.reserve_ai_usage(text, text, integer, uuid) from public;
revoke all on function public.reserve_ai_usage(text, text, integer, uuid) from authenticated;
grant execute on function public.reserve_ai_usage(text, text, integer, uuid) to service_role;

revoke all on function public.refund_ai_usage(text, text, uuid) from public;
revoke all on function public.refund_ai_usage(text, text, uuid) from authenticated;
grant execute on function public.refund_ai_usage(text, text, uuid) to service_role;

revoke all on function public.add_ai_tokens(text, integer, integer, uuid) from public;
revoke all on function public.add_ai_tokens(text, integer, integer, uuid) from authenticated;
grant execute on function public.add_ai_tokens(text, integer, integer, uuid) to service_role;
