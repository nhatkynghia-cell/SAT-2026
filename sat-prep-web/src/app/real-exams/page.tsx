'use client';

import { useGamification } from '@/context/GamificationContext';
import ExamRunner from '@/components/ExamRunner';

export default function RealExamsPage() {
  const { level } = useGamification();

  // Gate năng lực phía client (server /api/exam-session/start MỚI là nguồn quyết
  // định — gate cả tier Premium lẫn level≥7). Đây chỉ là lớp UX chặn sớm.
  if (level < 7) {
    return (
      <div className="space-y-8 animate-in fade-in duration-700 relative pb-20">
        <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #2e1065 0%, #4c1d95 100%)" }}>
          <div className="math-title-container">
            <div className="math-icon">🎓</div>
            <div>
              <h1 className="math-title" style={{ background: "linear-gradient(to right, #c084fc, #fbcfe8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>VƯỢT VŨ MÔN THI THẬT</h1>
              <p className="math-subtitle text-pink-200">Kỳ thi quyết định! Chúc chiến binh đạt điểm tối đa!</p>
            </div>
          </div>
        </div>

        <div className="bg-[#450a0a] border border-[#ef4444] text-[#fca5a5] p-6 rounded-lg shadow-[0_0_15px_rgba(239,68,68,0.2)]">
          <h3 className="font-bold text-xl mb-2 flex items-center gap-2">⚠️ CẢNH BÁO BẢO MẬT ĐỀ THI THẬT</h3>
          <p className="text-sm leading-relaxed">
            Đề thi thật (QAS / Past Papers) chỉ được phép mở khóa khi Chiến binh đã tinh thông 6 kỹ năng
            và sở hữu gói Premium. Vui lòng không chia sẻ đề thi ra bên ngoài để bảo vệ nguồn tài nguyên của Học viện.
          </p>
          <p className="mt-4 text-center text-lg font-bold text-red-300">
            🔒 Cần tinh thông 6 kỹ năng để mở khóa (hiện tại: {level - 1} kỹ năng)
          </p>
        </div>
      </div>
    );
  }

  return (
    <ExamRunner
      title="VƯỢT VŨ MÔN THI THẬT"
      subtitle="Kỳ thi quyết định! Chúc chiến binh đạt điểm tối đa!"
      mode="real"
      headerGradient="linear-gradient(135deg, #2e1065 0%, #4c1d95 100%)"
      titleGradient="linear-gradient(to right, #c084fc, #fbcfe8)"
      accentColor="#a855f7"
    />
  );
}
