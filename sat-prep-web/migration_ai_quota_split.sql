-- ============================================================================
--  MIGRATION — tách quota AI thành 2 bucket: gen_count + chat_count
--  Free: 3 gen + 3 chat/ngày (2 bucket riêng). Chạy TRƯỚC khi deploy code quota mới.
--  Prod signature increment_ai_usage có p_user_id uuid default auth.uid() (root_e).
-- ============================================================================
alter table public.user_ai_usage
  add column if not exists gen_count  integer not null default 0,
  add column if not exists chat_count integer not null default 0;

-- ⚠️ Hàm prod cũ có SIGNATURE khác: increment_ai_usage(uuid, text, int, int)
-- (root_e_step1_rpc.sql). CREATE OR REPLACE chỉ thay-thế khi CÙNG signature; khác
-- signature → tạo OVERLOAD mới, để lại hàm cũ mồ côi (vẫn còn GRANT authenticated,
-- vẫn tăng cột `count` cũ nếu bị gọi). Phải DROP tường minh hàm cũ trước.
drop function if exists public.increment_ai_usage(uuid, text, integer, integer);

create or replace function public.increment_ai_usage(
  p_kind       text,
  p_date       text,
  p_tokens_in  integer,
  p_tokens_out integer,
  p_user_id    uuid default auth.uid()
) returns integer
language plpgsql
security invoker
as $$
declare
  v_new integer;
begin
  insert into public.user_ai_usage (user_id, date, gen_count, chat_count, tokens_in, tokens_out, updated_at)
  values (p_user_id, p_date,
          case when p_kind = 'gen'  then 1 else 0 end,
          case when p_kind = 'chat' then 1 else 0 end,
          p_tokens_in, p_tokens_out, now())
  on conflict (user_id) do update set
    gen_count  = (case when user_ai_usage.date = excluded.date then user_ai_usage.gen_count  else 0 end)
                 + (case when p_kind = 'gen'  then 1 else 0 end),
    chat_count = (case when user_ai_usage.date = excluded.date then user_ai_usage.chat_count else 0 end)
                 + (case when p_kind = 'chat' then 1 else 0 end),
    tokens_in  = case when user_ai_usage.date = excluded.date then user_ai_usage.tokens_in + excluded.tokens_in else excluded.tokens_in end,
    tokens_out = case when user_ai_usage.date = excluded.date then user_ai_usage.tokens_out + excluded.tokens_out else excluded.tokens_out end,
    date       = excluded.date,
    updated_at = now()
  returning (case when p_kind = 'gen' then gen_count else chat_count end) into v_new;
  return v_new;
end;
$$;

revoke all on function public.increment_ai_usage(text, text, integer, integer, uuid) from public;
revoke all on function public.increment_ai_usage(text, text, integer, integer, uuid) from authenticated;
grant execute on function public.increment_ai_usage(text, text, integer, integer, uuid) to service_role;
