'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/context/ToastContext';
import { CorePracticeUI, type PracticeQuestion } from '@/components/CorePracticeUI';
import { ALL_SKILLS } from '@/lib/skill-taxonomy';

/**
 * KHỔ LUYỆN (GRIND) — nhồi 1 skill yếu nhất (hoặc do user chọn) tới mastered.
 * Quyền lợi ULTIMATE. Clone luồng Tower: server chọn skill + độ khó theo mastery
 * thật rồi sinh câu qua /api/grind/question → CorePracticeUI ghi mastery đúng skill
 * qua /api/grade (giữ ROOT A, không chấm/faucet ở client).
 */

const MASTERED_THRESHOLD = 80;

// Shape trả về từ GET /api/mastery (getMasterySummary).
interface MasterySkill {
  id: string;
  label: string;
  score: number;
  attempts: number;
  correct: number;
  reliable: boolean;
  mastered: boolean;
  moduleType: string;
}

export default function GrindPage() {
  const { showToast } = useToast();
  const [isPlaying, setIsPlaying] = useState(false);
  const [questionData, setQuestionData] = useState<PracticeQuestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  // '' = để hệ thống tự chọn skill yếu nhất.
  const [chosenSkill, setChosenSkill] = useState('');
  // skillId thực tế đang nhồi (do server trả về trên câu hỏi).
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const [mastery, setMastery] = useState<MasterySkill[] | null>(null);

  const activeSkill = mastery && activeSkillId ? mastery.find((s) => s.id === activeSkillId) ?? null : null;

  const loadMastery = useCallback(async () => {
    try {
      const res = await fetch('/api/mastery');
      if (res.ok) {
        const data = await res.json();
        setMastery(data.skills ?? []);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/mastery');
        if (res.ok && !cancelled) {
          const data = await res.json();
          setMastery(data.skills ?? []);
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const generateQuestion = async () => {
    setIsLoading(true);
    setQuestionData(null);
    try {
      const qs = chosenSkill ? `?skillId=${encodeURIComponent(chosenSkill)}` : '';
      const res = await fetch(`/api/grind/question${qs}`);

      if (res.status === 403) {
        setLocked(true);
        setIsPlaying(false);
        setIsLoading(false);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setQuestionData(data);
        setActiveSkillId(data.skillId ?? null);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err?.error ?? 'Thất bại khi sinh câu khổ luyện (API Error).', 'error');
        setIsPlaying(false);
      }
    } catch (e) {
      console.error(e);
      setIsPlaying(false);
    }
    setIsLoading(false);
  };

  const startGrind = () => {
    setIsPlaying(true);
    generateQuestion();
  };

  // Upsell khi không phải Ultimate.
  if (locked) {
    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-20">
        <div className="text-center p-12 bg-[#0e1117] rounded-xl border border-[#f59e0b] shadow-[0_0_30px_rgba(245,158,11,0.2)] max-w-2xl mx-auto">
          <div className="text-6xl mb-6">🔒</div>
          <h2 className="text-3xl font-black text-amber-400 mb-4">Khổ luyện là quyền lợi Ultimate</h2>
          <p className="text-gray-300 mb-8 max-w-lg mx-auto">
            Chế độ Khổ Luyện dồn toàn lực vào đúng kỹ năng yếu nhất của bạn, nhồi câu độ khó vừa tầm tới khi thành thạo. Đây là quyền lợi dành riêng cho gói Ultimate.
          </p>
          <Link
            href="/upgrade"
            className="inline-block bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-amber-950 font-black text-lg px-10 py-4 rounded-full shadow-lg transition-transform hover:scale-105"
          >
            Nâng cấp Ultimate
          </Link>
        </div>
      </div>
    );
  }

  const pct = activeSkill ? Math.min(100, Math.round((activeSkill.score / MASTERED_THRESHOLD) * 100)) : 0;
  const isMastered = !!activeSkill?.mastered;
  // Gợi ý skill kế tiếp (yếu nhất chưa thành thạo, khác skill hiện tại).
  const nextSuggestion = mastery
    ? [...mastery]
        .filter((s) => !s.mastered && s.id !== activeSkillId)
        .sort((a, b) => a.score - b.score || a.attempts - b.attempts)[0] ?? null
    : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header" style={{ background: 'linear-gradient(135deg, #1c1917 0%, #451a03 100%)' }}>
        <div className="math-title-container">
          <div className="math-icon">🏋️</div>
          <div>
            <h1 className="math-title" style={{ background: 'linear-gradient(to right, #f59e0b, #fcd34d)', WebkitBackgroundClip: 'text' }}>KHỔ LUYỆN (GRIND)</h1>
            <p className="math-subtitle text-gray-300">Dồn toàn lực nhồi 1 kỹ năng yếu nhất tới khi thành thạo.</p>
          </div>
        </div>
      </div>

      {!isPlaying && (
        <div className="text-center p-12 bg-[#0e1117] rounded-xl border border-[#334155] max-w-2xl mx-auto">
          <div className="text-6xl mb-6">🎯</div>
          <p className="text-gray-300 mb-6 max-w-lg mx-auto">
            AI sinh liên tục các câu nhắm đúng một kỹ năng, độ khó vừa tầm với năng lực hiện tại. Cày tới khi đạt {MASTERED_THRESHOLD}% mastery là thành thạo!
          </p>

          <div className="mb-8 max-w-sm mx-auto text-left">
            <label className="block text-sm text-gray-400 mb-2 font-bold">Chọn kỹ năng muốn nhồi</label>
            <select
              value={chosenSkill}
              onChange={(e) => setChosenSkill(e.target.value)}
              className="w-full bg-[#1b2533] border border-[#334155] text-white rounded-lg px-4 py-3 focus:border-amber-500 focus:outline-none"
            >
              <option value="">🤖 Tự động — kỹ năng yếu nhất của tôi</option>
              {ALL_SKILLS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={startGrind}
            className="bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-amber-950 font-black text-xl px-12 py-4 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-transform hover:scale-105"
          >
            BẮT ĐẦU KHỔ LUYỆN
          </button>
        </div>
      )}

      {isPlaying && (
        <>
          {/* Header: tên skill đang nhồi + thanh tiến độ mastery */}
          {activeSkill && (
            <div className="bg-[#1b2533] p-5 rounded-xl border border-[#262730]">
              <div className="flex justify-between items-center mb-3 gap-4">
                <div>
                  <span className="text-gray-400 text-sm">Đang nhồi kỹ năng:</span>
                  <h2 className="text-xl font-black text-amber-400">{activeSkill.label}</h2>
                </div>
                <button
                  onClick={() => { setIsPlaying(false); setQuestionData(null); loadMastery(); }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors whitespace-nowrap"
                >
                  Thoát
                </button>
              </div>
              <div className="w-full bg-[#0e1117] rounded-full h-4 overflow-hidden border border-[#334155]">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isMastered ? 'bg-gradient-to-r from-emerald-500 to-green-400' : 'bg-gradient-to-r from-amber-500 to-yellow-400'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-sm text-gray-400 mt-2">
                Mastery: <b className="text-white">{activeSkill.score}%</b> / {MASTERED_THRESHOLD}% (đã làm {activeSkill.attempts} câu)
              </div>
            </div>
          )}

          {/* Ăn mừng khi đạt mastered */}
          {isMastered && (
            <div className="text-center p-8 bg-[#022c22] rounded-xl border-2 border-[#10b981] shadow-[0_0_30px_rgba(16,185,129,0.25)]">
              <div className="text-5xl mb-3">🏆</div>
              <h2 className="text-2xl font-black text-emerald-400 mb-2">THÀNH THẠO KỸ NĂNG!</h2>
              <p className="text-gray-200 mb-6">Bạn đã làm chủ kỹ năng này. Chuyển sang mục tiêu kế tiếp nhé!</p>
              {nextSuggestion ? (
                <button
                  onClick={() => { setChosenSkill(nextSuggestion.id); setActiveSkillId(null); generateQuestion(); }}
                  className="bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-amber-950 font-black px-8 py-3 rounded-full transition-transform hover:scale-105"
                >
                  Nhồi tiếp: {nextSuggestion.label}
                </button>
              ) : (
                <p className="text-emerald-300 font-bold">Mọi kỹ năng đã thành thạo — quá đỉnh! 🎉</p>
              )}
            </div>
          )}

          {(isLoading || questionData) && (
            <div className="bg-[#0e1117] p-6 rounded-xl border border-[#f59e0b] shadow-lg">
              <CorePracticeUI
                questionData={questionData as PracticeQuestion}
                isLoading={isLoading}
                onSubmitted={loadMastery}
                onNext={generateQuestion}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
