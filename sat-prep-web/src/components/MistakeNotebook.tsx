'use client';

import { useState, useEffect, useCallback } from 'react';

type Mistake = {
  id?: string;
  question: string;
  choices: string[];
  correct_choice: string;
  user_choice?: string;
  explanation: string;
  source: string;
  passage?: string;
  box?: number;
  next_review?: string;
};

type Mode = 'browse' | 'review';

export function MistakeNotebook() {
  const [mode, setMode] = useState<Mode>('browse');
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Trạng thái riêng cho chế độ ôn tập (review).
  const [revealed, setRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  const load = useCallback((m: Mode) => {
    setIsLoading(true);
    const url = m === 'review' ? '/api/cau-sai?due=true' : '/api/cau-sai';
    fetch(url)
      .then(res => res.json())
      .then(data => {
        setMistakes(Array.isArray(data) ? data : []);
        setCurrentIndex(0);
        setRevealed(false);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    load(mode);
  }, [mode, load]);

  // Ghi kết quả ôn tập 1 câu (Leitner) rồi chuyển sang câu kế tiếp.
  const handleReview = async (isRemembered: boolean) => {
    const m = mistakes[currentIndex];
    if (!m?.id) return;
    try {
      await fetch('/api/cau-sai', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mistakeId: m.id, isRemembered }),
      });
    } catch (e) {
      console.error('Lỗi ghi kết quả ôn tập', e);
    }
    setReviewedCount(c => c + 1);
    // Câu vừa ôn rời khỏi danh sách đến hạn → bỏ nó khỏi mảng hiện tại.
    setMistakes(prev => prev.filter((_, i) => i !== currentIndex));
    setCurrentIndex(0);
    setRevealed(false);
  };

  const ModeTabs = () => (
    <div className="flex gap-2 mb-6">
      <button
        onClick={() => setMode('browse')}
        className={`text-sm px-4 py-1.5 rounded transition-colors ${mode === 'browse' ? 'bg-blue-600 text-white' : 'bg-[#1e293b] text-[#94a3b8] hover:bg-[#334155]'}`}
      >
        📚 Xem tất cả
      </button>
      <button
        onClick={() => setMode('review')}
        className={`text-sm px-4 py-1.5 rounded transition-colors ${mode === 'review' ? 'bg-blue-600 text-white' : 'bg-[#1e293b] text-[#94a3b8] hover:bg-[#334155]'}`}
      >
        🔁 Ôn tập đến hạn
      </button>
    </div>
  );

  if (isLoading) {
    return <div className="my-6 text-white text-center">Đang tải sổ tay ôn tập...</div>;
  }

  // ----- CHẾ ĐỘ ÔN TẬP (REVIEW / SRS) -----
  if (mode === 'review') {
    if (mistakes.length === 0) {
      return (
        <div className="my-6">
          <ModeTabs />
          <div className="text-center text-gray-400 py-8">
            <h2 className="text-[22px] font-bold text-white mb-3">🎉 Không còn câu nào đến hạn ôn!</h2>
            <p>{reviewedCount > 0 ? `Bạn vừa ôn xong ${reviewedCount} câu. Tuyệt vời!` : 'Hãy quay lại sau khi có câu đến lịch ôn nhé.'}</p>
          </div>
        </div>
      );
    }

    const m = mistakes[currentIndex];
    return (
      <div className="my-6">
        <ModeTabs />
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[22px] font-bold text-white">🔁 Ôn tập câu sai</h2>
          <span className="text-sm text-gray-400 bg-[#1e293b] px-3 py-1 rounded-full">
            Còn {mistakes.length} câu • Đã ôn {reviewedCount}
          </span>
        </div>

        <hr className="border-[#262730] my-4" />

        {m.passage && (
          <div className="bg-[#1b2533] border-l-4 border-[#3b82f6] text-[#e2e8f0] p-4 rounded mb-4 text-[15px] leading-relaxed">
            {m.passage}
          </div>
        )}

        <div className="bg-[#1b2533] border-l-4 border-[#fbbf24] text-[#e2e8f0] p-4 rounded mb-6 text-[15px] leading-relaxed">
          <strong>Thử nhớ lại đáp án đúng cho câu này:</strong><br/><br/>
          {m.question}
        </div>

        {!revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white font-bold px-4 py-3 rounded transition-colors"
          >
            👁️ Hiện đáp án &amp; lời giải
          </button>
        ) : (
          <>
            <div className="bg-[rgba(16,185,129,0.1)] border border-[#10b981] p-4 rounded mb-4">
              <div className="text-[#10b981] font-bold mb-1">✅ Đáp án đúng:</div>
              <div className="text-sm text-[#e2e8f0]">{m.correct_choice}</div>
            </div>
            <div className="bg-[#1e293b] p-4 rounded border border-[#334155] mb-6">
              <h4 className="text-[#fbbf24] font-bold mb-2">💡 Giải thích:</h4>
              <div className="text-sm text-[#e2e8f0] leading-relaxed">{m.explanation}</div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleReview(false)}
                className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold px-4 py-3 rounded transition-colors"
              >
                😓 Chưa nhớ (ôn lại sớm)
              </button>
              <button
                onClick={() => handleReview(true)}
                className="flex-1 bg-[#10b981] hover:bg-[#059669] text-white font-bold px-4 py-3 rounded transition-colors"
              >
                😎 Đã nhớ (ôn thưa hơn)
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ----- CHẾ ĐỘ XEM TẤT CẢ (BROWSE) -----
  if (mistakes.length === 0) {
    return (
      <div className="my-6">
        <ModeTabs />
        <div className="text-center text-gray-400">
          <h2 className="text-[24px] font-bold text-white mb-4">📂 SỔ TAY ÔN TẬP CÂU SAI</h2>
          <p>Bạn chưa có câu trả lời sai nào. Hãy tiếp tục ôn luyện nhé!</p>
        </div>
      </div>
    );
  }

  const currentMistake = mistakes[currentIndex];

  const handleNext = () => {
    if (currentIndex < mistakes.length - 1) setCurrentIndex(prev => prev + 1);
  };
  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  };

  return (
    <div className="my-6">
      <ModeTabs />
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-[24px] font-bold text-white">
          📂 SỔ TAY ÔN TẬP CÂU SAI
        </h2>
        <div className="text-sm text-gray-400 bg-[#1e293b] px-3 py-1 rounded-full">
          Câu {currentIndex + 1} / {mistakes.length}
        </div>
      </div>

      <hr className="border-[#262730] my-4" />

      {/* Tag thông tin câu hỏi */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <span className="bg-[#1e293b] border border-[#334155] px-2 py-1 rounded text-xs text-[#94a3b8]">Nguồn: {currentMistake.source || 'Không rõ'}</span>
        {currentMistake.passage && <span className="bg-[#1e293b] border border-[#334155] px-2 py-1 rounded text-xs text-[#3b82f6]">Đọc hiểu (Reading)</span>}
      </div>

      {currentMistake.passage && (
        <div className="bg-[#1b2533] border-l-4 border-[#3b82f6] text-[#e2e8f0] p-4 rounded mb-6 text-[15px] leading-relaxed">
          {currentMistake.passage}
        </div>
      )}

      <div className="bg-[#1b2533] border-l-4 border-[#ef4444] text-[#e2e8f0] p-4 rounded mb-6 text-[15px] leading-relaxed">
        <strong>Câu hỏi đã làm sai:</strong><br/><br/>
        {currentMistake.question}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-[rgba(239,68,68,0.1)] border border-[#ef4444] p-4 rounded">
          <div className="text-[#ef4444] font-bold mb-2">❌ Đáp án bạn chọn:</div>
          <div className="text-sm">{currentMistake.user_choice || 'Không rõ'}</div>
        </div>
        <div className="bg-[rgba(16,185,129,0.1)] border border-[#10b981] p-4 rounded">
          <div className="text-[#10b981] font-bold mb-2">✅ Đáp án đúng:</div>
          <div className="text-sm">{currentMistake.correct_choice}</div>
        </div>
      </div>

      <div className="bg-[#1e293b] p-4 rounded border border-[#334155] mb-6">
        <h4 className="text-[#fbbf24] font-bold mb-2">💡 Giải thích chi tiết:</h4>
        <div className="text-sm text-[#e2e8f0] leading-relaxed">
          {currentMistake.explanation}
        </div>
      </div>

      <div className="flex justify-between items-center mt-8">
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-bold px-6 py-2 rounded transition-colors"
        >
          ⬅️ Câu trước
        </button>
        <button
          onClick={handleNext}
          disabled={currentIndex === mistakes.length - 1}
          className="text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-6 py-2 rounded transition-colors shadow-[0_0_10px_rgba(37,99,235,0.5)]"
        >
          Câu tiếp theo ➡️
        </button>
      </div>
    </div>
  );
}
