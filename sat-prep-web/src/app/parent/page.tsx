'use client';

import { useState, useEffect } from 'react';
import { ParentReport, type ParentReportData } from '@/components/ParentReport';

/**
 * TRANG PHỤ HUYNH (KHÔNG cần đăng nhập) — mở /parent?code=PH-XXXX xem tiến độ con.
 * Đọc code từ URL (window.location, tránh Suspense của useSearchParams), fetch
 * /api/parent/report. Mã sai/hết hạn → thông báo, không crash.
 */

type State =
  | { phase: 'loading' }
  | { phase: 'no_code' }
  | { phase: 'invalid' }
  | { phase: 'ready'; data: ParentReportData };

export default function ParentPage() {
  const [state, setState] = useState<State>({ phase: 'loading' });

  useEffect(() => {
    // Mount-fetch hợp lệ: đọc code từ URL (window chỉ có ở client) rồi tải báo cáo.
    // Đây KHÔNG phải derived-state (cần window.location + fetch async), nên setState
    // trong effect là đúng pattern fetch-on-mount, không gây cascading render thật.
    /* eslint-disable react-hooks/set-state-in-effect */
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) {
      setState({ phase: 'no_code' });
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/parent/report?code=${encodeURIComponent(code)}`);
        if (!res.ok) {
          setState({ phase: 'invalid' });
          return;
        }
        const data = (await res.json()) as ParentReportData;
        setState({ phase: 'ready', data });
      } catch {
        setState({ phase: 'invalid' });
      }
    })();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  return (
    <div className="min-h-screen bg-[#0e1117] px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="text-center space-y-1">
          <h1 className="text-2xl font-black text-white">📈 Tiến độ học tập của con</h1>
          <p className="text-gray-400 text-sm">Báo cáo từ Ivy League Math Academy — Gia sư AI SAT</p>
        </header>

        {state.phase === 'loading' && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-5xl animate-spin mb-4">⚙️</div>
            <p className="text-gray-300">Đang tải báo cáo...</p>
          </div>
        )}

        {state.phase === 'no_code' && (
          <div className="bg-[#1b2533] p-8 rounded-xl border border-[#334155] text-center">
            <div className="text-5xl mb-4">🔗</div>
            <p className="text-gray-300">Thiếu mã chia sẻ. Hãy mở đúng đường link mà con bạn gửi (dạng <span className="text-indigo-300">/parent?code=PH-...</span>).</p>
          </div>
        )}

        {state.phase === 'invalid' && (
          <div className="bg-[#1b2533] p-8 rounded-xl border border-red-500/30 text-center">
            <div className="text-5xl mb-4">🚫</div>
            <p className="text-gray-300">Mã không tồn tại hoặc đã hết hạn.</p>
            <p className="text-gray-500 text-sm mt-2">Hãy đề nghị con tạo mã mới trong ứng dụng và gửi lại link.</p>
          </div>
        )}

        {state.phase === 'ready' && <ParentReport data={state.data} />}

        <footer className="text-center text-xs text-gray-600 pt-4">
          Bạn đang xem ở chế độ chỉ đọc. Dữ liệu cập nhật theo tiến độ luyện tập của con.
        </footer>
      </div>
    </div>
  );
}
