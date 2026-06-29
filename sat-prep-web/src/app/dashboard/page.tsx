'use client';
import { useGamification } from '@/context/GamificationContext';

export default function DashboardPage() {
  const { userStats, practiceQuestion, correctAnswersCountToday } = useGamification();

  // Tính toán dữ liệu Radar Chart giả lập hoặc dựa trên userStats
  const mathScore = Math.min(100, 40 + userStats.level * 2 + correctAnswersCountToday * 5);
  const readingScore = Math.min(100, 50 + userStats.level * 1.5);
  const writingScore = Math.min(100, 60 + userStats.level * 1);
  const vocabScore = Math.min(100, 30 + userStats.level * 3);
  const staminaScore = Math.min(100, 20 + userStats.streak * 10);

  // Helper để vẽ Radar Chart
  const size = 200;
  const center = size / 2;
  const radius = size / 2 - 20;

  const getPoint = (value: number, angle: number) => {
    const rad = (Math.PI / 180) * angle;
    const x = center + (radius * value) / 100 * Math.cos(rad);
    const y = center - (radius * value) / 100 * Math.sin(rad);
    return `${x},${y}`;
  };

  const points = [
    getPoint(mathScore, 90),     // Math (Top)
    getPoint(readingScore, 18),  // Reading (Right)
    getPoint(writingScore, 306), // Writing (Bottom Right)
    getPoint(vocabScore, 234),   // Vocab (Bottom Left)
    getPoint(staminaScore, 162), // Stamina (Left)
  ].join(' ');

  const gridPolygons = [20, 40, 60, 80, 100].map(val => {
    return [
      getPoint(val, 90), getPoint(val, 18), getPoint(val, 306), getPoint(val, 234), getPoint(val, 162)
    ].join(' ');
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #064e3b 0%, #022c22 100%)" }}>
        <div className="math-title-container">
          <div className="math-icon">📊</div>
          <div>
            <h1 className="math-title" style={{ background: "linear-gradient(to right, #34d399, #10b981)", WebkitBackgroundClip: "text" }}>NHẬT KÝ TRƯỞNG THÀNH</h1>
            <p className="math-subtitle text-emerald-200">Thống kê toàn bộ quá trình tu luyện của bạn!</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] flex flex-col items-center justify-center shadow-lg">
          <div className="text-4xl mb-2">🔥</div>
          <div className="text-3xl font-bold text-white">{userStats.streak} Ngày</div>
          <div className="text-gray-400 text-sm">Chuỗi Streak Hiện Tại</div>
        </div>
        <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] flex flex-col items-center justify-center shadow-lg">
          <div className="text-4xl mb-2">🎯</div>
          <div className="text-3xl font-bold text-white">{correctAnswersCountToday}</div>
          <div className="text-gray-400 text-sm">Câu Đúng Hôm Nay</div>
        </div>
        <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] flex flex-col items-center justify-center shadow-lg">
          <div className="text-4xl mb-2">📝</div>
          <div className="text-3xl font-bold text-white">{practiceQuestion.history ? practiceQuestion.history.length : 0}</div>
          <div className="text-gray-400 text-sm">Tổng Câu Hỏi Đã Làm</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Radar Chart Panel */}
        <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] flex flex-col items-center shadow-lg">
          <h3 className="text-xl font-bold text-white mb-6">Biểu Đồ Kỹ Năng SAT</h3>
          
          <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="overflow-visible">
              {/* Background Grid */}
              {gridPolygons.map((pts, i) => (
                <polygon key={i} points={pts} fill="none" stroke="#334155" strokeWidth="1" />
              ))}
              {/* Axes */}
              {[90, 18, 306, 234, 162].map((angle, i) => (
                <line key={i} x1={center} y1={center} x2={getPoint(100, angle).split(',')[0]} y2={getPoint(100, angle).split(',')[1]} stroke="#334155" strokeWidth="1" />
              ))}
              
              {/* Data Polygon */}
              <polygon points={points} fill="rgba(16, 185, 129, 0.4)" stroke="#10b981" strokeWidth="2" className="drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              
              {/* Data Points */}
              {points.split(' ').map((pt, i) => (
                <circle key={i} cx={pt.split(',')[0]} cy={pt.split(',')[1]} r="4" fill="#34d399" />
              ))}
            </svg>

            {/* Labels */}
            <div className="absolute top-[-25px] left-1/2 -translate-x-1/2 text-xs font-bold text-blue-400">Toán ({mathScore})</div>
            <div className="absolute top-[30%] right-[-45px] text-xs font-bold text-emerald-400">Đọc ({readingScore})</div>
            <div className="absolute bottom-[-15px] right-[-10px] text-xs font-bold text-yellow-400">Viết ({writingScore})</div>
            <div className="absolute bottom-[-15px] left-[-15px] text-xs font-bold text-purple-400">Từ vựng ({vocabScore})</div>
            <div className="absolute top-[30%] left-[-45px] text-xs font-bold text-red-400">Thể lực ({staminaScore})</div>
          </div>
        </div>

        {/* Recent Activity Panel */}
        <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] shadow-lg flex flex-col">
          <h3 className="text-xl font-bold text-white mb-4">Sổ Tay Khắc Phục (Sai lầm)</h3>
          <div className="flex-1 overflow-y-auto pr-2">
            {practiceQuestion.wrong_answers && practiceQuestion.wrong_answers.length > 0 ? (
              <ul className="space-y-4">
                {practiceQuestion.wrong_answers.slice(0, 5).map((id, idx) => (
                  <li key={idx} className="flex justify-between items-center border-b border-[#334155] pb-2 last:border-0">
                    <div>
                      <p className="text-[#e2e8f0] font-medium">Câu hỏi ID: {id}</p>
                      <p className="text-xs text-red-400">Cần ôn tập lại</p>
                    </div>
                    <button className="text-xs bg-[#3b82f6] px-3 py-1 rounded text-white">Xem lại</button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <div className="text-4xl mb-2">✨</div>
                <p>Tuyệt vời! Bạn chưa lưu câu sai nào.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
