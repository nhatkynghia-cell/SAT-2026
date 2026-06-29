'use client';

import { useState, useEffect } from 'react';
import { useGamification } from '@/context/GamificationContext';

interface QuestionData {
  id?: number;
  type?: string;
  passage?: string;
  question: string;
  choices: string[];
  correct: string;
  explanation: string;
  translation?: string;
}

export function AITutoring() {
  const { handlePracticeAnswer, practiceStreak, questionKey, incrementQuestionKey } = useGamification();
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [rewardData, setRewardData] = useState<{xpGiven: number, coinsGiven: number, comboMultiplier: number} | null>(null);
  
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // Fetch question on mount and when questionKey changes
  useEffect(() => {
    const fetchQuestion = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/questions');
        if (res.ok) {
          const data = await res.json();
          setCurrentQuestion(data);
        }
      } catch (e) {
        console.error("Failed to fetch question:", e);
      }
      setIsLoading(false);
      setSelectedAnswer(null);
      setIsSubmitted(false);
      setIsCorrect(null);
      setChatMessages([]);
    };
    
    fetchQuestion();
  }, [questionKey]);

  const handleSendChat = async () => {
    if (!chatInput.trim() || !currentQuestion) return;
    
    const userText = chatInput;
    const userMessage = { role: 'user' as const, text: userText };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setIsTyping(true);
    
    // AI Token Caching Mechanism
    const cacheKey = `ai_cache_${currentQuestion.question.substring(0, 30)}_${selectedAnswer}_${userText}`;
    const cachedResponse = localStorage.getItem(cacheKey);
    
    if (cachedResponse) {
      setTimeout(() => {
        setIsTyping(false);
        setChatMessages(prev => [...prev, { role: 'ai', text: cachedResponse }]);
      }, 500); // Fake delay for realism
      return;
    }

    try {
      // Server-authoritative: chỉ gửi DỮ LIỆU NGỮ CẢNH; prompt/model dựng ở server (§9.2).
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: currentQuestion.question,
          correctAnswer: currentQuestion.correct,
          selectedAnswer: selectedAnswer,
          explanation: currentQuestion.explanation,
          history: chatMessages,
          userMessage: userMessage.text,
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // Hết quota (429) → hiển thị thông báo thân thiện từ server, không cache.
        setIsTyping(false);
        setChatMessages(prev => [...prev, {
          role: 'ai',
          text: data?.error || "Lỗi: Không thể kết nối với server. Có thể bạn chưa thiết lập OPENAI_API_KEY trong file .env.local."
        }]);
        return;
      }

      const aiText = data.reply || "";

      // Save to cache
      localStorage.setItem(cacheKey, aiText);

      setIsTyping(false);
      setChatMessages(prev => [...prev, { role: 'ai', text: aiText }]);
    } catch (err) {
      setIsTyping(false);
      setChatMessages(prev => [...prev, { role: 'ai', text: "Lỗi: Không thể kết nối với server. Có thể bạn chưa thiết lập OPENAI_API_KEY trong file .env.local." }]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedAnswer || !currentQuestion) return;
    setIsSubmitted(true);
    
    const correct = selectedAnswer === currentQuestion.correct;
    setIsCorrect(correct);
    
    const result = handlePracticeAnswer(correct, 50, 10);
    setRewardData(result);
    
    if (!correct) {
      try {
        await fetch("/api/cau-sai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            passage: currentQuestion.passage || "",
            question: currentQuestion.question,
            choices: currentQuestion.choices,
            correct_choice: currentQuestion.correct,
            user_choice: selectedAnswer,
            explanation: currentQuestion.explanation,
            source: "Luyện AI (Next.js)"
          })
        });
      } catch (e) {
        console.error("Failed to save mistake", e);
      }
    }
  };

  const handleNext = () => {
    incrementQuestionKey();
  };

  if (isLoading) {
    return (
      <div className="my-6 p-8 flex flex-col items-center justify-center bg-[#1b2533] rounded-xl border border-[#262730]">
        <div className="text-4xl animate-spin mb-4">⚙️</div>
        <div className="text-white font-bold">Gia sư AI đang soạn câu hỏi mới...</div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className="my-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
        <h2 className="text-[24px] font-bold text-white">
          📝 Đang luyện tập phần: {currentQuestion.type || 'Hỗn hợp'}
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={handleNext}
            className="text-sm bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.1)] px-4 py-1.5 rounded text-white transition-colors">
            🔄 Đổi câu hỏi khác
          </button>
          <button className="text-sm bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.1)] px-4 py-1.5 rounded text-white transition-colors">
            💾 Lưu vào thư viện
          </button>
        </div>
      </div>
      
      <hr className="border-[#262730] my-4" />
      
      <h3 className="text-[18px] font-bold text-white mb-4">Question:</h3>
      
      {/* Passage */}
      {currentQuestion.passage && (
        <div className="bg-[#1b2533] border-l-4 border-[#3b82f6] text-[#e2e8f0] p-4 rounded mb-6 text-[15px] leading-relaxed whitespace-pre-wrap">
          {currentQuestion.passage}
        </div>
      )}
      
      {/* Question */}
      <div className="text-white text-[16px] mb-6 font-bold whitespace-pre-wrap">
        {currentQuestion.question}
      </div>
      
      {/* Choices */}
      <div className="space-y-2 mb-8">
        <div className="text-[14px] text-white mb-2">Chọn đáp án đúng nhất:</div>
        
        {currentQuestion.choices.map((choice, idx) => (
          <label key={idx} className="flex items-start gap-3 cursor-pointer group p-2 hover:bg-[rgba(255,255,255,0.02)] rounded">
            <input 
              type="radio" 
              name="question_choice" 
              disabled={isSubmitted}
              checked={selectedAnswer === choice}
              onChange={() => setSelectedAnswer(choice)}
              className="mt-1 w-4 h-4 text-red-500 bg-gray-800 border-gray-600 focus:ring-red-500" 
            />
            <span className="text-[15px] text-[#e2e8f0]">{choice}</span>
          </label>
        ))}
      </div>
      
      {/* Feedback Section */}
      {isSubmitted && (
        <div className="mb-6 space-y-6 animate-in fade-in zoom-in duration-500">
          {isCorrect && rewardData ? (
            <div className="bg-[#022c22] border border-[#10b981] text-[#34d399] p-4 rounded flex items-center gap-3 relative overflow-hidden">
              {rewardData.comboMultiplier > 1 && (
                <div className="absolute top-0 right-0 bg-[#facc15] text-[#713f12] text-xs font-bold px-2 py-1 rounded-bl">
                  COMBO x{rewardData.comboMultiplier}!
                </div>
              )}
              <span className="text-2xl">🎉</span>
              <div>
                <div className="font-bold">TUYỆT VỜI! Bạn đã trả lời chính xác!</div>
                <div className="text-sm">
                  Nhận được: <b>+{rewardData.xpGiven} XP</b> | 💰 <b>+{rewardData.coinsGiven} Xu</b> 
                  {practiceStreak > 1 && <span className="text-yellow-400 ml-2"> (Chuỗi đúng: {practiceStreak}🔥)</span>}
                </div>
              </div>
            </div>
          ) : !isCorrect ? (
            <div className="bg-[#450a0a] border border-[#ef4444] text-[#fca5a5] p-4 rounded flex items-center gap-3">
              <span className="text-2xl">❌</span>
              <div>
                <div className="font-bold">Chưa đúng rồi Chiến binh ơi!</div>
                <div className="text-sm">Đáp án đúng là: {currentQuestion.correct}. Câu này đã được lưu vào sổ tay ôn lỗi sai.</div>
              </div>
            </div>
          ) : null}

          {/* AI Explanation & Speech */}
          <div className="bg-[#1e293b] p-4 rounded border border-[#334155]">
            <h4 className="text-[#fbbf24] font-bold mb-2 flex justify-between items-center">
              <span>🤖 BÀI GIẢNG CHI TIẾT TỪ GIA SƯ AI</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const utterance = new SpeechSynthesisUtterance(currentQuestion.question);
                    utterance.lang = "en-US";
                    window.speechSynthesis.speak(utterance);
                  }}
                  className="text-xs bg-[#262730] hover:bg-[#333] border border-[#404353] px-2 py-1 rounded text-white transition-colors"
                >
                  🔊 Đọc đề (Tiếng Anh)
                </button>
                <button 
                  onClick={() => {
                    const utterance = new SpeechSynthesisUtterance(currentQuestion.explanation);
                    utterance.lang = "vi-VN";
                    window.speechSynthesis.speak(utterance);
                  }}
                  className="text-xs bg-[#262730] hover:bg-[#333] border border-[#404353] px-2 py-1 rounded text-white transition-colors"
                >
                  🔊 Nghe giảng (Tiếng Việt)
                </button>
              </div>
            </h4>
            <div className="text-sm text-[#e2e8f0] leading-relaxed whitespace-pre-wrap">
              {currentQuestion.explanation}
            </div>
          </div>

          {/* Interactive Chat */}
          <div className="bg-[#1b2533] p-4 rounded border border-[#262730]">
            <h4 className="text-[14px] font-bold text-white mb-3">💬 Hỏi đáp sâu với Gia sư AI về câu hỏi này:</h4>
            <div className="space-y-3 mb-4">
              {chatMessages.length === 0 && !isTyping ? (
                <div className="bg-[rgba(59,130,246,0.1)] border border-[rgba(59,130,246,0.2)] p-3 rounded text-sm text-[#e2e8f0]">
                  Hãy nhập câu hỏi nếu bạn chưa hiểu rõ phần giải thích nhé!
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div key={idx} className={`p-3 rounded text-sm ${msg.role === 'user' ? 'bg-[#2563eb] text-white ml-8' : 'bg-[#334155] text-[#e2e8f0] mr-8'}`}>
                    <strong>{msg.role === 'user' ? 'Bạn' : 'Gia sư AI'}:</strong> {msg.text}
                  </div>
                ))
              )}
              {isTyping && (
                <div className="p-3 rounded text-sm bg-[#334155] text-[#94a3b8] mr-8 flex items-center gap-2">
                  <strong>Gia sư AI:</strong> Đang suy nghĩ...
                  <span className="animate-pulse">⏳</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="Ví dụ: Tại sao đáp án A lại sai?"
                className="flex-1 bg-[#0e1117] border border-[#334155] rounded px-3 py-2 text-sm text-white outline-none focus:border-[#3b82f6]"
              />
              <button 
                onClick={handleSendChat}
                className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                Gửi câu hỏi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit button */}
      {!isSubmitted && (
        <button 
          onClick={handleSubmit}
          className="bg-[#ff4b4b] hover:bg-[#ff3333] text-white font-medium px-4 py-2 rounded shadow-sm transition-colors text-[15px]">
          🚀 Nộp bài &amp; Nghe chấm điểm
        </button>
      )}

    </div>
  );
}
