-- ============================================================================
--  MIGRATION — mở CHECK constraint gateway cho payOS (và bật lại vnpay/momo)
--  Chạy TRƯỚC khi bật cổng payOS/VNPay/MoMo trên prod. Idempotent (drop + add).
--  Chạy trong: Supabase Dashboard → SQL Editor → Run.
-- ============================================================================
--  Lý do: payment_transactions.sql gốc (và migration_stripe_gateway.sql) khai
--  CHECK gateway in ('vnpay','momo','stripe'). INSERT đơn gateway='payOS' sẽ bị
--  Postgres từ chối (23514) → user quét QR chuyển khoản nhưng đơn vỡ, gói không cấp.
--
--  Thêm 'payOS' (payOS dùng order_id = String(orderCode) số, gateway='payos').
--  'vnpay'/'momo' đã có trong CHECK → giữ nguyên (khi user đăng ký creds DN là bật).
-- ============================================================================
alter table public.payment_transactions
  drop constraint if exists payment_transactions_gateway_check,
  add  constraint payment_transactions_gateway_check
       check (gateway in ('vnpay', 'momo', 'stripe', 'payos'));
-- confirm_payment RPC đọc gateway dạng text thuần → KHÔNG cần sửa RPC.
