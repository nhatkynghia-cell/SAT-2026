'use client';

import { useState, useEffect } from 'react';
import { useGamification } from '@/context/GamificationContext';

interface VocabWord {
  id: string;
  box: number;
  word: string;
  meaning: string;
  example: string;
}

export default function VocabPage() {
  const { syncServerEconomy, updateQuestProgress } = useGamification();
  const [words, setWords] = useState<VocabWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/vocab')
      .then(res => res.json())
      .then(data => {
        if (data.words) setWords(data.words);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

  const handleReview = async (isRemembered: boolean) => {
    if (words.length === 0 || currentIndex >= words.length) return;
    
    const currentWord = words[currentIndex];
    
    try {
      // 🔴 ROOT A follow-up: server tự chấm điều kiện thưởng (từ đến hạn + "đã
      // nhớ") và trả về economy mới. Client KHÔNG còn POST /api/economy tự khai.
      const res = await fetch('/api/vocab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordId: currentWord.id, isRemembered })
      });
      if (res.ok) {
        const data = await res.json();
        syncServerEconomy(data.economy);
      }

      updateQuestProgress('vocab', 1);

      setIsFlipped(false);
      setCurrentIndex(prev => prev + 1);
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading) {
    return <div className="text-center p-12 text-white">Đang tải hộp từ vựng Leitner...</div>;
  }

  const isFinished = currentIndex >= words.length;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #4c1d95 0%, #2e1065 100%)" }}>
        <div className="math-title-container">
          <div className="math-icon">📚</div>
          <div>
            <h1 className="math-title" style={{ background: "linear-gradient(to right, #c084fc, #a855f7)", WebkitBackgroundClip: "text" }}>LÀM CHỦ TỪ VỰNG</h1>
            <p className="math-subtitle text-purple-200">Hệ thống ôn tập ngắt quãng (Spaced Repetition) Leitner Box.</p>
          </div>
        </div>
      </div>
      
      {!isFinished ? (
        <>
          <div className="text-center text-gray-400 font-bold">
            Tiến độ hôm nay: {currentIndex} / {words.length} từ
          </div>
          
          <div 
            onClick={() => setIsFlipped(!isFlipped)}
            className="bg-[#1b2533] p-8 rounded-xl border border-[#262730] flex flex-col items-center justify-center min-h-[300px] shadow-[0_0_20px_rgba(168,85,247,0.15)] relative overflow-hidden cursor-pointer transition-all hover:scale-[1.01]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#a855f7]/10 to-transparent pointer-events-none"></div>
            <div className="absolute top-4 right-4 bg-[#a855f7] text-white text-xs font-bold px-2 py-1 rounded">
              Box {words[currentIndex].box}
            </div>
            
            {!isFlipped ? (
              <>
                <div className="text-gray-400 text-sm mb-4 animate-pulse">Click để lật thẻ</div>
                <h2 className="text-5xl font-black text-white mb-6 text-center">{words[currentIndex].word}</h2>
              </>
            ) : (
              <div className="animate-in zoom-in duration-300 text-center">
                <h2 className="text-3xl font-black text-[#c084fc] mb-4">{words[currentIndex].word}</h2>
                <p className="text-[#a855f7] font-bold text-xl mb-4">
                  {words[currentIndex].meaning}
                </p>
                <p className="text-gray-300 italic max-w-lg mx-auto">
                  &quot;{words[currentIndex].example}&quot;
                </p>
              </div>
            )}
          </div>

          <div className={`flex justify-center gap-4 transition-opacity duration-300 ${isFlipped ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <button 
              onClick={() => handleReview(false)}
              className="bg-[#ef4444] hover:bg-[#dc2626] text-white px-8 py-4 rounded-xl font-bold shadow-lg transition-transform hover:scale-105"
            >
              ❌ Quên (Reset Box)
            </button>
            <button 
              onClick={() => handleReview(true)}
              className="bg-[#10b981] hover:bg-[#059669] text-white px-8 py-4 rounded-xl font-bold shadow-lg transition-transform hover:scale-105"
            >
              ✅ Đã nhớ (Up Box)
            </button>
          </div>
        </>
      ) : (
        <div className="bg-[#1b2533] p-12 rounded-xl border border-[#a855f7] text-center shadow-[0_0_30px_rgba(168,85,247,0.2)]">
          <div className="text-6xl mb-6">🏆</div>
          <h2 className="text-3xl font-black text-white mb-4">HOÀN THÀNH MỤC TIÊU!</h2>
          <p className="text-[#c084fc] text-lg">Bạn đã ôn tập xong toàn bộ từ vựng của ngày hôm nay.</p>
          <p className="text-gray-400 mt-2">Hệ thống thuật toán Leitner đã tự động xếp lịch học tiếp theo cho bạn.</p>
        </div>
      )}
    </div>
  );
}
