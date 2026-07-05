'use client';
import { useEffect, useState } from 'react';
import { useGamification } from '@/context/GamificationContext';
import { WeeklyTrendPanel, type WeeklyTrend } from '@/components/WeeklyTrendPanel';

/** Shape trả về từ /api/mastery (getMasterySummary). */
interface MasterySkill {
  id: string;
  label: string;
  score: number;
  attempts: number;
  domainId: string;
  domainLabel: string;
  subject: string;
}
interface MasterySummary {
  skills: MasterySkill[];
  bySubject: { math: number; reading: number };
  overall: number;
}
/** Shape trả về từ /api/score (predictScore). */
interface ScorePrediction {
  math: number;
  reading: number;
  total: number;
  confidence: 'low' | 'medium' | 'high';
  totalAttempts: number;
  targetScore: number | null;
  pointsToTarget: number | null;
  focusSkills: Array<{ id: string; label: string; score: number; subject: string }>;
}

// 5 trục radar = 4 chương Toán + 1 cụm Đọc-Viết (neo vào domainId thật).
const RADAR_AXES: { domainId: string; label: string; color: string; angle: number }[] = [
  { domainId: 'algebra', label: 'Đại số', color: 'text-blue-400', angle: 90 },
  { domainId: 'advanced_math', label: 'Nâng cao', color: 'text-emerald-400', angle: 18 },
  { domainId: 'data_analysis', label: 'Số liệu', color: 'text-yellow-400', angle: 306 },
  { domainId: 'geometry', label: 'Hình học', color: 'text-purple-400', angle: 234 },
  { domainId: 'reading_writing', label: 'Đọc & Viết', color: 'text-red-400', angle: 162 },
];

const CONFIDENCE_LABEL: Record<ScorePrediction['confidence'], string> = {
  low: 'Tham khảo (làm thêm để chính xác hơn)',
  medium: 'Khá tin cậy',
  high: 'Tin cậy cao',
};

export default function DashboardPage() {
  const { userStats } = useGamification();
  const [mastery, setMastery] = useState<MasterySummary | null>(null);
  const [score, setScore] = useState<ScorePrediction | null>(null);
  const [trend, setTrend] = useState<WeeklyTrend | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [mRes, sRes, tRes] = await Promise.all([
          fetch('/api/mastery'),
          fetch('/api/score'),
          fetch('/api/progress/weekly'),
        ]);
        if (mRes.ok) setMastery(await mRes.json());
        if (sRes.ok) setScore(await sRes.json());
        if (tRes.ok) setTrend(await tRes.json());
      } catch (e) {
        console.error('Lỗi tải dữ liệu dashboard', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Mastery trung bình theo từng domain (0..100) — thật, từ câu đã trả lời.
  const domainScore = (domainId: string): number => {
    if (!mastery) return 0;
    const skills = mastery.skills.filter((s) => s.domainId === domainId);
    if (skills.length === 0) return 0;
    return Math.round(skills.reduce((a, s) => a + s.score, 0) / skills.length);
  };

  // Radar geometry
  const size = 200;
  const center = size / 2;
  const radius = size / 2 - 20;
  const getPoint = (value: number, angle: number) => {
    const rad = (Math.PI / 180) * angle;
    const x = center + ((radius * value) / 100) * Math.cos(rad);
    const y = center - ((radius * value) / 100) * Math.sin(rad);
    return `${x},${y}`;
  };

  const axisValues = RADAR_AXES.map((ax) => ({ ...ax, value: domainScore(ax.domainId) }));
  const points = axisValues.map((a) => getPoint(a.value, a.angle)).join(' ');
  const gridPolygons = [20, 40, 60, 80, 100].map((val) =>
    RADAR_AXES.map((ax) => getPoint(val, ax.angle)).join(' ')
  );

  const totalAttempts = score?.totalAttempts ?? 0;
  const hasData = totalAttempts > 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header epic-shake-active" style={{ background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)' }}>
        <div className="math-title-container">
          <div className="math-icon">📊</div>
          <div>
            <h1 className="math-title" style={{ background: 'linear-gradient(to right, #34d399, #10b981)', WebkitBackgroundClip: 'text' }}>NHẬT KÝ TRƯỞNG THÀNH</h1>
            <p className="math-subtitle text-emerald-200">Thống kê dựa trên năng lực SAT thật của bạn!</p>
          </div>
        </div>
      </div>

      {/* Hàng chỉ số: streak (gamification thật) + câu đã làm + điểm dự đoán thật */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] flex flex-col items-center justify-center shadow-lg">
          <div className="text-4xl mb-2">🔥</div>
          <div className="text-3xl font-bold text-white">{userStats.streak} Ngày</div>
          <div className="text-gray-400 text-sm">Chuỗi Streak Hiện Tại</div>
        </div>
        <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] flex flex-col items-center justify-center shadow-lg">
          <div className="text-4xl mb-2">🎯</div>
          <div className="text-3xl font-bold text-white">{loading ? '...' : totalAttempts}</div>
          <div className="text-gray-400 text-sm">Tổng Câu Đã Luyện</div>
        </div>
        <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] flex flex-col items-center justify-center shadow-lg">
          <div className="text-4xl mb-2">📈</div>
          <div className="text-3xl font-bold text-white">{loading ? '...' : hasData ? score!.total : '—'}</div>
          <div className="text-gray-400 text-sm">Điểm SAT Dự Đoán (400-1600)</div>
        </div>
      </div>

      {/* Chi tiết điểm dự đoán */}
      <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] shadow-lg">
        <h3 className="text-xl font-bold text-white mb-4">🎓 Dự Đoán Điểm SAT</h3>
        {loading ? (
          <p className="text-gray-400">Đang tính toán từ dữ liệu luyện tập...</p>
        ) : hasData ? (
          <div className="space-y-3">
            <div className="flex gap-6 flex-wrap">
              <div>
                <div className="text-2xl font-bold text-blue-400">{score!.math}</div>
                <div className="text-xs text-gray-400">Toán (200-800)</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-400">{score!.reading}</div>
                <div className="text-xs text-gray-400">Đọc & Viết (200-800)</div>
              </div>
              {score!.targetScore !== null && (
                <div>
                  <div className="text-2xl font-bold text-yellow-400">{score!.targetScore}</div>
                  <div className="text-xs text-gray-400">Mục tiêu (còn {score!.pointsToTarget} điểm)</div>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">Độ tin cậy: {CONFIDENCE_LABEL[score!.confidence]} — ước lượng động viên, không phải điểm chính thức.</p>
          </div>
        ) : (
          <div className="text-gray-500 text-sm">
            <p>Chưa có dữ liệu để dự đoán. Hãy luyện một vài câu ở mục Toán / Văn / Từ vựng để hệ thống bắt đầu đo năng lực của bạn.</p>
          </div>
        )}
      </div>

      {/* Xu hướng tuần (time-series từ daily_snapshots) */}
      {trend && <WeeklyTrendPanel trend={trend} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Radar Chart Panel — neo vào mastery domain thật */}
        <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] flex flex-col items-center shadow-lg">
          <h3 className="text-xl font-bold text-white mb-6">Biểu Đồ Năng Lực SAT</h3>
          {!hasData && !loading && (
            <p className="text-gray-500 text-sm mb-4 text-center">Biểu đồ sẽ hiện khi bạn bắt đầu luyện tập.</p>
          )}
          <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="overflow-visible">
              {gridPolygons.map((pts, i) => (
                <polygon key={i} points={pts} fill="none" stroke="#334155" strokeWidth="1" />
              ))}
              {RADAR_AXES.map((ax, i) => (
                <line key={i} x1={center} y1={center} x2={getPoint(100, ax.angle).split(',')[0]} y2={getPoint(100, ax.angle).split(',')[1]} stroke="#334155" strokeWidth="1" />
              ))}
              <polygon points={points} fill="rgba(16, 185, 129, 0.4)" stroke="#10b981" strokeWidth="2" className="drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              {points.split(' ').map((pt, i) => (
                <circle key={i} cx={pt.split(',')[0]} cy={pt.split(',')[1]} r="4" fill="#34d399" />
              ))}
            </svg>
            <div className="absolute top-[-25px] left-1/2 -translate-x-1/2 text-xs font-bold text-blue-400">{axisValues[0].label} ({axisValues[0].value})</div>
            <div className="absolute top-[30%] right-[-45px] text-xs font-bold text-emerald-400">{axisValues[1].label} ({axisValues[1].value})</div>
            <div className="absolute bottom-[-15px] right-[-10px] text-xs font-bold text-yellow-400">{axisValues[2].label} ({axisValues[2].value})</div>
            <div className="absolute bottom-[-15px] left-[-15px] text-xs font-bold text-purple-400">{axisValues[3].label} ({axisValues[3].value})</div>
            <div className="absolute top-[30%] left-[-45px] text-xs font-bold text-red-400">{axisValues[4].label} ({axisValues[4].value})</div>
          </div>
        </div>

        {/* Skill cần tập trung — từ score prediction thật */}
        <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] shadow-lg flex flex-col">
          <h3 className="text-xl font-bold text-white mb-4">Kỹ Năng Cần Tập Trung</h3>
          <div className="flex-1 overflow-y-auto pr-2">
            {loading ? (
              <p className="text-gray-400">Đang tải...</p>
            ) : score && score.focusSkills.length > 0 ? (
              <ul className="space-y-4">
                {score.focusSkills.map((s) => (
                  <li key={s.id} className="flex justify-between items-center border-b border-[#334155] pb-2 last:border-0">
                    <div className="pr-2">
                      <p className="text-[#e2e8f0] font-medium text-sm">{s.label}</p>
                      <p className="text-xs text-red-400">Mastery: {s.score}/100</p>
                    </div>
                    <span className="text-xs bg-[#3b82f6] px-3 py-1 rounded text-white whitespace-nowrap">{s.subject === 'math' ? 'Toán' : 'Đọc-Viết'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <div className="text-4xl mb-2">✨</div>
                <p>Luyện tập để hệ thống gợi ý điểm yếu cần cải thiện.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
