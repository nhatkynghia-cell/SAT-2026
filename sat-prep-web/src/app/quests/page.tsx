'use client';
import Link from 'next/link';
import { useGamification } from '@/context/GamificationContext';
import { EmptyState } from '@/components/EmptyState';

type QuestTrack = 'answer' | 'vocab' | 'exam';
type DailyQuest = { id: string; progress: number; target: number; name: string; desc: string; claimed?: boolean; xp: number; coins: number; track?: QuestTrack };

function questActionHref(q: DailyQuest): string {
  const track = q.track ?? (q.id.startsWith('q1') ? 'answer' : q.id.startsWith('q2') ? 'vocab' : q.id.startsWith('q3') ? 'exam' : 'answer');
  if (track === 'vocab') return '/vocab';
  if (track === 'exam') return '/mock-exams';
  return '/';
}

export default function QuestsPage() {
  const { quests, claimQuest, gamificationLoaded } = useGamification();

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #172554 100%)" }}>
        <div className="math-title-container">
          <div className="math-icon">📜</div>
          <div>
            <h1 className="math-title" style={{ background: "linear-gradient(to right, #93c5fd, #60a5fa)", WebkitBackgroundClip: "text" }}>SỔ TAY NHIỆM VỤ</h1>
            <p className="math-subtitle text-blue-200">Hoàn thành thử thách mỗi ngày để thăng cấp thần tốc!</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        {!gamificationLoaded ? (
          <div className="bg-[#1b2533] p-8 rounded-xl border border-[#262730] text-center text-gray-400">
            Đang tải nhiệm vụ hôm nay...
          </div>
        ) : quests && quests.daily && quests.daily.length > 0 ? (
          quests.daily.map((q: DailyQuest, idx: number) => {
            const isDone = q.progress >= q.target;
            return (
              <div key={q.id || idx} className="bg-[#1b2533] p-5 rounded-xl border border-[#262730] flex justify-between items-center shadow-lg transition-transform hover:scale-[1.01]">
                <div>
                  <h3 className="text-white font-bold text-lg">{q.name}</h3>
                  <p className="text-sm text-gray-400">{q.desc}</p>
                  <div className="text-xs text-[#3b82f6] mt-2 font-mono bg-[#0f172a] inline-block px-2 py-1 rounded border border-[#334155]">
                    Tiến độ: {q.progress}/{q.target}
                  </div>
                </div>
                {q.claimed ? (
                  <button className="bg-[#1e293b] text-[#94a3b8] px-6 py-2 rounded font-bold cursor-not-allowed border border-[#334155]">
                    Đã nhận thưởng
                  </button>
                ) : isDone ? (
                  <button 
                    onClick={() => claimQuest(q.id)} 
                    className="bg-gradient-to-r from-[#10b981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white px-6 py-2 rounded font-bold animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                  >
                    Nhận {q.xp} XP & {q.coins} Xu
                  </button>
                ) : (
                  <Link
                    href={questActionHref(q)}
                    className="bg-[#334155] hover:bg-[#475569] text-gray-200 px-6 py-2 rounded font-bold transition-colors text-center"
                  >
                    Đi làm ngay →
                  </Link>
                )}
              </div>
            );
          })
        ) : (
          <EmptyState icon="📭" message="Không có nhiệm vụ nào hôm nay!" />
        )}
      </div>
    </div>
  );
}
