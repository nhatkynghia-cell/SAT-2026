-- ============================================================================
--  MIGRATION — mở CHECK constraint period cho gói 3 tháng (quarterly) + 6 tháng (semiannual)
--  Chạy TRƯỚC khi deploy code PLANS mới. Idempotent (drop if exists + add).
--  Lý do: 2 bảng có CHECK period in ('monthly','yearly') → INSERT period mới bị từ
--  chối (23514) → user trả tiền nhưng grantSubscription vỡ. Cột period là text (không enum).
-- ============================================================================
alter table public.user_subscriptions
  drop constraint if exists user_subscriptions_period_check,
  add  constraint user_subscriptions_period_check
       check (period in ('monthly','quarterly','semiannual','yearly'));

alter table public.payment_transactions
  drop constraint if exists payment_transactions_period_check,
  add  constraint payment_transactions_period_check
       check (period in ('monthly','quarterly','semiannual','yearly'));
-- confirm_payment RPC đọc period dạng text thuần → KHÔNG cần sửa RPC.
