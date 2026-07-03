# 🔐 SECURITY AUDIT — Money & Anti-Cheat Surfaces (2026-07-03)

> Chạy TRƯỚC khi gắn thanh toán thật (Phase 2) + Reward-to-Real (xu → quà giá trị thật, voucher lệ phí SAT 50.000 xu).
> Phương pháp: adversarial workflow — 8 finder dimensions → mỗi finding được 2 skeptic (exploitability + code-reality) xác minh → chỉ giữ finding KHÔNG bị đa số bác bỏ.
> Kết quả: **36 raw → 21 sống sót → 15 bác bỏ**. Claude đọc độc lập economy.ts / mastery.ts / stats.ts / economy-store.ts / các route để đối chiếu.
>
> ⚠️ **Kết luận điều hành: CHƯA AN TOÀN để gắn tiền thật.** Server authoritative về SỐ TIỀN (client không gửi được số xu) NHƯNG tin mù SỰ KIỆN học tập do client khẳng định (isCorrect/correctCount/skillId) + nhiều read-modify-write không atomic. Phải đóng ROOT A + B + C trước khi 1 xu quy ra giá trị thật.

---

## 🎯 4 ROOT CAUSE (21 finding gộp lại)

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
_Nguồn: workflow `money-anti-cheat-audit` (82 agent, 21 survivor). Synthesis agent cuối chết vì lỗi kết nối tạm thời → báo cáo này do Claude tổng hợp từ survivor list + đọc code trực tiếp._
