'use client';

import { useState, useEffect } from 'react';
import { useGamification } from '@/context/GamificationContext';
import { LoadingState } from './LoadingState';

export interface PracticeQuestion {
  title: string;
  full_passage?: string;
  archaic_words?: { word: string; meaning: string }[];
  practice_question: string;
  choices: string[];
  correct_choice: string;
  explanation: string;
  difficulty: string;
  trapRate: number;
  /** skillId từ skill-taxonomy (task #9) — optional để các trang cũ không vỡ. */
  skillId?: string;
  /** Phân tích từng đáp án (Nhóm 7 #9) — optional: câu cũ trong bank chưa có. */
  choice_analysis?: { choice_letter: string; is_correct: boolean; analysis: string }[];
}

interface CorePracticeUIProps {
  questionData: PracticeQuestion;
  onNext: () => void;
  isLoading?: boolean;
  onAnswer?: (isCorrect: boolean) => void;
  onSubmitted?: () => void;
  /**
   * Chế độ thi cổng: ẩn nút "Câu Hỏi Mới" cho tới khi đã nộp bài, để người thi
   * KHÔNG bỏ qua câu (skip = không trả lời) làm sai số đếm điểm cổng.
   */
  hideNextUntilSubmitted?: boolean;
}

export function CorePracticeUI({ questionData, onNext, isLoading, onAnswer, onSubmitted, hideNextUntilSubmitted }: CorePracticeUIProps) {
  const { handlePracticeAnswer, spendCoins, toggleBookmark, bookmarkedQuestions } = useGamification();
  
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [rewardData, setRewardData] = useState<{xpGiven: number, coinsGiven: number, comboMultiplier: number} | null>(null);
  
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [hintError, setHintError] = useState("");

  const isBookmarked = questionData ? bookmarkedQuestions.includes(questionData.practice_question) : false;

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!isSubmitted && !isLoading) {
      timer = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSubmitted, isLoading]);

  // Reset state when new question comes in. Đồng bộ state nội bộ với prop
  // questionData mới — reset-on-prop-change hợp lệ (không phải cascading render).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setSelectedAnswer(null);
    setIsSubmitted(false);
    setIsCorrect(null);
    setRewardData(null);
    setTimeElapsed(0);
    setHintsRevealed(0);
    setHintError("");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [questionData]);

  const handleSubmit = async () => {
    if (!selectedAnswer) return;
    setIsSubmitted(true);
    
    // Convert e.g. "A) option" to just the letter, or exact match
    const isAnsCorrect = selectedAnswer.trim()[0].toUpperCase() === questionData.correct_choice.trim()[0].toUpperCase();
    setIsCorrect(isAnsCorrect);
    
    const result = await handlePracticeAnswer(isAnsCorrect, questionData.difficulty);
    setRewardData(result);

    if (onAnswer) onAnswer(isAnsCorrect);

    // Prefetch câu kế ngay khi submit (user đang đọc giải thích) — 2.2.
    if (onSubmitted) onSubmitted();

    // Ghi nhận kết quả vào Mastery (task #9) — chỉ khi câu có skillId.
    // Fire-and-forget như /api/cau-sai: không chặn UI, lỗi chỉ log.
    if (questionData.skillId) {
      try {
        await fetch("/api/mastery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skillId: questionData.skillId,
            isCorrect: isAnsCorrect,
            difficulty: questionData.difficulty,
          })
        });
      } catch (e) {
        console.error("Failed to record mastery", e);
      }
    }

    if (!isAnsCorrect) {
      try {
        await fetch("/api/cau-sai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            passage: questionData.full_passage || "",
            question: questionData.practice_question,
            choices: questionData.choices,
            correct_choice: questionData.correct_choice,
            user_choice: selectedAnswer,
            explanation: questionData.explanation,
            source: "Core Practice (Next.js)",
            // Gắn skillId để sổ tay sinh câu BIẾN THỂ cùng kỹ năng khi ôn (Nhóm 7 #6).
            skill_id: questionData.skillId ?? null,
          })
        });
      } catch (e) {
        console.error("Failed to save mistake", e);
      }
    }
  };

  const handleRevealHint = (level: number) => {
    if (level === 1) {
      setHintsRevealed(1);
    } else if (level === 2) {
      if (spendCoins(20)) {
        setHintsRevealed(2);
      } else {
        setHintError("Bạn không đủ 20 Xu để mở gợi ý Cấp 2! Hãy luyện tập thêm.");
      }
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return <LoadingState message="Hệ thống đang cấu trúc câu hỏi động..." />;
  }

  const difficultyColor = questionData.difficulty === 'Hard' ? 'text-red-400 border-red-400' : 
                          questionData.difficulty === 'Medium' ? 'text-yellow-400 border-yellow-400' : 
                          'text-green-400 border-green-400';

  return (
    <div className="my-6 animate-in fade-in duration-500">
      
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 bg-[#1b2533] p-4 rounded-xl border border-[#262730]">
        <div>
          <h2 className="text-[20px] font-bold text-white mb-2">{questionData.title}</h2>
          <div className="flex gap-3 text-sm">
            <span className={`px-2 py-1 rounded border ${difficultyColor} bg-[rgba(0,0,0,0.2)] font-bold`}>
              🔥 Độ khó: {questionData.difficulty}
            </span>
            <span className="px-2 py-1 rounded border border-purple-400 text-purple-400 bg-[rgba(0,0,0,0.2)] font-bold">
              ⚠️ {questionData.trapRate}% học sinh sập bẫy
            </span>
            <span className="px-2 py-1 rounded border border-blue-400 text-blue-400 bg-[rgba(0,0,0,0.2)] font-bold flex items-center gap-1">
              ⏱️ {formatTime(timeElapsed)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => toggleBookmark(questionData.practice_question)}
            className={`text-sm px-4 py-2 rounded font-bold transition-colors border ${isBookmarked ? 'bg-yellow-500 text-yellow-900 border-yellow-500' : 'bg-transparent text-gray-300 border-gray-600 hover:bg-gray-800'}`}
          >
            {isBookmarked ? "⭐ Đã Lưu" : "⭐ Lưu Câu Này"}
          </button>
          {!(hideNextUntilSubmitted && !isSubmitted) && (
            <button
              onClick={onNext}
              className="text-sm bg-[#3b82f6] hover:bg-[#2563eb] border border-[#3b82f6] px-4 py-2 rounded text-white transition-colors font-bold">
              🔄 Câu Hỏi Mới
            </button>
          )}
        </div>
      </div>
      
      {/* Passage */}
      {questionData.full_passage && (
        <div className="bg-[#0e1117] border-l-4 border-[#3b82f6] text-[#e2e8f0] p-5 rounded-r mb-6 text-[16px] leading-relaxed whitespace-pre-wrap shadow-inner font-serif">
          {questionData.full_passage}
        </div>
      )}
      
      {/* Question */}
      <div className="text-white text-[18px] mb-6 font-bold whitespace-pre-wrap">
        {questionData.practice_question}
      </div>
      
      {/* Choices */}
      <div className="space-y-3 mb-8">
        {questionData.choices.map((choice, idx) => {
          const isSelected = selectedAnswer === choice;
          let choiceClass = "bg-[#1b2533] border-[#334155] text-[#e2e8f0]";
          
          if (isSubmitted) {
            const isThisChoiceCorrect = choice.trim()[0].toUpperCase() === questionData.correct_choice.trim()[0].toUpperCase();
            if (isThisChoiceCorrect) {
              choiceClass = "bg-[#064e3b] border-[#10b981] text-[#34d399]";
            } else if (isSelected) {
              choiceClass = "bg-[#7f1d1d] border-[#ef4444] text-[#fca5a5]";
            }
          } else if (isSelected) {
            choiceClass = "bg-[#1e3a8a] border-[#3b82f6] text-white";
          }

          return (
            <div 
              key={idx} 
              onClick={() => !isSubmitted && setSelectedAnswer(choice)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:scale-[1.01] ${choiceClass}`}
            >
              {choice}
            </div>
          );
        })}
      </div>
      
      {/* Smart Hints System */}
      {!isSubmitted && (
        <div className="mb-6 space-y-2">
          {hintsRevealed === 0 && (
            <button onClick={() => handleRevealHint(1)} className="text-sm text-yellow-400 hover:text-yellow-300 underline">
              💡 Cần gợi ý cơ bản? (Miễn phí)
            </button>
          )}
          {hintsRevealed >= 1 && (
            <div className="bg-[#1e293b] p-3 rounded border border-yellow-600/30 text-yellow-100 text-sm mb-2">
              <strong>💡 Gợi ý 1: </strong> 
              {questionData.archaic_words && questionData.archaic_words.length > 0 ? (
                <span>Từ khóa quan trọng: {questionData.archaic_words.map(w => `${w.word} (${w.meaning})`).join(", ")}</span>
              ) : (
                <span>Hãy chú ý kỹ vào yêu cầu chính của câu hỏi và loại trừ các đáp án mâu thuẫn.</span>
              )}
            </div>
          )}
          {hintsRevealed === 1 && (
            <div>
              <button onClick={() => handleRevealHint(2)} className="text-sm text-purple-400 hover:text-purple-300 underline font-bold">
                🔮 Loại bớt 1 đáp án sai? (Mất 20 Xu)
              </button>
              {hintError && <p className="text-red-400 text-xs mt-1">{hintError}</p>}
            </div>
          )}
          {hintsRevealed === 2 && (() => {
            // Gợi ý cấp 2 = LOẠI TRỪ: tiết lộ bẫy của MỘT đáp án SAI (không lộ đáp
            // án đúng) → dạy kỹ năng process-of-elimination trước khi nộp. Dùng
            // choice_analysis (Nhóm 7 #9); câu cũ trong bank thiếu field → fallback.
            const firstTrap = questionData.choice_analysis?.find(c => !c.is_correct);
            return (
              <div className="bg-[#2e1065] p-3 rounded border border-purple-500/50 text-purple-200 text-sm">
                <strong>🔮 Gợi ý loại trừ: </strong>
                {firstTrap ? (
                  <span>Có thể loại <b>đáp án {firstTrap.choice_letter}</b> — {firstTrap.analysis} Giờ cân nhắc các đáp án còn lại nhé!</span>
                ) : (
                  <span>Rất nhiều học sinh chọn sai vì mắc bẫy phân tâm. Hãy loại các đáp án mâu thuẫn với dữ kiện đề trước, rồi đọc kỹ phần còn lại.</span>
                )}
              </div>
            );
          })()}
        </div>
      )}
      
      {/* Feedback Section */}
      {isSubmitted && (
        <div className="mb-6 space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          {isCorrect && rewardData ? (
            <div className="bg-[#022c22] border-2 border-[#10b981] text-[#34d399] p-4 rounded-xl flex items-center gap-4 relative overflow-hidden shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              {rewardData.comboMultiplier > 1 && (
                <div className="absolute top-0 right-0 bg-[#facc15] text-[#713f12] text-xs font-bold px-3 py-1 rounded-bl-lg">
                  COMBO x{rewardData.comboMultiplier}!
                </div>
              )}
              <div className="text-4xl">🎉</div>
              <div>
                <div className="font-bold text-lg">CHÍNH XÁC TUYỆT ĐỐI!</div>
                <div className="text-sm mt-1">
                  Nhận thưởng: <b className="text-white">+{rewardData.xpGiven} XP</b> | <b className="text-yellow-400">+{rewardData.coinsGiven} Xu</b> 
                </div>
              </div>
            </div>
          ) : !isCorrect ? (
            <div className="bg-[#450a0a] border-2 border-[#ef4444] text-[#fca5a5] p-4 rounded-xl flex items-center gap-4 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
              <div className="text-4xl">❌</div>
              <div>
                <div className="font-bold text-lg">SẬP BẪY RỒI CHIẾN BINH!</div>
                <div className="text-sm mt-1">Câu hỏi đã được tự động lưu vào Sổ tay Cải thiện. Đừng nản lòng!</div>
              </div>
            </div>
          ) : null}

          {/* AI Explanation */}
          <div className="bg-[#0f172a] p-5 rounded-xl border border-[#334155] shadow-lg">
            <h4 className="text-[#fbbf24] font-bold mb-3 flex items-center gap-2">
              <span>🤖 GIA SƯ AI PHÂN TÍCH ĐÁP ÁN:</span>
            </h4>
            <div className="text-[15px] text-[#e2e8f0] leading-relaxed whitespace-pre-wrap">
              {questionData.explanation}
            </div>
          </div>

          {/* Phân tích TỪNG đáp án (Nhóm 7 #9) — dạy kỹ năng loại trừ bẫy. Chỉ
              hiện khi câu có choice_analysis (câu cũ trong bank có thể chưa có). */}
          {Array.isArray(questionData.choice_analysis) && questionData.choice_analysis.length > 0 && (
            <div className="bg-[#0f172a] p-5 rounded-xl border border-[#334155] shadow-lg">
              <h4 className="text-[#fbbf24] font-bold mb-3 flex items-center gap-2">
                <span>🔍 VÌ SAO CÁC ĐÁP ÁN KIA SAI?</span>
              </h4>
              <div className="space-y-2">
                {questionData.choice_analysis.map((ca, idx) => {
                  // Khớp lựa chọn của user theo INDEX (schema đảm bảo choice_analysis[i]
                  // ứng với choices[i] đúng thứ tự) — KHÔNG parse chữ cái đầu, vì choices
                  // có thể là giá trị trần ("x = 3") không mang nhãn "A)".
                  const isUserPick = questionData.choices[idx] === selectedAnswer;
                  const rowClass = ca.is_correct
                    ? 'bg-[#064e3b]/40 border-[#10b981]'
                    : isUserPick
                    ? 'bg-[#7f1d1d]/40 border-[#ef4444]'
                    : 'bg-[#1b2533] border-[#334155]';
                  const icon = ca.is_correct ? '✅' : isUserPick ? '❌' : '⚠️';
                  return (
                    <div key={idx} className={`p-3 rounded-lg border ${rowClass}`}>
                      <div className="text-sm text-[#e2e8f0] leading-relaxed">
                        <span className="font-bold mr-1">{icon} {ca.choice_letter}.</span>
                        {isUserPick && !ca.is_correct && (
                          <span className="text-[#fca5a5] font-bold mr-1">(Bạn đã chọn)</span>
                        )}
                        {ca.analysis}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Submit button */}
      {!isSubmitted && (
        <button 
          onClick={handleSubmit}
          disabled={!selectedAnswer}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-lg ${selectedAnswer ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white hover:scale-[1.02]' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}>
          🚀 CHỐT ĐÁP ÁN
        </button>
      )}
    </div>
  );
}
