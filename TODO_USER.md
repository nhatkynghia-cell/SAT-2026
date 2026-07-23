# ✅ TODO USER — Việc cần bạn giải quyết (Claude không tự làm được)

> Cập nhật 2026-07-20 (sau multi-agent audit + vá 15 finding). Code-side audit blockers đã đóng; còn credential/SQL blocker.

> **🖥️ BẢN LÀM VIỆC = ổ C:** `C:/Users/DELL/Desktop/SAT_Rescue 17.7/SAT_Rescue/0.SAT.Guru 2026/10.SAT_Prep_App 30.6/10.SAT_Prep_App 30.6/10.SAT_Prep_App/10.SAT_Prep_App/sat-prep-web`
> Đã verify: tsc sạch · lint 0 · **test 513/513** · build 79 pages.

> **🚀 DEPLOY:** prod https://sat-2026.vercel.app đang LIVE ở `da0b370` (BẢN CŨ, chưa có Stripe). Code Stripe đã commit local `ed982f5` nhánh `feat/stripe-payment-migration` — CHƯA push, nên prod chưa có Stripe.

> **▶️ KHỞI ĐỘNG:** bấm đúp `KhoiDong-App.bat` (root) → http://localhost:3000. App chiến lược: `KhoiDong-ChienLuoc.bat`. Account test: `truongsonht.xd@gmail.com` / `Nghia@123` (có thể đã đổi → "Quên mật khẩu" trên /login).

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

## 🔴 NHÓM 1D — CAO: SQL/RLS blocker do audit 2026-07-20 nêu

- [ ] **RLS `ai_chat_cache`** (bảng dùng chung, hiện `authenticated using(true)` — cần review policy production).
- [ ] **RPC atomic spin/economy**: đã có code + fallback non-atomic, cần chạy migration SQL (`quest_claim_atomic.sql`, `migration_exam_economy_atomic.sql`) để khóa dòng tránh double-grant.
- [ ] **Rate-limit store bền vững**: hiện in-memory, reset theo process serverless → cần Redis/edge-config/DB.
- [ ] **ROOT E `p_user_id` guard** tường minh trong RPC (chống user A tác động economy user B).
- [ ] **Test sandbox MoMo thật**: đối chiếu field-order chữ ký IPN MoMo với payload sample thật (điểm dễ sai nhất).

## 🔴 NHÓM 1C — CAO: hạ tầng

- [ ] **chkdsk F:** `chkdsk F: /f /r` (quyền admin, dismount ổ, chạy khi khởi động, lâu). Sửa bad sector đã làm build gãy EIO. Hoặc bỏ hẳn F:, dùng C:.

---

## 🟡 NHÓM 2 — TRUNG BÌNH: hạ tầng deploy

- [ ] Migration cột `pvp_*` trên prod (nếu muốn mở PvP; chưa có → route economy PvP trả 503 fail-safe, không lỗi).
- [ ] Verify cron `settle-speed-quiz` (`vercel.json`: `7 17 * * *`) có bảo vệ + bảng `speed_quiz` đã migrate.
- [ ] **OAuth Google** (Nhóm 3 cũ): tạo Client Google Cloud + bật Supabase Provider + Redirect URLs. Xem `OAUTH_SETUP.md`. Code sẵn, nút tự hiện khi bật.

## 🟡 NHÓM 3 — TRUNG BÌNH: tính năng/conversion (đã làm phần lớn 2026-07-19/20)

- [x] **Nhóm A** switch model AI theo tier + gỡ hứa A2/A3/A4 ở /upgrade — XONG.
- [x] **Nhóm B** gate Free tầng API /api/generate-practice — XONG (canGeneratePracticeForTier).
- [x] **C4** mất dữ liệu diagnostic khi login muộn — XONG (auth-gate diagnostic + login_required phase).
- [x] **Cụm CTA C5–C8** + paywall `from/unlock` — XONG.
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
- [ ] **Test coverage / technical debt (audit 2026-07-20 nêu)**: integration test diagnostic→practice→grade→mastery delta; edge cases economy/payment gate/quota; E2E mobile navigation/paywall/real-exams gate.
- [ ] Roadmap Phase 3/4 (mobile, social, B2B...) — sau beta.

---

## ✅ ĐÃ XONG PHIÊN 2026-07-20 (multi-agent audit + vá)

- 15 finding verify-true đã vá (MoMo HTTP-check, admin JSON 400, AITutoring error states, auth-session stub fail-closed, grade không tin streak client, diagnostic complete yêu cầu đủ câu, MistakeNotebook retry, generate-practice/gate src=gate + 503 khi issue fail, gate-exam ràng buộc questionIds, golden_hour giấu explanation đến sau nộp).
- Verify: test 513/513 · lint 0 · build 79 pages · tsc sạch.
- Tài liệu/dashboard: `docs/pre-deploy-strategy-dashboard.html`, `KhoiDong-App.bat`, `KhoiDong-ChienLuoc.bat`.
- Chi tiết: memory Claude `full-audit-fix-2026-07-20`.

*Danh sách đầy đủ + chi tiết file/dòng: xem `HANDOFF_2026-07-17.md` + block "AUDIT 2026-07-20" trong `memory.md`.*
