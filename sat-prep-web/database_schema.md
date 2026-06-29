# ☁️ DATABASE SCHEMA (PostgreSQL / Supabase) — bản KHỚP CODE

> [!IMPORTANT]
> Tài liệu này đã được **đồng bộ lại theo code thật** (2026-06-29). Nguồn sự thật là các
> store trong `src/lib/*-store.ts` + file DDL `phase1_5_tables.sql`. Bản cũ mô tả các bảng
> `users / inventory / mistakes / ai_chat_cache` (thiết kế dự kiến) **không khớp** với schema
> đang chạy trên Supabase — nếu có mâu thuẫn, **lấy code làm chuẩn**, không lấy doc này.

Toàn bộ dữ liệu user được scope theo `user_id uuid` (trỏ `auth.users(id)`) và bảo vệ bằng
RLS `auth.uid() = user_id`. Hồ sơ tài khoản dùng thẳng `auth.users` của Supabase Auth — KHÔNG
có bảng `users` riêng trong `public`.

## Tổng quan 7 bảng đang chạy

| Bảng | Khóa chính | Store nguồn | RLS |
| :--- | :--- | :--- | :--- |
| `user_economy` | `user_id` | `economy-store.ts` | `auth.uid() = user_id` |
| `user_mistakes` | `id` | `mistakes-store.ts` | `auth.uid() = user_id` |
| `test_history` | `id` | `history-store.ts` | `auth.uid() = user_id` |
| `user_mastery` | `user_id` | `mastery-store.ts` | `auth.uid() = user_id` |
| `user_goals` | `user_id` | `goals-store.ts` | `auth.uid() = user_id` |
| `user_ai_usage` | `user_id` | `ai-usage-store.ts` | `auth.uid() = user_id` |
| `user_vocab_srs` | `user_id` | `vocab-store.ts` | `auth.uid() = user_id` |

---

## 1. Bảng `user_economy` (Kinh tế game — server-authoritative)
Lưu xu / XP / túi đồ ảo. Ghi bằng `upsert` theo `user_id` (`economy-store.ts`). Nguồn sự thật
do server quyết (chống gian lận §9.1). KHÔNG còn Level phẳng (quyết định §10 — tiến trình do
Skill Tree).

| Cột | Kiểu | Khóa | Mô tả |
| :--- | :--- | :---: | :--- |
| `user_id` | `uuid` | PK/FK | Trỏ `auth.users(id)`. |
| `coins` | `integer` | | Số xu (tiền tệ ảo). Mặc định `DEFAULT_ECONOMY.coins = 100`. |
| `xp` | `integer` | | Điểm tích lũy. |
| `inventory` | `jsonb` | | Mảng id vật phẩm ẢO đã sở hữu (`string[]`). |
| `last_spin_date` | `text` | | Ngày quay gần nhất (chống quay nhiều lần/ngày). `null` nếu chưa quay. |

> [!NOTE]
> Bảng này có thể còn vài cột gamification cũ (vd `max_power`, `pvp_rank`) tồn tại từ thiết kế
> trước. Code hiện **chỉ đọc/ghi 5 cột trên** và cố ý không ghi đè các cột phụ
> (`economy-store.ts:46`). Khi gỡ Level phẳng (task 4.2) nên dọn các cột chết này.

## 2. Bảng `user_mistakes` (Sổ tay câu sai + SRS Leitner)
Thay hoàn toàn file `cau_sai.json`. Đã hợp nhất SRS (Leitner) ở Phase 1.5 — thêm cột `box` +
`next_review` (xem `phase1_5_tables.sql`).

| Cột | Kiểu | Khóa | Mô tả |
| :--- | :--- | :---: | :--- |
| `id` | `uuid` | PK | ID bản ghi (`DEFAULT uuid_generate_v4()`). |
| `user_id` | `uuid` | FK | Học viên làm sai câu này. |
| `passage` | `text` | | Đoạn văn đính kèm (rỗng nếu không có). |
| `question` | `text` | | Nội dung câu hỏi. |
| `choices` | `jsonb` | | Danh sách đáp án (`string[]`). |
| `correct_choice` | `text` | | Đáp án đúng. |
| `user_choice` | `text` | | Đáp án người dùng đã chọn (sai). |
| `explanation` | `text` | | Lời giải thích từ Hệ thống/AI. |
| `source` | `text` | | Nguồn câu hỏi (mặc định `'Luyện AI (Next.js)'`). |
| `box` | `integer` | | Bậc Leitner SRS (`NOT NULL DEFAULT 1`). |
| `next_review` | `text` | | Ngày ôn kế tiếp (`null` = chưa lên lịch). |
| `created_at` | `timestamp` | | Thời điểm làm sai (sắp xếp mới-nhất-trước). |

> [!IMPORTANT]
> RLS cần đủ 4 lệnh **SELECT / INSERT / UPDATE / DELETE**. Policy UPDATE từng thiếu khiến
> `updateMistakeReview` (`mistakes-store.ts:76`) bị chặn → đã vá ở `fix_verify_rls.sql` (2026-06-29).

## 3. Bảng `test_history` (Lịch sử thi)
Lưu kết quả mỗi lượt thi/luyện (`history-store.ts`).

| Cột | Kiểu | Khóa | Mô tả |
| :--- | :--- | :---: | :--- |
| `id` | `uuid` | PK | ID bản ghi. |
| `user_id` | `uuid` | FK | Người thi. |
| `module` | `text` | | Tên module/bài thi. |
| `subject` | `text` | | Môn (Toán / Đọc hiểu...). |
| `correct` | `integer` | | Số câu đúng. |
| `total` | `integer` | | Tổng số câu. |
| `score` | `integer` | | Điểm đạt được. |
| `test_timestamp` | `numeric` | | Mốc thời gian thi (Unix **seconds**). |
| `created_at` | `timestamp` | | Thời gian ghi bản ghi. |

## 4. Bảng `user_mastery` (Theo dõi thành thạo kỹ năng) ⭐
Nút thắt trung tâm cho lộ trình học + Skill Tree (§10.A.3). 1 dòng/user, cột `skills` là map
`skillId → {score, attempts, correct, lastSeen}` (`mastery-store.ts`).

| Cột | Kiểu | Khóa | Mô tả |
| :--- | :--- | :---: | :--- |
| `user_id` | `uuid` | PK/FK | `references auth.users(id) on delete cascade`. |
| `skills` | `jsonb` | | `NOT NULL DEFAULT '{}'`. Map mức thành thạo từng skill. |
| `updated_at` | `timestamptz` | | `NOT NULL DEFAULT now()`. |

## 5. Bảng `user_goals` (Điểm mục tiêu)
Lưu điểm SAT mục tiêu của user (`goals-store.ts`), phục vụ Score Prediction (§10.A.5).

| Cột | Kiểu | Khóa | Mô tả |
| :--- | :--- | :---: | :--- |
| `user_id` | `uuid` | PK/FK | `on delete cascade`. |
| `target_score` | `integer` | | Điểm mục tiêu (400–1600). `null` nếu chưa đặt. |
| `updated_at` | `timestamptz` | | `NOT NULL DEFAULT now()`. |

## 6. Bảng `user_ai_usage` (Hạn ngạch & token AI/ngày)
1 dòng/user, reset theo ngày trong code (`ai-usage-store.ts`). Nền cho quota freemium (§9.2)
+ đo chi phí (§9.5).

| Cột | Kiểu | Khóa | Mô tả |
| :--- | :--- | :---: | :--- |
| `user_id` | `uuid` | PK/FK | `on delete cascade`. |
| `date` | `text` | | Ngày của bản ghi hiện tại (`NOT NULL DEFAULT ''`). Khác ngày → reset count. |
| `count` | `integer` | | Số lượt hỏi AI trong ngày (`NOT NULL DEFAULT 0`). |
| `tokens_in` | `integer` | | Token input cộng dồn (`NOT NULL DEFAULT 0`). |
| `tokens_out` | `integer` | | Token output cộng dồn (`NOT NULL DEFAULT 0`). |
| `updated_at` | `timestamptz` | | `NOT NULL DEFAULT now()`. |

## 7. Bảng `user_vocab_srs` (Từ vựng Leitner)
Thay file `vocab_srs.json`. 1 dòng/user, cột `words` là mảng từ (`vocab-store.ts`).

| Cột | Kiểu | Khóa | Mô tả |
| :--- | :--- | :---: | :--- |
| `user_id` | `uuid` | PK/FK | `on delete cascade`. |
| `words` | `jsonb` | | `NOT NULL DEFAULT '[]'`. Mỗi phần tử `{ id, box, next_review, ... }`. |
| `updated_at` | `timestamptz` | | `NOT NULL DEFAULT now()`. |

---

## Bảng DÙNG CHUNG / DỰ KIẾN (chưa tạo trên Supabase)

### `ai_chat_cache` (Bộ nhớ đệm Gia sư AI) — task 5.3: STORE ĐÃ CÓ, BẢNG CHƯA TẠO
Cache câu trả lời AI để tiết kiệm token khi nhiều học sinh hỏi giống nhau. **Store đã viết xong**
(`chat-cache-store.ts`) + đã nối `/api/chat`; **bảng CHƯA tạo** trên Supabase (chờ user chạy
`ai_chat_cache.sql`). Khi chưa có bảng: `getCachedReply` trả `null` (miss) → route degrade về gọi
OpenAI, KHÔNG vỡ.

⚠️ **RLS KHÁC 7 bảng user_*:** đây là bảng DÙNG CHUNG (1 câu trả lời phục vụ mọi HS) → KHÔNG scope
`auth.uid()=user_id`; policy là `authenticated using(true)` (mọi user login đọc/ghi). An toàn vì bảng
chỉ chứa lời giải câu hỏi SAT, KHÔNG có PII.

| Cột | Kiểu | Khóa | Mô tả |
| :--- | :--- | :---: | :--- |
| `cache_hash` | `text` | PK | SHA256 của (question+correctAnswer+selectedAnswer+userMessage.toLowerCase). |
| `question_id` | `text` | | ID câu hỏi liên quan (`null` nếu không có). |
| `user_query` | `text` | | Tin nhắn gốc của học sinh. |
| `ai_response` | `text` | | Câu trả lời AI được cache. |
| `hit_count` | `integer` | | Số lần dùng lại (best-effort, không atomic). |

### ⚠️ `user_quotas` (LEGACY — route `/api/ai/generate`) — KHÔNG dùng cho luồng chính
Bảng đếm quota RIÊNG, song song với `user_ai_usage`. Chỉ được dùng bởi route CŨ `/api/ai/generate`
(`questions_generated` theo `user_id`+`usage_date`, hạn 10/ngày). Route này hiện **chỉ có `test-ai/page.tsx`
gọi** (trang debug) và là **lỗ hổng "proxy mù" §9.2** (nhận `systemPrompt`/`userPrompt` THÔ từ client,
KHÔNG có kill-switch ngân sách, KHÔNG `recordGlobalCost`). Luồng chính đã chuyển sang `/api/chat` (làm
cứng) + `user_ai_usage`. → **Đề xuất gỡ route `/api/ai/generate` + `test-ai` + bảng `user_quotas`** (xem
task mới ở Nhóm 4). Sự tồn tại của bảng trên Supabase CHƯA verify (môi trường không có credential đọc DB).

| Cột | Kiểu | Khóa | Mô tả |
| :--- | :--- | :---: | :--- |
| `user_id` | `uuid` | PK (kép) | Cùng `usage_date`. |
| `usage_date` | `text` | PK (kép) | Ngày dùng (`onConflict: 'user_id,usage_date'`). |
| `questions_generated` | `integer` | | Số câu đã sinh trong ngày (hạn `DAILY_FREE_QUOTA=10`). |

> [!TIP]
> 4 bảng dùng `user_id` làm PK (mastery/goals/ai_usage/vocab_srs) → mỗi user đúng 1 dòng, ghi
> bằng `upsert(..., { onConflict: 'user_id' })`. 3 bảng còn lại (economy 1-dòng/user;
> mistakes & test_history nhiều-dòng/user) phân trang theo `user_id` + index thời gian.
