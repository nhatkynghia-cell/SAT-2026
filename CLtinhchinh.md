# 🔧 CLtinhchinh.md — BACKLOG TINH CHỈNH CẤU TRÚC (trước khi chốt giá)

> **Bối cảnh:** User muốn tinh chỉnh cấu trúc app TRƯỚC khi chốt giá, vì chiến lược giá gắn với cấu trúc quyền lợi (đặc biệt: Ultimate 990k = 2× Premium 499k — phải "đáng gấp đôi").
> **Nguồn:** audit read-only 4 chiều song song (workflow 4 Explore agent, 2026-07-06) đọc code THẬT. Xem cũng [CLgia.md](CLgia.md) (chiến lược giá) + memory `sat-prep-funnel-pricing.md`.
> **Trạng thái:** CHƯA code gì — đây là danh mục để user duyệt + quyết build/gỡ từng mục, rồi mới triển khai. Verify hiện tại: tsc·test 272/272·lint 0/0.

---

## 🔴 NHÓM A — ULTIMATE "BÁN KHỐNG" (quyết định TRƯỚC khi chốt giá)

Trang bán `/upgrade` hứa 4 quyền lợi Ultimate mà **code CHƯA triển khai**. Vì Ultimate = 2× giá Premium, đây là trục quyết định "Ultimate đáng bao nhiêu". Mỗi mục: **hoặc LÀM, hoặc GỠ khỏi trang bán** trước khi thu tiền (tránh rủi ro pháp lý + churn).

| # | Lời hứa (upgrade/page.tsx) | Hiện trạng code | File bằng chứng | Mức |
|---|---|---|---|---|
| A1 | 🧠 "Model AI cao cấp hơn — giải thích sâu hơn" | Cả 3 tier đều hardcode `gpt-4o-mini`, KHÔNG switch theo tier | `chat/route.ts:32`, `generate-practice/route.ts:285`, hứa ở `upgrade/page.tsx:33` | **high** |
| A2 | 🗺️ "Đề luyện độc quyền" | `generate-practice` gọi `getUserTier()` nhưng KHÔNG dùng để lọc câu; không có pool/cột "exclusive"; mọi tier dùng chung bank | `generate-practice/route.ts:81-120`, `upgrade/page.tsx:34` | **high** |
| A3 | ⚔️ "Trang bị & skin độc quyền" | `ITEM_CATALOG` không có field tier; spin/`buyItem` không kiểm gói → free tích xu vẫn quay ra skin y hệt | `economy.ts:204` (SPIN_VIRTUAL_ITEMS), `GamificationContext.tsx:32-38`, `upgrade/page.tsx:35` | **high** |
| A4 | 🎁 "Thưởng xu độc quyền hằng tháng" | Không có logic monthly/recurring reward, không cron, không tier check | grep 0 hit `monthly_reward`; `upgrade/page.tsx:36` | **medium** |
| ✅ | "Báo cáo 90 ngày" (Ultimate) | ĐÃ LÀM ĐỦ — `TREND_WINDOW_DAYS {free7/prem30/ult90}` | `parent-report-store.ts:15` | (ok) |

**Hệ quả định giá:** Khác biệt Premium↔Ultimate **đang chạy thật** chỉ có 2 trục: hệ số xu ×2 (vs ×1.5) + báo cáo 90 ngày (vs 30). → Ultimate hiện KHÔNG "đáng gấp đôi". Muốn giữ giá 990k phải làm dày ≥1-2 mục A1-A4; hoặc hạ định vị/giá Ultimate.

**👉 Cần user quyết:** với mỗi A1-A4 → **LÀM** (mục nào trước?) hay **GỠ khỏi trang bán**? (khớp điểm để ngỏ #4 trong CLgia.md)

---

## 🟠 NHÓM B — RANH GIỚI FREE QUÁ LỎNG (đóng lỗ hổng, gắn định giá trực tiếp)

| # | Vấn đề | Hiện trạng | File | Mức |
|---|---|---|---|---|
| B1 | Gate domain chỉ ở **tầng hiển thị**, không ở API | `applyTierGate` đánh dấu `tierLocked` cho UI, nhưng `/api/generate-practice` nhận `moduleType='advanced_math'` từ free → qua quota là trả câu. Free dựng request tay → luyện chương "khóa" | `generate-practice/route.ts:106`, `skill-tree.ts:202-220` | **medium** |

**Hệ quả:** "Free chỉ 2 chương" là lời hứa bán hàng nhưng chưa chặn ở data layer → người rành kỹ thuật vượt được. Nên đóng gate ở API (kiểm `moduleType ∈ FREE_DOMAINS` khi tier=free) để ranh giới Free/Premium là THẬT. **Nguyên tắc vàng vẫn giữ:** không gate diagnostic + không gate ghi mastery/snapshot.

---

## 🟡 NHÓM C — PHỄU CHUYỂN ĐỔI FREE→PAID (đòn bẩy doanh thu, ít rủi ro kỹ thuật)

Các mục pure-UI/pure-read, đảo ngược được, làm tăng tỉ lệ nâng cấp mà KHÔNG đụng logic tiền.

| # | Vấn đề | File | Mức |
|---|---|---|---|
| C1 | **Diagnostic không dẫn tới /upgrade** — kết thúc diagnostic (aha moment mạnh nhất: điểm dự đoán + kỹ năng yếu) chỉ có CTA "Xem Cây Năng Lực", bỏ lỡ đúng lúc user "sốc" | `diagnostic/page.tsx:281-285` | **high** |
| C2 | **Focus skills bị lấy lại sau diagnostic** — diagnostic hiện focus skills, nhưng vào dashboard `/api/score` free trả `detailLocked+focusSkills:[]` → user nhầm "điểm đâu rồi?". Friction lớn, phản tác dụng | `score/route.ts:26-34`, `dashboard/page.tsx:220-226` | **high** |
| C3 | **Adaptive "Luyện Mục Tiêu" khóa free nhưng KHÔNG có nút upsell** — panel chỉ hiện text tĩnh, không button dẫn /upgrade | `adaptive/route.ts:26-29`, `skill-tree/page.tsx` | **high** |
| C4 | **Login muộn → mất dữ liệu diagnostic** — unauth chạy dưới `local-default-user`; làm diagnostic xong, tới payment mới bắt login → dữ liệu diagnostic (user cũ) KHÔNG chuyển sang tài khoản thật | `auth.ts:44-46`, `payment/create/route.ts:48` | **medium→high** |
| C5 | Skill-tree node khóa không có CTA "Mở khóa chương" trên từng node | `skill-tree/page.tsx:284-304` | medium |
| C6 | Real-exams gate 403 không trả `redirectUrl`/CTA → user tự mò /upgrade | `exams/start/route.ts:56-60`, `real-exams/page.tsx:24-33` | medium |
| C7 | AI quota không hiện "còn N lượt" TRƯỚC khi hết → 429 rồi mới biết, lỡ upsell | `AITutoring.tsx`, `chat/route.ts:102-110` | medium |
| C8 | Empty dashboard (chưa làm diagnostic) không có CTA "Làm bài xếp lớp ngay" | `dashboard/page.tsx:218-227` | low |

**Ghi chú:** C1+C2+C3 cùng một gốc — aha moment của diagnostic không được "chuyển hoá" thành lời mời nâng cấp đúng thời điểm. Sửa cụm này rẻ (UI + thêm CTA) mà tác động conversion lớn nhất. C4 nghiêm trọng hơn vẻ ngoài: mất dữ liệu = mất niềm tin ngay cửa thanh toán.

---

## 🔵 NHÓM D — KIỂM SOÁT CHI PHÍ AI (✅ ĐÃ VERIFY PROD — phần lớn đã đóng)

> ⚠️ Agent audit chỉ đọc CODE (không với tới prod DB) nên gắn cờ D1/D2 là rủi ro. **Kiểm chứng live prod (direct pg 2026-07-06):** RPC atomic + bảng ĐÃ tồn tại → cả 2 thực chất ĐÃ AN TOÀN. Giữ lại đây để minh bạch, KHÔNG cần làm gì thêm.

| # | Nghi vấn ban đầu | Kiểm chứng prod | Kết luận |
|---|---|---|---|
| D1 | Kill-switch $5/ngày vượt trần do `recordCost` fallback đọc-sửa-ghi race | RPC atomic `increment_ai_cost_ledger` (upsert `x=x+excluded.x`, hết race) **ĐÃ LIVE trên prod**. Đường fallback race CHỈ chạy khi RPC vắng (42883/PGRST202) → không phải prod. Cả 2 route đều `await` recordCost (agent tự xác nhận), không thật sự fire-and-forget. | ✅ **đã đóng** (khớp memory ROOT C 2026-07-03) |
| D2 | `ai_chat_cache` bảng chưa tạo → cache chết | Bảng `ai_chat_cache` **ĐÃ tồn tại trên prod** (`to_regclass` non-null) | ✅ **đã đóng** |

**✅ D3 (ĐÃ XỬ LÝ phiên này — latent footgun):** `atomic_mutations.sql` (bản nháp gốc ROOT C 2026-07-02) LỆCH prod ở **cả 3 hàm**, không chỉ 1 kiểu: (a) `consume_pvp_fight` + `increment_ai_usage` — prod CÓ thêm `p_user_id uuid DEFAULT auth.uid()` (bản ROOT E sau này, canonical ở `root_e_step1_rpc.sql`), file KHÔNG → khác signature; (b) `increment_ai_cost_ledger` — prod `(integer, plpgsql)`, file `(bigint, language sql)`. Header file lại ghi "chạy lại an toàn" → nếu ai re-run, `create or replace` tạo **overload thứ 2** song song bản prod → PostgREST "could not choose best candidate function" → vỡ money-path. **Đã vá:** gắn header **⛔ SUPERSEDED** vào `atomic_mutations.sql` (chỉ comment, KHÔNG đụng prod, KHÔNG viết lại định nghĩa) trỏ sang `root_e_step1_rpc.sql` là nguồn canonical. Verify prod: RPC đang chạy đúng, không cần thay đổi DB.

**Liên quan định giá:** nếu sau này chốt A1 (Ultimate dùng model xịn hơn) → chi phí OpenAI/lượt tăng → cập nhật `PRICING` trong `ai-cost.ts` cho model mới để kill-switch tính đúng. Cơ chế atomic đã sẵn sàng, chỉ cần số giá đúng.

---

## ⚪ NHÓM E — DỌN NHỎ (pre-launch hygiene)

| # | Vấn đề | File | Mức |
|---|---|---|---|
| E1 | TODO cũ đã resolve nhưng comment chưa xoá (getUserTier đã nối) | `subscription.ts:8` | low |
| E2 | `migrate-data` route legacy — 4 lớp phòng thủ rồi, nhưng nên xoá hẳn + file JSON cũ trước prod | `migrate-data/route.ts:15-26` | low (đã theo dõi) |
| E3 | `cf154ab` vá auth `/api/admin/ai-cost` — đã xong phiên này, chưa push (kẹt sau 3 commit định giá chưa push của phiên khác) | — | (chờ push) |

---

## 📌 BẢNG QUYẾT ĐỊNH USER (nối vào "5 điểm để ngỏ" của CLgia.md)

Trước khi chốt giá, cần bạn quyết:

1. **Ultimate value-ladder (Nhóm A):** với A1 model xịn / A2 đề độc quyền / A3 skin độc quyền / A4 thưởng xu tháng — mỗi cái **LÀM hay GỠ**? Nếu làm, thứ tự ưu tiên? (Đây là câu quyết định "Ultimate đáng gấp đôi" hay không.)
2. **Đóng gate Free ở API (B1)** — làm luôn (nên) hay chấp nhận lỏng ở beta?
3. **Cụm conversion C1-C3** — ưu tiên cao, rẻ, nên làm sớm để đo conversion thật khi beta. Đồng ý làm trước?
4. **C4 (mất dữ liệu diagnostic khi login)** — cần quyết hướng: ép login TRƯỚC diagnostic, hay merge dữ liệu `local-default-user` → tài khoản thật sau login?
5. **D1 kill-switch** — làm chắc trước khi bật thanh toán (bắt buộc nếu chọn A1).

> Sau khi bạn đánh dấu build/gỡ + thứ tự, phiên sau triển khai theo từng nhóm (mỗi nhóm 1 commit, verify gates, không đụng vùng đang khoá của phễu giá).

---

## 🔧 TRẠNG THÁI (đầu phiên tinh chỉnh sau)

- **Git:** `origin/main` = `d18ed13`. **11 commit local CHƯA push** (git ahead 11): định giá phiên song song (`6eab3bd`/`5a7878c`/`ad03bf8`) + adaptive-exam (`2ad9967`/`9d978ad`/`a4fc319`) + phiên audit này (`cf154ab` vá ai-cost auth · `562f7b2` file này · `5ead85e` SUPERSEDED). User chọn **giữ local, CHƯA push** (giá chưa chốt, không công khai đề xuất giá) → phiên sau HỎI trước khi push.
- **⚠️ `CLgia.md` có sửa chưa-commit của phiên song song — ĐỪNG đụng/commit hộ.**
- **Verify:** tsc sạch · test **272/272** · lint 0/0 · build 61 pages (đầu phiên; chưa chạy lại sau audit vì audit không đổi code app — chỉ comment SQL + docs).
- **Secret chưa rotate:** GitHub PAT / Vercel token / OpenAI key (chỉ DB pw đã đổi). Token còn sống: `~/.gitcreds-sat2026` + `~/.vercel-token`.
- **Nhóm D đã verify prod:** RPC atomic + bảng `ai_cost_ledger`/`ai_chat_cache` đã live → kill-switch + cache an toàn, KHÔNG cần đụng.

## 📋 CÂU LỆNH MỞ PHIÊN TINH CHỈNH (copy nguyên khối)

```
Đọc memory.md + master_task_list.md + CLtinhchinh.md + CLgia.md trong
D:\10.SAT_Prep_App 30.6\10.SAT_Prep_App 30.6\10.SAT_Prep_App\10.SAT_Prep_App\
rồi tinh chỉnh cấu trúc theo backlog CLtinhchinh.md. Trả lời tiếng Việt.

Trước khi làm gì: export PATH="$PATH:/c/Program Files/nodejs" rồi verify môi trường
(tsc + test + lint + build) trong sat-prep-web/. Baseline: tsc sạch · test 272/272
· lint 0/0 · build 61 pages. origin/main = d18ed13; có 11 commit local chưa push
(HỎI tôi trước khi push — gồm đề xuất giá chưa chốt).

TÔI ĐÃ QUYẾT (điền trước khi mở phiên):
- Nhóm A (Ultimate 4 quyền lợi): A1 model xịn [LÀM/GỠ], A2 đề độc quyền [LÀM/GỠ],
  A3 skin độc quyền [LÀM/GỠ], A4 thưởng xu tháng [LÀM/GỠ]. Thứ tự: ___
- Nhóm B đóng gate Free ở API: [làm/gác]
- Nhóm C conversion (C1-C4): [làm cụm nào trước]
- C4 mất dữ liệu diagnostic: [ép login trước / merge sau login]
- Giá 4 gói: [giữ 499k/3.99tr/990k/7.99tr / đổi thành ___]

Token: ~/.gitcreds-sat2026 (ghép "/nhatkynghia-cell/SAT-2026.git") + ~/.vercel-token.
DB direct: postgresql://postgres:SatPrep2026@db.yynszcfqcvbnuvguwtfy.supabase.co:5432/postgres
```
