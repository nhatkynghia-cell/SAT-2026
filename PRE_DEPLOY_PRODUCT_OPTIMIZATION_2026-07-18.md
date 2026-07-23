# PRE-DEPLOY PRODUCT OPTIMIZATION — 2026-07-18

Nghiên cứu sâu tối ưu sản phẩm SAT Prep App trước deploy. Vòng này tập trung vào sản phẩm/thói quen học/retention/conversion/analytics, khác với audit kỹ thuật trước đó. Các việc cần user/credential/SQL/deploy vẫn bị khóa để làm sau.

## North Star

Trước deploy, SAT Prep App nên tối ưu cho một vòng học rõ ràng: user vào app, làm diagnostic 5 phút, nhận kế hoạch hôm nay, làm câu đúng skill yếu, thấy mastery thay đổi, rồi được kéo quay lại bằng SRS/quest hằng ngày.

Ưu tiên độ tin cậy học tập hơn mở rộng tính năng: AI tutor phải đủ ngữ cảnh, question bank không được lưu câu lỗi, paywall phải khớp code thật và không làm đứt trải nghiệm học.

---

## Recommended first epic

**Bắt đầu bằng Epic “Learning Loop & First-session Activation”.**

Lý do:
- Không cần credential/SQL/deploy.
- Tận dụng engine đã có: diagnostic, mastery, skill-tree, adaptive, score prediction, mistake notebook.
- Ảnh hưởng trực tiếp activation, retention, conversion và chất lượng học.
- Sau khi có một bề mặt điều phối rõ (“Kế hoạch hôm nay”), AI tutor, question bank, RPG và paywall đều có chỗ gắn CTA đúng ngữ cảnh.

---

## Product Epics

### 1. Learning Loop & First-session Activation

**Goal:** User mới sau 5 phút hiểu app, làm diagnostic, nhận kế hoạch cá nhân, làm bài luyện đầu tiên và thấy tiến bộ.

**Claude làm ngay:**
- Tạo “Kế hoạch hôm nay” trên Home.
- Biến diagnostic result thành next action theo focus skill thật.
- Dashboard empty state có CTA tới diagnostic/math/literature.
- Hiện mastery delta sau mỗi câu.
- Focus skills có CTA luyện ngay.

**User để sau:** Không cần.

**Metrics:** diagnostic start/complete, first practice after diagnostic, question answered D0, mastery delta shown, D1 return.

**Risk:** Nếu UI quá nhiều card, user lại phân tán; kế hoạch hôm nay phải là primary CTA.

### 2. AI Tutor Quality & Safety

**Goal:** AI tutor trả lời đúng ngữ cảnh, không hallucinate, không lộ đáp án trước khi nộp, và không cache stale.

**Claude làm ngay:**
- Gỡ/disable localStorage cache trong `AITutoring`.
- Chuẩn hóa TutorContext: passage, choices, selected answer, correct answer, skillId, questionId, phase pre/post-submit.
- Tách Socratic pre-submit hint và post-submit explanation.
- Prompt delimiter cho topic.
- Chat route release quota khi reply rỗng.

**User để sau:** OpenAI live eval/credential.

**Metrics:** tutor requests có đủ context, cache hit đúng version, AI satisfaction, continued question rate, 429/quota complaint.

**Risk:** Thay request schema cần cập nhật caller; pre-submit hint không được lộ đáp án.

### 3. Content Quality & Question Bank Fidelity

**Goal:** Không để câu sai/kém chuẩn SAT lọt vào bank chung; mỗi câu có skillId đáng tin và schema hợp lệ.

**Claude làm ngay:**
- Validator sau JSON.parse trước `saveToBank`: 4 choices, correct_choice khớp option, exactly one correct analysis, lengths khớp, difficulty đúng, trapRate hợp lệ.
- Retry/quarantine/fallback khi câu AI fail validation.
- Prompt generate-practice theo SAT blueprint từng skill, giảm persona cường điệu.
- SkillId confidence / warning khi resolver fallback.
- Bank selection nhẹ theo quality: ưu tiên validated/curated, giảm overused.

**User để sau:** SQL fingerprint/versioning/backfill, curation tay.

**Metrics:** validation failure rate, câu fail bị chặn, coverage theo skill/difficulty, overused question rate, defect found/week.

**Risk:** Validator quá chặt có thể tăng fallback/503; cần retry một lần và bank fallback.

### 4. RPG Retention an toàn

**Goal:** Gamification kéo user quay lại học thật hằng ngày, không phá economy và không pay-to-win.

**Claude làm ngay:**
- Expose daily wheel UI nếu backend đã có 1 lượt/ngày.
- Quest-to-action CTA theo track answer/vocab/exam + progress bar.
- Daily check-in panel persistent thay vì chỉ toast.
- Rollback UI khi quest claim lỗi.
- Aspiration cosmetic copy/progress, shop tabs, season preview, tower personal best.

**User để sau:** policy coin đổi quà thật vs premium multiplier; server-authoritative forge/RNG.

**Metrics:** spin rate, quest completion, D1/D7 retention, streak continuation, shop goal click, tower repeat-run.

**Risk:** Reward UI không được lấn learning plan; không tăng faucet coin thiếu kiểm soát.

### 5. Conversion & Paywall Clarity

**Goal:** Quyền lợi Premium/Ultimate rõ, khớp code thật, không hứa quá và không làm mất ngữ cảnh upsell.

**Claude làm ngay:**
- Viết lại `/upgrade` theo outcome: hero, Premium vs Ultimate, parent block, trust strip, FAQ.
- Chuẩn hóa copy Premium/Ultimate: Premium phân tích/bản đồ; Ultimate adaptive/grind/QAS nếu backend đang khóa vậy.
- Thêm `?from=&unlock=` cho paywall links.
- Sửa QAS/Real Exams copy Premium vs Ultimate.
- Preserve purchase intent khi 401 payment/create.
- Hiển thị quota AI trước khi cạn.

**User để sau:** chốt pricing/value ladder, credential/Stripe/payment roundtrip, affiliate/coupon.

**Metrics:** upgrade CTA click by source, payment create attempt, 401 recovery rate, plan selection, quota CTA click, refund/churn complaints.

**Risk:** Upsell quá sớm làm user khó chịu; phải đặt sau immediate value.

### 6. Beta Analytics & Admin Insight

**Goal:** Beta 100 users trả lời được: ai activation, ai học thật, AI tốn ở đâu, payment rớt bước nào, phụ huynh có mở report không.

**Claude làm ngay:**
- Thiết kế spec `beta_events` + helper `trackBetaEvent` no-throw, chưa chạy SQL.
- Chuẩn bị hook points server-authoritative: diagnostic, grade, chat/generate, payment, parent, admin.
- Admin beta metrics JSON dựa trên ledgers/snapshots hiện có nếu không cần migration.
- Parent report opens không lưu raw share code.

**User để sau:** SQL migration `beta_events`, ops dashboard/deploy monitoring.

**Metrics:** diagnostic funnel, answered questions, correct rate by skill/source, AI cost per active user, cache hit, payment funnel, parent report opens.

**Risk:** Client-only analytics mất dữ liệu; không lưu prompt/userMessage/raw parent code.

---

## Quick Wins (1–2 giờ)

1. **Gỡ/disable localStorage cache trong AITutoring** — tránh tutor stale/sai trước server cache.
2. **Sửa copy QAS/Thi Thật Premium vs Ultimate** — tránh mismatch server đòi Ultimate.
3. **Dashboard empty-state CTA tới diagnostic** — biến dead-end thành activation.
4. **Quest CTA theo track** — chỉ user bấm đâu để hoàn thành quest.
5. **Diagnostic result CTA theo focus skill đầu tiên** — không mặc định “Luyện Toán” nếu yếu Reading/Writing.
6. **Paywall links thêm `from`/`unlock` params** — giữ ngữ cảnh upsell.
7. **RPG aspiration copy không pay-to-win** — pet/shop/leaderboard nói rõ cosmetic/progress.
8. **Rollback UI khi quest claim lỗi** — tránh user tưởng mất thưởng.

---

## Medium Tasks (0.5–1 ngày)

1. **Home “Kế hoạch hôm nay”** — gộp diagnostic, mastery, adaptive lock, SRS thành next action rõ.
2. **TutorContext + cache safety** — đủ passage/choices/skillId, cache miss khi context đổi.
3. **Question validator trước saveToBank** — không lưu câu lỗi vào bank.
4. **Diagnostic onboarding 5 phút + first practice** — nối login/home/result/dashboard.
5. **Viết lại `/upgrade` outcome-based** — Premium/Ultimate khớp code thật.
6. **Socratic pre-submit vs post-submit explanation** — học thật, không lộ đáp án.
7. **Mastery delta + next-action sau mỗi câu** — đóng vòng feedback.

---

## Later / không làm trước deploy

- Không deploy, không chạy SQL production, không đụng credential/env/Stripe/Supabase/OpenAI keys hoặc secret rotation.
- Không mở payment roundtrip thật, webhook prod, affiliate/coupon hoặc đổi giá/quyền lợi gói khi user chưa mở khóa.
- Không migration/backfill lớn: beta_events production, question fingerprint versioning, tách balance quà thật/cosmetic.
- Không server-authoritative forge/RNG đầy đủ trước khi core learning loop ổn.
- Không thiết kế PvP cap theo tier trước khi rõ economy/faucet.
- Không thêm external analytics service.
- Không làm live AI eval bằng credential thật cho tới khi user mở khóa.

---

## Mâu thuẫn cần chốt hoặc sửa copy

- **Adaptive Premium vs Ultimate:** API hiện khóa mọi tier không phải Ultimate. Nếu sản phẩm muốn Premium có adaptive, sửa API; nếu không, sửa mọi copy thành Ultimate-only.
- **QAS/Real Exams:** server yêu cầu Ultimate nhưng vài copy/flow có thể nói Premium.
- **AI model quyền lợi:** đã commit model-tier; copy nên nói “giải thích sâu theo điểm yếu” hoặc khớp đúng model-tier nếu muốn truyền thông.
- **Free AI quota:** docs cũ có thể ghi 5 lượt, code hiện có thể khác; cần đồng bộ số cuối.

---

## Đề xuất việc đầu tiên Claude nên bắt tay

Bắt đầu với **Home “Kế hoạch hôm nay” + diagnostic next-action + dashboard empty CTA**.

Đây là cụm có impact sản phẩm cao nhất, không cần credential/SQL, ít rủi ro hơn payment/security migration, và làm rõ toàn bộ vòng học. Sau đó mới làm AI tutor context + question validator.
