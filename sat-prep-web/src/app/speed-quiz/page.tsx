'use client';

import { useState, useCallback } from 'react';
import { useToast } from '@/context/ToastContext';
import { CorePracticeUI, type PracticeQuestion } from '@/components/CorePracticeUI';
import { SpeedQuizLeaderboard } from './SpeedQuizLeaderboard';

/** Mốc thưởng trong lượt (số câu đúng → xu). Đồng bộ SPEED_QUIZ_MILESTONES server. */
const MILESTONES: { correct: number; coins: number }[] = [
  { correct: 10, coins: 100 },
  { correct: 20, coins: 250 },
  { correct: 30, coins: 500 },
];

/** Số câu sai LIÊN TIẾP để kết thúc lượt (survival "2 mạng"). */
const MAX_WRONG_STREAK = 2;

type Tab = 'play' | 'ranking';

export default function SpeedQuizPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('play');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongStreak, setWrongStreak] = useState(0);
  const [questionData, setQuestionData] = useState<PracticeQuestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [rewardCoins, setRewardCoins] = useState(0);

  const nextMilestone = MILESTONES.find((m) => m.correct > correctCount)?.correct ?? null;

  const generateQuestion = useCallback(async (answered: number, session: string | null) => {
    setIsLoading(true);
    setQuestionData(null);
    try {
      // Server chọn skill + độ khó theo MASTERY thật (adaptive, ĐA MÔN) và sinh câu.
      // Kèm session để server TAG câu (chống gian lận đếm câu đúng lúc kết thúc).
      const qs = new URLSearchParams({ answered: String(answered) });
      if (session) qs.set('session', session);
      const res = await fetch(`/api/speed-quiz/question?${qs.toString()}`);
      if (res.ok) {
        setQuestionData(await res.json());
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err?.error ?? 'Thất bại khi sinh câu hỏi (API Error).', 'error');
        setIsPlaying(false);
      }
    } catch (e) {
      console.error(e);
      showToast('Lỗi kết nối khi sinh câu hỏi.', 'error');
      setIsPlaying(false);
    }
    setIsLoading(false);
  }, [showToast]);

  const startRun = useCallback(async () => {
    setIsPlaying(true);
    setIsGameOver(false);
    setCorrectCount(0);
    setWrongStreak(0);
    setRewardCoins(0);
    // Mở session server-side (chống gian lận + nguồn correct_count). Pre-migration
    // → sessionId null: vẫn chơi được, chỉ không thưởng/không xếp hạng (fail-safe).
    let session: string | null = null;
    try {
      const res = await fetch('/api/speed-quiz/start', { method: 'POST' });
      if (res.ok) session = (await res.json()).sessionId ?? null;
    } catch (e) {
      console.error('start session error', e);
    }
    setSessionId(session);
    generateQuestion(0, session);
  }, [generateQuestion]);

  // Kết thúc lượt: finalize + claim mốc (server đếm câu đúng THẬT). Idempotent.
  const endRun = useCallback(async (session: string | null) => {
    setIsGameOver(true);
    setIsPlaying(false);
    if (!session) return;
    try {
      const res = await fetch('/api/speed-quiz/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.rewardCoins > 0) {
          setRewardCoins(data.rewardCoins);
          showToast(`🎉 Nhận ${data.rewardCoins} xu thưởng theo mốc!`, 'success');
        }
      }
    } catch (e) {
      console.error('end session error', e);
    }
  }, [showToast]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header epic-shake-active" style={{ background: 'linear-gradient(135deg, #0c1a2b 0%, #1e3a5f 100%)' }}>
        <div className="math-title-container">
          <div className="math-icon">⚡</div>
          <div>
            <h1 className="math-title" style={{ background: 'linear-gradient(to right, #38bdf8, #a5f3fc)', WebkitBackgroundClip: 'text' }}>TRẢ LỜI NHANH (SPEED QUIZ)</h1>
            <p className="math-subtitle text-gray-300">Mỗi câu 15 giây. Sai {MAX_WRONG_STREAK} câu liên tiếp là kết thúc. Đúng càng nhiều, thưởng càng lớn!</p>
          </div>
        </div>
      </div>

      {/* Tabs: Chơi / Bảng xếp hạng — ẩn khi đang trong lượt để tập trung. */}
      {!isPlaying && (
        <div className="flex gap-2">
          <button
            onClick={() => setTab('play')}
            className={`px-5 py-2 rounded-lg font-bold text-sm transition-colors ${tab === 'play' ? 'bg-amber-500 text-[#78350f]' : 'bg-[#1b2533] text-gray-300 hover:bg-[#26344a]'}`}
          >
            ⚡ Chơi
          </button>
          <button
            onClick={() => setTab('ranking')}
            className={`px-5 py-2 rounded-lg font-bold text-sm transition-colors ${tab === 'ranking' ? 'bg-amber-500 text-[#78350f]' : 'bg-[#1b2533] text-gray-300 hover:bg-[#26344a]'}`}
          >
            🏆 Bảng Xếp Hạng
          </button>
        </div>
      )}

      {tab === 'ranking' && !isPlaying && <SpeedQuizLeaderboard />}

      {tab === 'play' && (
        <>
          {!isPlaying && !isGameOver && (
            <div className="text-center p-12 bg-[#0e1117] rounded-xl border border-[#334155]">
              <div className="text-6xl mb-6">⚡</div>
              <p className="text-gray-300 mb-6 max-w-lg mx-auto">Chế độ tốc độ đa môn: AI đưa câu nhắm đúng điểm yếu của bạn (Toán, Đọc/Viết, Từ vựng), độ khó tăng dần theo số câu đúng. Trả lời trong 15 giây — hết giờ tính là sai. Sai {MAX_WRONG_STREAK} câu liên tiếp thì dừng lượt.</p>
              <div className="flex justify-center gap-3 mb-8 flex-wrap">
                {MILESTONES.map((m) => (
                  <span key={m.correct} className="px-3 py-1.5 rounded-full bg-[#1b2533] border border-[#38bdf8]/40 text-sm text-sky-300">
                    🎯 {m.correct} câu đúng → +{m.coins} xu
                  </span>
                ))}
              </div>
              <button onClick={startRun} className="bg-gradient-to-r from-yellow-300 to-amber-500 hover:from-yellow-200 hover:to-amber-400 text-[#78350f] font-black text-xl px-12 py-4 rounded-full shadow-[0_0_20px_rgba(251,191,36,0.5)] transition-transform hover:scale-105">
                BẮT ĐẦU
              </button>
            </div>
          )}

          {isGameOver && (
            <div className="text-center p-12 bg-[#0c243a] rounded-xl border border-sky-500 shadow-[0_0_30px_rgba(56,189,248,0.3)]">
              <h2 className="text-4xl font-black text-sky-400 mb-4">HẾT LƯỢT</h2>
              <p className="text-xl text-white mb-2">Bạn trả lời đúng <span className="font-bold text-yellow-400">{correctCount}</span> câu trong lượt này!</p>
              {rewardCoins > 0 ? (
                <p className="text-lg text-green-400 font-bold mb-8">🎉 +{rewardCoins} xu thưởng theo mốc!</p>
              ) : (
                <p className="text-sm text-gray-400 mb-8">Đạt mốc 10/20/30 câu đúng để nhận thưởng xu (mỗi mốc 1 lần/ngày).</p>
              )}
              <button onClick={startRun} className="bg-gray-800 hover:bg-gray-700 text-white font-bold px-8 py-3 rounded-lg border border-gray-600">
                Chơi Lại
              </button>
            </div>
          )}

          {isPlaying && (
            <>
              <div className="flex justify-between items-center bg-[#1b2533] p-4 rounded-xl border border-[#262730]">
                <div>
                  <span className="text-gray-400 text-sm">Số câu đúng:</span>
                  <h2 className="text-2xl font-black text-sky-400">{correctCount}</h2>
                </div>
                <div className="text-center">
                  <span className="text-gray-400 text-sm">Mốc kế tiếp:</span>
                  <h2 className="text-lg font-bold text-yellow-400">{nextMilestone ? `🎯 ${nextMilestone} câu` : '🏆 Đã đạt hết mốc'}</h2>
                </div>
                <div className="text-center">
                  <span className="text-gray-400 text-sm">Mạng còn:</span>
                  <h2 className="text-2xl font-black text-red-400">{'❤️'.repeat(MAX_WRONG_STREAK - wrongStreak) || '💀'}</h2>
                </div>
                <button
                  onClick={() => endRun(sessionId)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
                >
                  Thoát
                </button>
              </div>

              {(isLoading || questionData) && (
                <div className="relative">
                  <div className="bg-[#0e1117] p-6 rounded-xl border border-[#38bdf8] shadow-lg mb-6">
                    <p className="text-sky-300 font-bold mb-4">⚡ Trả lời thật nhanh — 15 giây mỗi câu, độ khó tăng dần khi bạn đúng nhiều hơn.</p>
                    <CorePracticeUI
                      questionData={questionData as PracticeQuestion}
                      isLoading={isLoading}
                      timeLimit={15}
                      hideNextUntilSubmitted
                      onAnswer={(isCorrect) => {
                        if (isCorrect) {
                          setWrongStreak(0);
                          setCorrectCount((prev) => prev + 1);
                        } else {
                          // Sai (hoặc hết giờ tự nộp rỗng) → mất 1 mạng; hết mạng thì kết thúc.
                          const nextWrong = wrongStreak + 1;
                          setWrongStreak(nextWrong);
                          if (nextWrong >= MAX_WRONG_STREAK) {
                            void endRun(sessionId);
                          }
                        }
                      }}
                      onNext={() => {
                        // correctCount đã +1 ở onAnswer với câu đúng; câu tiếp dùng nó làm độ khó.
                        if (!isGameOver) generateQuestion(correctCount, sessionId);
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
