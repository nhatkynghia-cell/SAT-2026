This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Thanh toán (Stripe Test Mode)

Cổng thanh toán hiện dùng **Stripe Checkout** (redirect) + **webhook** để cấp gói. VNPay/MoMo tạm disable (code còn nguyên, bật lại khi có creds doanh nghiệp — xem `.env.example`).

Kiến trúc: `/api/payment/create` tạo Checkout Session (server tra giá từ `PLANS`, client KHÔNG gửi số tiền) → user thanh toán trên Stripe → Stripe gọi `POST /api/payment/stripe-webhook` (server-to-server, đã verify chữ ký) → cấp gói nguyên tử qua RPC `confirm_payment`. Đây là nguồn sự thật duy nhất — `success_url` chỉ hiển thị trạng thái.

> 🔴 VND là *zero-decimal currency* ở Stripe → `unit_amount` và `amount_total` = **số VND thật** (không ×100). Nhờ vậy khớp thẳng `amount_vnd` trong DB, không phải đổi giá.

### 1. Lấy API keys (Test Mode)

1. Vào [dashboard.stripe.com](https://dashboard.stripe.com), bật **Test Mode** (toggle góc phải).
2. Developers → API keys: copy `sk_test_...` và `pk_test_...`.
3. Điền vào `.env.local`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

### 2. Chạy webhook local

Cài [Stripe CLI](https://stripe.com/docs/stripe-cli) rồi:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/payment/stripe-webhook
```

Lệnh `listen` in ra `whsec_...` — copy vào `.env.local`:
```
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 3. Chạy DB migration

Chạy `migration_stripe_gateway.sql` trên Supabase (SQL Editor) để mở CHECK constraint `gateway` cho `'stripe'`. Nếu chưa chạy, đơn `gateway='stripe'` sẽ bị Postgres từ chối (23514).

### 4. Test thanh toán

Vào `/upgrade`, chọn gói → Stripe Checkout. Dùng thẻ test:
- Số thẻ: `4242 4242 4242 4242`
- Ngày hết hạn: bất kỳ ngày trong tương lai · CVC: 3 số bất kỳ

Thanh toán xong, webhook cấp gói → `user_subscriptions` có dòng mới, `payment_transactions` lật `paid`.

### 5. Production

Trên Stripe dashboard (Live/Test tùy môi trường): Developers → Webhooks → Add endpoint trỏ `${APP_BASE_URL}/api/payment/stripe-webhook`, lắng nghe event `checkout.session.completed`. Copy signing secret (`whsec_...`) vào env Vercel. Thiếu `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` → `/api/payment/create` trả 503 (không crash).

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
