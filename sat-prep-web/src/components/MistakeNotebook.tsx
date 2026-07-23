'use client';

import { useState, useEffect, useCallback } from 'react';
import { CorePracticeUI, type PracticeQuestion } from './CorePracticeUI';

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
  skill_id?: string | null;
};

type Mode = 'browse' | 'review';

/**
 * Tab chuyển chế độ — KHAI BÁO NGOÀI component cha. Nếu định nghĩa bên trong
 * render của MistakeNotebook, mỗi lần render tạo một type component MỚI → React
 * remount (mất state, nhấp nháy). Đưa ra ngoài + truyền props là cách đúng.
 */
function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex gap-2 mb-6">
      <button
        onClick={() => onChange('browse')}
        className={`text-sm px-4 py-1.5 rounded transition-colors ${mode === 'browse' ? 'bg-blue-600 text-white' : 'bg-[#1e293b] text-[#94a3b8] hover:bg-[#334155]'}`}
      >
        📚 Xem tất cả
      </button>
      <button
        onClick={() => onChange('review')}
        className={`text-sm px-4 py-1.5 rounded transition-colors ${mode === 'review' ? 'bg-blue-600 text-white' : 'bg-[#1e293b] text-[#94a3b8] hover:bg-[#334155]'}`}
      >
        🔁 Ôn tập đến hạn
      </button>
    </div>
  );
}

export function MistakeNotebook() {
  const [mode, setMode] = useState<Mode>('browse');
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Trạng thái riêng cho chế độ ôn tập (review).
  const [revealed, setRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  // Luyện BIẾN THỂ (Nhóm 7 #6): sinh câu CÙNG skill khác số liệu để active recall.
  // Kết quả trên biến thể LÀ tín hiệu SRS (đúng → nhớ, sai → quên) — mạnh hơn tự
  // đánh giá "nhớ/quên". variantScored đảm bảo chỉ chấm SRS 1 lần/câu sai dù
  // người dùng luyện thêm nhiều biến thể.
  const [variantQ, setVariantQ] = useState<PracticeQuestion | null>(null);
  const [variantLoading, setVariantLoading] = useState(false);
  const [variantError, setVariantError] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [variantScored, setVariantScored] = useState(false);

  const load = useCallback((m: Mode) => {
    setIsLoading(true);
    const url = m === 'review' ? '/api/cau-sai?due=true' : '/api/cau-sai';
    fetch(url)
      .then(res => res.json())
      .then(data => {
        setMistakes(Array.isArray(data) ? data : []);
        setCurrentIndex(0);
        setRevealed(false);
        setVariantQ(null);
        setVariantError('');
        setReviewError('');
        setVariantScored(false);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

  // Tải câu sai khi đổi chế độ. `load` set isLoading=true đồng bộ — đây là
  // trigger fetch hợp lệ (sync state với nguồn ngoài), không phải cascading render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(mode);
  }, [mode, load]);

  // Ghi kết quả ôn tập 1 câu (Leitner) rồi chuyển sang câu kế tiếp.
  const handleReview = async (isRemembered: boolean) => {
    const m = mistakes[currentIndex];
    if (!m?.id) return;
    setReviewError('');
    try {
      const res = await fetch('/api/cau-sai', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mistakeId: m.id, isRemembered }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setReviewError(data?.error || 'Không lưu được kết quả ôn tập. Vui lòng thử lại.');
        return;
      }
    } catch (e) {
      console.error('Lỗi ghi kết quả ôn tập', e);
      setReviewError('Lỗi kết nối khi lưu kết quả ôn tập. Vui lòng thử lại.');
      return;
    }
    setReviewedCount(c => c + 1);
    // Câu vừa ôn rời khỏi danh sách đến hạn → bỏ nó khỏi mảng hiện tại.
    setMistakes(prev => prev.filter((_, i) => i !== currentIndex));
    setCurrentIndex(0);
    setRevealed(false);
    setVariantQ(null);
    setVariantError('');
    setReviewError('');
    setVariantScored(false);
  };

  // Sinh câu BIẾN THỂ cùng skill (Nhóm 7 #6). Chỉ khả dụng khi câu sai có skill_id.
  const handlePracticeVariant = async () => {
    const m = mistakes[currentIndex];
    if (!m?.skill_id) return;
    setVariantLoading(true);
    setVariantError('');
    try {
      const res = await fetch(`/api/cau-sai/variant?skillId=${encodeURIComponent(m.skill_id)}`);
      const data = await res.json();
      if (!res.ok) {
        setVariantError(data?.error || 'Không tạo được câu biến thể. Thử lại sau nhé.');
        setVariantQ(null);
      } else {
        setVariantQ(data as PracticeQuestion);
      }
    } catch (e) {
      console.error('Lỗi sinh câu biến thể', e);
      setVariantError('Lỗi kết nối khi tạo câu biến thể.');
    } finally {
      setVariantLoading(false);
    }
  };

  // Người dùng trả lời câu biến thể → dùng kết quả làm tín hiệu SRS THẬT (đúng =
  // nhớ, sai = quên). Chấm 1 lần/câu sai (variantScored) để luyện thêm biến thể
  // không ghi đè kết quả. CorePracticeUI đã tự ghi mastery + lưu câu sai mới nếu
  // trả lời biến thể sai — ở đây chỉ lo phần SRS của câu sai GỐC.
  const handleVariantAnswer = (isCorrect: boolean) => {
    if (variantScored) return;
    setVariantScored(true);
    void handleReview(isCorrect);
  };

  if (isLoading) {
    return <div className="my-6 text-white text-center">Đang tải sổ tay ôn tập...</div>;
  }

  // ----- CHẾ ĐỘ ÔN TẬP (REVIEW / SRS) -----
  if (mode === 'review') {
    if (mistakes.length === 0) {
      return (
        <div className="my-6">
          <ModeTabs mode={mode} onChange={setMode} />
          <div className="text-center text-gray-400 py-8">
            <h2 className="text-[22px] font-bold text-white mb-3">🎉 Không còn câu nào đến hạn ôn!</h2>
            <p>{reviewedCount > 0 ? `Bạn vừa ôn xong ${reviewedCount} câu. Tuyệt vời!` : 'Hãy quay lại sau khi có câu đến lịch ôn nhé.'}</p>
          </div>
        </div>
      );
    }

    const m = mistakes[currentIndex];

    // Đang luyện BIẾN THỂ: thay toàn bộ khung ôn bằng CorePracticeUI. Kết quả
    // trả lời (onAnswer) làm tín hiệu SRS cho câu sai gốc → tự chuyển câu kế.
    if (variantQ) {
      return (
        <div className="my-6">
          <ModeTabs mode={mode} onChange={setMode} />
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-[20px] font-bold text-white">🎲 Biến thể câu sai — cùng dạng, khác số liệu</h2>
            <button
              onClick={() => { setVariantQ(null); setVariantScored(false); }}
              className="text-sm text-gray-400 hover:text-white underline"
            >
              ← Quay lại xem đáp án
            </button>
          </div>
          <p className="text-sm text-[#94a3b8] mb-2">
            Trả lời đúng = bạn đã nắm dạng này (ôn thưa dần); sai = ôn lại sớm. Kết quả tự cập nhật lịch ôn.
          </p>
          <CorePracticeUI
            questionData={variantQ}
            isLoading={variantLoading}
            onNext={handlePracticeVariant}
            onAnswer={handleVariantAnswer}
          />
        </div>
      );
    }

    return (
      <div className="my-6">
        <ModeTabs mode={mode} onChange={setMode} />
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

        {/* Luyện biến thể (Nhóm 7 #6) — active recall, chỉ khi câu có skill_id. */}
        {m.skill_id && (
          <div className="mb-4">
            <button
              onClick={handlePracticeVariant}
              disabled={variantLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-60 text-white font-bold px-4 py-3 rounded transition-colors"
            >
              {variantLoading ? '⚙️ Đang tạo câu biến thể...' : '🎲 Luyện câu biến thể (cùng dạng, khác số liệu)'}
            </button>
            <p className="text-xs text-[#94a3b8] mt-2 text-center">
              Cách ôn hiệu quả nhất: tự làm lại một câu tương tự thay vì chỉ xem đáp án.
            </p>
            {variantError && <p className="text-red-400 text-xs mt-1 text-center">{variantError}</p>}
          </div>
        )}

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
            <div className="flex flex-wrap gap-3">
              {reviewError && (
                <div className="basis-full bg-[#450a0a] border border-[#ef4444] text-[#fca5a5] px-3 py-2 rounded text-sm">
                  {reviewError}
                </div>
              )}
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
        <ModeTabs mode={mode} onChange={setMode} />
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
      <ModeTabs mode={mode} onChange={setMode} />
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
