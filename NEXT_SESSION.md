# ▶️ CÂU LỆNH KHỞI ĐỘNG PHIÊN SAU

Copy nguyên khối dưới đây, dán vào ô chat để mở phiên mới:

---

```
Đọc memory.md, master_task_list.md trong
D:\10.SAT_Prep_App 30.6\10.SAT_Prep_App 30.6\10.SAT_Prep_App\10.SAT_Prep_App\
rồi tiếp tục dự án. Đọc block "💳 PHASE 2 — TIER FOUNDATION" và "ĐƯỜNG THI ĐÃ VÁ" trong memory.md.

Trước khi làm gì: export PATH="$PATH:/c/Program Files/nodejs" rồi verify môi trường
(tsc + test + build + lint) trong sat-prep-web/. Baseline mong đợi:
tsc sạch · test 134/134 · lint 0/0 · build 47 pages. origin/main = 8ebce50.

Token đã lưu: ~/.gitcreds-sat2026 (git push/GitHub API) + ~/.vercel-token (Vercel API).
Team Vercel: sat-2027 | project: sat-2026 | app prod: https://sat-2026.vercel.app
Repo: github.com/nhatkynghia-cell/SAT-2026 (main). Account test: truongsonht.xd@gmail.com / Nghia@123
DB direct: postgresql://postgres:SatPrep2026@db.yynszcfqcvbnuvguwtfy.supabase.co:5432/postgres
Service-role: trong .env.local + Vercel (sensitive) — KHÔNG ghi vào git

ROOT E STEP2 — hỏi tôi đã chạy root_e_step2_revoke.sql chưa:
- Nếu ĐÃ CHẠY → verify browser PATCH user_economy.coins → 403 → ghi memory ROOT E đóng hoàn toàn
- Nếu CHƯA (đã qua 2026-07-05) → nhắc tôi chạy NGAY (file sẵn trong sat-prep-web/)
- Nếu CHƯA tới 2026-07-05 → bỏ qua, tiếp việc khác

SECRET chưa rotate (defer — tôi chọn để sau):
[ ] GitHub PAT ghp_...HETIG (lộ ảnh)
[ ] Vercel token (lộ chat)
[ ] OpenAI key (trong .anv ROOT + Vercel)
[x] DB password (đã reset SatPrep2026 ngày 2026-07-03)
Nếu đã đổi git/vercel token → xin token MỚI lưu lại.

VIỆC PHIÊN SAU — theo THỨ TỰ:
1. 🟡 PHASE 2 BƯỚC 2 — CỔNG THANH TOÁN (VNPay + MoMo). CẦN TÔI cung cấp trước:
   a. CHỐT GIÁ 4 gói (hiện placeholder: premium 99k/990k, ultimate 199k/1990k VND)
   b. Credentials sandbox/merchant VNPay + MoMo (không có → KHÔNG verify live được)
   Kế hoạch: payment-create (giá lấy từ PLANS server-side) → redirect cổng →
   webhook IDEMPOTENT (verify chữ ký server-side, dedupe txn id) → gọi
   grantSubscription() khi thành công. Nên thêm bảng payment_transactions.
   Chi tiết trong memory Claude "sat-prep-phase2-payments.md".
2. 🟢 PHASE 2 BƯỚC 3 — REWARD-TO-REAL (xu → quà) — ĐỘC LẬP, KHÔNG cần credentials,
   làm được ngay nếu chưa có creds cổng: redeem voucher 50000 xu (đã có trong shop
   GamificationContext.tsx:39) qua applySpend server-side + bản ghi fulfillment.
3. ⏳ Sau thanh toán: Parent Dashboard + Diagnostic Onboarding + Beta 100 users

⚠️ GIỚI HẠN NGỮ CẢNH ~85%: khi tới → DỪNG, cập nhật memory + commit + push.

Việc user-side tôi đã làm: [điền: đã chạy step2 chưa / rotate secret nào / chốt giá + cấp creds cổng chưa]
```

---

## 📋 ĐỐI CHIẾU KẾ HOẠCH (trạng thái sau phiên 2026-07-04)

### ĐÃ ĐÓNG HOÀN TOÀN
- [x] Phase 1 + 1.5 TRỌN (Persistence, Auth, RLS, Deploy, CI)
- [x] ROOT A–D + Rate-limit (audit bảo mật 2026-07-03)
- [x] **ROOT A REWARD HOLE** — thưởng luyện tập + choice_analysis leak (2026-07-04, b226269/a31abb6)
- [x] **ĐƯỜNG THI (exam path)** — server-side grading, đóng faucet cuối (2026-07-04, `a4e57c3`).
      Mọi bề mặt tiền giờ chấm server-side, KHÔNG chỗ nào client tự khai isCorrect/correctCount.
- [x] **PHASE 2 BƯỚC 1 — TIER FOUNDATION** (2026-07-04, `fd4d877`): subscription.ts +
      subscription-store.ts (getUserTier) + user_subscriptions.sql (RLS SELECT-only) +
      wire chat/generate-practice. Gate AI quota (free=5/ngày, paid=unlimited).
- [x] Integration Sprint T1–T5 + Tower adaptive + PvP economy + Nhóm 7 (#6/#8/#9)

### CÒN LẠI NGẮN
- [ ] root_e_step2_revoke.sql → verify PATCH→403 (chờ soak, ≥2026-07-05)

### PHASE 2 — MVP LAUNCH (việc chính phiên sau)
- [ ] **Cổng thanh toán VNPay + MoMo** (bước 2 — CẦN user chốt giá + cấp credentials)
- [ ] **Reward-to-real** (bước 3 — độc lập, làm được ngay)
- [ ] Parent Dashboard
- [ ] Diagnostic Onboarding
- [ ] Beta Launch 100 users

### PHASE 3+ (plan sẵn, chưa bắt đầu)
- Mobile App (React Native) · Social & Retention · Real PvP (WebSocket)
- Season Pass, Story Mode · B2B Licensing, ACT/IELTS, Fundraising

---

## Ghi chú kỹ thuật

- **HEAD:** `8ebce50` (phiên 2026-07-04: exam-path fix `a4e57c3` + tier foundation `fd4d877` + 2 docs). Push GitHub, tree sạch.
- **Baseline:** tsc sạch · test **134/134** · lint 0/0 · build **47 pages**.
- **Bảng mới trên prod DB (Claude đã tạo qua direct pg — user KHÔNG cần chạy SQL):**
  `user_subscriptions` (idempotent, RLS SELECT-only, INERT vì chưa route nào GHI).
- **⚠️ GIÁ PLANS là PLACEHOLDER** (premium 99k/990k, ultimate 199k/1990k VND) — CHỐT trước khi nối cổng.
- **`getUserTier` fail-safe → 'free'** khi lỗi/không có gói (lỗi hạ tầng KHÔNG mở khóa quyền lợi trả phí).
- **RLS bảo mật:** `user_subscriptions` CHỈ policy SELECT dòng của mình → user KHÔNG tự cấp premium; GHI chỉ service-role (webhook gọi `grantSubscription`).
- **`pg` module:** đã có trong node_modules (dùng chạy SQL trực tiếp). Nếu `npm ci` mà thiếu → cài lại `--no-save`.
- **Bug deploy Vercel (nhớ):** `NEXT_PUBLIC_*` env PHẢI `plain` không `sensitive`. SERVICE_ROLE_KEY = sensitive (đúng).
- **Verify pattern:** dev server (preview_start "sat-prep-web", port 3000) → login browser account test → prod Supabase chung. Dọn sạch test data + temp script sau verify.
