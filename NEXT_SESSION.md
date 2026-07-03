# ▶️ CÂU LỆNH KHỞI ĐỘNG PHIÊN SAU

Copy nguyên khối dưới đây, dán vào ô chat để mở phiên mới:

---

```
Đọc memory.md, master_task_list.md trong
D:\10.SAT_Prep_App 30.6\10.SAT_Prep_App 30.6\10.SAT_Prep_App\10.SAT_Prep_App\
rồi tiếp tục dự án. Đọc block "SECURITY AUDIT" trong memory.md.

Trước khi làm gì: export PATH="$PATH:/c/Program Files/nodejs" rồi verify môi trường
(tsc + test + build + lint) trong sat-prep-web/. Baseline mong đợi:
tsc sạch · test 123/123 · lint 0/0 · build 44 pages.

Token đã lưu: ~/.gitcreds-sat2026 (git push/GitHub API) + ~/.vercel-token (Vercel API).
Team Vercel: sat-2027 | project: sat-2026 | app prod: https://sat-2026.vercel.app
Repo: github.com/nhatkynghia-cell/SAT-2026 (main). Account test: truongsonht.xd@gmail.com / Nghia@123
DB direct: postgresql://postgres:SatPrep2026@db.yynszcfqcvbnuvguwtfy.supabase.co:5432/postgres
Service-role: trong .env.local + Vercel (sensitive) — KHÔNG ghi vào git

ROOT E STEP2 — hỏi tôi đã chạy root_e_step2_revoke.sql chưa:
- Nếu ĐÃ CHẠY → verify browser PATCH user_economy.coins → 403 → ghi memory ROOT E đóng hoàn toàn
- Nếu CHƯA (đã qua 2026-07-05) → nhắc tôi chạy NGAY (file sẵn trong sat-prep-web/)
- Nếu CHƯA tới 2026-07-05 → bỏ qua, tiếp việc khác

SECRET chưa rotate (defer):
[ ] GitHub PAT ghp_...HETIG (lộ ảnh)
[ ] Vercel token (lộ chat)
[ ] OpenAI key (trong .anv ROOT + Vercel)
[x] DB password (đã reset SatPrep2026 ngày 2026-07-03)
Nếu đã đổi git/vercel token → xin token MỚI lưu lại.

VIỆC PHIÊN SAU — theo THỨ TỰ:
1. ✅ ROOT E step2 verify (xem ở trên)
2. 🔴 Authenticated browser verify ROOT A: login test account → sinh câu AI (vocab/math)
   → chọn đáp án → /api/grade chấm → highlight đúng/sai → mastery ghi → coins cộng.
   Đây là VERIFY, không code mới — nếu lỗi thì fix.
3. 🟡 PHASE 2: THANH TOÁN — HỎI tôi chọn cổng trước (VNPay/MoMo/Stripe/combo):
   a. Payment integration (webhook idempotent, chữ ký, xác nhận server-side)
   b. Subscription tier (thay hardcode tier:'free' trong ai-quota.ts)
   c. Reward-to-Real flow (xu → quà: voucher SAT 50000 xu)
4. ⏳ Sau thanh toán: Parent Dashboard + Diagnostic Onboarding + Beta 100 users

⚠️ GIỚI HẠN NGỮ CẢNH 80%: khi tới ~80% → DỪNG, cập nhật memory + commit + push.

Việc user-side tôi đã làm: [điền: đã chạy step2 chưa / rotate secret nào / chọn cổng thanh toán nào]
```

---

## 📋 ĐỐI CHIẾU KẾ HOẠCH (trạng thái sau phiên 2026-07-03 B)

### ĐÃ ĐÓNG HOÀN TOÀN
- [x] Phase 1 + 1.5 TRỌN (Persistence, Auth, RLS, Deploy, CI)
- [x] ROOT E — service-role admin + step1 SQL chạy prod (step2 chờ soak 2026-07-05)
- [x] ROOT A — server-side grading hoàn chỉnh (issued_questions + /api/grade + hide correct_choice + gate-exam server-verify)
- [x] ROOT B — quest double-claim (quest_claims jsonb + 409)
- [x] ROOT C — atomic SQL chạy prod + fail-closed #2 + explicit userId #3
- [x] ROOT D — await accounting
- [x] Rate-limit mastery 30/min + economy 20/min
- [x] Integration Sprint T1–T5 + Tower adaptive + PvP economy
- [x] UX (toast, LoadingState, choice_analysis, hint bậc, prefetch)
- [x] Nhóm 7 (#6 variant, #8 hint, #9 choice analysis)

### CÒN LẠI NGẮN (phiên sau ~30 phút)
- [ ] root_e_step2_revoke.sql → verify PATCH→403
- [ ] Authenticated browser verify ROOT A (login → grade → highlight)

### PHASE 2 — MVP LAUNCH (việc chính phiên sau)
- [ ] Thanh toán (cần user chọn cổng)
- [ ] Subscription tier (thay 'free' hardcode)
- [ ] Parent Dashboard
- [ ] Diagnostic Onboarding
- [ ] Beta Launch 100 users

### PHASE 3+ (plan sẵn, chưa bắt đầu)
- Mobile App (React Native)
- Social & Retention (bảng xếp hạng, Study Squad)
- Real PvP Multiplayer (WebSocket)
- Season Pass, Story Mode
- B2B Licensing, ACT/IELTS, Fundraising

---

## Ghi chú kỹ thuật

- **HEAD:** `a821ea9` (11 commit bảo mật phiên 2026-07-03 B), push GitHub, Vercel READY.
- **Build:** 44 pages (thêm /api/grade so với 43 trước đó).
- **SQL đã chạy prod phiên này:** root_e_step1_rpc + atomic_mutations + quest_claims + issued_questions table.
- **`pg` module:** installed `--no-save` để chạy SQL trực tiếp, không trong package.json, sẽ bị xóa khi `npm ci`.
- **Bug deploy Vercel (nhớ):** `NEXT_PUBLIC_*` env PHẢI `plain` không `sensitive`.
- **Vercel env:** SUPABASE_SERVICE_ROLE_KEY = sensitive (server-only, đúng).
