'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useGamification } from '@/context/GamificationContext';

/**
 * DIAGNOSTIC BANNER — gợi ý nhẹ user mới làm bài test xếp lớp đầu vào.
 *
 * Chỉ hiện khi CHƯA hoàn tất onboarding (cờ từ /api/diagnostic qua context).
 * Dismiss là state cục bộ (không persist) → sẽ hiện lại lần load sau tới khi
 * user hoàn tất — cố ý nhắc lại, nhưng vẫn cho tắt trong phiên. KHÔNG redirect
 * ép: degrade-graceful, tôn trọng lựa chọn của user.
 */
export function DiagnosticBanner() {
  const { onboardingCompleted } = useGamification();
  const [dismissed, setDismissed] = useState(false);

  if (onboardingCompleted || dismissed) return null;

  return (
    <div className="relative bg-gradient-to-r from-indigo-900/60 to-blue-900/40 border border-indigo-500/40 rounded-xl p-5 flex items-center gap-4 shadow-lg animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="text-4xl shrink-0">🎯</div>
      <div className="flex-1 min-w-0">
        <h3 className="text-white font-black text-lg">Làm bài test xếp lớp (5 phút)</h3>
        <p className="text-indigo-200 text-sm">Đánh giá năng lực để mở khóa dự đoán điểm Cambridge và lộ trình học cá nhân hóa ngay từ đầu.</p>
      </div>
      <Link
        href="/diagnostic"
        className="shrink-0 bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 text-white font-bold px-5 py-2.5 rounded-lg shadow transition-transform hover:scale-105"
      >
        Bắt đầu →
      </Link>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Ẩn gợi ý"
        className="shrink-0 text-gray-400 hover:text-white text-xl leading-none px-1"
      >
        ×
      </button>
    </div>
  );
}
