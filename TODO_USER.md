# ✅ TODO USER — Việc cần bạn giải quyết (Claude không tự làm được)

> Cập nhật 2026-07-17. Đánh dấu `[x]` khi xong. Gửi được creds/token cho Claude thì Claude wire vào ngay.

> **🖥️ BẢN LÀM VIỆC MỚI = ổ C:** (ổ F: bad sector, build gãy EIO).
> `C:/Users/DELL/Desktop/SAT_Rescue 17.7/SAT_Rescue/0.SAT.Guru 2026/10.SAT_Prep_App 30.6/10.SAT_Prep_App 30.6/10.SAT_Prep_App/10.SAT_Prep_App/sat-prep-web`
> Bản C: có `.git`, đã verify: tsc sạch · lint 0 · test 498/498 · build 79 pages.

> **🚀 DEPLOY:** prod https://sat-2026.vercel.app đang LIVE ở `da0b370` (BẢN CŨ, chưa có Stripe). Code Stripe đã commit local `ed982f5` nhánh `feat/stripe-payment-migration` — CHƯA push, nên prod chưa có Stripe.

---

## 🔴 NHÓM 1 — CAO: đưa Stripe lên prod (chặn bán gói)

- [ ] **Push nhánh Stripe** `feat/stripe-payment-migration` (commit `ed982f5`) lên GitHub → backup + Vercel git auto-deploy build bản Stripe. (Claude push được nếu bạn đồng ý — cần credential.)
- [ ] **Cấp Stripe test keys** (chưa có key nào trong `.env.local` → `/api/payment/create` trả 503, thanh toán chết):
  → dashboard.stripe.com/test/apikeys lấy `sk_test_` + `pk_test_`
  → tạo webhook endpoint `https://sat-2026.vercel.app/api/payment/stripe-webhook` nghe `checkout.session.completed` → lấy `whsec_`
  → gửi Claude (wire `.env.local` + verify roundtrip card `4242 4242 4242 4242`) hoặc tự thêm vào Vercel env (sensitive)
- [ ] **Chạy migration `migration_stripe_gateway.sql`** trên Supabase SQL Editor (mở CHECK gateway thêm 'stripe'; chưa chạy → gateway='stripe' vỡ lỗi 23514 dù đã trả tiền).
- [ ] **Đồng bộ env server-only sang Vercel** khi deploy: `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `SAT_PREP_SECRET`, `ADMIN_SECRET`, `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, bộ `STRIPE_*`, `APP_BASE_URL=https://sat-2026.vercel.app`. (VERCEL_OIDC_TOKEN là token dev tạm, KHÔNG copy.)

## 🔴 NHÓM 1B — CAO: bảo mật secret đã lộ

- [ ] **Rotate `SAT_PREP_SECRET`** (lộ ảnh 06-29). Tạo chuỗi random mới → `.env.local` + Vercel. ⚠️ Đây là HMAC ký streak → đổi xong PHẢI re-ký dữ liệu cũ (Claude hỗ trợ script).
- [ ] **Xóa GitHub PAT cũ** `ghp_...HETIG` (github.com → Settings → Developer settings → PAT → Delete).
- [ ] **Xóa Vercel token cũ** `vcp_...` đã lộ trong chat (vercel.com → Account Settings → Tokens). Không còn cần cho deploy.
- [x] **Rotate OpenAI key — XONG 2026-07-14.** Đã wire prod + verify sống.
- [x] DB password Supabase — ĐÃ đổi.

## 🔴 NHÓM 1C — CAO: hạ tầng

- [ ] **chkdsk F:** `chkdsk F: /f /r` (quyền admin, dismount ổ, chạy khi khởi động, lâu). Sửa bad sector đã làm build gãy EIO. Hoặc bỏ hẳn F:, dùng C:.

---

## 🟡 NHÓM 2 — TRUNG BÌNH: hạ tầng deploy

- [ ] Migration cột `pvp_*` trên prod (nếu muốn mở PvP; chưa có → route economy PvP trả 503 fail-safe, không lỗi).
- [ ] Verify cron `settle-speed-quiz` (`vercel.json`: `7 17 * * *`) có bảo vệ + bảng `speed_quiz` đã migrate.
- [ ] **OAuth Google** (Nhóm 3 cũ): tạo Client Google Cloud + bật Supabase Provider + Redirect URLs. Xem `OAUTH_SETUP.md`. Code sẵn, nút tự hiện khi bật.

## 🟡 NHÓM 3 — TRUNG BÌNH: tính năng/conversion (Claude làm được, cần bạn chốt)

- [ ] **Nhóm A** (đã QUYẾT 2026-07-07): switch model AI cao cấp theo tier (Ultimate hiện vẫn `gpt-4o-mini`) + gỡ 3 dòng hứa A2/A3/A4 ở `/upgrade`. → Claude làm ngay khi bạn OK.
- [ ] **Nhóm B**: đóng gate Free ở tầng API `/api/generate-practice` (free đang dựng request tay luyện chương khóa).
- [ ] **C4**: mất dữ liệu diagnostic khi khách login muộn — chốt hướng (khuyến nghị ép login trước diagnostic).
- [ ] **Cụm CTA C5–C8**: skill-tree "mở khóa chương", real-exams redirect, AI quota "còn N lượt", empty dashboard CTA.
- [ ] **Affiliate 35%** (KOL 25% + giảm 10%): thiết kế xong, chưa code (bảng + discount + hoa hồng webhook).
- [ ] **Giải Top-5 toàn quốc**: nghiên cứu tiêu chí chống gian lận + build.

## 🟡 NHÓM 4 — BETA LAUNCH 100 users

- [ ] Pháp lý: điều khoản sử dụng cho trẻ vị thành niên.
- [ ] Kênh tuyển user beta.

---

## 🟢 THẤP — dọn dẹp / tương lai / verify

- [ ] Chốt giá 4 gói cuối (499k/3.99tr · 990k/7.99tr — CLtinhchinh còn để ngỏ Ultimate).
- [ ] OAuth Facebook (tùy chọn).
- [ ] Bật lại VNPay/MoMo (đã disable giữ code; cần pháp nhân doanh nghiệp lấy creds).
- [ ] Wave 2: cap PvP/tower theo tier.
- [ ] Dọn nhánh git rác (lane-a/b/c WIP — destructive, cần bạn duyệt) + thống nhất bản C:/F:.
- [ ] Gỡ route legacy `/api/migrate-data` + file JSON cũ trước prod.
- [ ] Dọn comment lỗi thời (subscription.ts:8, auth.ts:8-13); ROOT E #3 `p_user_id` tường minh.
- [ ] **Verify (có thể đã lỗi thời)**: mastery tracking luồng luyện thường · anti-cheat economy cutover (client còn tính coins?) · skill-tree/base-stats UI · click-verify UI /admin/redemptions.
- [ ] Roadmap Phase 3/4 (mobile, social, B2B...) — sau beta.

---

*Danh sách đầy đủ 33 mục + chi tiết file/dòng: xem `HANDOFF_2026-07-17.md`.*
