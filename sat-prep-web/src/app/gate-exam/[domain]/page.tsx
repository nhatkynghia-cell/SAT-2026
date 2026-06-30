'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { CorePracticeUI, type PracticeQuestion } from '@/components/CorePracticeUI';
import { useGamification } from '@/context/GamificationContext';
import { GATE_QUESTIONS, GATE_PASS_THRESHOLD, RETRY_CORRECT_NEEDED } from '@/lib/gate-exam';
import Link from 'next/link';

type Phase = 'loading' | 'not_eligible' | 'intro' | 'countdown' | 'fighting' | 'result';

interface GateProgress {
  passed: boolean;
  lastAttempt: string;
  score: number;
  correctSinceFail: number;
}

export default function GateExamPage() {
  const params = useParams();
  const domain = params.domain as string;
  const { handleExamComplete } = useGamification();

  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  /** Kết quả đúng/sai từng câu (index theo thứ tự thi) — để tô chấm tiến trình ĐÚNG câu nào. */
  const [answerLog, setAnswerLog] = useState<boolean[]>([]);
  const [gateProgress, setGateProgress] = useState<GateProgress | null>(null);
  const [domainAvg, setDomainAvg] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [resultData, setResultData] = useState<{ passed: boolean; nearMiss: boolean; score: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/gate-exam?domain=${encodeURIComponent(domain)}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? 'Lỗi tải đề thi cổng');
          setPhase('not_eligible');
          return;
        }
        const data = await res.json();
        setDomainAvg(data.domainAvg ?? 0);
        setGateProgress(data.gateProgress);

        if (!data.eligible) {
          setPhase('not_eligible');
          return;
        }

        setQuestions(data.questions);
        setPhase('intro');
      } catch {
        setError('Không thể kết nối server');
        setPhase('not_eligible');
      }
    }
    load();
  }, [domain]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) {
      // Cho "GO!" hiện rõ ~0.7s trước khi vào câu hỏi (nếu không sẽ chỉ chớp 1 frame).
      const t = setTimeout(() => setPhase('fighting'), 700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  const handleAnswer = useCallback((isCorrect: boolean) => {
    if (isCorrect) setCorrectCount((c) => c + 1);
    setAnswerLog((log) => [...log, isCorrect]);
  }, []);

  const handleNext = useCallback(async () => {
    const nextIdx = currentIdx + 1;
    if (nextIdx >= GATE_QUESTIONS) {
      try {
        const res = await fetch('/api/gate-exam', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain, correctCount }),
        });
        if (res.ok) {
          const data = await res.json();
          setResultData(data.result);
          setGateProgress(data.gateProgress);
          if (data.result.passed) {
            void handleExamComplete(correctCount, 'Hard');
          }
        } else {
          // 403/5xx: server từ chối (vd hết điều kiện) — coi như không qua, không crash.
          setResultData({ passed: false, nearMiss: false, score: correctCount });
        }
      } catch {
        setResultData({ passed: false, nearMiss: false, score: correctCount });
      }
      setPhase('result');
    } else {
      setCurrentIdx(nextIdx);
    }
  }, [currentIdx, correctCount, domain, handleExamComplete]);

  const startCountdown = () => {
    setCountdown(3);
    setPhase('countdown');
  };

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0e1117]">
        <div className="text-5xl animate-spin mb-4">⚙️</div>
        <p className="text-white font-bold text-xl">Đang chuẩn bị Đề Thi Cổng...</p>
        <p className="text-gray-400 text-sm mt-2">Hệ thống đang sinh {GATE_QUESTIONS} câu hỏi đánh giá năng lực</p>
      </div>
    );
  }

  if (phase === 'not_eligible') {
    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-20">
        <div className="math-academy-header" style={{ background: 'linear-gradient(135deg, #7f1d1d 0%, #1e1b4b 100%)' }}>
          <div className="math-title-container">
            <div className="math-icon">🚫</div>
            <div>
              <h1 className="math-title" style={{ background: 'linear-gradient(to right, #fca5a5, #c084fc)', WebkitBackgroundClip: 'text' }}>CHƯA ĐỦ ĐIỀU KIỆN</h1>
              <p className="math-subtitle text-red-200">Bạn chưa thể vào Cổng Khảo Thí lúc này</p>
            </div>
          </div>
        </div>
        <div className="bg-[#1b2533] p-8 rounded-xl border border-[#334155] max-w-lg mx-auto text-center">
          {error && <p className="text-red-400 mb-4">{error}</p>}
          {gateProgress && !gateProgress.passed && (
            <div className="mb-4">
              <p className="text-gray-300">Lần thi trước: {gateProgress.score}/{GATE_QUESTIONS}</p>
              <p className="text-amber-400 font-bold mt-2">
                Cần luyện thêm {Math.max(0, RETRY_CORRECT_NEEDED - gateProgress.correctSinceFail)} câu đúng trước khi thi lại
              </p>
            </div>
          )}
          <p className="text-gray-400 text-sm mb-6">
            Mastery trung bình chương: {domainAvg}/100 (cần ≥ 40)
          </p>
          <Link href="/skill-tree" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl inline-block">
            ← Quay lại Cây Năng Lực
          </Link>
        </div>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-20">
        <div className="math-academy-header epic-shake-active" style={{ background: 'linear-gradient(135deg, #7f1d1d 0%, #0f172a 100%)' }}>
          <div className="math-title-container">
            <div className="math-icon text-6xl">⚔️</div>
            <div>
              <h1 className="math-title" style={{ background: 'linear-gradient(to right, #f87171, #fbbf24)', WebkitBackgroundClip: 'text' }}>CỔNG KHẢO THÍ</h1>
              <p className="math-subtitle text-red-200">Boss Assessment — Chứng minh năng lực để mở chương mới</p>
            </div>
          </div>
        </div>

        <div className="max-w-lg mx-auto text-center space-y-6">
          <div className="bg-[#1b2533] p-8 rounded-xl border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
            <div className="text-6xl mb-4 animate-pulse">🏯</div>
            <h2 className="text-2xl font-black text-white mb-4">BOSS XUẤT HIỆN!</h2>
            <div className="space-y-3 text-left bg-[#0e1117] p-4 rounded-lg border border-[#334155]">
              <p className="text-gray-300"><span className="text-red-400 font-bold">⚔️ Thử thách:</span> {GATE_QUESTIONS} câu hỏi đánh giá năng lực</p>
              <p className="text-gray-300"><span className="text-green-400 font-bold">✅ Đạt yêu cầu:</span> Trả lời đúng ≥ {GATE_PASS_THRESHOLD}/{GATE_QUESTIONS} câu</p>
              <p className="text-gray-300"><span className="text-amber-400 font-bold">⚠️ Trượt sát:</span> {GATE_PASS_THRESHOLD - 1}/{GATE_QUESTIONS} = &quot;Chỉ thiếu 1 câu!&quot;</p>
              <p className="text-gray-300"><span className="text-purple-400 font-bold">🔄 Thi lại:</span> Cần luyện thêm {RETRY_CORRECT_NEEDED} câu đúng</p>
            </div>
            <button
              onClick={startCountdown}
              className="mt-8 bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-black text-xl px-10 py-4 rounded-full shadow-[0_0_25px_rgba(239,68,68,0.4)] transition-transform hover:scale-105"
            >
              ⚔️ BẮT ĐẦU THI
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'countdown') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-4 font-bold uppercase tracking-widest">Chuẩn bị...</p>
          <div className="text-[120px] font-black text-red-500 animate-ping" key={countdown}>
            {countdown > 0 ? countdown : 'GO!'}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'fighting') {
    const currentQ = questions[currentIdx];
    return (
      <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        <div className="flex justify-between items-center bg-[#1b2533] p-4 rounded-xl border border-red-500/30">
          <div>
            <span className="text-gray-400 text-sm">Cổng Khảo Thí</span>
            <h2 className="text-xl font-black text-red-400">Câu {currentIdx + 1} / {GATE_QUESTIONS}</h2>
          </div>
          <div className="flex gap-2">
            {Array.from({ length: GATE_QUESTIONS }).map((_, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 ${
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

  if (phase === 'result' && resultData) {
    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-20">
        {resultData.passed ? (
          <div className="max-w-lg mx-auto text-center space-y-6">
            <div className="bg-gradient-to-br from-[#052e23] to-[#0f172a] p-10 rounded-xl border-2 border-green-500 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
              <div className="text-7xl mb-4">🏆</div>
              <h2 className="text-3xl font-black text-green-400 mb-2">CỔNG ĐÃ MỞ!</h2>
              <p className="text-xl text-white mb-2">Kết quả: {resultData.score}/{GATE_QUESTIONS} câu đúng</p>
              <p className="text-gray-300">Chương mới đã được mở khóa trong Cây Năng Lực!</p>
              <div className="mt-8">
                <Link href="/skill-tree" className="bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white font-bold px-8 py-4 rounded-xl inline-block shadow-lg">
                  🌳 Xem Cây Năng Lực
                </Link>
              </div>
            </div>
          </div>
        ) : resultData.nearMiss ? (
          <div className="max-w-lg mx-auto text-center space-y-6">
            <div className="bg-gradient-to-br from-[#451a03] to-[#0f172a] p-10 rounded-xl border-2 border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
              <div className="text-7xl mb-4">😤</div>
              <h2 className="text-3xl font-black text-amber-400 mb-2">CHỈ THIẾU 1 CÂU!</h2>
              <p className="text-xl text-white mb-2">Kết quả: {resultData.score}/{GATE_QUESTIONS} câu đúng</p>
              <p className="text-amber-200 mb-4">Bạn gần lắm rồi! Luyện thêm {RETRY_CORRECT_NEEDED} câu đúng trong chương này rồi thử lại.</p>
              <div className="mt-6 flex flex-col gap-3 items-center">
                <Link href="/skill-tree" className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-6 py-3 rounded-xl inline-block">
                  🎯 Về luyện tiếp
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-lg mx-auto text-center space-y-6">
            <div className="bg-gradient-to-br from-[#450a0a] to-[#0f172a] p-10 rounded-xl border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <div className="text-7xl mb-4">💀</div>
              <h2 className="text-3xl font-black text-red-400 mb-2">CHƯA QUA CỔNG</h2>
              <p className="text-xl text-white mb-2">Kết quả: {resultData.score}/{GATE_QUESTIONS} câu đúng</p>
              <p className="text-red-200 mb-4">Hãy quay lại luyện kỹ năng yếu. Luyện thêm {RETRY_CORRECT_NEEDED} câu đúng trong chương này trước khi thi lại.</p>
              <div className="mt-6 flex flex-col gap-3 items-center">
                <Link href="/skill-tree" className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-6 py-3 rounded-xl inline-block">
                  🌳 Về Cây Năng Lực
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
