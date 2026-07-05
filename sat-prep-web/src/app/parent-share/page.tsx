'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * CHIA SẺ TIẾN ĐỘ VỚI PHỤ HUYNH (student) — sinh/thu hồi mã, copy link.
 * Phụ huynh mở link /parent?code=XXX xem read-only, không cần tài khoản.
 */

interface ShareCode {
  code: string;
  revoked: boolean;
  expires_at: string | null;
}

export default function ParentSharePage() {
  const [codes, setCodes] = useState<ShareCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    // window chỉ có ở client → đọc origin sau mount để dựng link chia sẻ đầy đủ.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/parent-share');
      if (res.status === 401) {
        setError('Bạn cần đăng nhập để tạo mã chia sẻ.');
        setCodes([]);
        return;
      }
      const data = await res.json();
      setCodes(Array.isArray(data.codes) ? data.codes : []);
    } catch {
      setError('Không thể tải danh sách mã.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch-on-mount hợp lệ: tải danh sách mã (load nội bộ setState sau await).
    // KHÔNG phải derived-state → setState trong effect đúng pattern, không cascading.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/parent-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' }),
      });
      if (res.status === 401) {
        setError('Bạn cần đăng nhập để tạo mã chia sẻ.');
        return;
      }
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Không thể tạo mã.');
        return;
      }
      await load();
    } catch {
      setError('Không thể kết nối server.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (code: string) => {
    setBusy(true);
    try {
      await fetch('/api/parent-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', code }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const linkFor = (code: string) => `${origin}/parent?code=${code}`;

  const copy = (code: string) => {
    navigator.clipboard?.writeText(linkFor(code));
    setCopied(code);
    setTimeout(() => setCopied((c) => (c === code ? null : c)), 2000);
  };

  const activeCodes = codes.filter((c) => !c.revoked);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header" style={{ background: 'linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)' }}>
        <div className="math-title-container">
          <div className="math-icon">👨‍👩‍👧</div>
          <div>
            <h1 className="math-title" style={{ background: 'linear-gradient(to right, #a5b4fc, #c084fc)', WebkitBackgroundClip: 'text' }}>CHIA SẺ VỚI PHỤ HUYNH</h1>
            <p className="math-subtitle text-indigo-200">Cho bố mẹ theo dõi tiến độ học của bạn</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-[#1b2533] p-6 rounded-xl border border-[#334155]">
          <p className="text-gray-300 text-sm mb-4">
            Tạo một mã chia sẻ rồi gửi link cho bố mẹ. Bố mẹ mở link là xem được điểm dự đoán, tiến độ và xu hướng học tập của bạn — <span className="text-indigo-300">không cần đăng nhập</span>. Bạn có thể thu hồi mã bất cứ lúc nào.
          </p>
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <button
            onClick={generate}
            disabled={busy}
            className="bg-gradient-to-r from-indigo-600 to-purple-500 hover:from-indigo-500 hover:to-purple-400 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl"
          >
            {busy ? 'Đang xử lý...' : '➕ Tạo mã chia sẻ mới'}
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center">Đang tải...</p>
        ) : activeCodes.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-white font-bold">Mã đang hoạt động</h3>
            {activeCodes.map((c) => (
              <div key={c.code} className="bg-[#1b2533] p-4 rounded-xl border border-[#334155] space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-mono text-lg text-indigo-300">{c.code}</span>
                  <div className="flex gap-2">
                    <button onClick={() => copy(c.code)} className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg">
                      {copied === c.code ? '✓ Đã copy link' : '📋 Copy link'}
                    </button>
                    <button onClick={() => revoke(c.code)} disabled={busy} className="text-xs bg-red-700 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                      🗑️ Thu hồi
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 break-all">{linkFor(c.code)}</p>
              </div>
            ))}
          </div>
        ) : (
          !error && <p className="text-gray-500 text-center text-sm">Chưa có mã nào. Tạo mã đầu tiên để chia sẻ với phụ huynh.</p>
        )}
      </div>
    </div>
  );
}
