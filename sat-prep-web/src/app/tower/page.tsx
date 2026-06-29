'use client';

import { useState } from 'react';
import { useGamification } from '@/context/GamificationContext';
import { useToast } from '@/context/ToastContext';
import { CorePracticeUI } from '@/components/CorePracticeUI';

export default function TowerPage() {
  const { addReward } = useGamification();
  const { showToast } = useToast();
  const [currentFloor, setCurrentFloor] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [questionData, setQuestionData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);

  const generateFloorQuestion = async (floor: number) => {
    setIsLoading(true);
    setQuestionData(null);
    try {
      const difficulty = floor > 20 ? 'Hard' : floor > 10 ? 'Medium' : 'Easy';
      const trap = Math.min(10 + floor * 5, 95);
      
      const res = await fetch('/api/generate-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleType: 'math', topic: `Tower Floor ${floor} - Survival`, difficulty, trapRate: trap })
      });
      
      if (res.ok) {
        const data = await res.json();
        setQuestionData(data);
      } else {
        showToast("Thất bại khi gọi quái vật (API Error).", 'error');
        setIsPlaying(false);
      }
    } catch (e) {
      console.error(e);
      setIsPlaying(false);
    }
    setIsLoading(false);
  };

  const startRun = () => {
    setIsPlaying(true);
    setCurrentFloor(1);
    setIsGameOver(false);
    generateFloorQuestion(1);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #020617 0%, #1e293b 100%)" }}>
        <div className="math-title-container">
          <div className="math-icon">🗼</div>
          <div>
            <h1 className="math-title" style={{ background: "linear-gradient(to right, #94a3b8, #cbd5e1)", WebkitBackgroundClip: "text" }}>THÁP VÔ TẬN (SURVIVAL)</h1>
            <p className="math-subtitle text-gray-300">Trả lời sai 1 câu = Game Over. Bạn lên được tầng mấy?</p>
          </div>
        </div>
      </div>
      
      {!isPlaying && !isGameOver && (
        <div className="text-center p-12 bg-[#0e1117] rounded-xl border border-[#334155]">
          <div className="text-6xl mb-6">⛩️</div>
          <p className="text-gray-300 mb-8 max-w-lg mx-auto">Chế độ Roguelike: Đối mặt với các câu hỏi do AI tạo ra với độ khó (Trap Rate) tăng dần qua mỗi tầng. Trả lời đúng sẽ được leo tiếp và nhận thưởng. Trả lời sai sẽ lập tức rớt đài!</p>
          <button onClick={startRun} className="bg-red-600 hover:bg-red-500 text-white font-black text-xl px-12 py-4 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.5)] transition-transform hover:scale-105">
            BƯỚC VÀO THÁP
          </button>
        </div>
      )}

      {isGameOver && (
        <div className="text-center p-12 bg-[#450a0a] rounded-xl border border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
          <h2 className="text-4xl font-black text-red-500 mb-4">GAME OVER</h2>
          <p className="text-xl text-white mb-8">Bạn đã gục ngã tại <span className="font-bold text-yellow-400">Tầng {currentFloor}</span>!</p>
          <button onClick={startRun} className="bg-gray-800 hover:bg-gray-700 text-white font-bold px-8 py-3 rounded-lg border border-gray-600">
            Chơi Lại Từ Đầu
          </button>
        </div>
      )}

      {isPlaying && (
        <>
          <div className="flex justify-between items-center bg-[#1b2533] p-4 rounded-xl border border-[#262730]">
            <div>
              <span className="text-gray-400 text-sm">Hiện tại đang ở:</span>
              <h2 className="text-2xl font-black text-red-500">TẦNG {currentFloor}</h2>
            </div>
            <button 
              onClick={() => { setIsPlaying(false); setIsGameOver(false); }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
            >
              Thoát (Giữ mạng)
            </button>
          </div>
          
          {(isLoading || questionData) && (
            <div className="relative">
              {/* Overlay logic xử lý CorePracticeUI onSubmit để quyết định leo tầng hay rớt */}
              <div className="bg-[#0e1117] p-6 rounded-xl border border-[#3b82f6] shadow-lg mb-6">
                <p className="text-blue-300 font-bold mb-4">Mẹo: Độ khó bẫy hiện tại là {Math.min(10 + currentFloor * 5, 95)}%.</p>
                <CorePracticeUI 
                  questionData={questionData} 
                  isLoading={isLoading}
                  onAnswer={(isCorrect) => {
                    if (!isCorrect) {
                      setIsGameOver(true);
                      setIsPlaying(false);
                    }
                  }}
                  onNext={() => {
                    setCurrentFloor(prev => prev + 1);
                    generateFloorQuestion(currentFloor + 1);
                  }} 
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
