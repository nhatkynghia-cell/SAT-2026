# PRE-DEPLOY FEATURE AUDIT — 2026-07-18

Audit sâu trước deploy cho SAT Prep App / Ivy League Math Academy (Next.js 16 + Supabase + Stripe). 6 cụm được rà soát: AI layer, Learning Core, RPG/Gamification, Payment/Conversion, Auth/Security/Admin, App-shell/UX/Perf. Kết quả này dùng để tối ưu tính năng trước deploy; các việc cần credential/user vẫn bị khóa để làm sau.

## Tóm tắt điều hành

App đã có nền tảng mạnh: nhiều engine cốt lõi đã được nối UI thật (không còn đơn giản là built-not-wired), quota AI có reserve atomic, issued_questions đã có mô hình giấu đáp án, economy đã atomic nhiều faucet, Stripe flow tạo transaction trước Checkout.

Tuy nhiên trước deploy nên ưu tiên xử lý các blocker liên quan: dữ liệu học tập có thể mất khi diagnostic chưa login, explanation còn lộ trong generate-practice payload, mobile navigation thiếu, splash toàn app chặn UX, một số lỗ hổng abuse/cost/security cần migration/credential.

---

## PRE-DEPLOY BLOCKERS

### Cần user/credential (khóa để làm sau)
1. **Cấu hình Stripe env + verify migration gateway** — `.env.local` thiếu `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_BASE_URL`; chưa chạy `migration_stripe_gateway.sql` thì `gateway='stripe'` có thể vỡ CHECK.
2. **Khóa quyền ghi `ai_chat_cache`** — RLS cho authenticated insert/update cache chung; cần SQL policy + route dùng service-role/admin client.
3. **Làm spin atomic bằng RPC** — vòng quay còn load-check-save non-atomic, cần migration RPC `consume_spin`.
4. **Rate-limit route tiền sang store bền vững** — in-memory Map không hiệu lực toàn cục trên Vercel serverless; ưu tiên economy/redeem/payment.
5. **ROOT E p_user_id guard** — thêm `auth.uid() <> p_user_id` guard trong RPC parameterized (defense-in-depth).

### Claude làm được không cần credential
1. **Ẩn `explanation` khỏi `/api/generate-practice` response** — hiện route chỉ giấu `correct_choice` + `choice_analysis`, vẫn trả `explanation` qua Network trước khi user nộp; nên lưu vào issued_questions context và chỉ trả qua `/api/grade` sau khi nộp.
2. **Bắt buộc đăng nhập trước diagnostic** — hiện diagnostic có thể chạy với `local-default-user`, không có handoff sang tài khoản thật sau login → mất dữ liệu onboarding/score prediction.
3. **Không nuốt lỗi saveMastery/saveGoal** — `saveMastery`/`saveGoal` đang log lỗi nhưng route vẫn báo thành công; dữ liệu học tập có thể không ghi mà UI tưởng ổn.
4. **Thêm mobile navigation drawer** — `Sidebar.tsx` `hidden md:flex` và không có hamburger/drawer; mobile không có điều hướng.
5. **Bỏ splash toàn app của GamificationProvider** — đang chặn toàn bộ app đến khi 4 fetch xong; gây cảm giác treo và giảm conversion.
6. **Prompt injection topic trong generate-practice** — topic đã slice 200 ký tự nhưng nội suy thẳng vào system prompt; nên delimiter và nhấn mạnh topic là dữ liệu, không phải instruction.
7. **Chat route: release quota khi reply rỗng** — generate-practice có guard content rỗng, chat thì finalize usage dù reply rỗng.

---

## PRE-DEPLOY POLISH / CONVERSION

1. **Luyện Mục Tiêu copy Premium nhưng API Ultimate-only** — chốt định vị: nếu Premium+ thì mở API; nếu Ultimate-only thì sửa UI/copy.
2. **Real exams gate Ultimate sớm + CTA đúng** — page chỉ gate level, server yêu cầu Ultimate; cần upsell rõ thay vì 403/redirect 2 nhịp.
3. **AI quota badge** — `/api/chat` trả quota nhưng UI không hiển thị; free user chỉ biết khi 429.
4. **Dashboard empty-state CTA** — hiện chỉ text, không có nút tới diagnostic/math/literature.
5. **Memo hóa/tách GamificationContext** — provider value object literal, nhiều state/action gây re-render rộng.
6. **Đồng bộ schema gốc pricing periods** — `payment_transactions.sql`/`user_subscriptions.sql` còn CHECK monthly/yearly, trong khi PLANS có quarterly/semiannual.
7. **Xử lý `checkout.session.expired`** — webhook đang ack-bỏ-qua event không completed, làm pending tích lũy.
8. **Làm rõ `proxy.ts` delegate route protection** — logic thật nằm ở `lib/supabase/middleware.ts`.

---

## POST-DEPLOY / SCALE

- Tối ưu daily login/streak bằng Promise.all.
- Sidebar mở group theo pathname.
- Chuẩn hóa OpenAI token param (`max_completion_tokens`).
- Test bảo vệ model/cost pricing.
- Question Bank fallback không lọc difficulty khi pool rỗng; normalize topic.
- TTL/version cho chat cache.
- Đồng bộ pvpRank server-side khi load.
- Chuyển Google Fonts `@import` sang `next/font/google`.
- Sửa auth loading flicker ở Sidebar.
- Chuẩn hóa LoadingState/EmptyState.
- Race kill-switch ngân sách AI bằng reserve cost/buffer.
- Ẩn debug_info trong migrate-data.
- Dashboard render mastery/score trước, weekly sau; giảm root bundle.
- Affiliate/coupon Wave 2.
- PvP cap theo tier (nếu thật sự cần).

---

## TOP 10 nên làm trước deploy

1. **Cấu hình Stripe env + gateway migration** — needs user.
2. **Ẩn explanation khỏi generate-practice** — Claude làm được.
3. **Gate diagnostic bằng auth thật** — Claude làm được.
4. **Không nuốt lỗi saveMastery/saveGoal** — Claude làm được.
5. **Mobile navigation drawer** — Claude làm được.
6. **Bỏ splash toàn app của GamificationProvider** — Claude làm được.
7. **Khóa quyền ghi ai_chat_cache** — needs user SQL/migration.
8. **Spin atomic bằng RPC** — needs user SQL/migration.
9. **Rate-limit route tiền bằng store bền vững** — needs user infra/migration.
10. **Real-exams gate/copy + dashboard/quota CTA** — Claude làm được.

---

## Điểm mạnh không nên đụng mạnh

- Dashboard/skill-tree/tower/grind đã nối nhiều API thật; không nên ưu tiên theo assumption cũ `built-not-wired` nếu chưa verify code.
- Quota AI reserve atomic là hướng đúng; chỉ bổ sung edge cases/cost race.
- issued_questions/grade đã có kiến trúc giấu đáp án sau nộp; fix explanation chỉ là nối đúng hạ tầng sẵn có.
- Economy đã atomic nhiều faucet quan trọng; spin là gap nổi bật còn lại.
- Stripe flow có transaction trước Checkout; vấn đề chính là env/migration/webhook đối soát, không phải rewrite toàn bộ payment.
