'use client';

import { useState, useMemo, useEffect } from 'react';
import { CorePracticeUI, type PracticeQuestion } from '@/components/CorePracticeUI';

type QuestionCard = {
  id: string;
  tag: string;
  text: string;
  source: string;
  subject: 'Reading & Writing' | 'Math';
  difficulty: string;
};

type ActiveExam = {
  question: PracticeQuestion;
  timeLimit: number;
};

export default function LibraryPage() {
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('Tất cả môn học');
  // applied* = giá trị thực sự dùng để lọc, chỉ cập nhật khi bấm "Tìm kiếm"
  const [appliedQuery, setAppliedQuery] = useState('');
  const [appliedSubject, setAppliedSubject] = useState('Tất cả môn học');

  const [cards, setCards] = useState<QuestionCard[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Trạng thái làm bài
  const [active, setActive] = useState<ActiveExam | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  // Nạp danh sách câu hỏi thật từ server khi mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/library');
        if (!res.ok) throw new Error('load failed');
        const data = await res.json();
        if (!cancelled) setCards(Array.isArray(data.questions) ? data.questions : []);
      } catch {
        if (!cancelled) setListError('Không tải được danh sách câu hỏi. Vui lòng thử lại.');
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const results = useMemo(() => {
    const q = appliedQuery.trim().toLowerCase();
    return cards.filter((item) => {
      const matchSubject = appliedSubject === 'Tất cả môn học' || item.subject === appliedSubject;
      const matchQuery =
        q === '' ||
        item.text.toLowerCase().includes(q) ||
        item.tag.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q);
      return matchSubject && matchQuery;
    });
  }, [appliedQuery, appliedSubject, cards]);

  const handleSearch = () => {
    setAppliedQuery(query);
    setAppliedSubject(subject);
  };

  // Bấm "Làm bài": issue câu qua server → mở CorePracticeUI có tính giờ.
  const handleStart = async (id: string) => {
    setStartingId(id);
    setStartError(null);
    try {
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('start failed');
      const data = await res.json();
      setActive({ question: data.question, timeLimit: data.timeLimit });
    } catch {
      setStartError('Không thể bắt đầu làm bài. Vui lòng thử lại.');
    } finally {
      setStartingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 relative pb-20">

      {/* Header */}
      <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}>
        <div className="math-title-container">
          <div className="math-icon">📚</div>
          <div>
            <h1 className="math-title" style={{ background: "linear-gradient(to right, #93c5fd, #60a5fa)", WebkitBackgroundClip: "text" }}>THƯ VIỆN ĐỀ THỰC CHIẾN</h1>
            <p className="math-subtitle text-blue-200">Kho tàng lưu trữ hàng ngàn câu hỏi đã được phân loại chi tiết.</p>
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          placeholder="Tìm kiếm câu hỏi, từ khóa, nguồn đề..."
          className="flex-1 bg-[#1b2533] border border-[#334155] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#3b82f6]"
        />
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="bg-[#1b2533] border border-[#334155] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#3b82f6]"
        >
          <option>Tất cả môn học</option>
          <option>Reading & Writing</option>
          <option>Math</option>
        </select>
        <button
          onClick={handleSearch}
          className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-6 py-3 rounded-lg font-bold transition-colors"
        >
          🔍 Tìm kiếm
        </button>
      </div>

      {startError && (
        <div className="bg-[#450a0a] border border-[#ef4444] text-[#fca5a5] rounded-lg px-4 py-3 text-sm">
          {startError}
        </div>
      )}

      <div className="space-y-4">
        {loadingList ? (
          <div className="bg-[#1b2533] border border-[#262730] rounded-xl p-8 text-center text-gray-400">
            Đang tải danh sách câu hỏi...
          </div>
        ) : listError ? (
          <div className="bg-[#450a0a] border border-[#ef4444] rounded-xl p-8 text-center text-[#fca5a5]">
            {listError}
          </div>
        ) : results.length === 0 ? (
          <div className="bg-[#1b2533] border border-[#262730] rounded-xl p-8 text-center text-gray-400">
            Không tìm thấy câu hỏi nào phù hợp.
          </div>
        ) : (
          results.map((q) => (
            <div key={q.id} className="bg-[#1b2533] border border-[#262730] rounded-xl p-5 hover:border-[#3b82f6] transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="bg-[#334155] text-white text-xs px-2 py-1 rounded font-mono">{q.subject}</span>
                  <span className="text-[#3b82f6] text-xs font-bold bg-[#3b82f6]/10 px-2 py-1 rounded border border-[#3b82f6]/30">{q.tag}</span>
                  <span className="text-gray-400 text-xs">Nguồn: {q.source}</span>
                  <span className="text-yellow-400 text-xs">🔥 {q.difficulty}</span>
                </div>
                <p className="text-[#e2e8f0] text-sm line-clamp-2">{q.text}</p>
              </div>
              <button
                onClick={() => handleStart(q.id)}
                disabled={startingId !== null}
                className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded font-bold text-sm whitespace-nowrap transition-all"
              >
                {startingId === q.id ? '⏳ Đang mở...' : '🚀 Làm bài'}
              </button>
            </div>
          ))
        )}
      </div>

      {/* Modal LÀM BÀI THẬT (có tính giờ) */}
      {active && (
        <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto my-8 bg-[#0e1117] border border-[#334155] rounded-2xl shadow-2xl p-6 relative">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold text-white">📝 Chế độ làm bài — tính giờ</h3>
              <button
                onClick={() => setActive(null)}
                className="text-gray-400 hover:text-white text-sm border border-gray-600 hover:bg-gray-800 px-3 py-1 rounded transition-colors"
              >
                ✕ Thoát
              </button>
            </div>
            <CorePracticeUI
              questionData={active.question}
              timeLimit={active.timeLimit}
              onNext={() => setActive(null)}
              hideNextUntilSubmitted
            />
          </div>
        </div>
      )}

    </div>
  );
}
