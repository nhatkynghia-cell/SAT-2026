'use client';

import { Suspense, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

/** Chỉ nhận path nội bộ (bắt đầu '/' nhưng không '//') — chống open-redirect. */
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/';
}

type Mode = 'login' | 'signup';

function LoginForm() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get('next'));
  const [error, setError] = useState<string | null>(
    searchParams.get('error') === 'auth_callback' ? 'Đăng nhập qua mạng xã hội thất bại. Vui lòng thử lại.' : null
  );
  // Chỉ hiện nút social khi provider THẬT SỰ đã bật trên Supabase (tránh trang lỗi JSON
  // "provider is not enabled"). Endpoint /auth/v1/settings công khai trả cờ external.*.
  const [oauth, setOauth] = useState<{ google: boolean; facebook: boolean }>({ google: false, facebook: false });

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: anon } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.external) setOauth({ google: !!d.external.google, facebook: !!d.external.facebook });
      })
      .catch(() => {});
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setMessage(null);
    setConfirm('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
    } else {
      router.push(next);
      router.refresh();
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 6) {
      setError('Mật khẩu cần tối thiểu 6 ký tự.');
      return;
    }
    if (password !== confirm) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
    } else {
      setMessage('🎉 Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.');
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    setError(null);
    setMessage(null);
    if (!email) {
      setError('Nhập email của bạn trước, rồi bấm "Quên mật khẩu".');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      setError(error.message);
    } else {
      setMessage('📧 Đã gửi link đặt lại mật khẩu tới email của bạn.');
    }
    setLoading(false);
  };

  const handleOAuth = async (provider: 'google' | 'facebook') => {
    setError(null);
    setMessage(null);
    setLoading(true);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    // Thành công → trình duyệt điều hướng sang trang provider (không tới đây). Chỉ tới đây khi lỗi.
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const isLogin = mode === 'login';

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-[#0e1117] to-indigo-950 p-4">
      {/* Halo vàng nền */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-amber-500/10 blur-[120px]" />

      <div className="relative w-full max-w-md rounded-2xl border border-amber-400/20 bg-slate-900/70 p-8 shadow-[0_10px_50px_-5px_rgba(0,0,0,0.7)] backdrop-blur">
        <div className="mb-6 text-center">
          <div className="mb-2 text-4xl">🎓</div>
          <h2 className="bg-gradient-to-r from-yellow-300 to-amber-500 bg-clip-text text-xl font-extrabold uppercase tracking-wide text-transparent">
            Viet Nam League Math Academy
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {isLogin ? 'Đăng nhập để tiếp tục hành trình' : 'Tạo hồ sơ để lưu tiến trình của bạn'}
          </p>
          {/* Chữ ký thương hiệu — nhỏ, nằm dưới tên app */}
          <div className="mt-3">
            <div className="produced-by" style={{ fontSize: '9px', letterSpacing: '2px', marginBottom: '2px' }}>PRODUCED BY</div>
            <div className="guru-name" style={{ fontSize: '26px', marginTop: '2px' }}>Nghia Guru</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-slate-800/50 p-1">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`rounded-lg py-2 text-sm font-bold transition ${
              isLogin ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`rounded-lg py-2 text-sm font-bold transition ${
              !isLogin ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Đăng ký
          </button>
        </div>

        <form className="space-y-4" onSubmit={isLogin ? handleLogin : handleSignUp}>
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm font-medium text-red-300">{error}</div>
          )}
          {message && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm font-medium text-green-300">{message}</div>
          )}

          <div>
            <label htmlFor="email-address" className="sr-only">Email address</label>
            <input
              id="email-address"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="block w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              placeholder="Địa chỉ Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="relative">
            <label htmlFor="password" className="sr-only">Password</label>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
              className="block w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2.5 pr-11 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              placeholder="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-amber-300"
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>

          {!isLogin && (
            <div>
              <label htmlFor="confirm-password" className="sr-only">Xác nhận mật khẩu</label>
              <input
                id="confirm-password"
                name="confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                className="block w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                placeholder="Xác nhận mật khẩu"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          )}

          {isLogin && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                className="text-xs font-medium text-slate-400 transition hover:text-amber-300 disabled:opacity-50"
              >
                Quên mật khẩu?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full justify-center rounded-lg bg-gradient-to-r from-yellow-400 to-amber-500 px-3 py-2.5 text-sm font-bold text-slate-900 shadow-lg shadow-amber-500/20 transition hover:from-yellow-300 hover:to-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:opacity-50"
          >
            {loading ? 'Đang xử lý...' : isLogin ? '🔑 Đăng nhập' : '✨ Tạo hồ sơ'}
          </button>
        </form>

        {/* Social login — chỉ render khi provider đã bật trên Supabase */}
        {(oauth.google || oauth.facebook) && (
          <>
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Hoặc</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <div className="flex gap-3">
              {oauth.google && (
                <button
                  type="button"
                  onClick={() => handleOAuth('google')}
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-amber-400/40 hover:bg-slate-800 disabled:opacity-50"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
                  </svg>
                  Google
                </button>
              )}
              {oauth.facebook && (
                <button
                  type="button"
                  onClick={() => handleOAuth('facebook')}
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-amber-400/40 hover:bg-slate-800 disabled:opacity-50"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#1877F2" aria-hidden="true">
                    <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11.01 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.08 24 18.09 24 12.07z" />
                  </svg>
                  Facebook
                </button>
              )}
            </div>
          </>
        )}

        <p className="mt-6 text-center text-xs text-slate-500">
          {isLogin ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
          <button
            type="button"
            onClick={() => switchMode(isLogin ? 'signup' : 'login')}
            className="font-semibold text-amber-400 hover:text-amber-300"
          >
            {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
          </button>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams cần Suspense boundary (Next 16).
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-950" />}>
      <LoginForm />
    </Suspense>
  );
}
