-- ============================================================================
--  MIGRATION — mở CHECK constraint gateway cho Stripe
--  Chạy TRƯỚC khi deploy code có nhánh Stripe. Idempotent (drop if exists + add).
--  Chạy trong: Supabase Dashboard → SQL Editor → Run.
-- ============================================================================
--  Lý do: payment_transactions.sql gốc khai CHECK gateway in ('vnpay','momo')
--  (constraint inline auto-name = payment_transactions_gateway_check). INSERT đơn
--  gateway='stripe' sẽ bị Postgres từ chối (23514) → user trả tiền nhưng đơn vỡ.
--
--  🔴 GIỮ 'vnpay','momo' trong CHECK: chỉ DISABLE ở tầng app (VALID_GATEWAYS), code
--  route/lib còn nguyên → thêm lại creds doanh nghiệp là bật lại được, không cần
--  migration ngược. Chỉ THÊM 'stripe'.
-- ============================================================================
alter table public.payment_transactions
  drop constraint if exists payment_transactions_gateway_check,
  add  constraint payment_transactions_gateway_check
       check (gateway in ('vnpay', 'momo', 'stripe'));
-- confirm_payment RPC đọc gateway dạng text thuần → KHÔNG cần sửa RPC.
