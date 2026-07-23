'use client';

import Link from 'next/link';
import { useGamification } from '@/context/GamificationContext';
import ExamRunner from '@/components/ExamRunner';

export default function RealExamsPage() {
  const { level, tier, gamificationLoaded } = useGamification();

  if (!gamificationLoaded) {
    return (
      <div className="space-y-8 animate-in fade-in duration-700 relative pb-20">
        <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #2e1065 0%, #4c1d95 100%)" }}>
          <div className="math-title-container">
            <div className="math-icon">🎓</div>
            <div>
              <h1 className="math-title" style={{ background: "linear-gradient(to right, #c084fc, #fbcfe8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>VƯỢT VŨ MÔN THI THẬT</h1>
              <p className="math-subtitle text-pink-200">Đang kiểm tra quyền truy cập...</p>
            </div>
          </div>
        </div>
        <div className="bg-[#1b2533] border border-[#262730] p-8 rounded-lg text-center text-gray-400">
          Đang tải trạng thái gói học...
        </div>
      </div>
    );
  }

  // Gate UX sớm: server /api/exam-session/start MỚI là nguồn quyết định (gate
  // tier === 'ultimate' VÀ level >= 7). Đây chỉ lớp chặn sớm để không cho user
  // bấm rồi mới nhận 403. Thứ tự: tier trước (Premium chưa đủ → upsell Ultimate),
  // rồi capability (đã Ultimate nhưng chưa đủ skill).
  if (tier !== 'ultimate') {
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

        <div className="bg-[#1b2533] border border-[#a855f7]/50 text-[#e9d5ff] p-6 rounded-lg shadow-[0_0_15px_rgba(168,85,247,0.2)]">
          <h3 className="font-bold text-xl mb-2 flex items-center gap-2">👑 Thi Thật QAS — quyền lợi gói Ultimate</h3>
          <p className="text-sm leading-relaxed text-[#cbb6e6]">
            Bộ đề thi thật (QAS / Past Papers) mô phỏng sát đề thi SAT thật, chỉ mở khóa cho học viên gói Ultimate.
            Nâng cấp lên Ultimate để luyện với đề thật và bảo vệ nguồn tài nguyên Học viện.
          </p>
          <Link href="/upgrade?from=real-exams&unlock=ultimate" className="inline-block mt-4 text-sm font-bold bg-gradient-to-r from-yellow-300 to-amber-500 text-[#78350f] px-5 py-2.5 rounded-lg hover:from-yellow-200 hover:to-amber-400 shadow-lg">
            Nâng cấp lên Ultimate →
          </Link>
        </div>
      </div>
    );
  }

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
            Đề thi thật (QAS / Past Papers) chỉ được phép mở khóa khi Chiến binh đã tinh thông 6 kỹ năng.
            Vui lòng không chia sẻ đề thi ra bên ngoài để bảo vệ nguồn tài nguyên của Học viện.
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
