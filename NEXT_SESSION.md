# ▶️ CÂU LỆNH KHỞI ĐỘNG PHIÊN SAU

> Cập nhật 2026-07-20 (sau multi-agent audit + vá 15 finding verify-true). Baseline mới: tsc sạch · test **513/513** · lint 0/0 · build **79 pages**. Code-side audit blockers đã đóng; còn credential/SQL blocker cho user.

Copy nguyên khối dưới đây, dán vào ô chat để mở phiên mới:

---

```
Đọc memory.md + master_task_list.md trong
C:/Users/DELL/Desktop/SAT_Rescue 17.7/SAT_Rescue/0.SAT.Guru 2026/10.SAT_Prep_App 30.6/10.SAT_Prep_App 30.6/10.SAT_Prep_App/10.SAT_Prep_App/
rồi tiếp tục dự án. Trả lời tiếng Việt. Code/comment mới bằng tiếng Việt, không viết chữ Hán.

Trước khi làm gì: verify môi trường (tsc + test + build + lint) trong sat-prep-web/.
Baseline mong đợi: tsc sạch · test 513/513 · lint 0/0 · build 79 pages.

Khởi động app: bấm đúp KhoiDong-App.bat (root SAT_Rescue 17.7/) → http://localhost:3000.
App chiến lược: bấm đúp KhoiDong-ChienLuoc.bat → mở app_chien_luoc.html.
Dashboard HTML chiến lược: docs/pre-deploy-strategy-dashboard.html (trong sat-prep-web/).

Token đã lưu: ~/.gitcreds-sat2026 (git push — format file = "https://user:token@github.com",
push phải GHÉP "/nhatkynghia-cell/SAT-2026.git" vào cuối) + ~/.vercel-token (Vercel API).
Team Vercel: sat-2027 | project: sat-2026 | app prod: https://sat-2026.vercel.app
Repo: github.com/nhatkynghia-cell/SAT-2026 (main). Account test: truongsonht.xd@gmail.com / Nghia@123 (UUID c43f015e-...; có thể đã đổi → "Quên mật khẩu" trên /login).
DB direct: postgresql://postgres:SatPrep2026@db.yynszcfqcvbnuvguwtfy.supabase.co:5432/postgres
Service-role: trong .env.local + Vercel (sensitive) — KHÔNG ghi vào git.
Cài SQL/verify: npm i pg --no-save --legacy-peer-deps (đặt script TRONG sat-prep-web/, KHÔNG /tmp).

✅ PHIÊN 2026-07-20 ĐÃ LÀM: multi-agent audit (31 agent) → 15 finding verify-true đã vá:
   MoMo HTTP-check, admin JSON 400, AITutoring error states, auth-session stub fail-closed,
   grade không tin streak client, diagnostic complete yêu cầu đủ câu, MistakeNotebook retry,
   generate-practice/gate gắn src=gate + 503 khi issue fail, gate-exam ràng buộc questionIds,
   golden_hour/AITutoring giấu explanation đến sau nộp. Verify: test 513/513 + lint + build pass.
   Chi tiết: memory Claude `full-audit-fix-2026-07-20` + block "AUDIT 2026-07-20" memory.md.

SECRET chưa rotate (HỎI tôi đã đổi chưa rồi TICK):
[ ] GitHub PAT ghp_...HETIG (lộ ảnh)  [ ] Vercel token (lộ chat)  [x] OpenAI key  [x] DB password
Nếu đã đổi git/vercel token → token cũ HẾT hiệu lực → xin token MỚI lưu lại.

VIỆC PHIÊN SAU — theo THỨ TỰ (chi tiết ở TODO_USER.md + NEXT_SESSION.md mục dưới):
1. 🔴 STRIPE lên prod (chặn bán gói): push nhánh feat/stripe-payment-migration + cấp Stripe test keys
   (sk_test_/pk_test_/whsec_) + chạy migration_stripe_gateway.sql (CHECK gateway thêm 'stripe').
2. 🟡 SQL/RLS: RLS ai_chat_cache + RPC atomic spin/economy + rate-limit store bền vững + ROOT E p_user_id guard.
3. 🟡 Rotate SAT_PREP_SECRET (lộ ảnh) + re-ký HMAC streak dữ liệu cũ.
4. ⏳ Beta 100 users (pháp lý trẻ vị thành niên + tuyển).

Việc user-side tôi đã làm trước phiên: [điền: đã rotate secret nào? / cấp Stripe keys? / chạy migration nào?]
```

---

## 🔴 VIỆC CỦA TÔI (USER) — quyết ĐẦU PHIÊN, Claude KHÔNG tự làm được

### 1️⃣ CỔNG THANH TOÁN VNPay + MoMo — khung xong `55ff53b`, chỉ thiếu 2 đầu vào của tôi
- **(a) Chốt giá 4 gói** (đang placeholder): Premium tháng **99k** / Premium năm **990k** /
  Ultimate tháng **199k** / Ultimate năm **1990k** VND → giữ hay đổi số nào?
- **(b) Creds sandbox** (lấy ở trang merchant → dán cho Claude hoặc tự thêm `.env.local`+Vercel sensitive):
  - VNPay: `VNPAY_TMN_CODE` + `VNPAY_HASH_SECRET`
  - MoMo: `MOMO_PARTNER_CODE` + `MOMO_ACCESS_KEY` + `MOMO_SECRET_KEY`
- **Có 2 thứ này → Claude:** nạp env → verify roundtrip live (tạo đơn → redirect cổng →
  IPN cấp gói) + **đối chiếu field-order chữ ký IPN MoMo với payload thật** (unit test đã
  phủ theo spec v2 nhưng chưa có sample IPN thật — điểm dễ sai nhất). VNPay dùng lib nên yên tâm.

### 2️⃣ ADMIN FULFILLMENT (đánh dấu phiếu quà pending→fulfilled) — tôi CHỌN 1 hướng
- **(a) Shared-secret env nhẹ** (`ADMIN_SECRET` bảo vệ 1 route) — nhanh, đủ beta.
  👉 Chọn cái này → **Claude làm NGAY trong phiên, KHÔNG cần gì thêm từ tôi.**
- **(b) Role system đầy đủ** (cột role + RLS admin) — chuẩn dài hạn, nặng hơn.
  💡 Parent Dashboard vừa làm đã có pattern service-role đọc/ghi cross-user → tái dụng ý tưởng được.

### 3️⃣ ROTATE 3 SECRET còn lại (đã LỘ) — tôi làm trên dashboard
- [ ] GitHub PAT `ghp_...HETIG` → Delete + tạo mới → gửi Claude lưu `~/.gitcreds-sat2026`
- [ ] Vercel token `vcp_...` → xóa + tạo mới → gửi Claude lưu `~/.vercel-token`
- [ ] OpenAI key → thu hồi + tạo mới + cập nhật biến `OPENAI_API_KEY` trên Vercel
- [x] DB password Supabase — ĐÃ ĐỔI ✅

### 4️⃣ BETA LAUNCH 100 users — tôi chuẩn bị (không phải việc code)
- Pháp lý điều khoản trẻ vị thành niên + kênh tuyển user.

---

## 🟢 VIỆC CLAUDE TỰ LÀM ĐƯỢC (không chờ tôi) — nếu tôi chưa sẵn đầu vào trên
1. **[nếu tôi chọn admin hướng (a)]** Admin fulfillment route shared-secret — gọn 1 phiên.
2. Đánh bóng UI 3 feature mới (Diagnostic + Parent + panel xu hướng tuần) trên nhiều kích thước màn hình.
3. ✅ ~~Panel "xu hướng tuần" cho học sinh ở `/dashboard`~~ — ĐÃ LÀM (2026-07-05, `27651d8`):
   tách `WeeklyTrendPanel` dùng chung dashboard + ParentReport, route `/api/progress/weekly`.
4. ✅ ~~Integration test 9.8~~ — ĐÃ LÀM (2026-07-05, `a9348d6`+`9ef2e69`+`8c791e8`): 61 test/8 file
   trong `sat-prep-web/src/test-int/` (harness fake Supabase in-memory + resolve-hook loader).
   Đường mở rộng nếu muốn: thêm test rate-limit cho grade/economy (redeem đã có); còn lại giá-trị-giảm-dần.

---

## 📊 ĐỐI CHIẾU KẾ HOẠCH (sau phiên 2026-07-05)

### PHASE 2 — MVP LAUNCH
| Việc | Trạng thái |
|---|---|
| Tier foundation | ✅ `fd4d877` |
| Reward-to-real (xu→quà) | ✅ `acf2729` |
| Cổng thanh toán VNPay/MoMo (khung) | ✅ `55ff53b` — **verify live CHỜ creds+giá của tôi** |
| **Diagnostic Onboarding** | ✅ `df0a10e` (2026-07-05) |
| **Parent Dashboard** | ✅ `9fb1d46` (2026-07-05) |
| Admin fulfillment | ⏳ **CHỜ tôi chọn hướng (a/b)** |
| Beta 100 users | ⏳ chờ pháp lý + tuyển |

### ĐÃ ĐÓNG HOÀN TOÀN (nền + bảo mật)
- Phase 1 + 1.5 TRỌN · ROOT A–E + rate-limit + ROOT E step2 revoke (BLOCKER #1 đóng)
- Integration Sprint T1–T5 + Tower adaptive + PvP economy + Nhóm 7 (#6/#8/#9)
- **Integration test 9.8** ✅ (2026-07-05) — 61 test/8 file, mọi bề mặt tiền, CI offline
- **Route legacy `/api/migrate-data`** ✅ khoá 4 lớp (2026-07-05) — hết vector faucet xu

### PHASE 3+ (chưa bắt đầu)
- Mobile (React Native) · Social/Retention · Real PvP WebSocket · Season Pass · B2B/ACT/IELTS/Fundraising

---

## 🔧 Ghi chú kỹ thuật (nhớ trước khi code)
- **AGENTS.md:** Next.js 16 BIẾN ĐỔI (Turbopack, `proxy.ts` thay middleware) — đọc `node_modules/next/dist/docs/` khi nghi API.
- **Bảng prod đã tạo (Claude qua direct pg — user KHÔNG cần chạy SQL):** user_subscriptions,
  reward_redemptions, payment_transactions, **parent_share_codes, daily_snapshots** (mới phiên này).
  Tất cả RLS SELECT own + ghi service-role.
- **MUST-VERIFY khi có creds:** field-order chữ ký IPN MoMo (`payment-momo.ts`) với payload thật.
- **Money/cross-user surface — nguyên tắc:** client gửi ý định, SERVER quyết số liệu; ghi chỉ
  service-role; RPC atomic idempotent. Parent Dashboard: cross-user read gom vào `parent-report-store.ts` (chỉ tiến độ, không PII).
- **Bug deploy Vercel:** `NEXT_PUBLIC_*` env PHẢI `plain` không `sensitive`. SERVICE_ROLE_KEY + creds cổng = sensitive.
- **⚠️ Verify browser:** `preview_fill` set DOM value KHÔNG trigger React onChange → login form
  controlled-input không submit giá trị. Đường no-auth verify được không cần login; đường cần auth
  → seed pg + kiểm logic 401. (Nếu cần login browser thật: tìm cách set state qua devtools/API.)
- **Test lib thuần:** `node --test` KHÔNG resolve alias `@/` lẫn value-import extensionless `./x` →
  module thuần đọc JSON qua fs, inline hằng số thay vì import value, import type `.ts` đường tương đối.
- **⭐ Integration test ROUTE (harness mới `src/test-int/`):** muốn test THẬT 1 route (chạy handler +
  store + logic, không mock reimplement) → dùng `loader.mjs` (resolve-hook remap `@/`→`src/` + stub
  `next/server`/`server-only`/`@/lib/supabase/{server,admin}`→`fake-db.mjs`). Viết `*.test.mjs`, `npm test`
  tự chạy. `fake-db.mjs` mô phỏng query-builder + RPC atomic, **deep-clone mọi ranh giới** (giống PostgREST).
  Điều khiển qua `harness.mjs`: `resetDb/setCurrentUser/seed/getRows/disableRpc/markMissingColumns`.
  ⚠️ Fake single-threaded → KHÔNG test được race đồng thời (verify riêng SQL/live). Chi tiết: `test-int/README.md`.
- **`vnpay@2.5.0`** trong package.json (`--legacy-peer-deps`, react 19). `pg` KHÔNG trong lock (cài `--no-save`).
