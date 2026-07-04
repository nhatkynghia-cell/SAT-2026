# 🧠 PROJECT MEMORY — Ivy League Math Academy (SAT Prep RPG)

Tài liệu này ghi nhớ cấu trúc, mục tiêu dự án và quy tắc phát triển của ứng dụng luyện thi SAT kết hợp Game nhập vai (RPG). Mục tiêu giúp các AI Agent thế hệ tiếp theo đọc hiểu nhanh chóng và tuân thủ các chuẩn lập trình của dự án.

---

## 🎯 1. MỤC TIÊU DỰ ÁN (PROJECT GOALS)

*   **Tên thương mại**: Ivy League Math Academy / Gia sư AI SAT - Phú Gia Education.
*   **Mô tả**: Ứng dụng ôn thi Digital SAT (Toán học & Đọc hiểu tiếng Anh) kết hợp sâu với các cơ chế Game nhập vai (RPG Gamification) nhằm tăng động lực học tập cho học sinh Việt Nam.
*   **Đối tượng người dùng**: Học sinh THPT tại Việt Nam ôn luyện chứng chỉ SAT để xét tuyển Đại học hoặc đi du học.
*   **Điểm độc đáo (Unique Selling Point - USP)**:
    1.  **RPG Gamification**: Có hệ thống Level (1-200), điểm XP, MP, tích lũy SAT Coins, Trang bị (6 slot), Thú cưng (Pets), Lò rèn nâng cấp đồ, Đấu trường PvP và Tháp vô tận.
    2.  **AI Personalization (GPT-4o-mini)**: Tạo bài giảng và câu hỏi thực hành cá nhân hóa theo từng chủ đề dựa trên điểm yếu của học sinh, kèm Chatbot giải thích 1-1.
    3.  **Bản địa hóa 100% (Localization)**: Giao diện và lời giải thích bằng Tiếng Việt, câu hỏi SAT giữ nguyên chuẩn Tiếng Anh.
    4.  **Offline-First & Windows Portable**: Đóng gói thành bản chạy offline hoàn toàn trên Windows (.zip), không cần cài đặt phức tạp, giúp học sinh vùng sâu vùng xa tiếp cận dễ dàng.

---

## 💻 2. KIẾN TRÚC & CÔNG NGHỆ (TECH STACK)

| Thành phần | Chi tiết công nghệ sử dụng |
|---|---|
| **Ngôn ngữ** | TypeScript/JavaScript (Next.js) & Python 3.12+ (Streamlit cũ) |
| **Giao diện (UI)** | Next.js App Router kết hợp Tailwind CSS (Bản Web Mới) / Streamlit (Bản cũ) |
| **Trí tuệ nhân tạo (AI)** | OpenAI GPT-4o-mini (Proxy server-side chống lộ key) |
| **Cơ sở dữ liệu** | PostgreSQL trên Supabase (Auth & Data) + Files JSON cục bộ (Bản cũ) |
| **Bảo mật dữ liệu** | Supabase Auth (RLS) & Server-authoritative logic (Web) |
| **Kiến trúc** | Full-stack Monorepo với Next.js (PA A) |

---

## 📂 3. CẤU TRÚC THƯ MỤC & TỆP TIN (DIRECTORY STRUCTURE)

Dự án được chia làm 2 tầng thư mục chính:

### Tầng 1: Thư mục Gốc Workspace
*   `implementation_plan.md`: Lộ trình thương mại hóa và kế hoạch di trú (Migration) sang Next.js + React + Supabase.
*   `master_task_list.md`: Danh sách công việc tổng thể để theo dõi tiến độ.
*   `memory.md` (Tệp này): Bộ nhớ dự án.

### Tầng 2: Thư mục Ứng dụng
*   **`sat-prep-web/` (Bản Web Thương Mại - Next.js Monorepo):**
    *   Chứa toàn bộ mã nguồn Frontend (React) và Backend API (Next.js Route Handlers).
    *   `src/app/api/`: Các endpoint bảo mật cho AI, xử lý kinh tế.
    *   `src/lib/supabase/`: Cấu hình Supabase Client và Server.
*   **`10.SAT_Prep_App - Copy/` (Bản Prototype Streamlit - Cũ):**
    *   `✨_Ôn_Luyện_Hằng_Ngày.py`: File chạy chính của ứng dụng. Quản lý Streak học tập, nhiệm vụ hàng ngày.
    *   `App_Hoc_Toan_Chuan_SAT.py`: Trang học Toán SAT cốt lõi độc lập.
    *   `launcher.py`: Trình kiểm tra môi trường và nạp Streamlit tự động.
*   **Thư mục Trang phụ `pages/` (Chứa 16 module Streamlit):**
    *   `1_🏆_Đấu_Trường_Thi_Thử.py`: Thi thử tùy chọn thời gian và số câu.
    *   `2_🎓_Vượt_Vũ_Môn_Thi_Thật.py`: Giả lập phòng thi thật nghiêm ngặt.
    *   `3_📐_Chinh_Phục_Toán_Học.py`: Bài giảng Toán chi tiết theo ma trận AI.
    *   `4_📚_Làm_Chủ_Từ_Vựng.py`: Học từ vựng thông minh Leitner.
    *   `5_📊_Nhật_Ký_Trưởng_Thành.py`: Trang Dashboard tiến độ cá nhân.
    *   `6_🧮_Bí_Kíp_Hack_Desmos.py`: Hướng dẫn sử dụng và thủ thuật Desmos.
    *   `7_📜_Giải_Mã_Văn_Học_Cổ.py`: Giải nghĩa và luyện các văn bản SAT cổ điển.
    *   `8_📚_Thư_Viện_Đề_Thực_Chiến.py`: Tải các bộ đề thi thử định dạng PDF.
    *   `9_🗺️_Bản_Đồ_Sưu_Tập.py`: Xem chỉ số sức mạnh, trang bị đang mang.
    *   `10_🛒_Cửa_Hàng_Vật_Phẩm.py`: Cửa hàng mua pet, trang bị nâng cấp.
    *   `11_📜_Sổ_Tay_Nhiệm_Vụ.py`: Danh sách quest hàng ngày, tuần, tháng.
    *   `12_🗼_Tháp_Vô_Tận.py`: Vượt tháp quái vật kiếm xu.
    *   `13_🏟️_Đấu_Trường_PvP.py`: So tài điểm cao với bot giả lập học sinh khác.
    *   `14_⚒️_Lò_Rèn_Chiến_Binh.py`: Nâng cấp chỉ số cho kiếm/giáp.
    *   `15_🗺️_Hành_Trình_Chinh_Phục.py`: Đi qua các ải bản đồ.
    *   `16_📔_Thư_Viện_Quái_Thú.py`: Thông tin về các pet có thể sở hữu.
*   **Các Tệp Tiện ích Logic `utils_*.py`:**
    *   `utils_gamification.py`: Quản lý Sidebar tùy chỉnh nâng cao, xử lý Level, XP, xu, mua bán vật phẩm, trang bị đồ.
    *   `utils_streak.py`: Quản lý chuỗi ngày học liên tục, khiên bảo vệ, đồng thời lưu dữ liệu dự phòng vào SQLite.
    *   `utils_quests.py`: Hệ thống nhiệm vụ hàng ngày/tuần/tháng.
    *   `utils_boss.py`: Cơ chế đánh Boss kiểm tra chương.
    *   `utils_forge.py`: Logic đập đồ và tỉ lệ rủi ro lò rèn.
    *   `utils_skills.py`: Kỹ năng chiến đấu của nhân vật.
    *   `utils_offline_cache.py`: Bộ nhớ đệm offline phòng khi mất mạng.
    *   `utils_pdf.py` & `utils_library.py`: Quản lý in đề thi PDF và thư viện tài liệu.
    *   `utils_pvp.py`: Logic đấu trường PvP mô phỏng.
*   **Thư mục Dữ liệu `data/`:**
    *   `sat_prep.db`: Cơ sở dữ liệu SQLite của ứng dụng.
    *   `shop_catalog.json`: Danh mục vật phẩm bán trong shop.
    *   `quests.json`: Mẫu nhiệm vụ mặc định.
    *   `boss_system.json`: Thông tin thuộc tính và máu của các Boss.
    *   `pet_collection.json`: Cơ sở dữ liệu thuộc tính của Pet.
    *   `offline_cache.json`: Cache bài giảng toán offline.

---

## ⚔️ 4. BẢN ĐỒ 16 PHÂN HỆ TÍNH NĂNG (SYSTEM MODULES MAP)

Hệ thống điều hướng sidebar tùy chỉnh trong `utils_gamification.py` gom 16 trang Streamlit vào 4 khu vực học tập:

```
[🗺️ BẢN ĐỒ HUẤN LUYỆN]
├── 🏠 TỔNG QUAN & LỘ TRÌNH
│   ├── ✨ Ôn Luyện Hằng Ngày (Trang chủ, Streak)
│   └── 📊 Nhật Ký Trưởng Thành (Stats/Dashboard)
├── ⚔️ THỰC CHIẾN & KIỂM TRA
│   ├── 🏆 Đấu Trường Thi Thử (Custom Mock)
│   ├── 🎓 Vượt Vũ Môn Thi Thật (Exam Mode)
│   └── 📚 Thư Viện Đề (Tải PDF đề thi)
├── 🧠 HUẤN LUYỆN KỸ NĂNG
│   ├── 📐 Chinh Phục Toán Học (Học 16 dạng toán)
│   ├── 📚 Làm Chủ Từ Vựng (Flashcard Leitner)
│   ├── 🧮 Bí Kíp Hack Desmos (Thủ thuật máy tính)
│   └── 📜 Giải Mã Văn Học Cổ (Luyện Reading cổ điển)
└── 🎮 HỆ SINH THÁI CHIẾN BINH (Gamification RPG)
    ├── 🗺️ Bản Đồ Sưu Tập (Xem đồ đạc/Stats)
    ├── 🛒 Cửa Hàng Vật Phẩm (Mua trang bị/Pet)
    ├── 📜 Sổ Tay Nhiệm Vụ (Daily/Weekly/Monthly Quests)
    ├── 🗼 Tháp Vô Tận (Infinity Tower)
    ├── 🏟️ Đấu Arena/PvP (Đấu PVP giả lập)
    ├── ⚒️ Lò Rèn Chiến Binh (Cường hóa đồ)
    ├── 🗺️ Hành Trình Chinh Phục (Nodes Map)
    └── 📔 Thư Viện Quái Thú (Pet Collection)
```

---

## 🛠️ 5. QUY TẮC PHÁT TRIỂN & BẢO TRÌ BẮT BUỘC (CRITICAL DEVELOPER RULES)

Khi sửa đổi mã nguồn Python của dự án này, bất kỳ Agent nào cũng **BẮT BUỘC** phải tuân thủ nghiêm ngặt các quy tắc sau:

### 🚨 3 Luật Sắt Tránh Sập Giao Diện (UI Crash Protection)
1.  **Cấm Tuyệt đối lỗi st.progress()**: Không bao giờ truyền giá trị nằm ngoài khoảng `[0.0, 1.0]` vào hàm `st.progress()`. Luôn bọc giá trị bằng toán tử giới hạn an toàn:
    ```python
    st.progress(min(1.0, max(0.0, progress_value)))
    ```
2.  **Triệt tiêu lỗi Markdown trôi lề**: Mọi chuỗi HTML/JS đa dòng hiển thị qua `st.markdown(..., unsafe_allow_html=True)` phải được bọc trong `textwrap.dedent()` để tránh lỗi hiển thị ký tự thô đầu dòng do Streamlit thụt dòng:
    ```python
    import textwrap
    st.markdown(textwrap.dedent("""
        <style>
        ...
        </style>
    """), unsafe_allow_html=True)
    ```
3.  **Unique Submit State**: Mỗi trang học tập (ví dụ: Ôn Luyện, Đấu Trường, Toán Học) phải sử dụng các khóa session state submit hoàn toàn khác nhau (ví dụ: `onluyen_submitted`, `arena_submitted`, `vuotvumon_submitted`) nhằm loại bỏ xung đột dữ liệu chéo trang khi di chuyển.

### 🛡️ Cơ Chế Bảo Mật & Chống Hack (Anti-Cheat)
*   Mọi thông tin tiến trình của người dùng lưu trữ trong các file JSON (như `streak_data.json`) được bảo vệ bằng chữ ký HMAC-SHA256 dựa trên khóa `SAT_PREP_SECRET` lấy từ tệp `.env`.
*   Khi cập nhật hoặc ghi đè file save của người chơi, phải tái tạo chữ ký HMAC chuẩn xác. Nếu chữ ký không khớp, ứng dụng sẽ phát hiện dữ liệu bị can tiệp và từ chối tải tiến trình.

### 📝 Chuẩn Hóa Văn Bản AI & Ký Tự LaTeX
*   Hàm `clean_ai_text(text)` trong các tệp chính có nhiệm vụ chuẩn hóa các ký tự điều khiển toán học do AI sinh ra:
    *   Thay thế các ký tự lỗi Form Feed `\f` và tab ẩn thành ký tự LaTeX đúng (`\frac`, `\theta`).
    *   Chuyển đổi các cặp ngoặc toán học chuẩn `\(` và `\)` thành `$`, và `\[`, `\]` thành `$$` để Streamlit render đúng công thức toán học.
*   Hãy luôn chạy dữ liệu thô nhận từ OpenAI API qua hàm `clean_ai_text()` trước khi đưa vào renderer.

### 🔄 Quy Trình Kiểm Thử QA "Viết - Khởi Chạy - Kiểm Tra"
1.  Sau khi chỉnh sửa mã nguồn bất kỳ tệp `.py` nào, **không** báo cáo hoàn thành ngay lập tức.
2.  Khởi chạy hoặc kiểm tra terminal đang chạy Streamlit ngầm để phát hiện các lỗi cảnh báo đỏ (Traceback), `StreamlitAPIException`, `IndentationError`, hay lỗi cú pháp `SyntaxError`.
3.  Tự động khắc phục triệt để cho đến khi terminal chạy mượt mà, không xuất hiện bất kỳ dòng log lỗi nào mới được bàn giao.

---

> [!IMPORTANT]
> ### 🚀 ĐÃ DEPLOY VERCEL THÀNH CÔNG (2026-07-02T18:xx) — APP SỐNG TRÊN PRODUCTION
> **URL production:** `https://sat-2026.vercel.app` (team `sat-2027`, project `sat-2026`, root dir `sat-prep-web`, repo `nhatkynghia-cell/SAT-2026`). Mọi route 200: `/`, `/login`, `/api/questions`, `/api/exams`, `/api/admin/ai-cost`, `/api/load-data`. Cả 3 migration phiên này SỐNG trên prod: `/api/admin/ai-cost` đọc `ai_cost_ledger` Supabase thật (`{costUsd:0,budgetUsd:5}`), `/api/questions`+`/api/exams` trả JSON bundled (fix serverless OK).
>
> **🐛 ROOT CAUSE 500 lần đầu (bài học QUAN TRỌNG, non-obvious):** deploy đầu 500 ở MỌI route qua middleware (favicon 200 vì matcher loại trừ). KHÔNG phải thiếu env (đủ 4) KHÔNG phải build fail (READY) KHÔNG phải code (local `next start` 200 hết). **Nguyên nhân: 2 biến `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` bị đặt `type: sensitive` trên Vercel.** Biến `NEXT_PUBLIC_*` phải nhúng vào bundle LÚC BUILD, nhưng Vercel KHÔNG cho đọc biến "sensitive" ở bước build → nhúng thành `undefined` → `createServerClient(undefined)` trong `proxy.ts`→`updateSession` throw → mọi request 500. **Fix (qua Vercel API, Claude tự làm được vì có token):** DELETE 2 biến sensitive → tạo lại `type:plain` (value lấy từ `.env.local`) → trigger deploy mới (build lại nhúng đúng). `OPENAI_API_KEY`/`SAT_PREP_SECRET` GIỮ sensitive (server-only, không nhúng bundle nên OK). ⚠️ QUY TẮC: biến `NEXT_PUBLIC_*` trên Vercel PHẢI để plain, KHÔNG sensitive.
>
> **🔑 Token dịch vụ (Claude giờ tự thao tác được, lưu ngoài repo):** GitHub PAT + Vercel token user cấp → lưu `~/.gitcreds-sat2026` + `~/.vercel-token` (chmod 600, KHÔNG commit). Git push không cần popup; đọc CI qua GitHub API; quản lý Vercel (env/deploy/logs) qua Vercel API. team `team_q6ezpFDUoFsOY6DE0IUpXpL9`, proj `prj_b8Q2K45HSN3vMrBzZv3kReWbqeYu`.
>
> **🔴 VỆ SINH BẢO MẬT GẤP (user PHẢI làm — đều đã LỘ):** (1) **GitHub PAT `ghp_...HETIG`** lộ trong ảnh chat → GitHub Settings→Tokens→Delete+tạo mới. (2) **Vercel token `vcp_...`** lộ trong chat → Vercel Settings→Tokens→xóa+tạo mới. (3) **OpenAI key** trong `.anv` (ROOT) + đang set trên Vercel → thu hồi platform.openai.com + tạo mới + cập nhật biến `OPENAI_API_KEY` trên Vercel. (4) reset DB password Supabase. → Sau khi rotate, token cũ trong `~/.gitcreds-sat2026`/`~/.vercel-token` sẽ hết hiệu lực (bình thường, cấp lại nếu cần).
>
> **⏳ CÒN LẠI (authenticated verify — cần user login trên app prod):** login `https://sat-2026.vercel.app/login` (account `truongsonht.xd@gmail.com`) → verify persist THẬT qua Supabase: streak qua reload (`user_progress`), question bank hit-rate>0 sau vài câu (`questions`), coins/mastery/economy. Claude verify được nếu user login giúp (như các phiên trước dùng dev server).

## 📈 6. KẾ HOẠCH NÂNG CẤP TIẾP THEO (NEXT STEPS)

> [!IMPORTANT]
> ### ▶️ CÂU LỆNH & CHECKLIST PHIÊN SAU (đọc NGAY — câu lệnh copy-paste ở `NEXT_SESSION.md`)
> **Câu lệnh khởi động phiên sau** đã lưu riêng ở `NEXT_SESSION.md` (thư mục dự án) — user paste vào để mở phiên. Tóm tắt việc phiên sau:
> - export PATH + verify (tsc·test·build) trong `sat-prep-web/`.
> - Token đã lưu: `~/.gitcreds-sat2026` (git push/API) + `~/.vercel-token` (Vercel API). ⚠️ NẾU user đã rotate (xem checklist) → token cũ HẾT hiệu lực, xin token mới.
> - App prod: `https://sat-2026.vercel.app` (sống). ✅ **authenticated verify + 2 nợ cũ ĐÃ XONG (2026-07-03)** — xem block "✅ AUTHENTICATED VERIFY XONG" ngay dưới. Việc chính phiên sau: **chờ user rotate 4 secret** (đã defer) rồi mới bàn Phase 2, KHÔNG còn nợ verify.
> - **⚠️ GIỚI HẠN NGỮ CẢNH 80%:** khi dùng tới ~80% context → DỪNG việc mới, cập nhật memory.md + commit + push (thủ tục bàn giao) TRƯỚC khi bị compact. KHÔNG bắt đầu việc lớn khi đã quá 80%.
>
> **🔴 CHECKLIST SECRET CẦN ROTATE (user làm — đều đã LỘ; phiên sau HỎI user đã đổi chưa rồi TICK + cập nhật):**
> - [ ] GitHub PAT `ghp_...HETIG` (lộ ảnh) → Delete + tạo mới
> - [ ] Vercel token `vcp_...` (lộ chat) → xóa + tạo mới
> - [ ] OpenAI key (trong `.anv` ROOT + biến `OPENAI_API_KEY` trên Vercel) → thu hồi + tạo mới + cập nhật lại trên Vercel
> - [ ] DB password Supabase (Settings→Database) → reset
> - Khi user báo đã đổi xong → sửa `[ ]`→`[x]` ở dòng tương ứng + ghi ngày; nếu đổi git/vercel token thì xin token mới lưu lại `~/.gitcreds-sat2026`/`~/.vercel-token`.
>
> **📋 PLAN CÒN LẠI (sau Phase 1.5 — XONG verify):** Phase 1.5 cạn (authenticated-verify XONG 2026-07-03; chỉ còn nợ nhỏ 5.2 `tier` hardcode `'free'` chờ subscription). Kế tiếp là **Phase 2 MVP**: thanh toán (VNPay/MoMo/Stripe), Parent Dashboard, Diagnostic Onboarding; + Nhóm 7 Phase-2 (câu vàng hằng ngày #2, pacing #7, báo cáo tuần phụ huynh #10). Các mục này LỚN → hỏi user chọn hướng trước khi code, đừng tự mở scope.

> [!IMPORTANT]
> ### 🔐 SECURITY AUDIT — TẤT CẢ BLOCKER ĐÃ ĐÓNG (2026-07-03, phiên này)
> **10 commit bảo mật đã push origin/main (HEAD `81b2d73`).** App XANH: tsc · test 123/123 · lint 0/0 · build 44 pages. Prod READY `https://sat-2026.vercel.app`.
>
> **✅ ROOT E (BLOCKER #1) — ĐÓNG HOÀN TOÀN (step2 chạy 2026-07-05):** service-role admin client + 7 store refactored + `root_e_step1_rpc.sql` chạy prod + `SUPABASE_SERVICE_ROLE_KEY` trên Vercel. **Step2 REVOKE ĐÃ CHẠY prod (direct pg):** revoke INSERT/UPDATE/DELETE của `authenticated` khỏi 6 bảng money + EXECUTE 3 RPC nhạy cảm khỏi CẢ authenticated LẪN public (Postgres mặc định grant PUBLIC → chỉ revoke authenticated CHƯA ĐỦ; đã vá file `root_e_step2_revoke.sql`). SELECT giữ. Verify live: browser PATCH `user_economy.coins` bằng JWT test user → **403 (42501)**; service-role write + RPC vẫn OK (app write path còn sống). → cửa hậu bơm xu/quyền qua REST ĐÓNG.
> **✅ ROOT A — DONE:** Server-side grading hoàn chỉnh: `issued_questions` table + `/api/grade` endpoint + generate-practice giấu `correct_choice` trả `questionId` + CorePracticeUI/math/page dùng /api/grade + gate-exam POST verify `was_correct` từ DB (không tin client `correctCount`).
> **✅ ROOT B — DONE:** `quest_claims` jsonb + route check double-claim → 409.
> **✅ ROOT C — DONE:** `atomic_mutations.sql` chạy prod + follow-up #2 fail-closed + #3 explicit userId (via ROOT E refactor).
> **✅ ROOT D — DONE** (await accounting, phiên trước).
> **✅ Rate-limit** — economy 20/min + mastery 30/min per user.
>
> **🟡 KẾT LUẬN (ĐÃ SỬA 2026-07-04): "AN TOÀN GẮN TIỀN" TRƯỚC ĐÓ SAI ở đường thưởng luyện tập.** Xem block "🔴 ROOT A REWARD HOLE" ngay dưới — ROOT A chấm server-side nhưng coins/XP/mastery vẫn tin client `isCorrect` → faucet (đã VÁ phiên 2026-07-04). Còn 1 bề mặt tiền hở: đường THI (`action:'exam'`) tin `correctCount` client (chưa vá).
>
> **📋 PHASE 2 — TIẾP THEO:** Thanh toán (Combo VNPay+MoMo — user chọn 2026-07-04) + Subscription tier + Parent Dashboard + Diagnostic Onboarding + Beta Launch 100 users.

> [!IMPORTANT]
> ### 🔴 ROOT A REWARD HOLE — PHÁT HIỆN + VÁ (phiên 2026-07-04, 2 commit pushed origin/main)
> **Bối cảnh:** phiên này verify ROOT A (authenticated browser, dev server → prod Supabase, account test) → happy-path CHẠY (sinh câu → chấm /api/grade → highlight → thưởng) NHƯNG phát hiện **chấm server-side CHỈ để tô màu UI**; coins/XP/mastery vẫn cộng theo `isCorrect` client gửi. **Chứng minh live:** POST `/api/economy {action:'answer',isCorrect:true,difficulty:'Hard'}` KHÔNG trả lời câu nào → +30 xu/+150 XP. Xu đổi quà thật → faucet. → Kết luận "mọi bề mặt money đã đóng" ở block trên SAI.
>
> **✅ VÁ 1 — commit `b226269`:** gộp cộng thưởng + ghi mastery VÀO `/api/grade` (nguồn sự thật duy nhất), khóa bằng **compare-and-swap** `answered:false→true` trên `issued_questions` (cộng đúng 1 lần, chống race/replay). GỠ `action:'answer'` khỏi `/api/economy` (→400). GỠ faucet bonus hạ boss ở math. `/api/questions` (golden_hour) giờ issue câu + giấu `correct` + trả questionId → AITutoring cũng chấm qua grade. Client: `handlePracticeAnswer`→`registerGradedResult` (chỉ cập nhật streak/quest/HUD, KHÔNG gọi API tiền).
>
> **✅ VÁ 2 — commit `a31abb6`:** đóng lỗ phụ `choice_analysis` (payload giấu `correct_choice` nhưng vẫn trả `choice_analysis[].is_correct` → lộ đáp án trước khi nộp). Lưu analysis server-side trong cột `issued_questions.context` (JSON envelope `{src,ca}` — KHÔNG cần migration), trả lại sau nộp qua `/api/grade`. Thêm `/api/hint` (gợi ý cấp 2 = 1 bẫy, không lộ đáp án đúng). Client render analysis từ grade-response state (`revealedAnalysis`) thay vì payload.
>
> **🔍 VERIFY:** cả 2 vá verified live (exploit→400; correct→+coins/xp+mastery 1 lần; replay→404; wrong→0; payload sạch; hint không lộ đáp án; grade trả analysis sau nộp; UI /vocabulary render đủ + 0 console error). Gate cuối: **tsc sạch · test 123/123 · lint 0/0 · build 45 pages.** origin/main HEAD `a31abb6`.
>
> **✅ ĐƯỜNG THI ĐÃ VÁ (2026-07-04, commit `a4e57c3` pushed origin/main).** Bề mặt tiền CUỐI còn hở — nay đóng. `/api/exams` trước ship NGUYÊN đáp án (correct_choice+explanation) xuống client → mock/real tự chấm rồi POST `correctCount` tùy ý lên `/api/economy {action:'exam'}` (faucet). **13 file:** NEW `src/lib/exams.ts` (listExamsPublic giấu đáp án / getExamById server-only); `/api/exams` GET trả bản giấu đáp án; NEW `/api/exams/start` (issueQuestion mỗi câu, src:'exam', trả questionId, giấu đáp án); NEW `/api/exams/grade` (gradeAnswer CAS từng câu → thưởng theo ĐỘ KHÓ THẬT từng câu đúng qua `applyExamRewardFromDifficulties`, chống replay/forge); GỠ `action:'exam'` khỏi `/api/economy` (→400); `/api/vocab` POST thưởng Easy server-side CHỈ khi từ đến hạn+đã nhớ (anti-farm); **GỠ `handleExamComplete` ở gate-exam (DOUBLE-reward: câu đã thưởng per-answer qua /api/grade, còn cộng lần 2 qua faucet)**; context bỏ handleExamComplete → thêm `syncServerEconomy`; mock/real/vocab pages dùng endpoint mới. **Verify live:** faucet→400; đáp án không lộ; grade 2/3 đúng→+15c/70xp, 3/3→+35c/170xp (per-difficulty); replay→0 (CAS); forged uuid→0; vocab due→+5c/20xp replay→0; UI mock full-flow 0 error. Gates: tsc·test **127/127**·lint 0/0·build **47 pages**. → **MỌI bề mặt tiền giờ chấm server-side, KHÔNG chỗ nào client tự khai isCorrect/correctCount.** Chi tiết: memory Claude `sat-prep-root-a-reward-hole.md` (mục EXAM PATH).
>
> **🧹 Dữ liệu test:** account `truongsonht.xd@gmail.com` có +vài row mastery/coins từ verify (đã dọn hết `issued_questions` seed + reset quota AI hôm nay). ROOT E step2: 2026-07-04 CHƯA tới hạn soak 5-6/7 → chưa chạy revoke.

> [!IMPORTANT]
> ### 💳 PHASE 2 — TIER FOUNDATION XONG (2026-07-04, commit `fd4d877` pushed origin/main)
> **Quyết định user 2026-07-04:** thanh toán Combo **VNPay + MoMo**; thứ tự build **(1) tier foundation → (2) gateway → (3) reward-to-real**; gate quyền lợi phiên này **CHỈ AI quota**; billing **Monthly + Yearly**.
>
> **✅ Bước 1 XONG:** `src/lib/subscription.ts` (THUẦN: `PaidTier` premium/ultimate, `BillingPeriod` monthly/yearly, `PLANS` 4 tổ hợp, `computeExpiry`/`isActive`/`resolveTier`, +7 test) + `subscription-store.ts` (`getActiveSubscription` ĐỌC RLS, `getUserTier` **fail-safe→'free'**, `grantSubscription` GHI admin service-role — cho webhook thanh toán gọi sau) + `user_subscriptions.sql`. Wire: `chat` + `generate-practice` thay hardcode `tier:'free'` → `await getUserTier(user.id)`. (Type `AiTier`+`DAILY_LIMITS` free=5/premium+ultimate=-1 unlimited đã có sẵn trong ai-quota.ts.)
>
> **🔴 BẢO MẬT — RLS bảng `user_subscriptions` CHỈ có policy SELECT** (KHÔNG insert/update/delete cho authenticated) → user KHÔNG tự cấp gói premium (faucet quyền lợi kiểu ROOT E). GHI chỉ service-role.
>
> **⚠️ Claude ĐÃ TẠO bảng `user_subscriptions` trên PROD DB** (direct pg connect, idempotent, additive, INERT vì chưa route nào GHI + free fail-safe) → **user KHÔNG cần chạy SQL**. **⚠️ GIÁ trong PLANS là PLACEHOLDER** (premium 99k/990k, ultimate 199k/1990k VND) — CHỐT với user TRƯỚC khi nối cổng thanh toán.
>
> **Verify live:** tier matrix — free @ cap5→429; premium→200 câu AI (bypass cap); expired→'free'→429. RLS: pg_policies chỉ SELECT. Dọn test data + temp script. Gates: tsc·test **134/134**·lint 0/0·build 47 pages.
>
> **✅ Bước 2 (gateway) + Bước 3 (reward-to-real) ĐÃ XONG** — xem 2 block riêng bên dưới. Chi tiết: memory Claude `sat-prep-phase2-payments.md`.

> [!IMPORTANT]
> ### ✅ PHASE 2 — BƯỚC 2 CỔNG THANH TOÁN (KHUNG) XONG (2026-07-04, commit `55ff53b` pushed origin/main)
> **Khung cổng VNPay + MoMo** để user nâng gói premium/ultimate. User chốt: **VNPay dùng lib `vnpay`, MoMo TỰ VIẾT HMAC-SHA256**; phạm vi backend đầy đủ + UI cơ bản. Nguyên tắc money surface (§9.1): client gửi ý định (gateway+tier+period), SERVER quyết giá từ PLANS; **CHỈ IPN server-to-server đã verify chữ ký mới cấp gói** (KHÔNG tin Return URL — browser giả mạo được); **IPN idempotent chống double-grant**.
>
> **13 file:** `src/lib/payment.ts` (THUẦN: types + validate + `generateOrderId` uuid + `buildOrderInfo` ASCII, +5 test) · `src/lib/payment-momo.ts` (HMAC-SHA256 tự viết theo sample chính thức momo-wallet/nodejs/MoMo.js — rawSignature field-order alphabet CỐ ĐỊNH + verify IPN timing-safe + createMomoPayment fetch, +7 test round-trip/tamper/test-vector) · `src/lib/payment-vnpay.ts` (wrapper lib `vnpay@2.5.0` MIT chỉ dayjs, HMAC-SHA512, tự ×100 amount, tái dụng IpnResponse constants) · `payment_transactions.sql` (bảng order_id UNIQUE, RLS **SELECT-own** ghi service-role + RPC atomic **`confirm_payment` FOR UPDATE → kiểm tiền → CAS pending→paid 1 lần** chống double-grant) · `src/lib/payment-store.ts` (create pending + confirmPaymentAtomic FAIL-CLOSED + get + list own) · 4 route `/api/payment/{create,vnpay-ipn,momo-ipn,return}` · `/upgrade` UI (4 gói PLANS + chọn cổng → create → redirect payUrl) · Sidebar +link · `.env.example` +7 biến.
>
> **⚠️ ĐÃ CHẠY `payment_transactions.sql` PROD DB** (direct pg, idempotent) — table+RPC+policy confirmed. **User KHÔNG cần chạy SQL.** `pg` chỉ cài `--no-save` để verify (KHÔNG vào package.json/lock); `vnpay` cài `--legacy-peer-deps` (đồng bộ CI react 19).
>
> **🔍 Verify (no creds):** gates tsc·test **149/149**·lint 0/0·build **53 pages**. RPC confirm_payment live prod (service-role): idempotent (confirm lần 2 → alreadyConfirmed KHÔNG cấp lại), amount_mismatch chặn, not_found, **RACE 5 concurrent → firstGrant=1/already=4 = KHÔNG double-grant**. VNPay URL builder: amount ×100 đúng, SHA512 hex 128, roundtrip verifyReturnUrl.isVerified=true. IPN chữ ký giả → 0 cấp gói. UI /upgrade render 4 gói đúng giá. Test data dọn sạch.
>
> **⏳ CÒN LẠI (cần USER) verify roundtrip LIVE:** (1) creds sandbox/merchant VNPay (TMN_CODE+HASH_SECRET) + MoMo (PARTNER_CODE+ACCESS_KEY+SECRET_KEY) → .env.local + Vercel sensitive; (2) chốt giá 4 gói (placeholder 99k/990k/199k/1990k, user "decide later"); (3) khi có creds → roundtrip thật + **XÁC NHẬN field-order chữ ký IPN MoMo** (unit test đã phủ theo spec v2, nhưng chưa có sample IPN thật). Admin fulfill (đánh dấu phiếu/giao dịch) vẫn chờ role system §9.3.

> [!IMPORTANT]
> ### ✅ PHASE 2 — BƯỚC 3 REWARD-TO-REAL XONG (2026-07-04, commit `acf2729` pushed origin/main)
> **xu → quà THẬT** (rw_1 Voucher lệ phí thi 50k xu / rw_2 tài liệu 10k / rw_3 gói AI VIP 20k — 3 item `type:'reward'` trong ITEM_CATALOG). Độc lập với cổng thanh toán, làm được ngay không cần creds. Server-authoritative giống mọi money surface (§9.1): client gửi `rewardId`, SERVER tra giá + trừ xu.
>
> **7 file (2 lib mới + 1 test + 1 SQL + 1 route + 2 sửa):** `src/lib/rewards.ts` (THUẦN, `REWARDS` catalog = nguồn sự thật GIÁ mirror ITEM_CATALOG, `getReward` validate, +3 test → **137**) · `reward_redemptions.sql` (bảng phiếu RLS **SELECT-own only** ghi chỉ service-role + RPC atomic `redeem_reward` **FOR UPDATE khóa dòng user_economy → check balance → trừ xu + INSERT phiếu 'pending' 1 transaction**, SECURITY INVOKER grant chỉ service_role) · `src/lib/redemption-store.ts` (`tryRedeemReward` admin rpc **FAIL-CLOSED** nếu RPC chưa có — KHÁC PvP: KHÔNG fallback non-atomic vì money-out+phiếu quà thật → thà chặn còn hơn phát quà sai; `listRedemptions` read own) · `/api/redeem` (POST {rewardId} server tra cost từ REWARDS, rate-limit 10/min, forge→400, insufficient→400, RPC missing→503; GET list) · `GamificationContext.redeemReward` (đồng bộ số dư server, KHÔNG optimistic) · `shop/page.tsx` (reward → dialog xác nhận "không hoàn lại" → redeemReward; item ảo giữ buyItem).
>
> **⚠️ ĐÃ CHẠY `reward_redemptions.sql` trên PROD DB** (direct pg, idempotent, additive) — table+RPC+policy confirmed live. **User KHÔNG cần chạy SQL.**
>
> **🔍 Verify live prod DB (test acct c43f015e):** direct pg — insufficient(5000<10000)→0 record; sufficient(60000→10000)→1 phiếu pending đúng name/cost; bad_cost(0) guard. **service_role rpc() (exact store path):** 25000→5000 success+record; insufficient chặn. **Double-spend race: 5 concurrent redeem balance đủ ĐÚNG 1 → ok=1/insufficient=4, coins=0, 1 record = KHÔNG faucet** (FOR UPDATE serialize OK). Curl dev :3000: forge rw_999→400, skin_1(ảo)→400, GET→200. Test data cleaned (coins restored 10930). Gates: tsc·test **137/137**·lint 0/0·build **48 pages**.
>
> **✅ BROWSER UI CLICK-VERIFY XONG (2026-07-04, :3000 sau khi chat khác tắt):** /shop → click "Đổi quà rw_2 10000" → dialog xác nhận (tên quà + cảnh báo không hoàn lại) → "Xác nhận đổi" → **coins 10930→930 (giảm đúng)**, dialog đóng, section "Lịch sử đổi quà" + badge "⏳ Đang xử lý", server coins=930 khớp, /api/redeem trả 1 phiếu pending. **0 lỗi console.** Dọn sạch data test. → reward-to-real verify TRỌN VẸN (DB/RPC/race + API + browser UI). **CÒN LẠI (nice-to-have):** admin fulfill route đánh dấu phiếu 'pending'→'fulfilled' — CHẶN bởi role system (§9.3 chưa có; không tự làm endpoint ghi money surface không auth).
>
> **⏳ CÒN LẠI Phase 2:** Bước 2 VNPay/MoMo gateway — cần USER cấp **merchant/sandbox creds** + **chốt giá 4 gói** (user chọn "decide later" 2026-07-04). ROOT E step2 revoke: 2026-07-04 vẫn CHƯA tới hạn soak 5-6/7. Chi tiết: memory Claude `sat-prep-phase2-payments.md`.

> [!IMPORTANT]
> ### ✅ AUTHENTICATED VERIFY XONG (2026-07-03) — persist Supabase THẬT + 2 nợ cũ ĐÓNG (login browser dev server)
> **Cách verify:** dev server local (`preview_start`, port 3000) trỏ CÙNG prod Supabase qua `.env.local` → login browser Claude điều khiển bằng account `truongsonht.xd@gmail.com` (pass user cấp phiên này) → cookie `sb-...-auth-token` set OK, `/api/economy` GET 200 coins 160/xp 400, mastery overall 11/18 skill (state cũ từ phiên trước). Prod tách biệt session nên PHẢI login trên browser-của-Claude, không mượn được session prod của user.
>
> **🔑 PHÁT HIỆN LỚN — CẢ 8 BẢNG SUPABASE ĐÃ TỒN TẠI TRÊN PROD** (anon REST probe: `[]` = có bảng + RLS chặn, KHÔNG phải `PGRST205` = thiếu). Gồm 3 bảng memory ghi "⏳ [user] chạy SQL": `user_progress` (4.1), `questions` (2.1), `ai_cost_ledger` (5.1) + `ai_chat_cache` (5.3) — **ĐỀU ĐÃ CHẠY**. → Prod chạy đường Supabase THẬT, KHÔNG còn dùng fallback file/fail-open. Cập nhật: mọi mục "⏳ user chạy SQL" trong master_task_list coi như DONE.
>
> **✅ 5 property core persist — VERIFY PASS:**
> 1. **PvP win-path (nợ cũ ĐÓNG):** POST `/api/economy {action:'pvp'}` 10 lần liên tục. Kết quả HOÀN HẢO: thắng cộng đúng reward opponent (300/500/800/1200/1800/2500/3500), rank leo 11→10→...→4, thua giữ rank; **7 thắng / 3 thua** (RNG thật, thua cụm khi opponent mạnh dần vs combatPower 1480). **Cap 10 trận/ngày CHẶN:** trận 11+ → `eligible:false` "đã đấu đủ 10 trận". Coins 160→10760 (đọc lại qua GET độc lập). **Reload → rank 4 + cap + coins 10760 GIỮ NGUYÊN** (đọc từ cột `pvp_rank/pvp_fights_today/pvp_last_fight_date` Supabase). Server bỏ qua targetRank client, tự tính. → **faucet xu ĐÓNG HẲN, anti-farm verify sống.**
> 2. **Mistake variant full-loop (nợ cũ ĐÓNG):** seed câu sai skill_id=`algebra.linear_eq` box1 → PATCH remembered=true → box 1→2 → GET `/api/cau-sai/variant?skillId=algebra.linear_eq` → 200 câu AI thật Medium `_source:ai`. Trả lời variant SAI (mirror CorePracticeUI+MistakeNotebook): (a) mastery ghi ĐÚNG skill `algebra.linear_eq` (attempts→8, correct→5, wrong đếm attempt không đếm correct); (b) câu sai MỚI lưu skill_id đúng box1; (c) **box câu GỐC reset 2→1** (`promote(2,false)=1`). Cả 3 hiệu ứng persist Supabase. ⚠️ `skills` là MẢNG object `{id,...}` KHÔNG phải map keyed — đừng tra `skills['x']`, dùng `.find(s=>s.id==='x')`.
> 3. **Streak (`user_progress` + HMAC):** save streak 137/shield 3 → read-back 137/3 (HMAC verify khớp, KHÔNG bị wipe về DEFAULT_STATE) → **reload → vẫn 137/3 từ Supabase**. Log xác nhận: chỉ `local-default-user` (tab chưa login) lỗi `22P02 invalid uuid` → fallback file; UUID thật ghi Supabase sạch. Đã RESTORE streak về 0/0 (state thật trước test).
> 4. **Kill-switch (`ai_cost_ledger`):** ledger cộng dồn THẬT calls 0→1→5, costUsd 0→0.0004→0.0018, tokens tích lũy. Persist Supabase (không reset cold-start). 
> 5. **Quota freemium (5.2, bonus verify):** sau 5 lượt AI/ngày → lượt 6 trả **429 "đã dùng hết 5 lượt"** (đếm `user_ai_usage`). Enforce sống.
>
> **⏳ Question Bank hit-rate (2.1) — CHƯA thấy hit SỐNG, nhưng ĐÚNG trạng thái:** bảng `questions` mới tạo, pool mọi module <MIN_POOL=8 → route sinh AI + `saveToBank` (0 log lỗi = ghi thành công). Quota cạn phiên này nên không đẩy pool tới 8 được. Điểm mấu chốt 2.1 (bỏ file reset-về-0 → Supabase tích lũy bền) ĐÃ verify (bảng tồn tại + ghi sống). Hit `_source:'bank'` sẽ xuất hiện tự nhiên khi 1 module đủ 8 câu. Verify hit sống = việc phiên sau (khi pool đủ) hoặc seed thẳng bảng.
>
> **🧹 DỮ LIỆU TEST để lại trong account thật (không có route DELETE mistakes):** +2 câu sai seed (`VERIFY-SEED` + `Core Practice VERIFY-VARIANT`) trong sổ tay + mastery `algebra.linear_eq` bị bơm vài attempt + coins lên 10760 + pvp_rank=4 + fights_today=10 (reset ngày mai) + 5 câu trong bank `questions`. Account test chuyên dụng nên chấp nhận được; nếu cần state sạch để demo → xóa 2 row `user_mistakes` + reset `user_economy`/`user_progress` cho user đó.
>
> **🔒 SECRET (user chọn "cứ làm để sau" phiên này):** 4 secret checklist CHƯA rotate → token `~/.gitcreds-sat2026`+`~/.vercel-token` VẪN sống (git/Vercel API dùng được). Phiên sau vẫn HỎI lại đã rotate chưa.



> [!IMPORTANT]
> ### 🎯 BÀN GIAO PHIÊN 2026-07-02 (B) — ĐỌC ĐẦU TIÊN (nối tiếp phiên (A) cùng ngày)
> **Máy:** như (A) — path `D:\10.SAT_Prep_App 30.6\...\10.SAT_Prep_App\`. ⚠️ Bash mỗi phiên `export PATH="$PATH:/c/Program Files/nodejs"`. Verify đầu phiên PASS: tsc sạch · **test 122/122** · lint **0/0** · build **43 pages**. **User-side phiên này: KHÔNG làm gì** (chọn "continue") → Claude tự chạy hết mục 🟢 "VIỆC CLAUDE TỰ LÀM ĐƯỢC".
>
> **✅ LÀM PHIÊN NÀY — 3/3 mục 🟢 file-based → Supabase XONG (fail-safe, CHƯA COMMIT, tree bẩn):** App cuối phiên XANH: tsc sạch · **test 122/122** · lint **0/0** · build **43 pages**. Khuôn mẫu chung mọi mục: store Supabase mới + SQL migration (user chạy sau) + **fail-safe degrade về hành vi cũ khi bảng chưa có** — runtime-verified ĐỦ CẢ 3 trên dev server (bảng absent → `PGRST205` log → degrade sạch, 0 crash).
> 1. **5.1 Cost-ledger → Supabase (rủi ro THẤP) — XONG.** `src/lib/cost-ledger-store.ts` (MỚI) + `ai-cost.ts` viết lại (bỏ fs/mutex/`ai_cost_global.json`, delegate store). `checkBudget`/`getCostReport` → ASYNC; 3 call site +`await` (chat:119, generate-practice:99, admin/ai-cost:15). `recordGlobalCost` vốn async (signature KHÔNG đổi → 2 call site fire-and-forget nguyên). **FAIL-OPEN** (bảng absent → ledger rỗng → allowed=true = hành vi cũ). SQL: `sat-prep-web/ai_cost_ledger.sql`. ⚠️ đánh đổi: quên tạo bảng prod → không có trần chi phí. Runtime: `/api/admin/ai-cost` → 200 costUsd 0.
> 2. **2.1 Question Bank → Supabase (rủi ro TB, hot path) — XONG.** `question-bank.ts` viết lại (bỏ fs/mutex, bảng `questions`). `poolSize`/`getFromBank` → ASYNC (4 call site generate-practice +`await`); `saveToBank` upsert onConflict `id` (dedup hash, `ignoreDuplicates`). **FAIL-SAFE** (bảng absent → poolSize 0 + getFromBank null → route sinh AI = hành vi cũ). SQL: `sat-prep-web/questions.sql` (+2 index module/difficulty). Runtime: 1 call gpt-4o-mini thật (vocab) → 200 `_source:'ai'` skillId đúng, poolSize async KHÔNG crash.
> 3. **4.1 Streak → Supabase (rủi ro CAO, HMAC core) — XONG.** ⭐ **De-risk then chốt:** sau T7, save/load-data KHÔNG còn mang coins/xp/level (đã server-authoritative qua /api/economy + /api/skill-tree). Blob giờ chỉ streak/shield/inventory/quests/practice-history/pet = KHÔNG-đổi-tiền-thật → chỉ đổi backend lưu trữ, HMAC KHÔNG đụng. `src/lib/progress-store.ts` (MỚI): `loadProgressRaw`/`saveProgressRaw` vs bảng `user_progress`. **🔑 Cột `data_json` là TEXT (KHÔNG jsonb)** — chứa NGUYÊN chuỗi JSON đã ký; jsonb sẽ chuẩn hóa số/thứ tự key → chuỗi đọc ra khác → HMAC lệch → app tưởng gian lận → XÓA tiến trình mỗi reload. Lưu raw string → HMAC verify khớp byte-cho-byte, route KHÔNG đổi 1 dòng logic HMAC. save-data: ký (cũ)→`saveProgressRaw`, false→fallback ghi file; load-data: `loadProgressRaw`, null→fallback đọc file→verify HMAC (cũ). **FAIL-SAFE** (bảng absent / user non-uuid → fallback FILE = 0 regression). SQL: `sat-prep-web/user_progress.sql` (RLS `auth.uid()=user_id` như 4 bảng user_*). Runtime: save streak 91 → read-back 91 + shield 2 + inventory qua HMAC INTACT (file fallback, KHÔNG bị wipe).
>
> **🔴 ƯU TIÊN PHIÊN SAU (cập nhật sau khi ĐÃ DEPLOY — xem block "🚀 ĐÃ DEPLOY VERCEL" ở đầu §6):**
> - **(1) ✅ DEPLOY XONG** — `https://sat-2026.vercel.app` sống, mọi route 200. (Bug 500 do env `NEXT_PUBLIC_*` sensitive → đã sửa thành plain qua API, xem block deploy.)
> - **(2) 🔴 VỆ SINH BẢO MẬT — user làm GẤP (đều đã LỘ):** thu hồi + tạo mới: GitHub PAT `ghp_...HETIG` (lộ ảnh), Vercel token `vcp_...` (lộ chat), OpenAI key (trong `.anv` ROOT + trên Vercel → cập nhật lại biến `OPENAI_API_KEY`), reset DB password Supabase. Sau rotate: token trong `~/.gitcreds-sat2026`+`~/.vercel-token` hết hiệu lực (cấp lại nếu cần).
> - **(3) ⏳ AUTHENTICATED VERIFY (việc Claude-làm-được-tiếp NẾU user login):** user login `https://sat-2026.vercel.app/login` (`truongsonht.xd@gmail.com`) → Claude verify persist THẬT qua Supabase: streak qua reload (`user_progress`), question bank hit-rate>0 sau vài câu (`questions`), kill-switch cộng dồn (`ai_cost_ledger`), coins/mastery. + nợ cũ: PvP win-path (login→thắng→leo rank→cap 10 trận/ngày), Mistake variant full-loop.
>
> **🟢 VIỆC CLAUDE TỰ LÀM ĐƯỢC — CẠN mục file-based/serverless.** 3 mục 🟢 (5.1/2.1/4.1) XONG + sweep serverless fix 2 bug (`/api/questions`, `/api/exams`) + dọn dead code + Nhóm 2 đóng. Nếu user vẫn chưa deploy/login ở phiên sau → việc Claude làm được CÒN LẠI (thứ tự đề xuất): (i) **nợ nhỏ 5.2** `tier` hardcode `'free'` — chờ subscription Phase 2, chưa cấp thiết; (ii) **Nhóm 7 Phase-2 items** (#1 streak đối thủ ảo, #2 câu vàng hằng ngày, #3 loss-aversion điểm dự đoán, #7 pacing trainer, #10 báo cáo tuần phụ huynh) — cần Social/Parent Dashboard, LỚN, nên hỏi user trước khi làm; (iii) dọn `user_quotas` DEAD (việc user drop bảng). KHÔNG còn cutover/bug hạ tầng cấp thiết → phiên sau NÊN chờ user deploy rồi authenticated-verify thay vì tự tìm việc.
>
> **📦 GIT PHIÊN (B):** ✅ **ĐÃ COMMIT + PUSH LÊN GITHUB (2026-07-02).** Repo remote: `https://github.com/nhatkynghia-cell/SAT-2026.git` (main). Commit `6c4b156` (5.1/2.1/4.1) + merge README `07f193d` = HEAD, đã verify `origin/main` khớp `07f193d`. **Repo KHÔNG còn "0 remote".** File MỚI: `sat-prep-web/src/lib/{cost-ledger-store,progress-store}.ts` + `sat-prep-web/{ai_cost_ledger,questions,user_progress}.sql`. File SỬA: `sat-prep-web/src/lib/{ai-cost,question-bank}.ts` + `sat-prep-web/src/app/api/{admin/ai-cost,chat,generate-practice,save-data,load-data}/route.ts` + docs. ⚠️ **.gitignore đã cứng hóa 3 lớp chặn secret:** `.env.local`, **`.anv` (file ở ROOT chứa NGUYÊN OpenAI key `sk-proj-...` — LỘ TRÊN ĐĨA, user PHẢI thu hồi key này)**, và `10.SAT_Prep_App - Copy/` (bản Streamlit cũ 2860 file gồm python_embed). Chỉ 23 file sạch lên git. CI `.github/workflows/ci.yml` giờ chạy thật trên push — kiểm ở tab Actions GitHub. ⚠️ **CI run #1 ĐỎ** (2026-07-02): job fail ~10s ở bước `npm ci` — ERESOLVE (`lucide-react@0.344.0` đòi peer react ^16/17/18, dự án dùng react 19). **ĐÃ VÁ commit `2b6aa35`:** `ci.yml` push đầu là bản CŨ (chỉ có `npm ci` + job `test`) — viết lại thành `npm ci --legacy-peer-deps` + khôi phục 3 cổng tsc+test+lint (đúng thiết kế 5.4). Đã reproduce lỗi + verify fix trong temp dir (`npm ci --legacy-peer-deps` exit 0) trước khi push. HEAD sau vá = `2b6aa35`. ✅ **CI run #2 XANH (2026-07-02, user xác nhận ảnh):** job `verify` Success 33s (chỉ 1 warning Node 20 deprecated, vô hại). Cổng tsc+test+lint chạy thật trên GitHub Actions.

> **🧹 DỌN + SWEEP SERVERLESS (2026-07-02, cuối phiên B, HEAD `1ee65e9`):**
> - **Dọn dead code** (commit `c1da231`): xóa `helpers/mutex.ts` (`acquireLock`) + `getSharedDataPath`/`readUserJson`/`writeUserJson` trong `user-data.ts` — 0 caller sau khi 5.1/2.1 bỏ đường file. Giữ `getUserDataPath` (fallback file của 4.1).
> - **Nhóm 2 đóng trọn:** 2.3 debounce save — review `GamificationContext.tsx:256-283`, trailing-debounce 1.5s đã đúng chuẩn → KHÔNG sửa (tránh over-engineer file rủi ro cao).
> - **⭐ Sweep file I/O runtime → 2 BUG THẬT serverless (ĐÃ FIX):** (1) **`/api/questions` (commit `adaf80f`)** đọc `fs.readFileSync('../10.SAT_Prep_App - Copy/data/golden_hour_questions.json')` = NGOÀI root deploy + đã gitignore → Vercel **500 không fallback** (AITutoring "Câu hỏi vàng" vỡ). Fix: copy JSON vào `src/data/` + import như module. Browser-verify 200. (2) **`/api/exams` (commit `1ee65e9`)** đọc `process.cwd()/data/mock_exams.json`; file-tracing không đảm bảo bundle file đọc động → Vercel có thể trả rỗng ÂM THẦM. Fix: import `src/data/mock_exams.json` như module. Browser-verify 200, 1 đề.
> - **`/api/migrate-data` GIỮ NGUYÊN (quyết định phạm vi, KHÔNG phải bug):** cũng đọc `../10.SAT_Prep_App - Copy/` nhưng có `fs.existsSync` guard → file thiếu → 200 + "File không tồn tại", KHÔNG crash. Tool migrate 1-lần từ Streamlit cũ, vô hại prod. Xóa/giữ = user quyết.
> - **Kết luận:** KHÔNG còn file I/O nào vỡ trên serverless (chỉ còn `getUserDataPath` fallback 4.1, chấp nhận được). App **sẵn sàng deploy Vercel**.


> [!IMPORTANT]
> ### 🎯 BÀN GIAO PHIÊN 2026-07-02 — ĐỌC ĐẦU TIÊN
> **Máy:** đổi máy LẦN 2 (xem block "💻 ĐỔI MÁY MỚI LẦN 2"). Path `D:\10.SAT_Prep_App 30.6\10.SAT_Prep_App 30.6\10.SAT_Prep_App\10.SAT_Prep_App\`. Node 24.18.0 mới cài (winget). ⚠️ Bash mỗi phiên `export PATH="$PATH:/c/Program Files/nodejs"`. App cuối phiên XANH: tsc sạch · **test 122/122** · lint **0/0** · build **43 pages**. 3 commit mới `0e5e810`/`e328498`/`c1fa15d` trên `main`.
>
> **✅ USER ĐÃ CHẠY SQL `phase1_5_pvp_mistakes.sql`** (2026-07-02, xác nhận "Success. No rows returned"): thêm `user_economy.pvp_rank/pvp_fights_today/pvp_last_fight_date` + `user_mistakes.skill_id`. → Mở khóa 2 việc:
>
> **✅ LÀM PHIÊN NÀY (2026-07-02) — 3 commit trên `main` (repo vẫn CHƯA remote):**
> 1. **PvP anti-faucet TỰ KÍCH HOẠT sau migration** — KHÔNG cần code thêm (đã wire fail-safe từ commit `1a329e5`). **Verify:** POST `/api/economy {action:'pvp'}` với `local-default-user` → 503 fail-safe (ĐÚNG: `local-default-user` không phải uuid). **Log server chứng minh migration THÀNH CÔNG:** lỗi = `invalid input syntax for type uuid: "local-default-user"` (22P02), KHÔNG phải `column does not exist` (42703) → PostgREST parse được cả 3 cột pvp_* trong SELECT trước khi cast uuid = **cột tồn tại**. Win-path vẫn cần login uuid thật (ràng buộc cũ). Task verify PvP DONE trong giới hạn không-login.
> 2. **Nhóm 7 #6 (Mistake→biến thể) XONG + browser-verify + rà soát thủ công 3 chiều** — commit `0e5e810`. Xem block "✅ MISTAKE VARIANT".
> 3. **PvP edge-case tests** — commit `e328498`. +4 test (fightsTodayEffective sanitize âm/float/0 qua checkPvpAttempt+bumpPvpCounter; resolvePvpFight 0/0 winProb guard không NaN; basePower clamp). 118→122 test.
> 4. **3.2 LoadingState (shared component)** — commit `c1fa15d`. Trích `<LoadingState message=/>` (spinner-card ⚙️ lặp 5 chỗ) áp vào 4 call site (CorePracticeUI/AITutoring/math/skill-tree). **CHỦ Ý KHÔNG làm `<ErrorState/>`** (lỗi dị nhau: toast=chuẩn de-facto, 1 error-box, còn lại im lặng/context → shared chỉ thêm props vô nghĩa). gate-exam (full-screen phase) + MistakeNotebook (text) giữ riêng. Browser-verified LoadingState render sống trong AITutoring, 0 error.
> 5. **AITutoring skill_id — QUYẾT ĐỊNH KHÔNG wire (đúng đắn):** AITutoring dùng `/api/questions` → `golden_hour_questions.json` (8 câu tĩnh legacy), field `type` chỉ Math/Writing/Reading (domain thô). Không map được sang skillId hợp lệ (Math=16 skill; Writing=không có skill trong taxonomy); đoán từ text = heuristic BỊ CẤM (2026-07-01) vì bẩn mastery. Degrade graceful đã có (skill_id=null → guard `m.skill_id` ẩn nút biến thể). App cuối phiên XANH: tsc sạch · **test 122/122** · lint **0/0** · build **43 pages**.
>
> **🔴 ƯU TIÊN PHIÊN SAU (VIỆC USER — Claude KHÔNG làm được, chặn deploy):**
> - **(a) Tạo repo GitHub + push `main`** (repo hiện 0 remote; 3 commit mới phiên này `0e5e810`/`e328498`/`c1fa15d` + toàn bộ lịch sử) → CI `.github/workflows/ci.yml` mới chạy thật.
> - **(b) Tạo bảng Supabase còn thiếu** (SQL Editor, DB PROD): `questions` (Question Bank 2.1, thay `question_bank.json` file-based), `ai_chat_cache` (5.3, file `ai_chat_cache.sql` đã sẵn), cost-ledger thay `ai_cost_global.json` (5.1). Cả 3 đều là gốc "file-based reset trên serverless".
> - **(c) Thu hồi OpenAI key cũ + reset DB password Supabase** (đã từng lộ phiên 2026-06-29).
> - **(d) Authenticated verify (cần login uuid thật):** PvP win-path (login → thách đấu rank kế → thắng cộng xu + leo rank + cap 10 trận/ngày chặn farm); Mistake variant full-loop (làm biến thể SAI → ghi mastery đúng skill + lưu câu sai mới + SRS box câu GỐC về 1).
> - **(e) [tùy chọn] #6 mở rộng:** hiện chỉ câu sai từ CorePracticeUI (math/literature/vocab/desmos/tower/gate) có skill_id → có nút biến thể. Câu sai từ AITutoring (golden_hour tĩnh) không có — chấp nhận được.
>
> **🟢 VIỆC CLAUDE TỰ LÀM ĐƯỢC (KHÔNG cần user — phiên sau tự chạy theo khuôn mẫu PvP fail-safe):** Còn 3 chỗ file-based sẽ vỡ/reset trên Vercel serverless. Khuôn mẫu an toàn: viết `*-store.ts` Supabase + SQL migration (user chạy sau) + **fail-safe** (bảng chưa có → degrade về hành vi cũ, KHÔNG vỡ). Xếp theo rủi ro tăng dần:
> - **5.1 Cost-ledger → Supabase (LÀM TRƯỚC, rủi ro THẤP):** `ai_cost_global.json` reset mỗi cold-start → kill-switch ngân sách AI **vô dụng trên Vercel**. Đã KHẢO SÁT xong (chưa viết code): `checkBudget`/`getCostReport` (sync→async, 3 call site: chat:119, generate-practice:99, admin/ai-cost:15 — 2 cái đầu đã trong async handler chỉ thêm `await`; `recordGlobalCost` đã async sẵn fire-and-forget). Bảng DÙNG CHUNG (như ai_chat_cache) → RLS `authenticated using(true)`, KHÔNG scope user_id. **Quyết định thiết kế: fail-OPEN** khi bảng chưa có (allowed=true, no-op record) = đúng hành vi hiện tại, không chặn nhầm dev. ⚠️ đánh đổi: deploy prod mà quên tạo bảng → không có trần (flag rõ trong handoff khi làm xong).
> - **2.1 Question Bank → Supabase (rủi ro TRUNG BÌNH, hot path):** `question_bank.json` reset → hit-rate ≈0% trên Vercel. Cần bảng `questions`. Đọc/ghi mỗi lần gọi AI.
> - **4.1 nốt Streak → Supabase (rủi ro CAO, đụng HMAC core):** `streak_data.json` qua save/load-data route. Cần bảng mới + đụng logic HMAC. Để CUỐI.

> [!NOTE]
> ### ✅ MISTAKE VARIANT (2026-07-02) — Nhóm 7 #6 "Mistake→biến thể" (active recall thay vì xem lại đáp án)
> **Mục tiêu:** ôn câu sai bằng câu BIẾN THỂ (cùng skill, khác số liệu) → active recall bền hơn xem đáp án; kết quả biến thể = tín hiệu SRS THẬT (đúng→box lên, sai→về box 1) mạnh hơn tự đánh giá "nhớ/quên". Đã hết chặn nhờ cột `user_mistakes.skill_id`.
> **Đã làm (6 đổi, app XANH: tsc·test 118/118·lint 0/0·build 43 pages, ĐÃ COMMIT `0e5e810`):**
> 1. **`lib/mistake-variant.ts` (MỚI, THUẦN)** — `buildVariantRequest(skill: SkillLike|null, difficulty)` → payload generate-practice hoặc null. ⚠️ **BÀI HỌC:** ban đầu import VALUE chéo `.ts` (`getSkill`/`selectDifficulty`) → `node --test` FAIL `ERR_MODULE_NOT_FOUND` (type-stripper không resolve extensionless value import; tsc pass vì exclude test + bundler resolution). Theo mẫu gate-exam.ts: module THUẦN chỉ import TYPE, mọi VALUE (taxonomy/mastery/difficulty) do CALLER tiêm. Refactor thành dependency-injection → xanh. (Cũng gặp bug `*/` trong string `"src/**/*.test.ts"` đóng block-comment sớm → xóa dòng đó.)
> 2. **`lib/mistake-variant.test.ts` (MỚI)** — 4 test (skill hợp lệ→payload; null→null; moduleType từ skill tiêm; difficulty echo). 114→118 test.
> 3. **`api/cau-sai/variant/route.ts` (MỚI)** — GET ?skillId → getSkill (400 nếu invalid) + getSkillMastery→selectDifficulty (ZPD) → buildVariantRequest → fetch generate-practice nội bộ (forward cookie, mirror tower/question) → trả câu + skillId+difficulty thật. Passthrough status lỗi (429/503).
> 4. **`lib/mistakes-store.ts`** — `MistakeEntry.skill_id?: string|null` + insert `skill_id` trong addMistake.
> 5. **`components/CorePracticeUI.tsx`** — POST `/api/cau-sai` giờ gửi `skill_id: questionData.skillId ?? null` (skillId đã sẵn scope, trước chỉ dùng cho /api/mastery).
> 6. **`components/MistakeNotebook.tsx`** — import CorePracticeUI+type; state variantQ/Loading/Error/Scored; nút "🎲 Luyện câu biến thể" trong review mode CHỈ khi `m.skill_id`; khi có variantQ → render CorePracticeUI inline, `onAnswer`=tín hiệu SRS (`handleVariantAnswer`→`handleReview(isCorrect)`, chấm 1 lần/câu qua `variantScored`); reset variant state ở load/handleReview.
> **🔍 Browser-verify (dev server port 3000, Next 16.2.9, `local-default-user`):** (a) `/api/cau-sai/variant?skillId=garbage` → **400** "Câu sai này chưa gắn kỹ năng..." (câu sai cũ skill_id=null → ẩn nút, degrade sạch); (b) `?skillId=algebra.linear_eq` → **200**, câu AI thật, `difficulty:Easy` (ZPD mastery 0), `skillId` echo đúng (ghi mastery đúng chỗ khi làm lại); (c) MistakeNotebook (bật radio "notebook" ở Sidebar) render heading+2 tab+empty-state, 0 console error, 0 error dialog. ⚠️ CHƯA verify authenticated: làm lại biến thể SAI → ghi mastery + lưu câu sai mới + SRS box câu gốc (cần login uuid thật; đường code mirror path đã verify của Tower/mastery nên rủi ро thấp).
> **⏳ NỢ:** authenticated full-loop (làm biến thể → SRS câu gốc cập nhật + mastery ghi). AITutoring vẫn KHÔNG gửi skill_id (QuestionData thiếu field) → câu sai từ AITutoring = skill_id null = không có nút biến thể (chấp nhận được, không chặn).

> [!IMPORTANT]
> ### 🎯 BÀN GIAO PHIÊN 2026-07-01 — ĐỌC ĐẦU TIÊN
> **Máy:** Node 24.18.0, path `E:\Nghia - Dự án 2026\10.SAT_Prep_App 30.6\10.SAT_Prep_App\10.SAT_Prep_App\`. ⚠️ Bash mỗi phiên `export PATH="$PATH:/c/Program Files/nodejs"`. ⚠️ AGENTS.md: đây là **Next.js BIẾN ĐỔI** (Next 16 + Turbopack, `proxy.ts` thay middleware) — đọc `node_modules/next/dist/docs/` khi nghi ngờ API. App cuối phiên XANH: tsc sạch · **test 108/108** · lint **0/0** · build **42 pages**. **Server-authoritative là luật:** client gửi HÀNH ĐỘNG, server quyết số liệu (§9.1).
> **✅ LÀM PHIÊN NÀY (2026-07-01) — đều verify live trên dev server, ĐÃ COMMIT:**
> 1. **Lint 0/0 + CI lint thành cổng chặn** — xem block "✅ DỌN LINT".
> 2. **V1 → Tower adaptive thật** (phát hiện `generate-practice` từng bỏ qua `difficulty` + Tower ghi mastery sai địa chỉ) — xem block "✅ TOWER ADAPTIVE".
> 3. **PvP economy server-authoritative** (khép nợ T7; lực chiến từ mastery + cổng năng lực) — xem block "✅ PVP ECONOMY". **Faucet xu ĐÃ VÁ + WIRE (fail-safe):** rank server-side + cap/ngày + server tự tính targetRank (bỏ qua client). Pre-migration → route trả 503 "đang nâng cấp" (faucet ĐÓNG). Tự kích hoạt khi USER chạy `phase1_5_pvp_mistakes.sql`.
> 4. **Nhóm 7 #9 — "Vì sao đáp án kia sai"** (phân tích từng đáp án bẫy) — xem block "✅ CHOICE ANALYSIS".
> 5. **Nhóm 7 #8 — Hint theo bậc**: hint cấp 2 (20 xu) nâng thành gợi ý LOẠI TRỪ — lộ bẫy 1 đáp án sai (từ `choice_analysis`), không lộ đáp án đúng. Fallback khi câu bank thiếu field.
> 6. **choice_analysis cho trang Toán** (`math/page.tsx`): trang Toán dùng UI inline RIÊNG (không phải CorePracticeUI) nên trước đó thiếu block "VÌ SAO CÁC ĐÁP ÁN KIA SAI". Đã thêm block render sau submit (cùng mẫu index-match). ⚠️ Static-verify OK, CHƯA browser-verify trên trang Toán (verify bị ngắt) — xác nhận phiên sau.
>
> **🖥️ BROWSER-VERIFY (2026-07-01, dev server riêng port 3000 — chat khác đã thoát):** auth fallback `getCurrentUser`→`local-default-user` khi chưa login (auth.ts:44) nên test được không cần mật khẩu. ĐÃ verify mắt: (a) **PvP page** render OK, combat power thật 1,640 từ /api/stats, click Thách Đấu → 503 "đang nâng cấp" hiện đẹp, KHÔNG crash; coins path (GET + answer-grant 100→105) KHÔNG bị đụng. (b) **choice_analysis + hint LOẠI TRỪ** trên `/vocabulary` (dùng CorePracticeUI): hint cấp 2 kéo bẫy thật ("'inconsequential' nghĩa là không quan trọng..."), submit → block "VÌ SAO CÁC ĐÁP ÁN KIA SAI" render đủ 4 dòng, đáp án user chọn đánh dấu "(Bạn đã chọn)".
> **✅ ĐÃ BROWSER-VERIFY TRANG TOÁN (2026-07-01, phiên sau, port 3000):** block choice_analysis trên `math/page.tsx` (commit `4501fb0`) render THẬT. Bank giờ có 20 câu (13 math, 0 câu có `choice_analysis`) > MIN_POOL=8 → click chủ đề trả câu bank (274ms) → block ĐÚNG bị ẩn (guard `Array.isArray && length>0` chạy đúng, degrade sạch). Ép `prefer:'ai'` (patch fetch trong browser, KHÔNG sửa source) → sinh câu AI thật (10.6s) → chọn đáp án SAI + submit → block "🔍 VÌ SAO CÁC ĐÁP ÁN KIA SAI?" render đủ 4 dòng: đáp án đúng ✅, đáp án user chọn ❌ + badge "(Bạn đã chọn)", 2 đáp án sai còn lại ⚠️ kèm bẫy cụ thể. Fetch đã restore, source tree KHÔNG đổi. → **Nhóm 7 #9 XONG HẲN cho MỌI trang.** Các trang CorePracticeUI (vocab/literature/desmos/tower) đã verify trước đó.
>
> **📦 GIT (2026-07-01):** 5 commit trên `main` (repo vẫn CHƯA remote): `6eebb8b` (Tower+PvP+choice_analysis+lint+T5 files, 46 file) · `4e66b50` (hint bậc 2) · `0315898` (anti-faucet pure logic + SQL migration) · `1a329e5` (wire anti-faucet vào route+store+context, fail-safe) · `4501fb0` (choice_analysis cho trang Toán). `.env.local` an toàn (nested `sat-prep-web/.gitignore` có `.env*`). Tree sạch sau `4501fb0`.
>
> **🧱 #6 (Mistake→biến thể) BỊ CHẶN:** `user_mistakes` KHÔNG có cột `skill_id` (`mistakes-store.ts` insert sẽ lỗi nếu thêm cột lạ). Sinh biến thể "cùng skill" + ghi mastery đúng skill → CẦN cột `skill_id` = việc USER. Bản heuristic (đoán skill từ question text) sẽ kém chính xác, mâu thuẫn nguyên tắc mastery-đúng-địa-chỉ → KHÔNG làm.
>
> **🔴 ƯU TIÊN PHIÊN SAU:** Việc USER (đều chặn): (a) **Chạy `sat-prep-web/phase1_5_pvp_mistakes.sql`** trên Supabase SQL Editor — thêm cột `user_economy.pvp_rank/pvp_fights_today/pvp_last_fight_date` + `user_mistakes.skill_id`. SAU KHI CHẠY: logic thuần anti-faucet ĐÃ SẴN (`checkPvpAttempt`/`bumpPvpCounter`/`nextPvpRank` trong economy.ts, commit `0315898`) → chỉ cần WIRE vào `economy-store.ts` (đọc/ghi cột mới) + `/api/economy` action pvp (gọi checkPvpAttempt trước cổng năng lực, bumpPvpCounter + nextPvpRank sau resolve). ⚠️ ĐỪNG wire TRƯỚC khi chạy SQL (upsert cột chưa tồn tại → hỏng saveEconomy → mất coins/xp). skill_id mở khóa #6. (b) tạo bảng `questions`/`ai_chat_cache`/cost-ledger; (c) thu hồi key cũ + reset DB pw; (d) tạo repo GitHub + push `main` (CI chạy thật).

> [!NOTE]
> ### ✅ CHOICE ANALYSIS (2026-07-01) — Nhóm 7 #9 "Vì sao đáp án kia sai" (phân tích từng đáp án bẫy)
> **Mục tiêu:** dạy kỹ năng LOẠI TRỪ BẪY (cốt lõi SAT) + giữ chân ở màn feedback (tò mò "mình sập bẫy nào"). Tách app khỏi ngân hàng câu tĩnh.
> **Đã làm (2 file, app XANH: tsc·lint 0/0·test 108/108·build 42 pages, CHƯA commit):**
> 1. **`api/generate-practice/route.ts`** — thêm trường `choice_analysis` (mảng `{choice_letter, is_correct, analysis}`) vào CẢ baseSchema + mathSchema (+ required vì OpenAI `strict:true` đòi mọi property nằm trong required). Directive prompt DÙNG CHUNG mọi module (nối sau block difficulty): mỗi đáp án 1-2 câu TV — đúng thì vì sao, sai thì BẪY GÌ. `cleanAiText` chạy trên `analysis` (chuẩn hóa LaTeX Toán). **Additive** → câu cũ trong bank thiếu field vẫn không vỡ.
> 2. **`components/CorePracticeUI.tsx`** — type `PracticeQuestion.choice_analysis?` (optional); render block "🔍 VÌ SAO CÁC ĐÁP ÁN KIA SAI?" trong feedback sau nộp, guard `Array.isArray && length>0`. Tô màu: đúng=xanh, đáp án user chọn sai=đỏ (badge "Bạn đã chọn"), còn lại=vàng cảnh báo.
> **🔍 Verify live (1 call OpenAI thật, prefer:ai):** math Medium → choice_analysis 4 phần tử khớp 4 choices, đúng 1 câu marked correct, mỗi đáp án sai nêu bẫy cụ thể ("tính sai khi gộp hạng tử"...). difficulty=Medium tôn trọng. ⚠️ Chưa verify TRONG BROWSER (cần login); render path chỉ kiểm qua build, chưa thấy mắt.
>
> **✅ ĐÃ XONG TRƯỚC ĐÓ (Nhóm 6):** T1 (skillId+Mastery), T2 (Dashboard thật), T3 (Skill Tree page), T4 (Adaptive panel). Xem các block ✅ bên dưới.
>
> **🔴 ƯU TIÊN PHIÊN SAU (theo thứ tự):**
> 1. ✅ **T5 Cổng Khảo Thí — XONG + review + verify (2026-06-30).** Xem block "✅ T5 ĐÃ XONG" ngay dưới.
> 2. ✅ **Dọn lint — XONG (2026-07-01).** Về **0 error + 0 warning**. Đã vá nốt `MistakeNotebook.tsx` (chuyển disable-comment lên trước `load(mode)`), xóa import thừa `mock-exams/page.tsx:5`, thêm `argsIgnorePattern/varsIgnorePattern/caughtErrorsIgnorePattern: '^_'` vào `eslint.config.mjs` (xử lý `_itemId`). **Đã LẬT cờ CI:** bỏ `continue-on-error` ở `.github/workflows/ci.yml` → lint giờ là cổng CHẶN thứ 3 cùng tsc+test. Verify lại: tsc sạch · test 92/92 · build 41 pages.
> 3. ✅ **PvP economy (nợ T7) — XONG (2026-07-01).** RNG trận + lực-chiến-từ-mastery + phần thưởng đã lên server (action `pvp` ở `/api/economy`). Xem block "✅ PVP ECONOMY" ngay dưới.
> 4. **V1: verify Tower/Boss** — ✅ VERIFY (2026-07-01): prior "✅" SAI. → ✅ **ĐÃ VÁ Tower thành adaptive thật (2026-07-01).** Xem block "✅ TOWER ADAPTIVE" ngay dưới. (Gate-Exam vẫn dùng difficulty hardcode — chấp nhận được vì là bài THI chuẩn hóa, không cần ZPD; nhưng giờ generate-practice ĐÃ tôn trọng difficulty nên Gate có thể nâng cấp sau nếu muốn.)
> 5. **Deploy Vercel** — CHẶN bởi việc USER (tạo bảng Supabase còn thiếu + git push bật CI).
>
> **⏳ NỢ KỸ THUẬT MỚI (cần cột DB → việc USER, ƯU TIÊN trước deploy):** PvP rank/streak vẫn ở client save-data → server KHÔNG kiểm được targetRank hợp lệ → **faucet xu** (xem lỗ hổng đỏ ở block PVP ECONOMY). Vá: thêm cột `user_economy` (pvp_rank, pvp_fights_today, pvp_last_fight_date) → rank server-authoritative + cap số trận PvP/ngày. ĐÂY LÀ CHẶN DEPLOY THẬT, không chỉ "nice-to-have".

> [!IMPORTANT]
> ### ✅ PVP ECONOMY (2026-07-01) — Đấu trường server-authoritative, lực chiến = học thật
> **Khép nợ T7 (PvP từng descope).** 3 lỗ hổng bản cũ (`fightPvP` client-side): (1) RNG `calculateFightResult`+`Math.random()` chạy ở BROWSER → đánh lại tới khi thắng; (2) lực = `maxPower` (client save-data, bị item bơm +10/+15/+50) KHÔNG phải mastery; (3) không trao thưởng (descope). 
> **Cách vá (5 đổi + test, app XANH: tsc sạch · test 108/108 · lint 0/0 · build 42 pages):**
> 1. **`lib/economy.ts`** — `resolvePvpFight(state, {basePower,opponentPower,rewardCoins,rewardXp}, rng)` THUẦN + consts `PVP_COMBAT_SCALE=40`, `PVP_MIN_POWER_RATIO=0.5`. `combatPower=basePower×40` (basePower 0..100 → cùng thang luc_chien 120..4000). **Cổng năng lực:** chỉ đủ điều kiện khi `combatPower>=luc_chien×0.5`. winProb=`combatPower/(combatPower+luc_chien)`. Chỉ cộng thưởng khi eligible+won; thua/không-đủ → state nguyên (PvP không mất phí lượt bản này).
> 2. **`api/economy/route.ts`** — action `pvp`: load mastery→`computeStats(summary,0)` (equipmentBonus=0: trang bị KHÔNG bơm lực PvP), validate targetRank theo `PVP_OPPONENTS`, `resolvePvpFight` với `Math.random`, chỉ `saveEconomy` khi eligible+won. Trả `{eligible,won,granted,combatPower,targetRank,state,reason}`.
> 3. **`context/GamificationContext.tsx`** — `fightPvP` thành ASYNC: POST `/api/economy` action pvp; eligible+won→`syncEconomy(state)`+leo rank+bump streak; thua→reset streak; !eligible→trả message hướng dẫn. Bỏ import `calculateFightResult` (RNG client xoá sổ). Interface `fightPvP: () => Promise<...>`.
> 4. **`app/pvp/page.tsx`** — `handleFight` await async + chống double-click (`isFighting`). Hiển thị **combatPower thật** từ `/api/stats` (basePower×SCALE) thay `maxPower` client; badge cảnh báo khi chưa đủ lực + disable nút. Refetch stats sau mỗi trận.
> 5. **`lib/economy.test.ts`** — +7 test (cổng dưới ngưỡng/biên; combatPower=base×scale; eligible+win cộng đúng thưởng; eligible+thua không thưởng; lực cao→winProb cao; reward kẹp>=0). 101→108 test.
> **⚖️ Cân bằng (đã mô phỏng):** basePower 0 → khoá hết (phải học mới chơi). basePower 51 (account test) → rank10 94% win (dopamine dễ), rank5 58%, rank1 34% cược jackpot 15000 xu. Jackpot rank1 đòi basePower>=50 = mastery thật → thưởng nối thẳng vào năng lực học.
> **🔴 LỖ HỔNG CÒN HỞ (review adversarial bắt được — KHÔNG được quên):** cổng năng lực CHỈ chặn account YẾU, KHÔNG chặn FARM. Account đã giỏi (basePower>=50) có thể **script POST `/api/economy {action:'pvp',targetRank:1}` lặp vô hạn** — không cooldown, không phí lượt, server KHÔNG kiểm targetRank có hợp lệ với rank thật của user (rank chỉ ở client save-data, không authoritative). ~33% × 15000 xu/lần = faucet xu, mà xu đổi quà THẬT (voucher 50000 xu). **Nói cách khác: "rank-skip vô hại" ở ghi chú cũ là SAI.** Vì sao chưa vá in-code: cap-trận/ngày cần STATE SERVER riêng; nhét vào `inventory` sẽ hỏng `/api/stats` (equipmentBonus=inventory.length×5) → cần CỘT DB = việc USER. App pre-deploy (0 user thật) nên chưa phải exploit live, nhưng PHẢI vá trước khi mở thật.
> **🔍 Verify:** unit test phủ win-path; live smoke-test curl `/api/economy` action pvp trên dev server: rank lạ→400; user mastery 0→eligible=false+combatPower=0+state nguyên (coins 100). ⚠️ Chưa verify win-path TRONG BROWSER (cần login account mastery>0, như Tower). **CHƯA commit.**
> **⏳ HOÃN (cần cột DB = việc USER, CHẶN deploy thật):** rank/streak server-side + cap trận/ngày chống farm — xem lỗ hổng đỏ ở trên. KHÔNG còn coi là "cosmetic vô hại".
> **✅ Đã vá theo review (2026-07-01):** (1) `fightPvP` streak dùng functional update `prev.pvpWinStreak+1` (không stale); (2) [liên quan] `CorePracticeUI` choice_analysis match user-pick theo INDEX không parse chữ cái đầu.

> [!IMPORTANT]
> ### ✅ TOWER ADAPTIVE (2026-07-01) — Tháp Vô Tận giờ dùng mastery thật, ghi mastery đúng skill
> **Phát hiện gốc khi làm:** `/api/generate-practice` TRƯỚC ĐÂY **bỏ qua hoàn toàn field `difficulty`** trong body — prompt math hardcode "SIÊU KHÓ - HARD MODULE", nên mọi câu math đều Hard bất kể caller gửi gì. Tower lại gửi topic tự do `"Tower Floor N"` → `resolveSkillId` không match keyword → mọi câu quy nhầm về `algebra.linear_eq`. Tức Tower trước đây: độ khó giả (server phớt lờ) + mastery ghi sai địa chỉ.
> **Đã sửa (6 đổi + 1 file mới, app XANH: tsc sạch · test 101/101 · lint 0/0 · build 42 pages):**
> 1. **`api/generate-practice/route.ts`** — đọc + áp dụng `difficulty` từ body. Parse + validate (Easy/Medium/Hard); nối directive ÉP độ khó vào CUỐI systemPrompt (ghi đè dòng hardcode phía trên). **Không truyền difficulty → KHÔNG nối gì → hành vi y hệt cũ** (math vẫn mặc định Hard) → 4 trang math/desmos/literature/vocab KHÔNG đổi. Bank lọc theo difficulty (3 call site getFromBank truyền reqDifficulty; 2 fallback degrade mềm `?? getFromBank(...không-difficulty)`).
> 2. **`lib/question-bank.ts`** — `getFromBank(moduleType, topic?, difficulty?)` thêm tham số lọc difficulty (đọc `data.difficulty`). Không truyền → lấy bất kỳ (cũ).
> 3. **`lib/adaptive.ts`** — thêm 2 hàm THUẦN: `towerDifficulty(mastery, floor)` = nền ZPD (`selectDifficulty`) + áp lực tầng (≤8:+0, 9-16:+1, 17+:+2, cap Hard) → yếu vẫn khởi đầu thắng được (flow/chống rage-quit) nhưng trần dâng; `pickTowerSkill(skills, floor)` = xoay vòng trong `TOWER_SKILL_WINDOW=5` skill MATH yếu nhất chưa thành thạo theo `(floor-1)%window` → mỗi tầng 1 chủ đề khác (đỡ nhàm) mà vẫn dồn điểm yếu. Math-only.
> 4. **`api/tower/question/route.ts`** (MỚI) — GET ?floor=N: auth → getMasterySummary → pickTowerSkill → fetch generate-practice nội bộ (truyền cookie như gate-exam) → trả câu kèm `skillId` + `difficulty` THẬT. Chuyển nguyên status lỗi (429 quota/503 budget) cho client. Mirror pattern gate-exam.
> 5. **`tower/page.tsx`** — `generateFloorQuestion` GET `/api/tower/question?floor=N` thay vì tự dựng generate-practice. Hiển thị lỗi từ server. Bỏ dòng "trap rate theo tầng" (giờ độ khó do mastery), sửa copy intro.
> 6. **`adaptive.test.ts`** — +9 test (towerDifficulty nền/áp lực/cap; pickTowerSkill math-only/yếu-nhất/xoay-vòng/window/difficulty khớp). 92→101 test.
> **✅ BROWSER-VERIFY (2026-07-01, phiên sau, port 3000):** gọi thẳng `GET /api/tower/question?floor=N` từ browser (account chưa login = `local-default-user`, mastery toàn 0 → nền ZPD = Easy). Kết quả KHỚP thiết kế: floor 1 (≤8,+0)→**Easy** `advanced.quadratic`; floor 9 (9-16,+1)→**Medium** `advanced.radicals`; floor 17 (17+,+2)→**Hard** `advanced.exponential`. Độ khó leo đúng theo băng tầng + skill xoay vòng (skillId THẬT, KHÔNG còn quy nhầm `algebra.linear_eq`), mỗi câu kèm `choice_analysis`. Endpoint chuyển nguyên 429 quota (khi hết 5 lượt AI/ngày) — đúng thiết kế passthrough. → **Tower adaptive XONG HẲN.**
> **📊 Lưu ý bank pool (kiểm lúc làm):** `data/question_bank.json` hiện có ĐÚNG 8 câu math (= MIN_POOL), TẤT CẢ difficulty=Hard. Hệ quả runtime (đúng như thiết kế, tự lành): Tower tầng cần **Easy/Medium** → `getFromBank` lọc theo difficulty trượt (0 câu) → sinh AI mới (prompt giờ ÉP đúng độ khó) → lưu lại bank → pool đa dạng dần. Tầng cần **Hard** → trúng bank ngay (rẻ). KHÔNG phải bug. (⚠️ nhắc lại nợ USER: tạo bảng `questions` Supabase để thay file bank này khi lên prod — 2.1.)

> [!WARNING]
> ### ⚠️ V1 KẾT QUẢ (2026-07-01) — Tower & Gate-Exam KHÔNG dùng adaptive engine (prior "✅" là SAI)
> Verify bằng đọc source trực tiếp (đã đối chiếu file:line, không chỉ tin agent):
> - **Tower** (`tower/page.tsx:19`): độ khó là công thức tuyến tính theo tầng (`floor>20?'Hard':floor>10?'Medium':'Easy'`), topic hardcode `Tower Floor N`, luôn `moduleType:'math'`. KHÔNG lookup mastery, KHÔNG gọi `selectDifficulty`, KHÔNG gắn skillId.
> - **Gate-Exam** (`api/gate-exam/route.ts:54-56`): độ khó hardcode (`i<2?'Medium':'Hard'`), skill chọn round-robin `skillPool[i%len]`. Mastery CHỈ dùng để gate ELIGIBILITY (domainAvg>=40 ở dòng 33-36), KHÔNG tune độ khó từng câu. (Có gắn `skillId` đúng → ghi mastery đúng skill, nhưng độ khó không adaptive.)
> - **Adaptive engine** (`lib/adaptive.ts:28` `selectDifficulty`, `:52` `recommendNext`): code ĐẦY ĐỦ + có test, nhưng CHỈ được gọi bởi `/api/adaptive` → `/api/adaptive` CHỈ được dùng bởi panel "Luyện Mục Tiêu" ở `skill-tree/page.tsx:106`. Tower & Gate-Exam KHÔNG hề gọi.
> **KẾT LUẬN:** Nếu muốn Tower/Boss "adaptive thật" cần: lookup mastery của skill (qua getMasterySummary), feed vào `selectDifficulty()` thay cho công thức tầng/array hardcode. ĐÂY LÀ TASK MỚI (chưa làm) — không phải đã xong như task list cũ đánh dấu.

> [!NOTE]
> ### ✅ DỌN LINT — XONG (2026-07-01) — 0 error + 0 warning, CI lint đã CHẶN
> **Kết thúc hành trình 40 error+15 warn → 0+0.** Phiên 2026-07-01 vá nốt 3 mục cuối: (1) `MistakeNotebook.tsx` chuyển `// eslint-disable-next-line react-hooks/set-state-in-effect` lên NGAY TRƯỚC `load(mode)` (hết 1 error + 1 "unused directive" warning); (2) xóa import thừa `CorePracticeUI, PracticeQuestion` ở `mock-exams/page.tsx:5`; (3) thêm block rule vào `eslint.config.mjs`: `@typescript-eslint/no-unused-vars` với `argsIgnorePattern/varsIgnorePattern/caughtErrorsIgnorePattern: '^_'` (xử lý `_itemId` + chuẩn hóa quy ước prefix `_` toàn dự án). **CI 5.4: đã bỏ `continue-on-error` ở mục lint** → lint là cổng CHẶN thứ 3 cùng tsc+test. App XANH: tsc sạch · test 92/92 · build 41 pages. CHƯA commit.
>
> _(Lịch sử chi tiết cách vá 6 file React-bug + 12 file `any`/unused phiên 2026-06-30 giữ nguyên bên dưới để tham khảo.)_

> [!IMPORTANT]
> ### 🧹 [LỊCH SỬ] DỌN LINT phiên 2026-06-30 — cách vá chi tiết (đã hoàn tất ở trên)
> **Tiến độ:** 40 error+15 warn → **1 error+4 warn**. tsc SẠCH, test 92/92, build 41 pages OK (app vẫn XANH — lint chưa chặn CI). 12 file an toàn (`any`/unused/unescaped) đã dọn qua workflow; 6 file React-bug đã vá tay (chi tiết dưới). **Mọi thay đổi CHƯA commit.**
>
> **🔴 CÒN 1 ERROR (chặn việc lật cờ CI) — `MistakeNotebook.tsx:74`** `react-hooks/set-state-in-effect`: comment `// eslint-disable-next-line` đặt SAI CHỖ (ở dòng 75, SAU `load(mode)` dòng 74) nên không suppress + sinh thêm warning "Unused eslint-disable directive" (dòng 75). **VÁ:** chuyển dòng `// eslint-disable-next-line react-hooks/set-state-in-effect` lên NGAY TRƯỚC `load(mode);` (giữa `useEffect(() => {` và `load(mode)`). Vá 1 chỗ này = hết 1 error + 1 warning.
>
> **🟡 CÒN 3 WARNING (KHÔNG chặn CI — gate chỉ tính error, vá cho sạch):**
> - `mock-exams/page.tsx:5` — import `CorePracticeUI` + `PracticeQuestion` KHÔNG dùng (file render inline riêng). VÁ: xóa nguyên dòng import đó.
> - `math/page.tsx:60` — param `_itemId` của `removeConsumable` bị flag dù đã prefix `_` (eslint config dự án KHÔNG bật `argsIgnorePattern:'^_'`). VÁ: hoặc thêm `argsIgnorePattern` vào eslint config, hoặc đổi `removeConsumable` thành no-arg + bỏ 2 call site truyền arg (`removeConsumable("...")`→`removeConsumable()`). Đơn giản nhất: để yên (chỉ warning).
>
> **✅ React-bug đã vá tay phiên này (6 file mixed):**
> - **MistakeNotebook.tsx:** HOISTED `ModeTabs` ra ngoài component (trước định nghĩa trong render → 4 lỗi "Cannot create components during render"; giờ nhận props `{mode,onChange}`, 4 call site đã sửa). Còn 1 error set-state-in-effect chưa khép (xem trên).
> - **CorePracticeUI.tsx:** effect reset-on-prop-change (`questionData`) bọc `/* eslint-disable react-hooks/set-state-in-effect */`...`enable` (reset hợp lệ, fix chuẩn `key`-prop sẽ đụng mọi caller → hoãn).
> - **math/page.tsx:** `Math.random` boss-roll (dòng ~101) bọc `// eslint-disable-next-line react-hooks/purity` (nằm trong async handler `handleGenerateLesson`, KHÔNG phải render → an toàn); `(i as any)`→`(i as {itemId?:string})`; gỡ destructure thừa `toggleBookmark`/`bookmarkedQuestions`.
> - **mock-exams + real-exams/page.tsx:** thêm interface `ExamQuestion/ExamModule/FullExam/ScoreData` thay 4 `any`; REORDER `finishExam`→`handleNextModule`→timer-effect (sửa "access before declared"); timer auto-nộp bọc `eslint-disable-next-line react-hooks/set-state-in-effect` + `exhaustive-deps`; guard null `if(!selectedExam)return` + narrow render branch `currentModule && currentQuestion ? (...) : null` (stricter type lộ null-gap mà `any` từng giấu).
> - **GamificationContext.tsx:** `QuestsState.daily/weekly/monthly: any[]`→`Quest[]` (thêm interface `Quest`); badge effect+setState → `useMemo` (thuần dẫn xuất từ level/coins/maxPower, bỏ `unlockedBadges` state + `setUnlockedBadges`); gỡ import thừa `Tier`/`getPvpRankName`.
> - **quests/page.tsx:** quest map param type `id:string` (workflow agent để `string|number|undefined` gây tsc lỗi — đã sửa).
>
> **⚠️ LƯU Ý cách vá set-state-in-effect/purity phiên này:** dùng `eslint-disable-next-line` CÓ COMMENT giải thích vì sao hợp lệ (reset-on-prop, phản ứng timer=0, random trong handler) — KHÔNG phải lười. Chỉ badge-effect được fix chuẩn bằng useMemo vì là dẫn xuất thuần. Khi vá nốt MistakeNotebook nhớ: disable phải ở dòng NGAY TRƯỚC lời gọi setState, không phải sau.



> [!IMPORTANT]
> ### ✅ T5 ĐÃ XONG (Cổng Khảo Thí / Checkpoint Gate) — CODE + adversarial review (14 fix) + authenticated full-flow verify (2026-06-30)
> **Boss=Assessment gate chèn giữa "đạt ngưỡng" và "mở chương kế" trong Skill Tree.** Trước T5: domain avg>=40 (`DOMAIN_UNLOCK_THRESHOLD`) → TỰ unlock chương phụ thuộc. Sau T5: `satisfied` = avg>=40 **VÀ** gate passed (hoặc domain không có chương phụ thuộc = `not_required`). Pass 4/5; near-miss 3/5; trượt <=2 → luyện 10 câu đúng mới thi lại.
>
> **Files mới:** `src/lib/gate-exam.ts` (PURE: isGateEligible/isRetryAllowed/evaluateGateResult/**bumpDomainGateProgress**; inline `GATE_DOMAIN_THRESHOLD=40` + `GATES_KEY='__gates__'` vì module phải thuần cho node:test — KHÔNG import value chéo .ts) · `gate-store.ts` (loadGates/saveGateResult, ghi `__gates__` trong `user_mastery.skills` JSONB, **KHÔNG cần SQL mới**) · `gate-exam.test.ts` (19 test) · `api/gate-exam/route.ts` (GET eligibility+sinh 5 câu qua generate-practice; **POST re-check `isGateEligible` server-side** trước khi ghi) · `gate-exam/[domain]/page.tsx` (intro→countdown→fighting→result, "BOSS XUẤT HIỆN").
> **Files sửa:** `skill-tree.ts` (+`gateStatus` field + `getGateStatus` state machine; `satisfied` đòi gate pass) · `api/skill-tree/route.ts` (load gates → buildSkillTree) · `skill-tree/page.tsx` (nút "⚔️ Thi Cổng"/badge "✅ Đã vượt cổng"/cooldown) · `mastery.ts` (recordAnswer GỘP `bumpDomainGateProgress` vào CHÍNH lần ghi mastery — tránh race) · `CorePracticeUI.tsx` (+prop `hideNextUntilSubmitted` chặn skip câu khi thi).
>
> **🔍 ADVERSARIAL REVIEW (workflow 4 dim × verify, 24 agent):** 20 raw → 14 confirmed → ĐÃ VÁ HẾT. Nặng nhất: **(A)** POST `/api/gate-exam` KHÔNG re-check eligibility → curl thẳng `{correctCount:5}` pass cổng bỏ qua avg>=40+cooldown → vá: POST mirror GET, !eligible→403. **(B)** `saveGateResult` nuốt read-error → đọc lỗi tạm thời → upsert `skills={__gates__}` XÓA SẠCH mastery → vá: bail nếu readError. **(C)** `incrementCorrectSinceFail` fire-and-forget race với saveMastery cùng dòng → vá: gộp `bumpDomainGateProgress` vào recordAnswer (xóa hàm cũ khỏi gate-store). **(D)** chấm tiến trình tô theo aggregate count → vá: mảng `answerLog` per-câu. **(E)** nút "Câu Hỏi Mới" cho skip không trả lời → vá: `hideNextUntilSubmitted`. **(F)** dead code `finalCorrect`/`?0:0` → dọn. **(G)** hardcode 10 retry → page import `RETRY_CORRECT_NEEDED`, skill-tree.ts +sync-comment. **(H)** "GO!" chỉ chớp 1 frame → +700ms delay.
>
> **✅ VERIFY:** tsc sạch · **test 92/92** (72→92, +19 gate-exam +1 skill-tree) · build 41 pages OK. **Authenticated full-flow PASS (login browser `truongsonht.xd@gmail.com`):** seed 8×POST `/api/mastery` algebra Hard → GET đọc lại avg=51; GET gate eligible+5 câu; chương `advanced.quadratic` state=**locked** (avg đủ nhưng gate CHƯA pass — đúng, pre-T5 đã auto-unlock); POST 4/5 → `{passed:true,score:4}`; GET lại skill-tree → algebra `gateStatus:passed,satisfied:true`, advanced.quadratic + geo.circles **locked→available**; re-GET eligibility→false (ko thi lại gate đã pass); UI `/skill-tree` render "✅ Đã vượt cổng". **Direct ineligible POST→403 (Fix A live).**
>
> **⚠️ DESIGN NOTE:** chỉ chương CÓ chương phụ thuộc mới có cổng — hiện CHỈ `algebra` (DOMAIN_PREREQS: advanced/data/geometry→[algebra], reading→[]). 3 chương Toán lá + reading = `not_required`. Nhất quán "cổng mở chương KẾ". Nếu sau muốn mọi chương có boss riêng = mở rộng DOMAIN_PREREQS hoặc đổi điều kiện gate.
>
> **⚠️ MASTERY DB SAU VERIFY:** account `truongsonht.xd@gmail.com` giờ CÓ algebra mastery (avg~51) + gate algebra passed trong DB thật (seed lúc verify). Nếu phiên sau cần state sạch để test → reset `user_mastery` row hoặc dùng account khác.


>
> **⚠️ VIỆC CỦA USER (chặn deploy, Claude KHÔNG làm được):**
> - Tạo bảng Supabase SQL Editor (DB PROD): `ai_chat_cache` (`ai_chat_cache.sql`), `questions` (Question Bank 2.1), cost-ledger thay `ai_cost_global.json` (5.1).
> - Thu hồi OpenAI key cũ + reset DB password Supabase (đã từng lộ).
> - Tạo repo GitHub + push `main` để CI chạy thật (repo hiện 0 commit, chưa remote).
> - ⚠️ **Email confirmation Supabase đang BẬT** — nếu muốn tự đăng ký account test cho dev thì tắt trên dashboard; account đã confirm: `truongsonht.xd@gmail.com`.
>
> **Git:** branch `main` (51724d6). Thay đổi CHƯA commit: ~22 file M (T7 phiên này + phần phiên trước) + `skill-tree/` + `.claude/` (launch.json) mới. 3 branch lane-a/b/c WIP (KHÔNG merge thẳng).

> [!IMPORTANT]
> ### ✅ T7 ĐÃ CUTOVER (4.1 economy server-authoritative + 4.2 gỡ Level phẳng) — CODE XONG + verify tĩnh/route PASS (2026-06-30)
> **Đây là block AUTHORITATIVE cho T7, THAY THẾ 2 block "🔴 T7 ĐÃ THỬ-REVERT" và "🔧 T7 ĐÃ KHẢO SÁT" cũ bên dưới** (giữ lại làm lịch sử). Lần này cutover ĐÃ LÀM THẬT, không revert.
>
> **Quyết định đã chốt với user phiên này:** (1) **PvP DESCOPE** khỏi T7 — `fightPvP` chỉ đổi rank/chuỗi thắng, KHÔNG cộng coins/xp (gỡ `addReward`); ghi nợ task riêng "PvP economy" (cần chuyển RNG trận + sức mạnh-từ-mastery lên server). (2) **`level = masteredCount + 1`**, retune mọi ngưỡng gate sang thang skill 1..19.
>
> **✅ ĐÃ CODE (tsc sạch · test 72/72 · build 40 pages OK):**
> - **`economy.ts`+route+test:** thêm action `quest` + `applyQuestReward(state,questId)` tra `QUEST_REWARD` keyed theo questId (q1={c10,x50}/q2={c20,x100}/q3={c100,x500}, khớp DEFAULT_STATE load-data). questId lạ→0 (đóng vector bơm tùy ý). +2 test → 72.
> - **`GamificationContext.tsx` viết lại:** XÓA `addReward`/`getMaxXp`/`levelUpAlert`/vòng level-up/`maxXp`. Mount fetch SONG SONG `/api/load-data`(nền)+`/api/economy`(ghi đè coins/xp/lastSpinDate)+`/api/skill-tree`(masteredCount→level). Thêm `syncEconomy()` set coins/xp từ response server. **Grant=ASYNC:** `handlePracticeAnswer(isCorrect,difficulty)` POST `answer`; `handleExamComplete(correctCount,difficulty)` MỚI POST `exam`. **Spend=optimistic sync:** `spendCoins`/`buyItem`/`upgradeItem` trừ cục bộ + `postSpend()` POST `spend` reconcile (spend KHÔNG phải cheat vector). `spinDailyWheel`=async POST `spin` (RNG server). `claimQuest`=async POST `quest`. Expose thêm `masteredCount`/`totalNodes`/`handleExamComplete`.
> - **Call sites:** CorePracticeUI `await handlePracticeAnswer(_,questionData.difficulty)`; AITutoring `'Medium'` (câu ko có difficulty); math normal `lessonData.difficulty`, math boss `'Hard'` (thay 150/50); mock-exams `void handleExamComplete(correct,'Medium')`; real-exams `'Hard'`; vocab `handleExamComplete(1,'Easy')`(=addReward(20,5) cũ). **tower: gỡ DEAD import** `addReward`+`useGamification` (ko dùng gì khác).
> - **Gỡ Level phẳng:** `app/page.tsx` xóa modal level-up, thanh XP→thanh mastery `masteredCount/totalNodes`, rank ternary→4/7/11/15. BADGE_CATALOG tu-vi→2/4/7/11/15. **`BadgeSystem.tsx` có MẢNG `BADGES` RIÊNG hardcode** (req_desc) → đã sửa 5 chuỗi "Cần đạt Cấp X"→"Tinh thông N kỹ năng" (logic unlock vẫn từ BADGE_CATALOG.check). collection 2/4/7/11/15; pets 1/3/6; journey 1/4/8/13; real-exams gate `<7` ("tinh thông 6 kỹ năng").
>
> **✅ VERIFY ĐÃ CHẠY:** tsc sạch · **test 72/72** · build 40 pages 0 error/warn · grep 0 vết `addReward`/`maxXp`/`levelUpAlert`/`getMaxXp` ngoài comment · 0 ngưỡng cũ 30/60/100 sót. **Route LIVE (curl localhost:3000, unauth):** quest q1→{c10,x50} ✓; q999→0 ✓; answer Hard→{c20,x100} ✓; exam Medium×3→{c30,x150} ✓; spin→server RNG +80 ✓; invalid action→400 ✓; spend overdraw→400 ✓; wrong answer→0 ✓. Home unauth render: Lv.1, bar 0/18, 100 Coins (derived-level OK). **`/api/skill-tree` totalNodes=18** (16 math+2 reading) → trần ngưỡng 15 an toàn.
>
> **✅✅ AUTHENTICATED WRITE→READ-BACK PASS (2026-06-30, login browser thật `truongsonht.xd@gmail.com`):** Login form `/login` → cookie `sb-...-auth-token` set OK. POST quest q1 → GET lại **coins 100→110, xp 0→50**; POST answer Hard → GET lại **110→130, xp 50→150** (TÍCH LŨY qua 2 lần ghi + GET độc lập đọc lại từ Supabase, KHÔNG reset về 100). Reload `/` → HUD hydrate **coins=130** từ server (đúng, không phải default). → **Economy THỰC SỰ persist vào bảng `user_economy`; lỗ hổng 9.1 đã KHÉP.** Đây là bằng chứng memory yêu cầu (POST 200 chưa đủ — đã GET lại + reload). T7 HOÀN TẤT.
> **Preview server:** `.claude/launch.json` ở ROOT workspace dùng `node.exe` tuyệt đối + `runtimeArgs:["node_modules/next/dist/bin/next","dev"]` + `cwd` sat-prep-web + `autoPort` (npm/next ko thấy node trên PATH khi preview spawn). Next dev là SINGLETON/dir → phải kill dev cũ trước (`MSYS_NO_PATHCONV=1 taskkill /PID <pid> /F`). ⚠️ **Email confirmation Supabase đang BẬT** — account đăng ký mới phải confirm email mới login được (memory cũ ghi "tắt cho dev" là STALE); account `truongsonht.xd@gmail.com` đã confirm sẵn.

> [!IMPORTANT]
> ### 🔴 BLOCKER DEPLOY SỐ 1 (đối chiếu code 2026-06-28): PERSISTENCE VẪN LÀ FILE CỤC BỘ
> Auth đã nối Supabase thật (`src/lib/auth.ts` đọc session Supabase), NHƯNG **dữ liệu user vẫn ghi xuống ổ đĩa cục bộ** bằng `fs.writeFileSync` vào `data/users/<user_id>/*.json` (`src/lib/user-data.ts`). Mọi file mastery/economy/goals/streak/ai_usage/vocab_srs đều trên filesystem.
> → Trên serverless (Vercel) filesystem chỉ-đọc & phù du → **mất sạch tiến trình học sau mỗi deploy/cold-start.** Migration đẩy lên Supabase nhưng runtime không đọc/ghi Supabase = "split-brain".
> **Đây là P0-1 trong PLAN CHUẨN "PRODUCTION READINESS" (`master_task_list.md`) — phải sửa TRƯỚC khi đưa lên hệ thống.** Thiết kế đã lường trước: chỉ cần thay thân `readUserJson`/`writeUserJson`, chữ ký hàm giữ nguyên → route + engine không phải sửa.

> [!IMPORTANT]
> ### ⚠️ TRẠNG THÁI THỰC TẾ (đối chiếu code 2026-06-28): "BUILT-NOT-WIRED"
> Một loạt engine cốt lõi **đã được viết xong** ở tầng `src/lib/` + `/api/*` + unit test (51 test pass), **NHƯNG chưa UI nào gọi tới** → người dùng chưa hưởng được. Đây là tài sản đang ngủ, kích hoạt ở P2-2 (Integration Sprint) SAU khi P0-1 xong.
>
> | Engine | lib + API + test | Đã nối UI? |
> |---|---|---|
> | Mastery (`/api/mastery`) | ✅ | ❌ luồng trả lời chưa gắn `skillId`, chưa POST |
> | Skill Tree (`/api/skill-tree`) | ✅ | ❌ chưa có trang UI |
> | Score Prediction (`/api/score`) | ✅ | ❌ Dashboard chưa gọi |
> | Adaptive (`/api/adaptive`) | ✅ | ❌ chưa gắn nút luyện |
> | Base Stats (`/api/stats`) | ✅ | ❌ UI vẫn đọc `maxPower` client |
> | Economy server-authoritative (`/api/economy`) | ✅ | ❌ context vẫn dùng `/api/save-data` |
> | Question Bank (`/api/generate-practice`) | ✅ | ✅ **đã nối** |

Dự án đang trong quá trình chuyển đổi từ Prototype (Streamlit) sang Web App thương mại (Next.js Monorepo).
Tình trạng thực tế Phase 1:
1.  **Frontend Migration (HOÀN TẤT)**: 16 module đã viết lại 100% bằng Next.js + TailwindCSS; không còn trang stub `UnderConstruction`.
2.  **Supabase Auth (HOÀN TẤT)**: Đã tích hợp Đăng ký/Đăng nhập và định tuyến Auth (tắt Confirm Email cho Dev).
3.  **Database Migration (HOÀN TẤT)**: Đã tạo các bảng Supabase và API migration đẩy dữ liệu cục bộ lên đám mây.
4.  **AI Proxy (HOÀN TẤT)**: `/api/generate-practice` ẩn API key + dùng Question Bank + kill-switch ngân sách. ⚠️ *Quota freemium chat (9.2) cần verify đã enforce theo `user_id`+ngày chưa.*
5.  **✅ Anti-Cheat server-authoritative (9.1) — ĐÃ KHÉP (2026-06-30, T7):** `GamificationContext` cutover xong — client gửi HÀNH ĐỘNG, server (`/api/economy` action answer/exam/quest/spend/spin) quyết coins/xp từ bảng cố định, client sync từ response. Verify GHI thật PASS (login browser → write→read-back→reload hydrate). Lỗ hổng `/api/save-data` ký bừa số liệu client cho economy ĐÃ đóng. *(Còn nợ: PvP economy descope — fightPvP tạm không trao thưởng tiền tệ tới khi chuyển RNG+stats lên server.)*
6.  **✅ Level phẳng 1-200 ĐÃ GỠ (2026-06-30, T7):** xóa `addReward`/`getMaxXp`/`levelUpAlert`/vòng level-up/`maxXp`/modal. `level = masteredCount + 1` (dẫn xuất Skill Tree), giữ tên biến cho 8 trang gate; mọi ngưỡng retune sang thang skill 1..19; BADGE neo vào level dẫn xuất.

**ĐANG LÀM (chốt 2026-06-28): PHASE 1.5 — KHÓA NỀN & TỐI ƯU APP** (chèn giữa Phase 1↔2, xem `master_task_list.md` Phase 1.5 với 7 nhóm + `implementation_plan.md`).

> [!IMPORTANT]
> ### 💻 ĐỔI MÁY MỚI LẦN 2 (2026-07-02) — môi trường đã dựng lại xong
> User chuyển sang máy mới (lần 2). Đường dẫn dự án hiện tại: `D:\10.SAT_Prep_App 30.6\10.SAT_Prep_App 30.6\10.SAT_Prep_App\10.SAT_Prep_App\` (máy trước là `E:\Nghia - Dự án 2026\...`; máy đầu là `D:\2026\Dự án 2026\5.SAT_Prep_App\...`).
> - **Node.js 24.18.0 + npm 11.16.0** — máy này BAN ĐẦU CHƯA cài Node (winget có sẵn). Đã `winget install OpenJS.NodeJS.LTS --silent` (2026-07-02) → cài vào `/c/Program Files/nodejs/`. ⚠️ PATH chưa vào shell hiện tại → mỗi phiên bash phải `export PATH="$PATH:/c/Program Files/nodejs"` cho tới khi mở terminal mới.
> - **Verify máy mới PASS (2026-07-02):** `npx tsc --noEmit` sạch · `npm test` **114/114** · `npm run build` **42 pages** · `npm run lint` **0/0**. `node_modules/` + `.env.local` copy sẵn theo thư mục dự án, chạy được, KHÔNG cần `npm ci` lại.
> - **Git:** repo (root ở tầng `10.SAT_Prep_App/`, KHÔNG phải sat-prep-web) `main` ở `4501fb0`, tree sạch (chỉ untracked cũ), **VẪN CHƯA có remote**. 4 branch: main + lane-a/b/c WIP + trial/smoke.
> - _(Lịch sử máy trước 2026-06-30 giữ nguyên bên dưới để tham chiếu.)_
>
> #### [LỊCH SỬ] ĐỔI MÁY 2026-06-30 (máy E:) — môi trường đã dựng lại xong
> Đường dẫn máy đó: `E:\Nghia - Dự án 2026\10.SAT_Prep_App 30.6\10.SAT_Prep_App\10.SAT_Prep_App\`.
> - **Node.js 24.18.0 + npm 11.16.0** cài qua `winget install OpenJS.NodeJS.LTS` (2026-06-30).
> - **Verify máy đó PASS:** `npx tsc --noEmit` sạch · `npm test` **67/67**. `node_modules/` + `.env.local` copy từ máy cũ chạy được, không cần `npm ci` lại.
> - **Đã prune 4 worktree chết** (lane-a/b/c + trial trỏ về path `D:` máy cũ → `git worktree prune`). **3 branch lane vẫn còn** trong repo: `lane-a-learning` (2 commit), `lane-b-rpg` (1), `lane-c-dashboard-cleanup` (1) — đều là **WIP "rescued from stalled workflow"** (partial, CHƯA qua verdict gate MERGE_RUNBOOK). main vẫn ở `51724d6` WIP T1.
> - **Đã xóa dòng rác lộ password** `# Database password: ...` khỏi `.env.local` (sự cố lộ secret phiên 2026-06-29). ⚠️ User vẫn nên reset DB password Supabase + xác nhận đã thu hồi OpenAI key cũ.
> - Python KHÔNG cài (chỉ bản Streamlit cũ cần; bản web Next.js không dùng).

> [!IMPORTANT]
> ### ✅ T1 (Nhóm 6 — keystone) HOÀN TẤT + verify runtime (2026-06-30)
> Gắn `skillId` + ghi Mastery đã wired end-to-end. Phát hiện: WIP checkpoint `51724d6` đã làm gần xong (producer `generate-practice` gắn skillId, consumer `CorePracticeUI` + `math/page` POST `/api/mastery`, mọi skillId khớp `skill-taxonomy`). Phần Claude bổ sung phiên này:
> - **Granularity (user chốt: 16 chủ đề chi tiết nhóm 4 domain):** `math/page.tsx` thay 4 nút thô → bộ chọn 2 cấp render thẳng từ `SKILL_TREE` (single source of truth) → mastery phủ đủ **13 skill Toán** thay vì 4. Trước đó 9/13 skill mãi = 0%.
> - **`generate-practice` nhận `skillId` tường minh từ UI** (ưu tiên hơn keyword-matching), validate `isValidSkill`, fallback `resolveSkillId` nếu thiếu. math + desmos giờ đều gửi skillId tường minh; `resolveSkillId` chỉ còn là lưới an toàn legacy.
> - **desmos**: 3 category map cứng skillId (algebra.systems / advanced.quadratic / algebra.systems), thread qua state `currentSkillId` + fetch/prefetch/onNext/onSubmitted.
> - ⚠️ **Bug đã biết (KHÔNG chặn):** `resolveSkillId` match từ khóa tiếng Việt bị trượt (NFC/NFD regex literal trong source) → đã thêm `.normalize('NFC')` nhưng vẫn lệch khi input NFD. Không ảnh hưởng vì đường chính gửi skillId tường minh; chỉ là fallback legacy. Nếu sau cần dùng lại resolveSkillId cho module mới → normalize cả 2 phía hoặc match bằng ASCII keyword.
> - **Verify runtime PASS:** dev server Next 16.2.9; POST explicit skillId=geo.circles/algebra.systems → echo đúng + `_source:'ai'`; invalid skillId → fallback skill hợp lệ; vocab no-skillId → rw.vocab. tsc sạch · test 67/67 · build 41 routes.
> - ⚠️ Verify ghi-DB mastery thật (POST /api/mastery có login) CHƯA chạy lại phiên này — đường này đã PASS smoke-test 2026-06-28 (UUID c43f015e...), code POST không đổi. Nên xác nhận lại khi làm T2 (dashboard đọc mastery thật).

> [!IMPORTANT]
> ### ✅ T2 + T3 (Nhóm 6) HOÀN TẤT + verify runtime (2026-06-30)
> - **T2 — Dashboard Score+Mastery thật:** Phát hiện WIP `51724d6` ĐÃ thay xong công thức cứng giả (`mathScore=40+level*2`). `dashboard/page.tsx` đọc `/api/mastery`+`/api/score`, radar dùng `domainScore()` từ mastery thật, focus skills từ `score.focusSkills`. Contract khớp 100% (verify grep + đọc lib). Runtime: dashboard 200, `/api/mastery` overall:0, `/api/score` total:400/confidence:low/totalAttempts:0 (baseline đúng user chưa luyện). KHÔNG còn công thức giả nào.
> - **T3 — Trang Skill Tree:** TẠO MỚI `src/app/skill-tree/page.tsx` (engine `/api/skill-tree`+`skill-tree.ts`+test đã có sẵn, chỉ thiếu UI). Gom node theo 4 domain Toán + Reading, mỗi node = 1 skill với 4 state (locked/available/in_progress/mastered) màu khác nhau; thanh tiến trình chương + tổng "X/13 tinh thông" thay chỉ số Level. Thêm vào Sidebar nhóm "TỔNG QUAN & LỘ TRÌNH" (`/skill-tree`, cạnh dashboard). Runtime: page 200, API trả algebra=available + chương phụ thuộc=locked (logic tiên quyết DOMAIN_PREREQS chạy đúng). tsc sạch · build 40 pages.

> [!IMPORTANT]
> ### 🔧 T7 (4.1 economy cutover + 4.2 gỡ Level phẳng) — ĐÃ KHẢO SÁT, CHƯA CODE (2026-06-30)
> Task nền nặng & rủi ro nhất (MERGE_RUNBOOK xếp lane-b merge CUỐI). Đã đọc đủ context, CHỐT 2 quyết định thiết kế với user:
> 1. **Level:** giữ biến `level` cho 8 trang gate đọc, nhưng DẪN XUẤT từ mastery (masteredCount), KHÔNG từ XP. Bỏ `addReward`/`getMaxXp`/`levelUpAlert`/vòng level-up.
> 2. **Inventory:** server (`/api/economy`) sở hữu coins/xp/inventory-ảo/spin; forge `Equipment[]` GIỮ client-side (forge chưa phải vùng đổi-ra-tiền-thật).
>
> **🔑 PHÁT HIỆN QUAN TRỌNG — bảng thưởng economy ĐƯỢC THIẾT KẾ KHỚP SẴN call site cũ** (cutover sạch, ít rủi ro hơn vẻ ngoài):
> - `ANSWER_REWARD`: Easy={coins:5,xp:20} · Medium={coins:10,xp:50} · Hard={coins:20,xp:100}.
> - vocab `addReward(20,5)` = ĐÚNG 1 câu Easy → map `{action:'answer',isCorrect:true,difficulty:'Easy'}`.
> - mock-exams `correct*50,correct*10` = Medium/câu → `{action:'exam',correctCount,difficulty:'Medium'}`.
> - real-exams `correct*100,correct*20` = Hard/câu → `{action:'exam',correctCount,difficulty:'Hard'}`.
> - tower: cần đọc lại amount khi làm.
>
> **Việc cutover (cho phiên sau, làm gọn 1 đơn vị + verify hard):**
> - `GamificationContext`: mount fetch `/api/economy` (coins/xp/inv-ảo/lastSpinDate) + `/api/mastery|skill-tree` (masteredCount→level). Mọi mutation POST `/api/economy` action, update state từ response server. Bỏ `/api/save-data` cho economy (vẫn giữ cho streak tới khi Nhóm 4.1 streak).
> - ⚠️ **Đổi signature `handlePracticeAnswer(isCorrect, difficulty)`** (bỏ truyền amount) → đụng 3 call site: `CorePracticeUI` (có `questionData.difficulty`), `math/page` (có `lessonData.difficulty` + nhánh boss), `AITutoring` (cần verify có difficulty). Đây là cốt lõi anti-cheat: client KHÔNG gửi số tiền nữa.
> - 5 call site `addReward` (mock/real-exams/vocab/tower/pvp) → đổi sang action exam/answer. pvp `addReward` trong `fightPvP` (context nội bộ).
> - 8 trang gate `level>=X`: giữ đọc `level` (đã dẫn xuất từ mastery) — chỉ chỉnh ngưỡng cho hợp (vd real-exams "Level 30").
> - Cần login thật để verify GHI economy (giống smoke-test mastery 2026-06-28). POST 200 KHÔNG đủ — phải đọc log/GET lại.

> [!IMPORTANT]
> ### ✅ T4 (Adaptive "Luyện Mục Tiêu") HOÀN TẤT + verify runtime (2026-06-30)
> Thêm panel "Luyện Mục Tiêu" vào trang Skill Tree (`src/app/skill-tree/page.tsx`): fetch `/api/adaptive` song song với `/api/skill-tree`, hiển thị skill yếu nhất + độ khó đề xuất (Easy/Medium/Hard theo `selectDifficulty`) + lý do, nút "Luyện ngay" deep-link `<Link>` sang trang module (`MODULE_ROUTE`: math→/math, literature→/literature, vocab→/vocabulary, desmos→/desmos). Chọn `<Link>` đơn giản thay vì useSearchParams/Suspense (Next 16 cần Suspense bọc) → 0 rủi ro, không đụng math/page. Adaptive 404 (chưa có skill khớp) coi là "chưa có đề xuất", không phải lỗi. Runtime: `/api/adaptive` trả algebra.linear_eq score0→Easy, filter subject=math chạy, page 200. tsc · test 67/67 · build OK.

> [!IMPORTANT]
> ### 🔴 T7 (4.1+4.2) ĐÃ THỬ — REVERT SẠCH, để phiên riêng (2026-06-30)
> Đã bắt đầu cutover economy nhưng REVERT toàn bộ (tsc sạch, 67/67, grep 0 vết) vì phát hiện **không thể làm partial an toàn**:
> - **Split-brain coins:** nếu load đọc coins từ `/api/economy` mà mutation vẫn ghi `/api/save-data` → coins mất khi reload. Phải chuyển TẤT CẢ mutation cùng lúc.
> - **`/api/economy` thiếu mảnh:** route chỉ có action `answer`/`spend`/`spin`. THIẾU branch `exam` (dù `applyExamReward` đã có sẵn ở `economy.ts`) cho mock/real-exams; THIẾU grant path cho pvp/quest (amount tùy ý = chính cheat vector cần đóng).
> - **Đổi signature:** `handlePracticeAnswer(isCorrect, difficulty)` (bỏ truyền amount) đụng CorePracticeUI + math/page + AITutoring (AITutoring=Medium vì câu không có difficulty).
> - **tower `addReward` là DEAD import** (chỉ import dòng 9, KHÔNG gọi) → khi cutover gỡ luôn.
> - Verify GHI cần login browser. → T7 là 1 ĐƠN VỊ multi-file, phải làm trọn + verify trong 1 phiên dành riêng, KHÔNG nhét đuôi phiên dài.
>
> **✅ ĐÃ KHÉP 1 blocker phụ của T7 (2026-06-30):** thêm branch `action:'exam'` vào `/api/economy/route.ts` (gọi `applyExamReward` vốn import-nhưng-chưa-dùng) + 3 unit test cho `applyExamReward` (trước đó hàm chưa có test). Server nhân correctCount × đơn giá theo độ khó, KHÔNG combo. Thuần additive (chưa caller nào gọi) → khi cutover, mock/real-exams chỉ cần POST `{action:'exam',correctCount,difficulty}`. test 67→70, tsc sạch, build OK. Blocker T7 CÒN LẠI: split-brain coins + grant path pvp/quest + đổi signature handlePracticeAnswer + verify login.

> [!IMPORTANT]
> ### 🧹 4.3/4.5 (dọn dẹp deploy) ĐÃ XONG SẴN — verify 2026-06-30
> - `/api/ai/generate` + `test-ai/` ĐÃ XÓA ở WIP `51724d6` (4.5 xong).
> - `src/proxy.ts` đã dùng convention Next 16 `export function proxy` (KHÔNG còn `middleware.ts` deprecated) — phần Next-16 của 4.3 xong.
> - API routes: **0 `console.log` debug**. Chỉ 12 `console.error` (catch hợp lệ — GIỮ) + 2 `console.warn` (fraud-log HMAC load-data — GIỮ). KHÔNG có gì cần dọn.
> - CÒN LẠI 4.3: lint nợ `any` (load/save-data/migrate/generate-practice + Math.random render math/page) → dọn rồi mới lật cờ chặn lint CI.
>
> **🐛 ĐÃ VÁ bug rules-of-hooks (2026-06-30):** `Sidebar.tsx:102` gọi `useGamification()` LẦN 2 trong JSX (`onClick={useGamification().incrementQuestionKey}`) — sau early `return null` dòng 55 → vi phạm rules-of-hooks (hook gọi có điều kiện). Đã destructure `incrementQuestionKey` ở dòng 52 và dùng trực tiếp. Verify: tsc sạch, lint Sidebar hết lỗi, test 70/70.
>
> **📊 LINT STATE (2026-06-30, cập nhật cuối phiên):** `npm run lint` còn **40 errors + 16 warnings** (đã giảm từ 48 sau khi vá `any` ở `load-data` + `save-data` route — đổi `sortKeys(obj:any)`→`unknown`, `generateSignature(data)`→`Record<string,unknown>`). Phân rã CÒN LẠI: **~28 `no-explicit-any`** (question-bank ×4, mutex, migrate-data ×3, generate-practice catch:277, vocab:8, mock/real-exams ×6 mỗi, quests:21, tower:13, AITutoring, MistakeNotebook, math:59 `(i as any)`, GamificationContext QuestsState `any[]` ×3 + ITEM_CATALOG), 14 unused-vars, 2 unescaped-entities (vocab:96), 2 exhaustive-deps, **1 set-state-in-effect (GamificationContext:438)**, **1 Math.random-in-render (math/page:101 boss roll)**, **4 "Cannot create components during render" (MistakeNotebook 97/109/171/191)**, 3 "Cannot access variable before declared" (mock/real-exams). ⚠️ CI gate lint **all-or-nothing** (chỉ lật chặn khi về 0 error). `any`-thuần dọn an toàn từng file; **4 lỗi MistakeNotebook + Math.random + set-state-in-effect là BUG React thật** (đụng logic/nền) → gộp khi làm T7 hoặc phiên dọn riêng, KHÔNG vá vội. Mẫu fix `any` JSON-normalizer đã dùng: `unknown` + cast `as Record<string,unknown>`.






> [!IMPORTANT]
> ### 📌 TRẠNG THÁI PHASE 1.5 / NHÓM 1 (cập nhật 2026-06-29T04:25) — bàn giao phiên
>
> **NHÓM 1 (KHÓA NỀN) — XONG.** 1.1 persistence ✅, 1.2 secrets + key mới đã nạp & verify SỐNG ✅, 1.3 RLS đã vá + verify cả 7 bảng `rls_enabled=true` ✅. Còn 2 việc vệ sinh bảo mật KHÔNG chặn (chỉ user làm được, xem 1.2): thu hồi key cũ + xử lý sự cố lộ secret trong ảnh phiên này. Nhóm 2 đã khởi động (2.2 xong).
>
> **Nhóm 1.1 (Persistence file→Supabase) HOÀN TẤT — đã smoke-test cả ĐỌC lẫn GHI.**
>
> **✅ SQL đã chạy xong trên Supabase (user xác nhận, đã probe EXISTS):**
> - Tạo 4 bảng mới: `user_mastery`, `user_goals`, `user_ai_usage`, `user_vocab_srs` (mỗi bảng `user_id uuid PK references auth.users(id)` + RLS `auth.uid()=user_id`).
> - **ALTER `user_mistakes` thêm 2 cột SRS: `box integer default 1`, `next_review text`** — đã verify cột tồn tại.
> - File SQL nguồn: `sat-prep-web/phase1_5_tables.sql` (giữ lại để tham chiếu).
>
> **✅ Code đã chuyển sang Supabase store (tất cả hàm liên quan giờ ASYNC):**
> - `mastery.ts`→`mastery-store.ts`; `score-prediction.ts`→`goals-store.ts`; `ai-quota.ts`→`ai-usage-store.ts`; `api/vocab`→`vocab-store.ts`; `api/cau-sai`→`mistakes-store.ts` (đã thêm SRS, bỏ đường file → hết trùng câu sai). Đã `await` ở mọi route gọi.
>
> **✅ Verify ĐỌC:** `tsc` sạch · `npm test` 51/51 · `npm run build` 41/41 · 5 route engine GET HTTP 200.
>
> **✅ Smoke-test GHI PASS (2026-06-28T09:4x):** đăng nhập THẬT trên app (`/login`, email+password → UUID `c43f015e-aa29-441b-b108-2cc79c162679`). POST `/api/mastery {algebra.linear_eq}` → log server hết lỗi `22P02`, `overall` 0→1, GET đọc lại được → **RLS cho phép GHI khi đã login.**
>   - ⚠️ **Bẫy verify đã gặp:** `saveMastery` (mastery-store.ts) NUỐT lỗi (chỉ `console.error` rồi return) → POST trả 200 KHÔNG đủ kết luận ghi thành công, PHẢI đọc log dev server. Lần POST đầu tiên thất bại vì tab chạy console CHƯA login app (server thấy `local-default-user`, DB từ chối vì cột `user_id` là uuid → lỗi `22P02`). Login app ≠ login Chrome/Gmail.
>
> **✅ An toàn dữ liệu:** File JSON cũ (`data/users/local-default-user/streak_data.json`, `vocab_srs.json`) GIỮ NGUYÊN.
>
> **🟡 Nhóm 1.2 (Secrets & key) — CODE XONG, còn rotate key thủ công:**
> - Đã bỏ fallback HMAC yếu `default_sat_secret_123` ở `save-data/route.ts` + `load-data/route.ts` → bắt buộc `SAT_PREP_SECRET` từ ENV (throw nếu thiếu, dùng IIFE để TS narrow string).
> - Đã sinh secret mạnh 64-hex vào `.env.local` + **ký lại** `streak_data.json` cũ bằng secret mới (script một lần, đã xóa) → không mất dữ liệu. Verify: tsc sạch, test 51/51, load/save-data HTTP 200.
> - Tạo `.env.example` doc hóa ENV. `.gitignore` đã che `.env*`. Git repo `sat-prep-web` có 0 commit → key `sk-proj` CHƯA từng lọt vào git.
> - ⏳ **CÒN LẠI (user tự làm trên dashboard):** rotate OpenAI key ở platform.openai.com → dán key mới vào `.env.local`.
>
> **✅ Nhóm 1.3 (Verify RLS) — HOÀN TẤT (2026-06-29):**
> - **Đã chạy `pg_policies` (SQL Editor 2026-06-28):** cả 7 bảng đều CÓ policy, `using/with_check` = `auth.uid() = user_id`. 4 bảng mới dùng policy `ALL`; 3 bảng cũ tách lệnh: `user_economy` (SELECT/INSERT/UPDATE), `test_history` (SELECT/INSERT), `user_mistakes` (SELECT/INSERT/DELETE+UPDATE).
> - **✅ ĐÃ VÁ policy UPDATE cho `user_mistakes`** (chạy `fix_verify_rls.sql` phần A trên SQL Editor 2026-06-29). Bug LIVE trước đó: `mistakes-store.ts:83` `updateMistakeReview` `.update({box,next_review})` bị RLS chặn → `PATCH /api/cau-sai` (nút nhớ/quên `MistakeNotebook.tsx:57`, mount `page.tsx:130`) trả 500, ôn câu sai FAIL, box Leitner không tăng (SRS 10.A.4 hỏng). Nay đã hết.
> - **✅ Xác nhận dứt khoát `rls_enabled=true` cả 7 bảng** (KHÔNG cần PAT): query (B) trong `fix_verify_rls.sql` đọc thẳng `pg_class.relrowsecurity` qua SQL Editor (2026-06-29) → cả 7 bảng (`test_history/user_ai_usage/user_economy/user_goals/user_mastery/user_mistakes/user_vocab_srs`) = `true`. Đây chính là cái `supabase_smoketest.mjs` định verify → **PAT/script/MCP KHÔNG còn cần cho mục đích RLS** (chỉ tùy chọn nếu sau muốn verify schema tự động từ CLI).
>
> **🔧 CÔNG CỤ Supabase MCP (thiết lập 2026-06-28, Phương án chính thức — KHÔNG dùng Puppeteer/Playwright vì brittle + trùng Claude-in-Chrome):**
> - `.mcp.json` ở root `10.SAT_Prep_App/`: remote HTTP MCP `https://mcp.supabase.com/mcp?project_ref=yynszcfqcvbnuvguwtfy&read_only=true`, header `Bearer ${SUPABASE_ACCESS_TOKEN}`. **read_only=true** vì project gắn nhãn PRODUCTION. Remote HTTP MCP KHÔNG có npm install.
> - `supabase_smoketest.mjs` (root): gọi Management API verify RLS, token đọc từ env. Đã `node --check` OK.
> - ⏳ Để dùng MCP/script: user tạo PAT ở `supabase.com/dashboard/account/tokens` → set `SUPABASE_ACCESS_TOKEN`. MCP read-only KHÔNG vá được policy (cần write) → việc vá UPDATE phải chạy ở SQL Editor.
> - **🔒 ĐÃ QUÉT (2026-06-28T13:16): KHÔNG có credential GHI nào trong môi trường** — không PAT trong env, không service_role/DB-password/connection-string ở bất kỳ `.env`, supabase CLI chưa login. ⇒ Claude KHÔNG thể tự chạy SQL vá policy; **bắt buộc user chạy `fix_verify_rls.sql` trên SQL Editor** (cũng đúng nguyên tắc: không tự sửa access control trên DB nhãn PRODUCTION). Đừng phí thời gian phiên sau thử tự chạy lại.
>
> **🎯 VIỆC ĐẦU TIÊN PHIÊN SAU (theo thứ tự):**
> 1. ✅ **XONG — Vá + verify RLS** (2026-06-29): user đã chạy `fix_verify_rls.sql`; query (B) trả cả 7 bảng `rls_enabled=true`. Nhóm 1.3 chốt.
> 2. **[user] Rotate OpenAI key** (1.2 còn lại — việc DUY NHẤT chặn để Nhóm 1 đạt 100%): tạo key mới + thu hồi cũ trên platform.openai.com → sửa dòng `OPENAI_API_KEY=` trong `.env.local` (mở bằng VS Code/Notepad, KHÔNG dùng viewer trong app) → báo Claude restart dev server (kill cổng 3000 rồi `npm run dev`). Sau restart, Claude browser-test luôn prefetch 2.2 (cần key sống).
> 3. **[tùy chọn][user] PAT** cho MCP/script — KHÔNG còn cần cho RLS, chỉ nếu sau muốn verify schema tự động từ CLI.
> 4. **Nhóm 2 (Hiệu năng) — ĐANG LÀM:**
>    - **2.2 prefetch câu kế — HOÀN TẤT + browser-test PASS (2026-06-29):** prefetch fire đúng lúc submit (user đang đọc giải thích → cost-safe §9.5, không phí token); guard `prefetchedRef` chống gọi OpenAI lần 2; nút "câu mới" tái dùng promise đã prefetch nếu khớp topic. Browser-test (đếm fetch `/api/generate-practice`): click chủ đề=1 call, submit=+1 (prefetch), next=+0 → KHÔNG gọi trùng. Phủ: `math/page.tsx` (inline) + 3 wrapper (literature/desmos/vocabulary) qua callback **`onSubmitted` mới thêm vào `CorePracticeUI`** (additive, optional → 0 rủi ro caller cũ). Test trực tiếp math + literature; literature chứng minh đường shared `CorePracticeUI` → desmos/vocabulary suy ra. CHƯA phủ `tower/page.tsx` (luồng Boss/Tower khác — để verify ở V1 Nhóm 6). T1 Nhóm 6 sẽ gộp pattern lặp này thành hook chung khi gắn `skillId` (cố ý chưa trừu tượng sớm, tránh khóa shape trước khi biết yêu cầu T1).
>    - **2.1 hit-rate Question Bank — CHẶN:** `question-bank.ts` vẫn file-based (`question_bank.json`) → trên Vercel serverless reset mỗi cold-start, pool không đạt `MIN_POOL=8` → hit-rate ≈ 0%. Fix thật = chuyển bank sang bảng Supabase `questions` (cần tạo bảng trên DB PRODUCTION = thao tác user, giống RLS). Thêm: `getFromBank` pick random không tránh trùng câu user đã thấy; có field `_source:'bank'|'ai'` nhưng chưa đo/log hit-rate.
>    - **2.3 debounce save 1.5s — ĐỂ CUỐI:** `GamificationContext.tsx:224` debounce ổn nhưng ghi `/api/save-data` (vẫn file streak, chưa Supabase) → chỉ có ý nghĩa SAU cutover economy/streak Supabase (Nhóm 4.1). Nên gộp 2.3 vào Nhóm 4.
> 5. **Nhóm 3 (UX/UI) — ĐÃ LÀM 3.1, ĐIỀU TRA 3.3:**
>    - **3.1 alert()→toast — HOÀN TẤT + browser-test PASS (2026-06-29):** tạo `src/context/ToastContext.tsx` (tự build, KHÔNG thêm dependency — tránh xung đột peer React 19 đã ghi ở memory; success/error/info dùng bảng màu banner sẵn có; tự ẩn 3.5s), mount `ToastProvider` trong `layout.tsx` (trong GamificationProvider). Thay **15 alert() / 6 file**: math(8), literature/desmos/vocabulary(1 mỗi), tower(1), shop(2), real-exams(1). Verify: tsc sạch, test 51/51, grep `alert(`=0; browser-test shop → toast đỏ đúng nội dung trong 100ms.
>    - **3.3 empty-state — PHẦN LỚN ĐÃ CÓ SẴN (điều tra 2026-06-29):** MistakeNotebook/AITutoring/quests/mock-exams/forge/dashboard-panel-câu-sai đều có empty-state rồi; collection/pets dùng placeholder khóa 🔒. KHÔNG còn khoảng trống đáng làm. Chỗ "hiện số giả" duy nhất là radar Dashboard nhưng đó là **công thức cứng giả** → việc của T2 (đã ghi cảnh báo vào T2), KHÔNG phải 3.3.
>    - **3.2 chuẩn hóa loading/error 16 trang — CHƯA làm, CÂN NHẮC bỏ:** nguy cơ over-engineer (ép 1 component chung qua 16 trang dị nhau). Đánh giá lại khi thật sự cần.
> 6. **Nhóm 5 (Chi phí AI & bảo mật) — VERIFY CODE + CI (2026-06-29), CHƯA chạy runtime:**
>    - **5.1 kill-switch:** `checkBudget()` gọi TRƯỚC khi tốn tiền ở cả `/api/chat` + `/api/generate-practice`; cả 2 `recordGlobalCost`. `DAILY_BUDGET_USD=5`. ⚠️ ledger `ai_cost_global.json` vẫn FILE-BASED → serverless reset (cùng gốc 2.1, cần bảng Supabase).
>    - **5.2 quota chat:** `/api/chat` `checkQuota(user.id)` free=5/ngày, bảng `user_ai_usage` BỀN. ⚠️ (1) `tier` hardcode 'free'; (2) **`/api/generate-practice` KHÔNG có checkQuota** — plan §2.1 nói "5 câu AI/ngày" nên cần áp cho generate-practice (để gộp T1 Nhóm 6).
>    - **5.3 chat cache:** `chat-cache-store.ts` Supabase, nối `/api/chat`. ⚠️ [user] chạy `ai_chat_cache.sql` (bảng dùng chung, RLS `authenticated using(true)`). Chưa tạo bảng → miss → degrade gọi OpenAI, không vỡ.
>    - **5.4 CI:** tạo `.github/workflows/ci.yml` (Node 22, `npm ci --legacy-peer-deps`, CHẶN tsc+test, lint `continue-on-error` vì còn lỗi `any` nợ cũ). ⚠️ repo 0 commit + chưa remote → CHƯA verify chạy thật, chỉ kiểm YAML tĩnh.

> [!IMPORTANT]
> ### 🔑 QUYẾT ĐỊNH CHỐT 2026-06-28 — "CỔNG KHẢO THÍ" (Checkpoint Gate, Phương án A)
> Ý "level 10/20/30 có đề thi vượt cấp" được hiện thực **KHÔNG bằng Level phẳng** (đã bỏ theo quyết định 2026-06-26). Thay vào đó: **Cổng Khảo Thí chặn việc mở khóa chương/bậc trong Skill Tree.** Đạt ngưỡng mastery chương → mở Đề Thi Cổng (= Boss=Assessment 10.B.3); **trượt → không mở chương kế**, đẩy về luyện skill yếu (adaptive). Kèm near-miss ("chỉ thiếu 1 câu") + thi lại sau khi luyện N câu đúng (chống đoán bừa). Cái bị chặn là **năng lực SAT thật, không phải con số XP.**
