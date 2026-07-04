# ▶️ CÂU LỆNH KHỞI ĐỘNG PHIÊN SAU

Copy nguyên khối dưới đây, dán vào ô chat để mở phiên mới:

---

```
Đọc memory.md, master_task_list.md trong
D:\10.SAT_Prep_App 30.6\10.SAT_Prep_App 30.6\10.SAT_Prep_App\10.SAT_Prep_App\
rồi tiếp tục dự án. Đọc block "PHASE 2 — BƯỚC 2 CỔNG THANH TOÁN (KHUNG)" và
"BƯỚC 3 REWARD-TO-REAL" trong memory.md. Trả lời tiếng Việt.

Trước khi làm gì: export PATH="$PATH:/c/Program Files/nodejs" rồi verify môi trường
(tsc + test + build + lint) trong sat-prep-web/. Baseline mong đợi:
tsc sạch · test 149/149 · lint 0/0 · build 53 pages. origin/main = 29081b2.

Token đã lưu: ~/.gitcreds-sat2026 (git push/GitHub API) + ~/.vercel-token (Vercel API).
Team Vercel: sat-2027 | project: sat-2026 | app prod: https://sat-2026.vercel.app
Repo: github.com/nhatkynghia-cell/SAT-2026 (main). Account test: truongsonht.xd@gmail.com / Nghia@123
DB direct: postgresql://postgres:SatPrep2026@db.yynszcfqcvbnuvguwtfy.supabase.co:5432/postgres
Service-role: trong .env.local + Vercel (sensitive) — KHÔNG ghi vào git
Cài SQL trực tiếp: pg module cài `npm i pg --no-save --legacy-peer-deps` (KHÔNG vào package.json).

✅ ĐÃ ĐÓNG HẾT BLOCKER BẢO MẬT — ROOT A–E + rate-limit. ROOT E step2 revoke ĐÃ CHẠY
2026-07-05 (browser PATCH user_economy.coins → 403). KHÔNG còn việc bảo mật tồn đọng.

SECRET chưa rotate (defer — tôi chọn để sau; HỎI tôi đã đổi chưa rồi TICK):
[ ] GitHub PAT ghp_...HETIG (lộ ảnh)
[ ] Vercel token (lộ chat)
[ ] OpenAI key (trong .anv ROOT + Vercel)
[x] DB password (đã reset SatPrep2026 ngày 2026-07-03)
Nếu đã đổi git/vercel token → token cũ trong ~/.gitcreds-sat2026 / ~/.vercel-token HẾT hiệu lực → xin token MỚI lưu lại.

VIỆC PHIÊN SAU — theo THỨ TỰ:
1. 🟡 HOÀN TẤT CỔNG THANH TOÁN (khung đã xong `55ff53b`) — CẦN TÔI cung cấp:
   a. CHỐT GIÁ 4 gói (hiện placeholder: premium 99k/990k, ultimate 199k/1990k VND)
   b. Credentials sandbox/merchant: VNPay (TMN_CODE + HASH_SECRET) + MoMo
      (PARTNER_CODE + ACCESS_KEY + SECRET_KEY) → set vào .env.local + Vercel (sensitive)
   Khi có creds → Claude verify ROUNDTRIP THẬT (redirect cổng → thanh toán sandbox →
   IPN cấp gói) + XÁC NHẬN field-order chữ ký IPN MoMo (unit test đã phủ theo spec v2,
   nhưng CHƯA đối chiếu payload IPN thật — đây là điểm dễ sai nhất, PHẢI verify).
2. 🟢 ADMIN FULFILLMENT (đánh dấu phiếu quà/giao dịch pending→fulfilled) — CHẶN bởi
   quyết định role system (§9.3 chưa có). Cần tôi chọn: (a) xây role system đầy đủ,
   hay (b) shared-secret env nhẹ cho 1 route admin. KHÔNG tự làm endpoint ghi money
   surface không auth.
3. ⏳ Sau thanh toán: Parent Dashboard + Diagnostic Onboarding + Beta 100 users.

⚠️ GIỚI HẠN NGỮ CẢNH ~85%: khi tới → DỪNG, cập nhật memory + commit + push.

Việc user-side tôi đã làm: [điền: chốt giá + cấp creds cổng chưa / rotate secret nào]
```

---

## 📋 ĐỐI CHIẾU KẾ HOẠCH (trạng thái sau phiên 2026-07-04→05)

### ĐÃ ĐÓNG HOÀN TOÀN
- [x] Phase 1 + 1.5 TRỌN (Persistence, Auth, RLS, Deploy, CI)
- [x] ROOT A–D + Rate-limit (audit bảo mật 2026-07-03)
- [x] **ROOT A REWARD HOLE** + choice_analysis leak (2026-07-04, b226269/a31abb6)
- [x] **ĐƯỜNG THI (exam path)** server-side grading (2026-07-04, `a4e57c3`)
- [x] **ROOT E step2 REVOKE** — đóng BLOCKER #1 (2026-07-05, `29081b2`). Browser PATCH
      user_economy.coins bằng JWT test user → 403 (42501). Cửa hậu bơm xu qua REST ĐÓNG.
      → **TẤT CẢ BLOCKER MONEY/ANTI-CHEAT ĐÓNG HOÀN TOÀN.**
- [x] **PHASE 2 BƯỚC 1 — TIER FOUNDATION** (2026-07-04, `fd4d877`)
- [x] **PHASE 2 BƯỚC 3 — REWARD-TO-REAL** (2026-07-04, `acf2729`+`59487ab`): xu→quà thật,
      RPC atomic redeem_reward (chống double-spend race verify live), UI shop + lịch sử phiếu.
- [x] **PHASE 2 BƯỚC 2 — CỔNG THANH TOÁN (KHUNG)** (2026-07-04, `55ff53b`): lib payment +
      MoMo HMAC-SHA256 tự viết + wrapper lib vnpay (SHA512) + payment_transactions + RPC
      atomic confirm_payment (idempotent + race chống double-grant verify live) + 4 route +
      UI /upgrade. Verify no-creds đầy đủ; roundtrip live CHỜ creds.
- [x] Integration Sprint T1–T5 + Tower adaptive + PvP economy + Nhóm 7 (#6/#8/#9)

### PHASE 2 — MVP LAUNCH (còn lại)
- [ ] **Cổng thanh toán — verify roundtrip LIVE** (CẦN user: creds + chốt giá)
- [ ] **Admin fulfillment** (CẦN user: quyết role system)
- [ ] Parent Dashboard
- [ ] Diagnostic Onboarding
- [ ] Beta Launch 100 users

### PHASE 3+ (plan sẵn, chưa bắt đầu)
- Mobile App (React Native) · Social & Retention · Real PvP (WebSocket)
- Season Pass, Story Mode · B2B Licensing, ACT/IELTS, Fundraising

---

## Ghi chú kỹ thuật

- **HEAD:** `29081b2` (phiên 2026-07-04→05: reward-to-real `acf2729`/`59487ab` + payment
  gateway khung `55ff53b` + ROOT E step2 `29081b2` + docs). Push GitHub, tree sạch.
- **Baseline:** tsc sạch · test **149/149** · lint 0/0 · build **53 pages**.
- **Bảng mới trên prod DB (Claude đã tạo qua direct pg — user KHÔNG cần chạy SQL):**
  `user_subscriptions`, `reward_redemptions`, `payment_transactions` (đều RLS SELECT-only,
  ghi chỉ service-role) + RPC `redeem_reward` + `confirm_payment` (atomic FOR UPDATE).
- **⚠️ GIÁ PLANS là PLACEHOLDER** (premium 99k/990k, ultimate 199k/1990k VND) — CHỐT trước khi cổng nhận tiền thật.
- **⚠️ MUST-VERIFY khi có creds:** field-order chữ ký IPN MoMo (`payment-momo.ts buildMomoIpnRawSignature`)
  — làm theo spec v2 đã biết, chưa đối chiếu payload IPN thật. VNPay dùng lib nên đã yên tâm.
- **Env cổng thanh toán (server-only, .env.example đã có mẫu):** VNPAY_TMN_CODE/HASH_SECRET/HOST,
  MOMO_PARTNER_CODE/ACCESS_KEY/SECRET_KEY/CREATE_URL, APP_BASE_URL. Thiếu → route 503, KHÔNG crash.
- **Money surface — nguyên tắc:** client gửi ý định, SERVER quyết số tiền (từ PLANS/REWARDS);
  chỉ IPN server-to-server đã verify chữ ký mới cấp gói; RPC atomic idempotent chống double-grant/spend.
- **`vnpay@2.5.0`** trong package.json (cài `--legacy-peer-deps` vì react 19). Dùng enum
  `HashAlgorithm.SHA512` (không phải string). `pg` KHÔNG trong package.json (cài `--no-save` khi cần chạy SQL).
- **Bug deploy Vercel (nhớ):** `NEXT_PUBLIC_*` env PHẢI `plain` không `sensitive`. SERVICE_ROLE_KEY + creds cổng = sensitive.
- **Verify pattern:** dev server (preview_start "sat-prep-web", port 3000) → login browser account
  test → prod Supabase chung. Dọn sạch test data + temp script sau verify. RPC/money verify được
  headless qua service-role (không cần browser) — dùng khi :3000 bận.
- **AGENTS.md:** đây là Next.js 16 BIẾN ĐỔI (Turbopack, proxy.ts thay middleware) — đọc
  node_modules/next/dist/docs/ khi nghi ngờ API.
