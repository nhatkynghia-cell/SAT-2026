# 🔐 SECURITY AUDIT — Money & Anti-Cheat Surfaces (2026-07-03)

> Chạy TRƯỚC khi gắn thanh toán thật (Phase 2) + Reward-to-Real (xu → quà giá trị thật, voucher lệ phí SAT 50.000 xu).
> Phương pháp: adversarial workflow — 8 finder dimensions → mỗi finding được 2 skeptic (exploitability + code-reality) xác minh → chỉ giữ finding KHÔNG bị đa số bác bỏ.
> Kết quả: **36 raw → 21 sống sót → 15 bác bỏ**. Claude đọc độc lập economy.ts / mastery.ts / stats.ts / economy-store.ts / các route để đối chiếu.
>
> ⚠️ **Kết luận điều hành: CHƯA AN TOÀN để gắn tiền thật.** Server authoritative về SỐ TIỀN (client không gửi được số xu) NHƯNG tin mù SỰ KIỆN học tập do client khẳng định (isCorrect/correctCount/skillId) + nhiều read-modify-write không atomic. Phải đóng ROOT A + B + C trước khi 1 xu quy ra giá trị thật.
>
> 🔴🔴 **CẬP NHẬT 2026-07-03 (bổ sung sau, NGHIÊM TRỌNG NHẤT — ROOT E):** RLS chỉ bảo vệ QUYỀN SỞ HỮU DÒNG, KHÔNG bảo vệ GIÁ TRỊ CỘT. User đã đăng nhập có thể `PATCH` thẳng `user_economy.coins` / `user_mastery.skills` của CHÍNH MÌNH qua PostgREST (dùng anon key + JWT session, cả hai đều lộ ở client) → **bỏ qua HOÀN TOÀN `/api/economy` + toàn bộ thiết kế server-authoritative + mọi fix ROOT A/B/C.** Đã xác minh SỐNG (non-destructive, ghi lại đúng giá trị cũ): PATCH coins→**200**, PATCH mastery skills→**200**, cross-user INSERT→**403** (RLS chặn đúng phần sở hữu). **Đây là đường NGẮN NHẤT tới voucher 50.000 xu. Phải đóng TRƯỚC A/B/C** (chúng vô nghĩa nếu E còn hở). Chi tiết + cách vá: mục ROOT E bên dưới.

---

## 🎯 5 ROOT CAUSE (21 finding + ROOT E bổ sung)

### 🔴🔴 ROOT E — RLS bảo vệ DÒNG chứ KHÔNG bảo vệ GIÁ TRỊ CỘT: user PATCH thẳng coins/mastery của mình qua PostgREST (NGHIÊM TRỌNG NHẤT — đóng TRƯỚC A/B/C)
**Bản chất:** policy RLS trên `user_economy`/`user_mastery`/... là `auth.uid() = user_id` — chỉ giới hạn user chạm ĐÚNG DÒNG của mình, KHÔNG giới hạn user GHI GIÁ TRỊ GÌ vào cột nào của dòng đó. Supabase expose PostgREST public; anon key nằm trong bundle client (`sb_publishable_...`), JWT session đọc được từ cookie `sb-...-auth-token` bằng JS. → User đã đăng nhập mở devtools chạy:
```js
fetch(`${SUPABASE_URL}/rest/v1/user_economy?user_id=eq.<chính mình>`, {
  method:'PATCH', headers:{ apikey:<anon>, Authorization:`Bearer <jwt>`, 'Content-Type':'application/json' },
  body: JSON.stringify({ coins: 999999999 })   // hoặc mastery.skills = full 100
})
```
→ **Set coins/mastery tùy ý, BỎ QUA hoàn toàn `/api/economy` + thiết kế server-authoritative + MỌI fix ROOT A/B/C/D.** Đây là đường ngắn nhất tới voucher lệ phí SAT 50.000 xu (§9.6 = giá trị thật).
**✅ ĐÃ XÁC MINH SỐNG (2026-07-03, non-destructive — ghi lại đúng giá trị cũ, KHÔNG đổi dữ liệu):** `PATCH user_economy.coins`→**HTTP 200**; `PATCH user_mastery.skills`→**HTTP 200**; `POST user_economy` với `user_id` người khác→**HTTP 403** (RLS chặn đúng phần sở hữu — nên bug CHỈ ở phạm vi ghi-đè dòng-của-mình, không phải cross-user).
**Vì sao lộ ra bây giờ:** T7 chuyển economy sang server-authoritative qua `/api/economy`, NHƯNG chưa bao giờ THU HỒI quyền ghi trực tiếp của `authenticated` trên các bảng đó. App ghi bằng chính JWT user (`.env.local` KHÔNG có `SUPABASE_SERVICE_ROLE_KEY`) nên các bảng buộc phải để `authenticated` ghi được → client cũng ghi được y hệt.
**Cách vá (kiến trúc, VIỆC USER — cần secret mới + đổi RLS prod):**
- [ ] Thêm `SUPABASE_SERVICE_ROLE_KEY` vào env (server-only, KHÔNG `NEXT_PUBLIC`). Tạo 1 admin client riêng ở server dùng service-role cho MỌI ghi kinh tế/mastery/gate/quota/ledger.
- [ ] REVOKE quyền INSERT/UPDATE/DELETE của role `authenticated` trên các bảng server-authoritative (`user_economy`, `user_mastery`, `user_ai_usage`, `ai_cost_ledger`, `user_progress` nếu muốn siết) — GIỮ SELECT nếu client cần đọc (hoặc bỏ luôn, đọc qua API). Service-role bỏ qua RLS nên server vẫn ghi được.
- [ ] Các bảng client ĐƯỢC PHÉP tự ghi (nếu có, vd bookmark thuần cá nhân) thì giữ; còn lại đóng.
- [ ] Sau khi đóng: các store hiện dùng anon-client-với-session sẽ MẤT quyền ghi → phải chuyển sang admin client. Đây là refactor tầng store (Claude làm được) + đổi RLS (user chạy SQL) — làm CÙNG nhau.
- **Phải xong TRƯỚC khi bật thanh toán.** Trong lúc chưa vá: coi như economy KHÔNG chống gian lận với bất kỳ user đăng nhập nào biết mở devtools.

### ROOT A — Client tự khẳng định "đã trả lời đúng" mà server KHÔNG có bằng chứng câu hỏi (11 finding)
Server không lưu câu hỏi đã phát + đáp án đúng, nên mọi endpoint chấm điểm đều tin client:
- `POST /api/economy {action:'answer', isCorrect:true, difficulty:'Hard', streak:5}` → `isCorrect` do client khẳng định, không kiểm được → **30 xu/lần, loop vô hạn**. (route.ts:55, economy.ts:64)
- `POST /api/economy {action:'exam', correctCount:1e9, difficulty:'Hard'}` → `applyExamReward` chỉ chặn `Number.isInteger && >0`, KHÔNG trần → **~20 tỉ xu/1 request**. (route.ts:65-75, economy.ts:88) 🔴 CRITICAL — có clamp an toàn (xem Fix 1).
- `POST /api/mastery {skillId, isCorrect:true, difficulty:'Hard'}` → không cost, không rate-limit → spam đẩy mastery lên 100 trong ~5-10 lần (EWMA α=0.28 với Hard). Mastery → basePower → combatPower → **thắng PvP ăn xu thật** + mở khóa Skill Tree gate + reset cooldown thi lại. Phá vỡ luật "sức mạnh phải đến từ học thật". (mastery/route.ts:25, mastery.ts:71)
- `POST /api/gate-exam {domain, correctCount:5}` → eligibility ĐÃ re-check server-side (Fix A phiên cũ còn hiệu lực ✅) NHƯNG `correctCount` vẫn client-reported, không đối chiếu đáp án thật → vượt cổng bằng cách khai 5/5. (gate-exam/route.ts:97,103)
- `difficulty` do client gửi → luôn khai 'Hard' để mastery/xu tăng nhanh nhất. (mastery/route.ts:37)

**Vì sao chưa fix tự động:** fix đúng = server sinh câu → lưu server-side kèm đáp án + session token → chấm ở server (hiện generate-practice trả cả `correct_choice` cho client). Đây là **redesign kiến trúc Phase 2**, KHÔNG phải vá 1 dòng. Cần bạn quyết hướng.

### ROOT B — Quest double-claim: server không lưu trạng thái "đã nhận" (1 finding, CRITICAL)
`POST /api/economy {action:'quest', questId:'q3'}` → `applyQuestReward` tra bảng thưởng nhưng KHÔNG kiểm "đã claim chưa" (comment tự thừa nhận: kiểm claim vẫn ở client). → **re-POST q3 vô hạn = +100 xu +500 xp mỗi lần**. (economy.ts:124)
**Fix đúng:** đưa claim-state hằng-ngày lên server (bảng riêng hoặc cột trong user_economy) — cần schema, việc có bạn tham gia.

### ROOT C — Read-modify-write KHÔNG atomic (5 finding, race dưới đồng thời)
Mọi mutation đều `load() → compute → save()` không khóa dòng → 2 request song song đọc cùng giá trị cũ → mất cập nhật / vượt trần:
- **PvP daily cap** (economy-store.ts:113 + route.ts:114): 10 request `pvp` đồng thời cùng đọc `fightsToday=0` → tất cả qua cap → vượt trần 10 trận/ngày = faucet xu. CRITICAL.
- **Coins** (economy-store.ts:34): 2 action đồng thời → 1 ghi đè → thực ra làm MẤT xu (không lợi cho attacker) nhưng có thể lợi khi kết hợp spend+grant. MEDIUM.
- **Gate progress** `correctSinceFail` (gate-store.ts:33): race trên user_mastery.skills JSONB → có thể mất/nhân đếm. HIGH.
- **Cost ledger** (cost-ledger-store.ts:75): concurrent AI calls cùng đọc cost cũ → ghi đè → **vượt trần ngân sách ngày** (kill-switch mất tác dụng dưới tải). CRITICAL cho cost.
- **Quota** (ai-usage-store race): tương tự → vượt 5 lượt/ngày.

**Fix đúng:** atomic tại DB (Postgres `rpc()` increment / `UPDATE ... SET x = x + n` / advisory lock). Cần thêm DB function vào PRODUCTION = cần bạn chạy SQL (đúng mẫu cũ). Claude viết được migration + code, KHÔNG tự chạy trên prod.

### ROOT D — recordUsage / recordGlobalCost fire-and-forget (2 finding)
`recordUsage` (generate-practice:302) + `recordGlobalCost` (chat) gọi KHÔNG `await` → trên serverless function có thể bị freeze/kill trước khi ghi xong → **kế toán cost/quota thất thoát**. CONFIRMED. → Fix 2 (thêm await) an toàn.

---

## ✅ FIX ÁP DỤNG PHIÊN NÀY (an toàn, cô lập, có test)
1. **Trần `correctCount` trong exam reward** — chặn coin-mint tỉ xu (ROOT A phần exam). Clamp ở `applyExamReward` về `MAX_EXAM_QUESTIONS` (rộng hơn mọi đề thật) + test. KHÔNG đụng chấm-điểm-client (baseline app), chỉ chặn số phi lý.
2. **`await` recordUsage/recordGlobalCost** (ROOT D) — kế toán chắc chắn ghi trước khi trả response trên serverless.

## 🔴 PHẢI LÀM TRƯỚC KHI GẮN TIỀN THẬT (kiến trúc — cần bạn quyết hướng)
- **A. Server-authoritative question grading** (đóng ROOT A gốc): server lưu câu đã phát + đáp án + session token, chấm ở server, KHÔNG trả `correct_choice` cho client trước khi nộp. Lớn — đây là hạng mục Phase 2.
- **B. Quest claim-state server-side** (đóng ROOT B): cột/bảng đánh dấu đã-claim theo ngày.
- **C. Atomic mutations** (đóng ROOT C): DB function/`UPDATE ... x=x+n` cho coins, pvp counter, cost ledger, quota, gate progress. Claude viết migration + code, bạn chạy SQL.
- **Rate-limit** `/api/mastery` + `/api/economy` (giảm tốc spam kể cả trước khi có grading thật).

## 🟢 XÁC NHẬN AN TOÀN (15 finding bị bác bỏ = phòng thủ ĐANG chạy đúng)
- PvP power gate + rank tuần tự + server tự tính targetRank (bỏ qua client) — chặn nhảy rank ăn jackpot.
- HMAC save-data: từ T7 blob KHÔNG còn mang coins/xp → không mint được qua save-data.
- RLS auth.uid()=user_id trên bảng user_* — chặn IDOR cross-user (bác bỏ các finding IDOR).
- gate-exam POST re-check eligibility server-side (Fix A cũ còn sống).
- `/api/generate-practice` có checkQuota TRƯỚC gọi OpenAI; câu từ bank không tính lượt.
- spin RNG chạy server + 1 lượt/ngày theo `today` server cấp.
- applySpend clamp số âm/không đủ số dư.

## 📌 COVERAGE GAP (pass sau)
- Payment webhook surface (chưa tồn tại — kiểm khi Phase 2 thêm VNPay/MoMo/Stripe: idempotency, chữ ký webhook, xác nhận số tiền server-side).
- Chuỗi liên hệ mastery→stats→PvP→coins đã soi; nên có integration test end-to-end cho chuỗi này.
- Idempotency key cho mọi economy POST (chống double-submit do retry mạng).

---

## 🛠️ ROOT C — ĐÃ TRIỂN KHAI + REVIEW (2026-07-03)

**Đã làm:** chuyển 3 mutation kinh tế sang ATOMIC (fail-safe, 0 regression pre-migration).
- **SQL:** `atomic_mutations.sql` (MỚI) — 3 hàm `SECURITY INVOKER`: `increment_ai_cost_ledger` (upsert x=x+n), `increment_ai_usage` (per-user, reset ngày, `auth.uid()`), `consume_pvp_fight` (SELECT FOR UPDATE khóa dòng → reset ngày → check rank tuần tự → check cap → +1 + leo rank nếu thắng). ⏳ [user] chạy trên SQL Editor prod.
- **Code:** `cost-ledger-store.ts` (recordCost→RPC), `ai-usage-store.ts` (incrementUsageAtomic), `ai-quota.ts` (recordUsage→RPC), `economy-store.ts` (tryConsumePvpFightAtomic), `economy/route.ts` (pvp action dùng atomic, fallback non-atomic khi RPC vắng).
- **FAIL-SAFE:** RPC chưa có (pre-migration 42883/PGRST202) → fallback về đường cũ = 0 regression. Runtime-verified SỐNG (login browser, prod chưa có RPC): PvP fight qua fallback sạch (eligible/lost/rank giữ/0 lỗi log).
- App XANH: tsc · **test 123/123** · lint 0/0 · build 43 pages.

**Adversarial review (workflow `rootc-atomic-review`, 25 agent, 18 raw → 15 survivor):** **VERDICT = GO — an toàn commit as-is.** Fail-safe pre-migration đúng; mọi bug là edge-case POST-migration, KHÔNG làm hệ thống tệ hơn hiện tại.
- ✅ **FIX trong PR này (#1):** `recordCost` fallback trên MỌI lỗi → nếu RPC commit rồi mất response (timeout) sẽ +1 lần nữa = double-count. Đã sửa: chỉ fallback khi 42883/PGRST202 (đồng bộ 2 store kia). *(Review đính chính: double-count này INFLATE cost → kill-switch trip SỚM hơn = an toàn hướng, không phải bypass ngân sách.)*
- 📌 **Review đính chính 2 finding "critical" bị thổi phồng:** (a) `consume_pvp_fight(p_won=true)` gọi thẳng KHÔNG phải hố MỚI — nó bị bao trùm bởi ROOT E (user PATCH thẳng `user_economy` được RỒI hôm nay); RPC còn THÊM ràng buộc (rank tuần tự, cap, row-lock) và KHÔNG đụng coins. (b) "PvP double-execute on network error" sai cơ chế: khi `consumed===null` nhánh atomic bị BỎ QUA hoàn toàn, chỉ 1 đường chạy.
- ⏳ **FOLLOW-UP (chưa làm, tracked — money-core control-flow tinh tế, KHÔNG vội cuối phiên):**
  - **#2 (medium):** post-migration RPC lỗi THẬT (RLS 42501 / constraint / transient) hiện bị coi là "hàm vắng" → fallback non-atomic (mở lại race dưới tải đồng thời). Nên fail-CLOSED trên mã lỗi không-phải-pre-migration + verify mã lỗi thật của supabase-js bằng 1 call hàm-vắng thực tế.
  - **#3 (low, defense-in-depth):** atomic dùng `auth.uid()`, fallback dùng `userId` param — cùng session cookie nên bằng nhau trong vận hành thường; truyền `p_user_id` tường minh + `raise if auth.uid() <> p_user_id` để 2 đường provably giống nhau.
  - **fallback partial-success (medium):** `saveEconomy` (void, nuốt lỗi) + `savePvpState` (bỏ qua boolean trả về) là 2 transaction riêng → có thể ghi 1 nửa mà route vẫn trả success=true. Cân nhắc gộp hoặc kiểm trả về.

> ⚠️ **QUAN TRỌNG:** ROOT C atomic đóng RACE, nhưng **KHÔNG phải ranh giới chống gian lận** khi ROOT E còn hở — user vẫn PATCH thẳng DB được. Thứ tự đúng: **đóng ROOT E TRƯỚC**, rồi A/B/C mới có ý nghĩa. `consume_pvp_fight` tin `p_won` từ client chỉ CHẤP NHẬN ĐƯỢC vì dòng DB vốn đã client-writable (ROOT E); sau khi đóng E, cần re-check: p_won phải do server tính, không nhận từ client gọi RPC trực tiếp (khi đó revoke execute RPC cho authenticated, chỉ service-role gọi).

---
_Nguồn: workflow `money-anti-cheat-audit` (82 agent, 21 survivor) + `rootc-atomic-review` (25 agent, GO verdict). Báo cáo do Claude tổng hợp từ survivor list + đọc code trực tiếp + xác minh live non-destructive._
