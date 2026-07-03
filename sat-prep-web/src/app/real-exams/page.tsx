'use client';

import { useState, useEffect } from 'react';
import { useGamification } from '@/context/GamificationContext';
import { useToast } from '@/context/ToastContext';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// ROOT A follow-up: câu thi KHÔNG còn `correct_choice` (server giấu đáp án) —
// chỉ có `questionId` để nộp lên server chấm.
interface ExamQuestion {
  id: string;
  questionId?: string;
  full_passage?: string;
  practice_question: string;
  choices: string[];
}
interface ExamModule {
  name: string;
  time_minutes: number;
  questions: ExamQuestion[];
}
interface FullExam {
  id: string;
  title: string;
  description: string;
  total_time_minutes: number;
  modules: ExamModule[];
}
interface ScoreData {
  correct: number;
  total: number;
  estimatedScore: number;
  xpReward: number;
  coinsReward: number;
}

export default function RealExamsPage() {
  const { level, syncServerEconomy } = useGamification();
  const { showToast } = useToast();
  const [exams, setExams] = useState<FullExam[]>([]);
  const [selectedExam, setSelectedExam] = useState<FullExam | null>(null);

  const [isExamStarted, setIsExamStarted] = useState(false);
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    fetch('/api/exams')
      .then(res => res.json())
      .then(data => {
        if (data.exams) setExams(data.exams);
      })
      .catch(err => console.error("Failed to load exams", err));
  }, []);

  const handleStartExam = async (exam: FullExam) => {
    // Cổng năng lực: cần tinh thông ≥6 kỹ năng (level dẫn xuất = masteredCount+1).
    if (level < 7) {
      showToast("Cần tinh thông 6 kỹ năng để mở khóa đề thi thật QAS!", 'error');
      return;
    }
    // ROOT A follow-up: lấy đề từ /api/exams/start (server phát câu + lưu đáp án
    // + trả questionId). Đề trong danh sách đã bị giấu đáp án + không có questionId.
    try {
      const res = await fetch('/api/exams/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId: exam.id }),
      });
      if (!res.ok) {
        showToast("Không thể vào phòng thi. Vui lòng thử lại.", 'error');
        return;
      }
      const started: FullExam = await res.json();
      setSelectedExam(started);
      setIsExamStarted(true);
      setCurrentModuleIndex(0);
      setCurrentQuestionIndex(0);
      setAnswers({});
      setIsFinished(false);
      setScoreData(null);
      setTimeLeft(started.modules[0].time_minutes * 60);
    } catch (e) {
      console.error('Failed to start exam', e);
      showToast("Không thể vào phòng thi. Vui lòng thử lại.", 'error');
    }
  };

  const handleAnswer = (questionId: string, choice: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: choice }));
  };

  const currentModule = selectedExam?.modules[currentModuleIndex];
  const currentQuestion = currentModule?.questions[currentQuestionIndex];

  const handleNextQuestion = () => {
    if (!currentModule) return;
    if (currentQuestionIndex < currentModule.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const finishExam = async () => {
    if (!selectedExam) return;
    setIsFinished(true);

    // 🔴 ROOT A follow-up: đáp án đã bị giấu → KHÔNG tự chấm. Gom {questionId,
    // answer}[] rồi để SERVER chấm + thưởng theo độ khó THẬT từng câu.
    let total = 0;
    const submitted: { questionId: string; answer: string }[] = [];
    selectedExam.modules.forEach((mod: ExamModule) => {
      mod.questions.forEach((q: ExamQuestion) => {
        total++;
        const userAns = answers[q.id];
        if (q.questionId && userAns) {
          submitted.push({ questionId: q.questionId, answer: userAns });
        }
      });
    });

    let correct = 0;
    try {
      const res = await fetch('/api/exams/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: submitted }),
      });
      if (res.ok) {
        const data = await res.json();
        correct = data.correct ?? 0;
        syncServerEconomy(data.economy);
      }
    } catch (e) {
      console.error('Failed to grade exam', e);
    }

    const ratio = total > 0 ? correct / total : 0;
    const estimatedScore = Math.floor(400 + ratio * 1200);
    const xpReward = correct * 100; // Thưởng cao hơn thi thử (server chấm Hard)
    const coinsReward = correct * 20;

    setScoreData({ correct, total, estimatedScore, xpReward, coinsReward });
  };

  const handleNextModule = () => {
    if (!selectedExam) return;
    if (currentModuleIndex < selectedExam.modules.length - 1) {
      setCurrentModuleIndex(prev => prev + 1);
      setCurrentQuestionIndex(0);
      setTimeLeft(selectedExam.modules[currentModuleIndex + 1].time_minutes * 60);
    } else {
      finishExam();
    }
  };

  // Timer: đặt SAU handleNextModule/finishExam để không tham chiếu hàm trước khi
  // khai báo. Auto-nộp module khi hết giờ — phản ứng với thời gian (nguồn ngoài)
  // đạt 0, một trường hợp setState-in-effect hợp lệ.
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isExamStarted && !isFinished && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && isExamStarted && !isFinished) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleNextModule();
    }
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExamStarted, isFinished, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 relative pb-20">
      
      {/* Header */}
      <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #2e1065 0%, #4c1d95 100%)" }}>
        <div className="math-title-container">
          <div className="math-icon">🎓</div>
          <div>
            <h1 className="math-title" style={{ background: "linear-gradient(to right, #c084fc, #fbcfe8)", WebkitBackgroundClip: "text" }}>VƯỢT VŨ MÔN THI THẬT</h1>
            <p className="math-subtitle text-pink-200">Kỳ thi quyết định! Chúc chiến binh đạt điểm tối đa!</p>
          </div>
        </div>
      </div>

      {!isExamStarted ? (
        <>
          <div className="bg-[#450a0a] border border-[#ef4444] text-[#fca5a5] p-6 rounded-lg mb-6 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <h3 className="font-bold text-xl mb-2 flex items-center gap-2">⚠️ CẢNH BÁO BẢO MẬT ĐỀ THI THẬT</h3>
            <p className="text-sm leading-relaxed">
              Đề thi thật (QAS / Past Papers) chỉ được phép mở khóa khi Chiến binh đã tinh thông 6 kỹ năng.
              Vui lòng không chia sẻ đề thi ra bên ngoài để bảo vệ nguồn tài nguyên của Học viện.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {exams.map(exam => (
              <div key={exam.id} className={`bg-[#1b2533] border-2 ${level >= 7 ? 'border-[#10b981]' : 'border-[#334155]'} rounded-xl p-6 flex flex-col items-center text-center relative overflow-hidden group`}>
                <div className="text-5xl mb-4">📜</div>
                <h3 className="text-lg font-bold text-white mb-1">{exam.title}</h3>
                <p className="text-[#94a3b8] text-sm mb-4">Digital SAT QAS</p>
                
                <button 
                  onClick={() => handleStartExam(exam)}
                  className={`w-full py-2 rounded font-bold transition-colors ${level >= 7 ? 'bg-[#10b981] hover:bg-[#059669] text-white' : 'bg-[#334155] text-gray-400 cursor-not-allowed'}`}
                >
                  {level >= 7 ? 'VÀO THI NGAY' : `🔒 Cần tinh thông 6 kỹ năng`}
                </button>
              </div>
            ))}
          </div>
        </>
      ) : isFinished && scoreData ? (
        <div className="bg-[#2e1065] border border-[#a855f7] rounded-xl p-8 text-center shadow-[0_0_30px_rgba(168,85,247,0.3)]">
          <h2 className="text-3xl font-black text-white mb-6">KẾT QUẢ THI THẬT QAS</h2>
          <div className="text-[60px] font-black text-[#fbcfe8] mb-4 drop-shadow-lg">
            {scoreData.estimatedScore} <span className="text-2xl text-gray-400">/ 1600</span>
          </div>
          <p className="text-xl text-[#c084fc] mb-8">Số câu đúng: {scoreData.correct} / {scoreData.total}</p>
          
          <div className="flex justify-center gap-6 mb-8">
             <div className="bg-[#1b2533] px-6 py-4 rounded-lg border border-[#a855f7]">
               <div className="text-3xl mb-2">⭐</div>
               <div className="text-[#c084fc] font-bold text-xl">+{scoreData.xpReward} XP</div>
             </div>
             <div className="bg-[#1b2533] px-6 py-4 rounded-lg border border-[#fbcfe8]">
               <div className="text-3xl mb-2">💰</div>
               <div className="text-[#fbcfe8] font-bold text-xl">+{scoreData.coinsReward} Xu</div>
             </div>
          </div>

          <button 
            onClick={() => setIsExamStarted(false)} 
            className="px-8 py-3 bg-[#a855f7] hover:bg-[#9333ea] text-white font-bold rounded-lg transition-colors"
          >
            Về Danh Sách Đề
          </button>
        </div>
      ) : currentModule && currentQuestion ? (
        <div className="bg-[#1b2533] rounded-xl border border-[#a855f7] shadow-[0_0_20px_rgba(168,85,247,0.15)] overflow-hidden flex flex-col min-h-[600px]">
          {/* Top Bar */}
          <div className="bg-[#2e1065] p-4 flex justify-between items-center border-b border-[#4c1d95]">
            <div className="font-bold text-white">
              {currentModule.name} 
              <span className="ml-4 text-pink-300 font-normal">Câu {currentQuestionIndex + 1} / {currentModule.questions.length}</span>
            </div>
            <div className={`font-black text-xl flex items-center gap-2 ${timeLeft < 300 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
              ⏱️ {formatTime(timeLeft)}
            </div>
          </div>

          {/* Exam Content */}
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
                   const isSelected = answers[currentQuestion.id] === choice;
                   return (
                     <button
                       key={idx}
                       onClick={() => handleAnswer(currentQuestion.id, choice)}
                       className={`w-full text-left p-4 rounded-xl border transition-all text-[#e2e8f0] font-medium
                         ${isSelected ? 'bg-[#4c1d95] border-[#a855f7] shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-[#0f172a] border-[#334155] hover:border-[#64748b]'}`}
                     >
                       <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{choice}</ReactMarkdown>
                     </button>
                   );
                 })}
               </div>
            </div>
          </div>

          {/* Navigation Bar */}
          <div className="bg-[#2e1065] p-4 border-t border-[#4c1d95] flex justify-between items-center">
            <button 
              onClick={handlePrevQuestion}
              disabled={currentQuestionIndex === 0}
              className="px-6 py-2 bg-gray-800 disabled:opacity-50 text-white rounded font-bold"
            >
              ⬅️ Câu trước
            </button>
            <div className="flex gap-2">
               {currentQuestionIndex < currentModule.questions.length - 1 ? (
                 <button 
                   onClick={handleNextQuestion}
                   className="px-6 py-2 bg-[#a855f7] hover:bg-[#9333ea] text-white rounded font-bold"
                 >
                   Câu tiếp ➡️
                 </button>
               ) : (
                 <button 
                   onClick={handleNextModule}
                   className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-bold"
                 >
                   Nộp Module 🚀
                 </button>
               )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
