-- ============================================================================
--  MIGRATION — ADMIN ROLES (role-based admin auth, thay dần ADMIN_SECRET)
--  Chạy trong: Supabase Dashboard → SQL Editor → Run (idempotent)
-- ============================================================================
--  Trước đây admin bảo vệ bằng 1 shared-secret duy nhất (ADMIN_SECRET) — ai có
--  chuỗi đó = toàn quyền, không phân biệt "ai", không thu hồi từng người. Nay
--  gắn VAI TRÒ admin vào tài khoản Supabase: tài khoản có role 'admin' → đăng
--  nhập bình thường là vào được trang admin, không cần nhớ secret.
--
--  🔴 DUAL-AUTH (chống tự khóa mình ra ngoài): route admin cho vào nếu HOẶC
--  (a) session-user có role admin, HOẶC (b) x-admin-secret đúng (đường dự phòng
--  cũ). Cấu hình role sai vẫn còn secret cứu → KHÔNG BAO GIỜ mất quyền admin.
--
--  🔴 BẢO MẬT: RLS chỉ cho SELECT dòng CỦA MÌNH (user tự kiểm mình có admin
--  không, KHÔNG đọc được role người khác). GHI role chỉ qua service-role / SQL
--  editor (KHÔNG có policy insert/update cho authenticated) → user KHÔNG tự cấp
--  admin cho mình (nếu cho ghi = faucet quyền, giống lỗ ROOT E).
--
--  FAIL-CLOSED: bảng chưa có / lỗi đọc → isUserAdmin trả false (KHÔNG vô tình
--  cấp quyền). Chưa chạy migration → chỉ đường secret hoạt động (0 regression).
-- ============================================================================

create table if not exists public.user_roles (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  role       text        not null check (role in ('admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;

-- CHỈ SELECT own: user kiểm CHÍNH MÌNH có role không. KHÔNG có policy
-- insert/update/delete cho authenticated → chỉ service-role/SQL ghi được.
drop policy if exists "user_roles_select_own" on public.user_roles;
create policy "user_roles_select_own" on public.user_roles
  for select to authenticated
  using (auth.uid() = user_id);

-- ============================================================================
--  BOOTSTRAP — gán CHÍNH BẠN làm admin. ĐỔI email dưới thành email đăng nhập
--  của bạn (email tài khoản Supabase Auth), rồi chạy. Idempotent (ON CONFLICT).
-- ============================================================================
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users
where email = 'ĐỔI_THÀNH_EMAIL_ADMIN_CỦA_BẠN@example.com'
on conflict (user_id, role) do nothing;

-- Kiểm tra: liệt kê admin hiện có (chạy riêng để xác nhận bootstrap thành công).
-- select u.email, r.role from public.user_roles r join auth.users u on u.id = r.user_id;

-- ============================================================================
--  XONG. Tài khoản đã gán 'admin' → vào /api/admin/* bằng session (không cần
--  secret). ADMIN_SECRET vẫn hoạt động song song (đường dự phòng).
-- ============================================================================
