'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CorePracticeUI, type PracticeQuestion } from '@/components/CorePracticeUI';

/**
 * DIAGNOSTIC ONBOARDING — bài test xếp lớp đầu vào.
 *
 * Phase machine (theo mẫu gate-exam, bỏ theatrics boss/countdown):
 *   loading → done_already | intro → fighting → result
 *
 * Mỗi câu render qua CorePracticeUI (hideNextUntilSubmitted) → submit tự chấm +
 * ghi mastery qua /api/grade (câu có skillId cụ thể). Sau câu cuối, POST complete
 * → nhận điểm dự đoán vừa gieo để hiển thị.
 */

type Phase = 'loading' | 'done_already' | 'intro' | 'fighting' | 'result';

interface Prediction {
  math: number;
  reading: number;
  total: number;
  confidence: string;
  totalAttempts: number;
  focusSkills: Array<{ id: string; label: string; score: number; subject: string }>;
}

const CONFIDENCE_LABEL: Record<string, string> = {
  low: 'Sơ bộ (làm thêm để chính xác hơn)',
  medium: 'Khá tin cậy',
  high: 'Tin cậy cao',
};

export default function DiagnosticPage() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answerLog, setAnswerLog] = useState<boolean[]>([]);
  const [targetScore, setTargetScore] = useState<string>('');
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [tier, setTier] = useState<string>('free');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/diagnostic');
        const data = await res.json();
        setPhase(data.completed ? 'done_already' : 'intro');
      } catch {
        setPhase('intro');
      }
    }
    checkStatus();
  }, []);

  const startDiagnostic = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch('/api/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      const data = await res.json();
      if (data.completed) {
        setPhase('done_already');
        return;
      }
      if (!res.ok || !Array.isArray(data.questions) || data.questions.length === 0) {
        setError(data.error ?? 'Không thể chuẩn bị bài test. Vui lòng thử lại.');
        return;
      }
      setQuestions(data.questions);
      setCurrentIdx(0);
      setAnswerLog([]);
      setPhase('fighting');
    } catch {
      setError('Không thể kết nối server.');
    } finally {
      setStarting(false);
    }
  };

  const handleAnswer = useCallback((isCorrect: boolean) => {
    setAnswerLog((log) => [...log, isCorrect]);
  }, []);

  const finish = useCallback(async () => {
    setPhase('loading');
    try {
      const target = parseInt(targetScore, 10);
      const res = await fetch('/api/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          ...(Number.isFinite(target) ? { targetScore: target } : {}),
        }),
      });
      const data = await res.json();
      setPrediction(data.prediction ?? null);
      if (typeof data.tier === 'string') setTier(data.tier);
    } catch {
      setPrediction(null);
    }
    setPhase('result');
  }, [targetScore]);

  const handleNext = useCallback(() => {
    const nextIdx = currentIdx + 1;
    if (nextIdx >= questions.length) {
      void finish();
    } else {
      setCurrentIdx(nextIdx);
    }
  }, [currentIdx, questions.length, finish]);

  if (phase === 'loading') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-[#0e1117]">
        <div className="text-5xl animate-spin mb-4">⚙️</div>
        <p className="text-white font-bold text-xl">Đang xử lý...</p>
      </div>
    );
  }

  if (phase === 'done_already') {
    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-20">
        <div className="math-academy-header" style={{ background: 'linear-gradient(135deg, #064e3b 0%, #1e1b4b 100%)' }}>
          <div className="math-title-container">
            <div className="math-icon">🎓</div>
            <div>
              <h1 className="math-title" style={{ background: 'linear-gradient(to right, #6ee7b7, #a5b4fc)', WebkitBackgroundClip: 'text' }}>ĐÃ XẾP LỚP</h1>
              <p className="math-subtitle text-emerald-200">Bạn đã hoàn tất bài test đầu vào</p>
            </div>
          </div>
        </div>
        <div className="bg-[#1b2533] p-8 rounded-xl border border-[#334155] max-w-lg mx-auto text-center space-y-6">
          <p className="text-gray-300">Bài test xếp lớp chỉ làm một lần. Tiếp tục luyện tập để nâng cao dự đoán điểm và mở khóa lộ trình.</p>
          <div className="flex flex-col gap-3 items-center">
            <Link href="/skill-tree" className="bg-gradient-to-r from-yellow-300 to-amber-500 hover:from-yellow-200 hover:to-amber-400 text-[#78350f] font-bold px-6 py-3 rounded-xl inline-block">
              🌳 Xem Cây Năng Lực
            </Link>
            <Link href="/dashboard" className="text-amber-300 hover:text-amber-200">📊 Xem Nhật Ký Trưởng Thành</Link>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-20">
        <div className="math-academy-header" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 100%)' }}>
          <div className="math-title-container">
            <div className="math-icon text-6xl">🎯</div>
            <div>
              <h1 className="math-title" style={{ background: 'linear-gradient(to right, #93c5fd, #c084fc)', WebkitBackgroundClip: 'text' }}>TEST XẾP LỚP ĐẦU VÀO</h1>
              <p className="math-subtitle text-blue-200">Đánh giá năng lực để cá nhân hóa lộ trình học</p>
            </div>
          </div>
        </div>

        <div className="max-w-lg mx-auto space-y-6">
          <div className="bg-[#1b2533] p-8 rounded-xl border border-indigo-500/30">
            <div className="space-y-3 text-left bg-[#0e1117] p-4 rounded-lg border border-[#334155] mb-6">
              <p className="text-gray-300"><span className="text-blue-400 font-bold">📝 Nội dung:</span> {questions.length || 14} câu phủ Đại số, Toán nâng cao, Phân tích số liệu, Hình học & Đọc hiểu</p>
              <p className="text-gray-300"><span className="text-emerald-400 font-bold">⏱️ Thời lượng:</span> khoảng 5–10 phút, không giới hạn giờ</p>
              <p className="text-gray-300"><span className="text-amber-400 font-bold">🎁 Kết quả:</span> điểm SAT dự đoán ban đầu + gợi ý kỹ năng cần tập trung</p>
            </div>

            <label htmlFor="targetScore" className="block text-sm text-gray-400 mb-2">Điểm SAT mục tiêu của bạn (tùy chọn, 400–1600):</label>
            <input
              id="targetScore"
              type="number"
              value={targetScore}
              onChange={(e) => setTargetScore(e.target.value)}
              placeholder="VD: 1400"
              min={400}
              max={1600}
              className="w-full bg-[#0e1117] border border-[#334155] rounded-lg px-4 py-2 text-white mb-6 focus:border-amber-400 outline-none"
            />

            {error && <p className="text-red-400 mb-4 text-sm">{error}</p>}

            <button
              onClick={startDiagnostic}
              disabled={starting}
              className="w-full bg-gradient-to-r from-yellow-300 to-amber-500 hover:from-yellow-200 hover:to-amber-400 disabled:opacity-50 text-[#78350f] font-black text-lg px-10 py-4 rounded-xl shadow-lg transition-transform hover:scale-[1.02]"
            >
              {starting ? 'Đang chuẩn bị...' : '🚀 Bắt đầu làm bài'}
            </button>
          </div>
          <p className="text-center">
            <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm">Để sau →</Link>
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'fighting') {
    const currentQ = questions[currentIdx];
    return (
      <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        <div className="flex justify-between items-center bg-[#1b2533] p-4 rounded-xl border border-indigo-500/30">
          <div>
            <span className="text-gray-400 text-sm">Test Xếp Lớp</span>
            <h2 className="text-xl font-black text-indigo-300">Câu {currentIdx + 1} / {questions.length}</h2>
          </div>
          <div className="flex gap-2 flex-wrap max-w-[50%] justify-end">
            {questions.map((_, i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full border-2 ${
                  i < answerLog.length
                    ? answerLog[i]
                      ? 'bg-green-500 border-green-500'
                      : 'bg-red-500 border-red-500'
                    : i === currentIdx
                    ? 'bg-amber-400 border-amber-400 animate-pulse'
                    : 'bg-transparent border-gray-600'
                }`}
              />
            ))}
          </div>
        </div>

        {currentQ && (
          <CorePracticeUI
            questionData={currentQ}
            isLoading={false}
            onAnswer={handleAnswer}
            onNext={handleNext}
            hideNextUntilSubmitted
          />
        )}
      </div>
    );
  }

  if (phase === 'result') {
    const correctCount = answerLog.filter(Boolean).length;
    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-20">
        <div className="max-w-lg mx-auto text-center space-y-6">
          <div className="bg-gradient-to-br from-[#0b3b2e] to-[#0f172a] p-10 rounded-xl border-2 border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.25)]">
            <div className="text-7xl mb-4">🎉</div>
            <h2 className="text-3xl font-black text-emerald-400 mb-2">HOÀN THÀNH XẾP LỚP!</h2>
            <p className="text-gray-300 mb-6">Bạn trả lời đúng {correctCount}/{answerLog.length} câu. Dưới đây là điểm SAT dự đoán ban đầu:</p>

            {prediction ? (
              <>
                <div className="bg-[#0e1117] p-6 rounded-lg border border-[#334155] mb-6">
                  <div className="text-5xl font-black text-white mb-1">{prediction.total}</div>
                  <div className="text-gray-400 text-sm mb-4">/ 1600 &middot; Độ tin cậy: {CONFIDENCE_LABEL[prediction.confidence] ?? prediction.confidence}</div>
                  <div className="flex justify-around text-sm">
                    <div><span className="text-blue-300 font-bold">{prediction.math}</span><div className="text-gray-500">Toán</div></div>
                    <div><span className="text-purple-300 font-bold">{prediction.reading}</span><div className="text-gray-500">Đọc & Viết</div></div>
                  </div>
                </div>

                {prediction.focusSkills.length > 0 && (
                  <div className="text-left bg-[#0e1117] p-4 rounded-lg border border-[#334155] mb-6">
                    <p className="text-amber-400 font-bold text-sm mb-2">🎯 Nên tập trung luyện:</p>
                    <ul className="space-y-1">
                      {prediction.focusSkills.map((s) => (
                        <li key={s.id} className="text-gray-300 text-sm">• {s.label} <span className="text-gray-500">({s.score}/100)</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="text-gray-400 mb-6">Đã ghi nhận kết quả. Xem Cây Năng Lực để bắt đầu lộ trình.</p>
            )}

            {/* C1 — CTA nâng cấp ĐÚNG aha-moment: free vừa thấy điểm yếu cụ thể ở đây,
                vào dashboard sẽ bị khóa → mời "giữ lộ trình cá nhân hóa này". Chỉ hiện cho free. */}
            {tier === 'free' && (
              <div className="text-left bg-gradient-to-br from-[#1e1b4b] to-[#0e1117] p-5 rounded-lg border border-indigo-500/60 mb-6">
                <p className="text-indigo-300 font-bold text-sm mb-1">💎 Mở khóa lộ trình cá nhân hóa</p>
                <p className="text-gray-400 text-xs mb-3">
                  Premium phân tích sâu từng điểm yếu, gợi ý skill ưu tiên và bài &ldquo;Luyện Mục Tiêu&rdquo;
                  để lên điểm nhanh nhất — dựa trên chính kết quả bạn vừa làm.
                </p>
                <Link href="/upgrade" className="inline-block text-sm font-bold bg-gradient-to-r from-yellow-300 to-amber-500 text-[#78350f] px-5 py-2.5 rounded-lg hover:from-yellow-200 hover:to-amber-400 shadow-lg">
                  Xem gói nâng cấp →
                </Link>
              </div>
            )}

            <div className="flex flex-col gap-3 items-center">
              <Link href="/skill-tree" className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold px-8 py-4 rounded-xl inline-block shadow-lg">
                🌳 Xem lộ trình trong Cây Năng Lực
              </Link>
              <Link href="/math" className="text-indigo-300 hover:text-indigo-200">📐 Luyện Toán ngay →</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
