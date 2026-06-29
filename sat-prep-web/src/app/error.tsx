'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error("Global Error Caught:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="bg-[#1b2533] border border-[#ef4444] rounded-2xl p-8 max-w-lg w-full text-center shadow-[0_0_30px_rgba(239,68,68,0.15)] animate-in zoom-in duration-500">
        <div className="text-6xl mb-6 animate-pulse">⚠️</div>
        <h2 className="text-2xl font-bold text-white mb-2" style={{ background: "linear-gradient(to right, #fca5a5, #ef4444)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Hệ thống gặp sự cố
        </h2>
        <p className="text-[#94a3b8] mb-6 leading-relaxed">
          Sếp thông cảm, hệ thống đang được bảo trì hoặc có thể do kết nối mạng không ổn định. Vui lòng thử lại!
        </p>
        
        <div className="bg-[#0f172a] rounded-lg p-4 mb-8 text-left overflow-x-auto border border-[#334155]">
          <div className="text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-bold">Mã lỗi kỹ thuật (Error Trace):</div>
          <p className="text-xs text-[#ef4444] font-mono whitespace-pre-wrap">
            {error.message || "Unknown Error"}
          </p>
          {error.digest && (
            <p className="text-xs text-gray-500 mt-2">Digest ID: {error.digest}</p>
          )}
        </div>

        <button
          onClick={() => reset()}
          className="bg-gradient-to-r from-[#ef4444] to-[#b91c1c] hover:from-[#dc2626] hover:to-[#991b1b] text-white font-bold py-3 px-8 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 mx-auto"
        >
          <span>🔄</span> Thử Lại (Try Again)
        </button>
        
        <div className="mt-8 text-xs font-bold" style={{ color: "#fbbf24", textShadow: "0 0 5px rgba(251, 191, 36, 0.5)" }}>
          PRODUCED BY Nghia Guru
        </div>
      </div>
    </div>
  );
}
