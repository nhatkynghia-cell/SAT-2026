'use client';

/**
 * PARENT REPORT — render read-only tiến độ con cho phụ huynh (Hướng A mã chia sẻ).
 * Tái dụng radar SVG 5 domain (như dashboard học sinh) + WeeklyTrendPanel chung.
 * Nhận data từ /api/parent/report (không cần login).
 */

import { useState, useEffect } from 'react';
import { WeeklyTrendPanel, type WeeklyTrend } from './WeeklyTrendPanel';

export interface ParentReportData {
  prediction: {
    math: number;
    reading: number;
    total: number;
    confidence: 'low' | 'medium' | 'high';
    totalAttempts: number;
    targetScore: number | null;
    pointsToTarget: number | null;
    focusSkills: Array<{ id: string; label: string; score: number; subject: string }>;
  };
  mastery: {
    overall: number;
    bySubject: { math: number; reading: number };
    domains: Array<{ domainId: string; domainLabel: string; score: number }>;
  };
  streak: number;
  weeklyTrend: WeeklyTrend;
  recentTests: Array<{ module: string; subject: string; correct: number; total: number; score: number; when: number }>;
  /** Optional (backward-compat) — gói của con quyết định độ sâu báo cáo. */
  studentTier?: 'free' | 'premium' | 'ultimate';
  /** Optional — số ngày cửa sổ xu hướng (7/30/90). */
  trendWindowDays?: number;
  /** Optional — "tốc độ cải thiện" thuần (mọi tier có >=2 snapshot). */
  improvement?: { deltaOverall: number; deltaPredicted: number; windowDays: number } | null;
}

const RADAR_AXES: { domainId: string; label: string; color: string; angle: number }[] = [
  { domainId: 'algebra', label: 'Đại số', color: 'text-blue-400', angle: 90 },
  { domainId: 'advanced_math', label: 'Nâng cao', color: 'text-emerald-400', angle: 18 },
  { domainId: 'data_analysis', label: 'Số liệu', color: 'text-yellow-400', angle: 306 },
  { domainId: 'geometry', label: 'Hình học', color: 'text-purple-400', angle: 234 },
  { domainId: 'reading_writing', label: 'Đọc & Viết', color: 'text-red-400', angle: 162 },
];

const CONFIDENCE_LABEL: Record<string, string> = {
  low: 'Tham khảo (con cần luyện thêm để chính xác hơn)',
  medium: 'Khá tin cậy',
  high: 'Tin cậy cao',
};

export function ParentReport({ data }: { data: ParentReportData }) {
  const { prediction, mastery, streak, weeklyTrend, recentTests } = data;
  const hasData = prediction.totalAttempts > 0;
  // Fallback an toàn nếu API cũ chưa trả field (backward-compat).
  const studentTier = data.studentTier ?? 'free';
  const trendWindowDays = data.trendWindowDays ?? 7;
  const isFreeStudent = studentTier === 'free';
  const improvement = data.improvement ?? null;

  // Radar geometry (giống dashboard học sinh).
  const size = 200;
  const center = size / 2;
  const radius = size / 2 - 20;
  const getPoint = (value: number, angle: number) => {
    const rad = (Math.PI / 180) * angle;
    const x = center + ((radius * value) / 100) * Math.cos(rad);
    const y = center - ((radius * value) / 100) * Math.sin(rad);
    return `${x},${y}`;
  };
  const domainScore = (domainId: string) => mastery.domains.find((d) => d.domainId === domainId)?.score ?? 0;
  const axisValues = RADAR_AXES.map((ax) => ({ ...ax, value: domainScore(ax.domainId) }));
  const points = axisValues.map((a) => getPoint(a.value, a.angle)).join(' ');
  const gridPolygons = [20, 40, 60, 80, 100].map((val) => RADAR_AXES.map((ax) => getPoint(val, ax.angle)).join(' '));

  return (
    <div className="space-y-6">
      {/* Con dùng gói free → gợi ý nâng cấp (báo cáo sâu hơn: xu hướng 30-90 ngày, nhiều bài thi hơn). */}
      {isFreeStudent && (
        <div className="bg-gradient-to-r from-[#1e3a8a] to-[#4c1d95] border border-[#6366f1] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-white">📊 Báo cáo cơ bản (xu hướng {trendWindowDays} ngày)</p>
            <p className="text-xs text-indigo-200 mt-0.5">Nâng cấp Premium để xem xu hướng 30 ngày, hoặc Ultimate 90 ngày + nhiều bài thi chi tiết hơn.</p>
          </div>
          <a href="/upgrade" className="text-xs font-bold bg-white text-indigo-700 px-4 py-2 rounded-lg hover:bg-indigo-100 whitespace-nowrap text-center">💎 Xem gói nâng cấp</a>
        </div>
      )}

      {/* Hàng chỉ số chính */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="📈" value={hasData ? String(prediction.total) : '—'} label="Điểm SAT dự đoán" />
        <StatCard icon="🔥" value={`${streak}`} label="Chuỗi ngày học" />
        <StatCard icon="🎯" value={String(prediction.totalAttempts)} label="Tổng câu đã luyện" />
        <StatCard
          icon={weeklyTrend.scoreDelta >= 0 ? '⬆️' : '⬇️'}
          value={`${weeklyTrend.scoreDelta >= 0 ? '+' : ''}${weeklyTrend.scoreDelta}`}
          label={`Điểm thay đổi ${trendWindowDays} ngày`}
        />
      </div>

      {/* Tốc độ cải thiện (thuần — mọi tier có >=2 snapshot trong cửa sổ) */}
      {improvement && (
        <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730]">
          <h3 className="text-lg font-bold text-white mb-3">🚀 Tốc độ cải thiện ({improvement.windowDays} ngày)</h3>
          <div className="flex gap-8 flex-wrap">
            <div>
              <div className={`text-2xl font-bold ${improvement.deltaPredicted >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {improvement.deltaPredicted >= 0 ? '+' : ''}{improvement.deltaPredicted}
              </div>
              <div className="text-xs text-gray-400">Điểm SAT dự đoán</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${improvement.deltaOverall >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {improvement.deltaOverall >= 0 ? '+' : ''}{improvement.deltaOverall}
              </div>
              <div className="text-xs text-gray-400">Năng lực tổng (0-100)</div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">So sánh mốc đầu và cuối trong cửa sổ {improvement.windowDays} ngày — càng dương càng tiến bộ.</p>
        </div>
      )}

      {/* 🧠 Nhận xét từ Mentor AI — CHỈ gói Ultimate; tự ẩn nếu chưa có nhận xét. */}
      {studentTier === 'ultimate' && <MentorAiPanel />}

      {/* Chi tiết điểm */}
      <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730]">
        <h3 className="text-lg font-bold text-white mb-3">🎓 Dự đoán điểm SAT của con</h3>
        {hasData ? (
          <>
            <div className="flex gap-6 flex-wrap">
              <div><div className="text-2xl font-bold text-blue-400">{prediction.math}</div><div className="text-xs text-gray-400">Toán (200-800)</div></div>
              <div><div className="text-2xl font-bold text-emerald-400">{prediction.reading}</div><div className="text-xs text-gray-400">Đọc & Viết (200-800)</div></div>
              {prediction.targetScore !== null && (
                <div><div className="text-2xl font-bold text-yellow-400">{prediction.targetScore}</div><div className="text-xs text-gray-400">Mục tiêu (còn {prediction.pointsToTarget})</div></div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-3">Độ tin cậy: {CONFIDENCE_LABEL[prediction.confidence]} — ước lượng động viên, không phải điểm chính thức.</p>
          </>
        ) : (
          <p className="text-gray-500 text-sm">Con chưa luyện đủ để dự đoán điểm. Hãy động viên con luyện tập mỗi ngày!</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Radar năng lực */}
        <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] flex flex-col items-center">
          <h3 className="text-lg font-bold text-white mb-6">Biểu đồ năng lực</h3>
          <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="overflow-visible">
              {gridPolygons.map((pts, i) => (<polygon key={i} points={pts} fill="none" stroke="#334155" strokeWidth="1" />))}
              {RADAR_AXES.map((ax, i) => (<line key={i} x1={center} y1={center} x2={getPoint(100, ax.angle).split(',')[0]} y2={getPoint(100, ax.angle).split(',')[1]} stroke="#334155" strokeWidth="1" />))}
              <polygon points={points} fill="rgba(16, 185, 129, 0.4)" stroke="#10b981" strokeWidth="2" />
              {points.split(' ').map((pt, i) => (<circle key={i} cx={pt.split(',')[0]} cy={pt.split(',')[1]} r="4" fill="#34d399" />))}
            </svg>
            <div className="absolute top-[-25px] left-1/2 -translate-x-1/2 text-xs font-bold text-blue-400">{axisValues[0].label} ({axisValues[0].value})</div>
            <div className="absolute top-[30%] right-[-45px] text-xs font-bold text-emerald-400">{axisValues[1].label} ({axisValues[1].value})</div>
            <div className="absolute bottom-[-15px] right-[-10px] text-xs font-bold text-yellow-400">{axisValues[2].label} ({axisValues[2].value})</div>
            <div className="absolute bottom-[-15px] left-[-15px] text-xs font-bold text-purple-400">{axisValues[3].label} ({axisValues[3].value})</div>
            <div className="absolute top-[30%] left-[-45px] text-xs font-bold text-red-400">{axisValues[4].label} ({axisValues[4].value})</div>
          </div>
        </div>

        {/* Xu hướng tuần + skill yếu */}
        <div className="space-y-6">
          <WeeklyTrendPanel trend={weeklyTrend} />

          <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730]">
            <h3 className="text-lg font-bold text-white mb-3">Kỹ năng con cần tập trung</h3>
            {prediction.focusSkills.length > 0 && hasData ? (
              <ul className="space-y-2">
                {prediction.focusSkills.map((s) => (
                  <li key={s.id} className="flex justify-between items-center text-sm border-b border-[#334155] pb-2 last:border-0">
                    <span className="text-gray-200 pr-2">{s.label}</span>
                    <span className="text-red-400 whitespace-nowrap">{s.score}/100</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">Chưa đủ dữ liệu.</p>
            )}
          </div>
        </div>
      </div>

      {/* Lịch sử thi gần đây */}
      {recentTests.length > 0 && (
        <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730]">
          <h3 className="text-lg font-bold text-white mb-3">📝 Bài thi gần đây</h3>
          <ul className="space-y-2">
            {recentTests.map((t, i) => (
              <li key={i} className="flex justify-between items-center text-sm border-b border-[#334155] pb-2 last:border-0">
                <span className="text-gray-200">{t.module} <span className="text-gray-500">({t.subject})</span></span>
                <span className="text-emerald-400">{t.correct}/{t.total} đúng</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="bg-[#1b2533] p-4 rounded-xl border border-[#262730] flex flex-col items-center justify-center text-center">
      <div className="text-3xl mb-1">{icon}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-gray-400 text-xs">{label}</div>
    </div>
  );
}

/**
 * Khối "Nhận xét từ Mentor AI" (chỉ render khi con dùng gói Ultimate).
 * Đọc mã chia sẻ từ URL (?code=PH-...) — cùng nguồn với /parent — rồi fetch
 * /api/mentor-comment. Nhận xét được server CACHE theo ngày (1 lần gọi OpenAI/
 * học sinh/ngày). comment=null (fail-safe: OpenAI chặn VN / hết ngân sách / lỗi)
 * → ẩn khối IM LẶNG, không làm vỡ phần số liệu của báo cáo.
 */
function MentorAiPanel() {
  const [phase, setPhase] = useState<'loading' | 'hidden' | 'ready'>('loading');
  const [comment, setComment] = useState('');

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) {
      setPhase('hidden');
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/mentor-comment?code=${encodeURIComponent(code)}`);
        if (!res.ok) {
          setPhase('hidden');
          return;
        }
        const json = (await res.json()) as { comment?: string | null };
        if (json.comment) {
          setComment(json.comment);
          setPhase('ready');
        } else {
          setPhase('hidden');
        }
      } catch {
        setPhase('hidden');
      }
    })();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  if (phase === 'hidden') return null;

  return (
    <div className="bg-gradient-to-br from-[#1e293b] to-[#312e81] p-6 rounded-xl border border-[#6366f1]">
      <h3 className="text-lg font-bold text-white mb-3">🧠 Nhận xét từ Mentor AI</h3>
      {phase === 'loading' ? (
        <div className="flex items-center gap-2 text-indigo-200 text-sm">
          <span className="animate-spin">⚙️</span> Đang tạo nhận xét cho con...
        </div>
      ) : (
        <p className="text-sm text-indigo-100 whitespace-pre-line leading-relaxed">{comment}</p>
      )}
    </div>
  );
}
