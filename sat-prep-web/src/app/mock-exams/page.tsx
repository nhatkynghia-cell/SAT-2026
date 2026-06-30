'use client';

import { useState, useEffect } from 'react';
import { useGamification } from '@/context/GamificationContext';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface ExamQuestion {
  id: string;
  full_passage?: string;
  practice_question: string;
  choices: string[];
  correct_choice: string;
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

export default function MockExamsPage() {
  const { handleExamComplete, updateQuestProgress } = useGamification();
  const [exams, setExams] = useState<FullExam[]>([]);
  const [selectedExam, setSelectedExam] = useState<FullExam | null>(null);

  const [isExamStarted, setIsExamStarted] = useState(false);
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  // Load danh sách đề thi
  useEffect(() => {
    fetch('/api/exams')
      .then(res => res.json())
      .then(data => {
        if (data.exams) setExams(data.exams);
      })
      .catch(err => console.error("Failed to load exams", err));
  }, []);

  const handleStartExam = (exam: FullExam) => {
    setSelectedExam(exam);
    setIsExamStarted(true);
    setCurrentModuleIndex(0);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setIsFinished(false);
    setScoreData(null);
    setTimeLeft(exam.modules[0].time_minutes * 60);
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

  const finishExam = () => {
    if (!selectedExam) return;
    setIsFinished(true);
    let correct = 0;
    let total = 0;

    selectedExam.modules.forEach((mod: ExamModule) => {
      mod.questions.forEach((q: ExamQuestion) => {
        total++;
        const userAns = answers[q.id];
        if (userAns && userAns.trim()[0].toUpperCase() === q.correct_choice.trim()[0].toUpperCase()) {
          correct++;
        }
      });
    });

    // Tính điểm SAT (Scale 400 - 1600 giả lập)
    const ratio = correct / total;
    const estimatedScore = Math.floor(400 + ratio * 1200);
    const xpReward = correct * 50;
    const coinsReward = correct * 10;

    setScoreData({ correct, total, estimatedScore, xpReward, coinsReward });
    // 🔴 Server quyết thưởng: thi thử = độ khó Medium × số câu đúng (§9.1).
    void handleExamComplete(correct, 'Medium');

    updateQuestProgress('q3', 1);
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
  // khai báo. Auto-nộp module khi hết giờ — đây là phản ứng với thời gian (nguồn
  // ngoài) đạt 0, một trường hợp setState-in-effect hợp lệ.
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
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header epic-shake-active">
        <div className="math-title-container">
          <div className="math-icon">🏆</div>
          <div>
            <h1 className="math-title">ĐẤU TRƯỜNG THI THỬ</h1>
            <p className="math-subtitle">Vượt qua bài thi Full-length để chứng minh sức mạnh thực sự!</p>
          </div>
        </div>
      </div>

      {!isExamStarted ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {exams.map(exam => (
            <div key={exam.id} className="bg-[#1b2533] border border-[#262730] rounded-xl p-6 hover:border-[#ff4b4b] transition-colors cursor-pointer shadow-lg" onClick={() => handleStartExam(exam)}>
              <div className="text-4xl mb-4">📝</div>
              <h3 className="text-xl font-bold text-white mb-2">{exam.title}</h3>
              <p className="text-gray-400 text-sm mb-4">{exam.description}</p>
              <div className="flex justify-between items-center text-xs text-[#ff4b4b] font-bold">
                <span>⏱️ {exam.total_time_minutes} Phút</span>
                <span>💎 Thưởng lớn</span>
              </div>
            </div>
          ))}
          {exams.length === 0 && (
            <div className="text-gray-500 text-center col-span-2">Đang tải danh sách đề thi...</div>
          )}
        </div>
      ) : isFinished && scoreData ? (
        <div className="bg-[#0f172a] border border-[#3b82f6] rounded-xl p-8 text-center shadow-[0_0_20px_rgba(59,130,246,0.2)]">
          <h2 className="text-3xl font-black text-white mb-6">KẾT QUẢ THI THỬ</h2>
          <div className="text-[60px] font-black text-[#fbbf24] mb-4 drop-shadow-lg">
            {scoreData.estimatedScore} <span className="text-2xl text-gray-400">/ 1600</span>
          </div>
          <p className="text-xl text-[#34d399] mb-8">Số câu đúng: {scoreData.correct} / {scoreData.total}</p>
          
          <div className="flex justify-center gap-6 mb-8">
             <div className="bg-[#1b2533] px-6 py-4 rounded-lg border border-[#3b82f6]">
               <div className="text-3xl mb-2">⭐</div>
               <div className="text-[#60a5fa] font-bold text-xl">+{scoreData.xpReward} XP</div>
             </div>
             <div className="bg-[#1b2533] px-6 py-4 rounded-lg border border-[#fbbf24]">
               <div className="text-3xl mb-2">💰</div>
               <div className="text-[#fbbf24] font-bold text-xl">+{scoreData.coinsReward} Xu</div>
             </div>
          </div>

          <button 
            onClick={() => setIsExamStarted(false)} 
            className="px-8 py-3 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-bold rounded-lg transition-colors"
          >
            Quay lại Đấu Trường
          </button>
        </div>
      ) : currentModule && currentQuestion ? (
        <div className="bg-[#1b2533] rounded-xl border border-[#262730] shadow-xl overflow-hidden flex flex-col min-h-[600px]">
          {/* Top Bar */}
          <div className="bg-[#0e1117] p-4 flex justify-between items-center border-b border-[#262730]">
            <div className="font-bold text-white">
              {currentModule.name} 
              <span className="ml-4 text-gray-400 font-normal">Câu {currentQuestionIndex + 1} / {currentModule.questions.length}</span>
            </div>
            <div className={`font-black text-xl flex items-center gap-2 ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
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
                         ${isSelected ? 'bg-[#1e3a8a] border-[#3b82f6] shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-[#0f172a] border-[#334155] hover:border-[#64748b]'}`}
                     >
                       <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{choice}</ReactMarkdown>
                     </button>
                   );
                 })}
               </div>
            </div>
          </div>

          {/* Navigation Bar */}
          <div className="bg-[#0e1117] p-4 border-t border-[#262730] flex justify-between items-center">
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
                   className="px-6 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded font-bold"
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
