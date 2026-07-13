# ✅ TODO USER — Việc cần bạn giải quyết (Claude không tự làm được)

> Cập nhật 2026-07-13. Mục tiêu gần: **deploy chạy thử app**.
> Đánh dấu `[x]` khi xong. Việc nào gửi được creds/token cho Claude thì Claude wire vào ngay.

---

## 🔴 NHÓM 1 — BẢO MẬT (làm GẤP, secret đã lộ)

- [ ] **Xóa GitHub token cũ** `ghp_...HETIG` (lộ trong ảnh). Đã có token mới `github_pat_...` (SAT) đang dùng → xóa cái cũ an toàn.
  → github.com → Settings → Developer settings → Personal access tokens → Delete token cũ
- [ ] **Rotate Vercel token** `vcp_...` (lộ trong chat).
  → vercel.com → Account Settings → Tokens → xóa + tạo mới (gửi Claude nếu cần deploy qua CLI)
- [ ] **Rotate OpenAI key** (nằm trong `.anv` + Vercel, lộ ảnh 2026-06-29).
  → platform.openai.com → API keys → revoke key cũ + tạo mới → cập nhật biến `OPENAI_API_KEY` trên Vercel + `.env.local`
- [ ] **Rotate `SAT_PREP_SECRET`** (lộ cùng ảnh 06-29).
  → tạo chuỗi random mới → cập nhật `.env.local` + Vercel (sensitive)
- [x] DB password Supabase — ĐÃ đổi (từ trước)

---

## 🟡 NHÓM 2 — CỔNG THANH TOÁN (cần để bán gói)

Code + routes + giá ĐÃ xong (Premium 499k/3.99tr · Ultimate 990k/7.99tr). Chỉ thiếu creds sandbox để verify live.

- [ ] Lấy creds **VNPay sandbox**: `VNPAY_TMN_CODE` + `VNPAY_HASH_SECRET`
- [ ] Lấy creds **MoMo sandbox**: `MOMO_PARTNER_CODE` + `MOMO_ACCESS_KEY` + `MOMO_SECRET_KEY`
  → sandbox.vnpayment.vn / business.momo.vn → gửi Claude hoặc tự thêm `.env.local` + Vercel (sensitive)
  → Có creds: Claude verify roundtrip live + đối chiếu field-order chữ ký IPN MoMo (điểm dễ sai nhất)

---

## 🟡 NHÓM 3 — OAUTH GOOGLE/FACEBOOK (tùy chọn — nút social)

Xem chi tiết đầy đủ trong **`OAUTH_SETUP.md`**. Tóm tắt:
- [ ] Tạo OAuth Client ở Google Cloud Console (redirect: `https://yynszcfqcvbnuvguwtfy.supabase.co/auth/v1/callback`)
- [ ] Supabase → Authentication → Providers → Google → bật + dán Client ID/Secret
- [ ] Supabase → URL Configuration → thêm `http://localhost:3000/auth/callback` + `https://sat-2026.vercel.app/auth/callback`
- [ ] (tùy chọn) Facebook tương tự
  → Xong: nút Google/FB TỰ hiện lại trên trang login, không cần sửa code

---

## ⏳ NHÓM 4 — BETA LAUNCH 100 users

- [ ] Pháp lý: điều khoản sử dụng cho trẻ vị thành niên
- [ ] Kênh tuyển user beta

---

## 🚀 CHUẨN BỊ DEPLOY (Claude làm phiên sau — phần lớn không cần bạn)

Việc Claude sẽ tự làm khi mở phiên sau (xem HANDOFF_2026-07-13.md):
- Verify môi trường (tsc/test/lint/build)
- Kiểm cấu hình Vercel deploy (env plain vs sensitive, vercel.json)
- Rà checklist pre-deploy: env đủ chưa, RLS, rate-limit, secret không lọt git
- Deploy thử lên Vercel + smoke test các luồng chính

**Bạn chỉ cần** (nếu muốn deploy đầy đủ): rotate secret nhóm 1 (để prod dùng key sạch) + xác nhận Vercel token còn sống để Claude deploy qua CLI (hoặc bạn tự deploy bằng nút trên dashboard Vercel).
