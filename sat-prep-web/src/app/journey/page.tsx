'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LoadingState } from '@/components/LoadingState';

/**
 * JOURNEY PAGE (Cụm A2 — LỘ TRÌNH CÁ NHÂN)
 *
 * Đọc /api/journey → lộ trình luyện theo tuần dựng từ mastery thật + điểm mục
 * tiêu. Mỗi tuần liệt kê kỹ năng yếu cần củng cố + mastery hiện tại + số buổi
 * gợi ý + nút "Luyện ngay" deep-link sang trang luyện tương ứng.
 *
 * PHÂN TẦNG: quyền lợi ULTIMATE. Free/Premium → server trả { plan:null,
 * locked:true } → hiện upsell + link /upgrade (mẫu skill-tree "Luyện Mục Tiêu").
 */

interface PlanFocusSkill {
  skillId: string;
  label: string;
  moduleType: string;
  masteryScore: number;
  targetSessions: number;
}
interface PlanWeek {
  weekIndex: number;
  focusSkills: PlanFocusSkill[];
  rationale: string;
}
interface WeeklyPlan {
  generatedAt: string;
  targetScore: number | null;
  pointsToTarget?: number;
  weeks: PlanWeek[];
}

/**
 * moduleType → route trang luyện tương ứng. Ưu tiên deep-link sang /grind
 * (Khổ Luyện, Cụm A1) mang theo skillId để luyện đúng kỹ năng; các module đặc
 * thù (đọc/từ vựng) trỏ thẳng trang chuyên biệt như skill-tree đang dùng.
 *
 * GIẢ ĐỊNH: /grind nhận query param `skillId` (Cụm A1 chưa chốt tên chính thức).
 */
const MODULE_ROUTE: Record<string, string> = {
  math: '/math',
  literature: '/literature',
  vocab: '/vocabulary',
  desmos: '/desmos',
};

/** Link "Luyện ngay" cho 1 kỹ năng: /grind?skillId=… nếu có, fallback theo module. */
function practiceHref(skill: PlanFocusSkill): string {
  return `/grind?skillId=${encodeURIComponent(skill.skillId)}`;
}

export default function JourneyPage() {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/journey');
        if (res.ok) {
          const data = await res.json();
          if (data.locked) setLocked(true);
          else setPlan(data.plan);
        } else {
          setError(true);
        }
      } catch (e) {
        console.error('Lỗi tải lộ trình', e);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await fetch('/api/journey', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.locked) setLocked(true);
        else setPlan(data.plan);
      }
    } catch (e) {
      console.error('Lỗi tạo lại lộ trình', e);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header epic-shake-active" style={{ background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)' }}>
        <div className="math-title-container">
          <div className="math-icon">🗺️</div>
          <div>
            <h1 className="math-title" style={{ background: 'linear-gradient(to right, #6ee7b7, #10b981)', WebkitBackgroundClip: 'text' }}>HÀNH TRÌNH CHINH PHỤC</h1>
            <p className="math-subtitle text-emerald-200">Lộ trình luyện cá nhân hóa theo điểm yếu và mục tiêu điểm của bạn.</p>
          </div>
        </div>
      </div>

      {loading && <LoadingState message="Đang dựng lộ trình cá nhân của bạn..." />}

      {/* Free/Premium → khóa: hiện upsell Ultimate (mẫu skill-tree). */}
      {!loading && locked && (
        <div className="bg-gradient-to-br from-[#064e3b] to-[#0f172a] p-8 rounded-xl border border-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🔒</span>
                <h3 className="text-xl font-bold text-white">Lộ Trình Cá Nhân (Ultimate)</h3>
              </div>
              <p className="text-[#e2e8f0] font-medium">Kế hoạch luyện theo tuần, bám sát điểm yếu và mục tiêu điểm.</p>
              <p className="text-sm text-emerald-300 mt-2">Ultimate phân tích toàn bộ kỹ năng của bạn, sắp thứ tự luyện tối ưu theo tuần và gợi ý số buổi cho từng kỹ năng để lên điểm nhanh nhất.</p>
            </div>
            <Link
              href="/upgrade"
              className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-amber-950 font-bold px-6 py-3 rounded-xl transition-all text-center whitespace-nowrap shadow-lg"
            >
              💎 Mở khóa Ultimate
            </Link>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="bg-[#450a0a] border border-[#ef4444] text-[#fca5a5] p-6 rounded-xl">
          Không tải được lộ trình. Vui lòng đăng nhập và thử lại.
        </div>
      )}

      {!loading && !locked && plan && (
        <>
          {/* Tổng quan mục tiêu + nút tạo lại */}
          <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Kế Hoạch {plan.weeks.length} Tuần</h3>
              {plan.targetScore !== null ? (
                <p className="text-sm text-gray-400">
                  Mục tiêu <span className="text-emerald-400 font-bold">{plan.targetScore}</span>
                  {typeof plan.pointsToTarget === 'number' && plan.pointsToTarget > 0 && (
                    <> — còn cách <span className="text-amber-400 font-bold">{plan.pointsToTarget}</span> điểm.</>
                  )}
                  {typeof plan.pointsToTarget === 'number' && plan.pointsToTarget === 0 && (
                    <> — bạn đã chạm ước lượng mục tiêu! Giữ phong độ nhé.</>
                  )}
                </p>
              ) : (
                <p className="text-sm text-gray-400">
                  Chưa đặt điểm mục tiêu.{' '}
                  <Link href="/dashboard" className="text-emerald-400 underline">Đặt mục tiêu</Link> để lộ trình bám sát hơn.
                </p>
              )}
            </div>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="bg-[#065f46] hover:bg-[#047857] disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap"
            >
              {regenerating ? 'Đang tạo lại...' : '🔄 Tạo lại lộ trình'}
            </button>
          </div>

          {/* Lộ trình rỗng (đã tinh thông hết kỹ năng) */}
          {plan.weeks.length === 0 && (
            <div className="bg-[#052e23] border border-[#10b981] text-[#34d399] p-6 rounded-xl text-center">
              🎉 Bạn đã tinh thông toàn bộ kỹ năng trong lộ trình! Hãy thi thử full-length để giữ phong độ và kiểm chứng điểm số.
            </div>
          )}

          {/* Timeline các tuần */}
          {plan.weeks.length > 0 && (
            <div className="relative border-l-4 border-[#10b981] ml-6 space-y-10 pb-4">
              {plan.weeks.map((week) => (
                <div key={week.weekIndex} className="relative pl-8">
                  <div className="absolute -left-[14px] top-0 w-6 h-6 rounded-full border-4 border-[#0e1117] bg-[#10b981]" />
                  <div className="bg-[#1b2533] p-6 rounded-xl border border-[#334155]">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-white">Tuần {week.weekIndex}</h3>
                      <span className="text-xs bg-[#064e3b] text-[#34d399] border border-[#10b981] px-2 py-0.5 rounded">
                        {week.focusSkills.length} kỹ năng
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mb-5">{week.rationale}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {week.focusSkills.map((skill) => (
                        <div key={skill.skillId} className="bg-[#0e1117] border border-[#262730] p-4 rounded-xl">
                          <h4 className="text-sm font-bold text-gray-100 leading-snug mb-3">{skill.label}</h4>
                          <div className="w-full h-2 bg-[#1b2533] rounded-full overflow-hidden border border-[#334155] mb-1.5">
                            <div className="h-full bg-[#10b981] transition-all" style={{ width: `${Math.min(100, skill.masteryScore)}%` }} />
                          </div>
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-xs text-gray-400">Mastery {skill.masteryScore}/100</span>
                            <span className="text-xs text-emerald-400 font-bold">{skill.targetSessions} buổi/tuần</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={practiceHref(skill)}
                              className="flex-1 text-center bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white font-bold px-4 py-2 rounded-lg text-sm transition-all"
                            >
                              ⚡ Luyện ngay
                            </Link>
                            {MODULE_ROUTE[skill.moduleType] && (
                              <Link
                                href={MODULE_ROUTE[skill.moduleType]}
                                className="text-center bg-[#1b2533] hover:bg-[#243040] text-gray-300 border border-[#334155] px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
                              >
                                Học lý thuyết
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
