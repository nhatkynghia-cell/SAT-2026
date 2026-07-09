'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGamification } from '@/context/GamificationContext';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { rawToScaled, type AdaptivePath } from '@/lib/exam-scoring';

// Câu thi ĐÃ GIẤU đáp án (ROOT A): chỉ có questionId để nộp lên server chấm.
interface ExamQuestion {
  id: string;
  questionId?: string;
  full_passage?: string;
  practice_question: string;
  choices: string[];
}

interface ModuleData {
  name: string;
  timeMinutes: number;
  moduleNum: 1 | 2;
  section: 'rw' | 'math';
  questions: ExamQuestion[];
}

type Phase = 'lobby' | 'loading' | 'in-module' | 'between-modules' | 'break' | 'finished';

interface SectionAcc {
  raw: number;
  total: number;
  path: AdaptivePath | null;
}

interface ExamRunnerProps {
  title: string;
  subtitle: string;
  mode: 'mock' | 'real';
  headerGradient?: string;
  titleGradient?: string;
  accentColor?: string;
}

// Header tách ra module-scope (KHÔNG tạo trong render) — chỉ phụ thuộc props.
function ExamHeader({
  title,
  subtitle,
  headerGradient,
  titleGradient,
}: {
  title: string;
  subtitle: string;
  headerGradient: string;
  titleGradient: string;
}) {
  return (
    <div className="math-academy-header" style={{ background: headerGradient }}>
      <div className="math-title-container">
        <div className="math-icon">🏆</div>
        <div>
          <h1 className="math-title" style={{ background: titleGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{title}</h1>
          <p className="math-subtitle">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

export default function ExamRunner({
  title,
  subtitle,
  mode,
  headerGradient = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
  titleGradient = 'linear-gradient(to right, #fbbf24, #f59e0b)',
  accentColor = '#3b82f6',
}: ExamRunnerProps) {
  const { syncServerEconomy, updateQuestProgress } = useGamification();

  const [phase, setPhase] = useState<Phase>('lobby');
  const [currentSection, setCurrentSection] = useState<'rw' | 'math'>('rw');
  const [currentModule, setCurrentModule] = useState<ModuleData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // key = questionId
  const [timeLeft, setTimeLeft] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [rwPath, setRwPath] = useState<AdaptivePath | null>(null);

  // Tích luỹ điểm mỗi section (từ kết quả SERVER chấm — không tự chấm client).
  const accRef = useRef<{ rw: SectionAcc; math: SectionAcc }>({
    rw: { raw: 0, total: 0, path: null },
    math: { raw: 0, total: 0, path: null },
  });

  // Chụp lại breakdown lúc chấm xong (KHÔNG đọc accRef trong render).
  const [displayScore, setDisplayScore] = useState<{
    rw: number;
    math: number;
    total: number;
    rwRaw: number;
    rwTotal: number;
    rwPathResult: AdaptivePath;
    mathRaw: number;
    mathTotal: number;
    mathPathResult: AdaptivePath;
  } | null>(null);

  // Timer đếm ngược
  useEffect(() => {
    if (phase !== 'in-module' || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [phase, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const buildSubmittedAnswers = useCallback(() => {
    if (!currentModule) return [];
    const out: { questionId: string; answer: string }[] = [];
    for (const q of currentModule.questions) {
      if (q.questionId && answers[q.questionId]) {
        out.push({ questionId: q.questionId, answer: answers[q.questionId] });
      }
    }
    return out;
  }, [currentModule, answers]);

  const startSection = useCallback(async (section: 'rw' | 'math') => {
    setPhase('loading');
    setCurrentSection(section);
    setErrorMsg('');
    setLoadingMessage(`AI đang sinh đề ${section === 'rw' ? 'Reading & Writing' : 'Math'} Module 1...`);
    setLoadingProgress(10);

    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => Math.min(prev + 5, 90));
    }, 2000);

    try {
      const res = await fetch('/api/exam-session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, mode }),
      });
      clearInterval(progressInterval);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 403 && err.reason === 'tier') {
          setErrorMsg('Thi Thật QAS là quyền lợi Premium. Chuyển tới trang nâng cấp...');
          setTimeout(() => { window.location.href = '/upgrade'; }, 1500);
          setPhase('lobby');
          return;
        }
        throw new Error(err.error || 'Không thể bắt đầu bài thi');
      }

      const data = await res.json();
      setLoadingProgress(100);
      setCurrentModule(data.module);
      setCurrentQuestionIndex(0);
      setAnswers({});
      setTimeLeft(data.module.timeMinutes * 60);
      setPhase('in-module');
    } catch (error) {
      clearInterval(progressInterval);
      console.error('Start section error:', error);
      setErrorMsg((error as Error)?.message || 'Không thể sinh đề thi. Vui lòng thử lại.');
      setPhase('lobby');
    }
  }, [mode]);

  const finishExam = useCallback(() => {
    const rw = accRef.current.rw;
    const math = accRef.current.math;
    const rwPathResult = rw.path ?? 'easy';
    const mathPathResult = math.path ?? 'easy';
    const rwScaled = rawToScaled(rw.raw, rw.total || 1, rwPathResult);
    const mathScaled = rawToScaled(math.raw, math.total || 1, mathPathResult);
    setDisplayScore({
      rw: rwScaled,
      math: mathScaled,
      total: rwScaled + mathScaled,
      rwRaw: rw.raw,
      rwTotal: rw.total,
      rwPathResult,
      mathRaw: math.raw,
      mathTotal: math.total,
      mathPathResult,
    });
    updateQuestProgress('exam', 1);
    setPhase('finished');
  }, [updateQuestProgress]);

  const submitModule = useCallback(async () => {
    if (!currentModule) return;
    const section = currentModule.section;
    const moduleNum = currentModule.moduleNum;
    const submitted = buildSubmittedAnswers();

    if (moduleNum === 1) {
      setPhase('between-modules');
      setLoadingMessage(`AI đang phân tích kết quả và sinh ${section === 'rw' ? 'Reading & Writing' : 'Math'} Module 2...`);
      setLoadingProgress(10);
    } else {
      setPhase('loading');
      setLoadingMessage('Đang chấm điểm...');
      setLoadingProgress(40);
    }

    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => Math.min(prev + 5, 90));
    }, 2000);

    try {
      const res = await fetch('/api/exam-session/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, moduleNum, mode, answers: submitted }),
      });
      clearInterval(progressInterval);

      if (!res.ok) throw new Error('Không thể nộp module');

      const data = await res.json();

      // Đồng bộ economy THẬT (server đã cộng thưởng theo độ khó câu đúng).
      syncServerEconomy(data.economy);

      // Tích luỹ điểm section từ kết quả server chấm.
      const acc = accRef.current[section];
      acc.raw += data.moduleResult?.correct ?? 0;
      acc.total += data.moduleResult?.total ?? 0;

      if (moduleNum === 1 && !data.module) {
        // Module 1 đã chấm + điểm đã cộng vào acc ở trên; server KHÔNG sinh được
        // Module 2 (moduleGenerationFailed, thường do OpenAI chặn VN). KHÔNG mất
        // điểm M1 — kết thúc section êm: RW nghỉ giải lao qua Math, Math chấm luôn.
        acc.path = data.adaptivePath;
        if (section === 'rw') { setRwPath(data.adaptivePath); setPhase('break'); }
        else finishExam();
      } else if (moduleNum === 1) {
        acc.path = data.adaptivePath;
        if (section === 'rw') setRwPath(data.adaptivePath);
        setLoadingProgress(100);
        setCurrentModule(data.module);
        setCurrentQuestionIndex(0);
        setAnswers({});
        setTimeLeft(data.module.timeMinutes * 60);
        setPhase('in-module');
      } else {
        // Module 2 xong → RW: nghỉ giải lao rồi qua Math. Math: kết thúc.
        if (section === 'rw') {
          setPhase('break');
        } else {
          finishExam();
        }
      }
    } catch (error) {
      clearInterval(progressInterval);
      console.error('Submit module error:', error);
      // Không sinh được M2 / lỗi mạng: nếu đang ở RW thì vẫn cho qua break, else chấm luôn.
      if (moduleNum === 1 && section === 'rw') {
        setPhase('break');
      } else if (moduleNum === 1 && section === 'math') {
        finishExam();
      } else if (section === 'rw') {
        setPhase('break');
      } else {
        finishExam();
      }
    }
  }, [currentModule, buildSubmittedAnswers, mode, syncServerEconomy, finishExam]);

  // Auto-nộp khi hết giờ (đặt SAU submitModule để không truy cập trước khi khai báo).
  useEffect(() => {
    if (phase === 'in-module' && timeLeft === 0 && currentModule) {
      // set-state-in-effect cố ý: auto-nộp là phản ứng với đồng hồ đếm về 0 (external clock).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void submitModule();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const resetToLobby = () => {
    accRef.current = { rw: { raw: 0, total: 0, path: null }, math: { raw: 0, total: 0, path: null } };
    setRwPath(null);
    setDisplayScore(null);
    setCurrentModule(null);
    setAnswers({});
    setPhase('lobby');
  };

  const currentQuestion = currentModule?.questions[currentQuestionIndex];

  const header = <ExamHeader title={title} subtitle={subtitle} headerGradient={headerGradient} titleGradient={titleGradient} />;

  // --- RENDER ---

  if (phase === 'lobby') {
    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-20">
        {header}
        <div className="max-w-2xl mx-auto">
          {errorMsg && (
            <div className="bg-[#450a0a] border border-[#ef4444] text-[#fca5a5] p-4 rounded-lg mb-4 text-sm">{errorMsg}</div>
          )}
          <div className="bg-[#1b2533] border border-[#262730] rounded-xl p-8 shadow-lg">
            <h2 className="text-2xl font-bold text-white mb-4">SAT Practice Test (Bản Chuẩn Digital SAT)</h2>
            <p className="text-gray-400 mb-6">Đề thi mô phỏng sát cấu trúc Digital SAT thật: 4 module adaptive, 98 câu, 134 phút.</p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-[#0f172a] p-4 rounded-lg border border-[#334155]">
                <div className="text-sm text-gray-400 mb-1">Reading & Writing</div>
                <div className="text-white font-bold">2 Modules × 27 câu</div>
                <div className="text-xs text-gray-500 mt-1">32 phút / module</div>
              </div>
              <div className="bg-[#0f172a] p-4 rounded-lg border border-[#334155]">
                <div className="text-sm text-gray-400 mb-1">Math</div>
                <div className="text-white font-bold">2 Modules × 22 câu</div>
                <div className="text-xs text-gray-500 mt-1">35 phút / module</div>
              </div>
            </div>

            <div className="bg-[#0c1322] border border-[#1e3a5f] rounded-lg p-4 mb-6">
              <h3 className="text-sm font-bold text-blue-300 mb-2">Cơ chế Adaptive (giống thi thật)</h3>
              <p className="text-xs text-gray-400">Module 2 tự điều chỉnh độ khó theo kết quả Module 1. Làm tốt M1 → M2 khó hơn (trần điểm cao hơn). Chưa tốt → M2 dễ hơn (trần điểm giới hạn).</p>
            </div>

            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-400">
                <span className="text-[#fbbf24]">⏱️ 134 Phút</span>
                <span className="mx-3">|</span>
                <span className="text-[#34d399]">98 Câu</span>
                <span className="mx-3">|</span>
                <span className="text-[#f472b6]">💎 Thưởng theo độ khó</span>
              </div>
              <button
                onClick={() => startSection('rw')}
                className="px-8 py-3 font-bold text-white rounded-lg transition-all hover:scale-105 shadow-lg"
                style={{ background: accentColor }}
              >
                BẮT ĐẦU THI
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'loading' || phase === 'between-modules') {
    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-20">
        {header}
        <div className="max-w-lg mx-auto text-center">
          <div className="bg-[#1b2533] border border-[#262730] rounded-xl p-12 shadow-lg">
            <div className="text-5xl mb-6 animate-bounce">🧠</div>
            <h2 className="text-xl font-bold text-white mb-4">{loadingMessage}</h2>
            <div className="w-full bg-[#0f172a] rounded-full h-3 mb-4">
              <div className="h-3 rounded-full transition-all duration-500" style={{ width: `${loadingProgress}%`, background: accentColor }} />
            </div>
            <p className="text-gray-400 text-sm">Câu hỏi được AI sinh theo chuẩn Digital SAT, đa dạng kỹ năng và độ khó...</p>
            {phase === 'between-modules' && rwPath && currentSection === 'rw' && (
              <div className="mt-6 p-4 rounded-lg border" style={{ borderColor: accentColor, background: 'rgba(59,130,246,0.1)' }}>
                <p className="text-sm font-bold text-white">
                  Nhánh Module 2: {rwPath === 'hard' ? '🔥 KHÓ (trần 800)' : '📘 CƠ BẢN (trần 650)'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'break') {
    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-20">
        {header}
        <div className="max-w-lg mx-auto text-center">
          <div className="bg-[#1b2533] border border-[#262730] rounded-xl p-12 shadow-lg">
            <div className="text-5xl mb-6">☕</div>
            <h2 className="text-2xl font-bold text-white mb-4">Hoàn thành phần Reading & Writing!</h2>
            <p className="text-gray-400 mb-6">Nghỉ giải lao trước khi vào phần Math.</p>
            <button
              onClick={() => startSection('math')}
              className="px-8 py-3 font-bold text-white rounded-lg transition-all hover:scale-105 shadow-lg"
              style={{ background: accentColor }}
            >
              VÀO PHẦN MATH →
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'finished') {
    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-20">
        {header}
        {displayScore && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-[#0f172a] border rounded-xl p-8 text-center shadow-lg" style={{ borderColor: accentColor }}>
              <h2 className="text-3xl font-black text-white mb-6">KẾT QUẢ THI DIGITAL SAT</h2>
              <div className="text-[60px] font-black text-[#fbbf24] mb-2 drop-shadow-lg">
                {displayScore.total} <span className="text-2xl text-gray-400">/ 1600</span>
              </div>
              <div className="grid grid-cols-2 gap-6 mb-8 mt-6">
                <div className="bg-[#1b2533] p-5 rounded-lg border border-[#334155]">
                  <div className="text-sm text-gray-400 mb-1">Reading & Writing</div>
                  <div className="text-3xl font-black text-[#60a5fa]">{displayScore.rw}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {displayScore.rwRaw}/{displayScore.rwTotal} câu đúng • {displayScore.rwPathResult === 'hard' ? '🔥 Hard' : '📘 Easy'} path
                  </div>
                </div>
                <div className="bg-[#1b2533] p-5 rounded-lg border border-[#334155]">
                  <div className="text-sm text-gray-400 mb-1">Math</div>
                  <div className="text-3xl font-black text-[#34d399]">{displayScore.math}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {displayScore.mathRaw}/{displayScore.mathTotal} câu đúng • {displayScore.mathPathResult === 'hard' ? '🔥 Hard' : '📘 Easy'} path
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-400 mb-6">💰 Xu & XP đã được cộng theo độ khó thật của từng câu đúng (chấm trên máy chủ).</p>
              <button onClick={resetToLobby} className="px-8 py-3 font-bold text-white rounded-lg transition-colors" style={{ background: accentColor }}>
                Quay lại Đấu Trường
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // phase === 'in-module'
  if (!currentModule || !currentQuestion) return null;
  const qKey = currentQuestion.questionId ?? currentQuestion.id;

  return (
    <div className="space-y-0 animate-in fade-in duration-700 pb-20">
      {header}
      <div className="bg-[#1b2533] rounded-xl border border-[#262730] shadow-xl overflow-hidden flex flex-col min-h-[600px]">
        <div className="bg-[#0e1117] p-4 flex justify-between items-center border-b border-[#262730]">
          <div className="font-bold text-white">
            {currentModule.name}
            <span className="ml-4 text-gray-400 font-normal">Câu {currentQuestionIndex + 1} / {currentModule.questions.length}</span>
          </div>
          <div className={`font-black text-xl flex items-center gap-2 ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
            ⏱️ {formatTime(timeLeft)}
          </div>
        </div>

        <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="pr-6 md:border-r border-[#334155]">
            {currentQuestion.full_passage && (
              <div className="prose prose-invert max-w-none text-[#e2e8f0] font-serif text-[17px] leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {currentQuestion.full_passage}
                </ReactMarkdown>
              </div>
            )}
          </div>
          <div>
            <div className="font-bold text-white text-lg mb-6">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {currentQuestion.practice_question}
              </ReactMarkdown>
            </div>
            <div className="space-y-3">
              {currentQuestion.choices.map((choice: string, idx: number) => {
                const isSelected = answers[qKey] === choice;
                return (
                  <button
                    key={idx}
                    onClick={() => setAnswers(prev => ({ ...prev, [qKey]: choice }))}
                    className={`w-full text-left p-4 rounded-xl border transition-all text-[#e2e8f0] font-medium
                      ${isSelected ? 'bg-[#1e3a8a] border-[#3b82f6] shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-[#0f172a] border-[#334155] hover:border-[#64748b]'}`}
                  >
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{choice}</ReactMarkdown>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-[#0e1117] p-4 border-t border-[#262730] flex justify-between items-center">
          <button
            onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
            disabled={currentQuestionIndex === 0}
            className="px-6 py-2 bg-gray-800 disabled:opacity-50 text-white rounded font-bold"
          >
            ⬅️ Câu trước
          </button>
          <div className="text-xs text-gray-500">
            {currentSection === 'rw' ? 'Reading & Writing' : 'Math'} • Module {currentModule.moduleNum}
          </div>
          <div className="flex gap-2">
            {currentQuestionIndex < currentModule.questions.length - 1 ? (
              <button
                onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                className="px-6 py-2 text-white rounded font-bold hover:opacity-90"
                style={{ background: accentColor }}
              >
                Câu tiếp ➡️
              </button>
            ) : (
              <button
                onClick={() => void submitModule()}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-bold"
              >
                Nộp Module 🚀
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
