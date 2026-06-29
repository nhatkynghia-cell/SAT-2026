'use client';

export default function LibraryPage() {
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
          placeholder="Tìm kiếm câu hỏi, từ khóa, nguồn đề..." 
          className="flex-1 bg-[#1b2533] border border-[#334155] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#3b82f6]"
        />
        <select className="bg-[#1b2533] border border-[#334155] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#3b82f6]">
          <option>Tất cả môn học</option>
          <option>Reading & Writing</option>
          <option>Math</option>
        </select>
        <button className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-6 py-3 rounded-lg font-bold transition-colors">
          🔍 Tìm kiếm
        </button>
      </div>

      <div className="space-y-4">
        {[
          { id: "RW-001", tag: "Command of Evidence", text: "Scientists have long debated the precise function of the bizarre...", source: "Practice Test 1" },
          { id: "M-105", tag: "Algebra", text: "If 3x - y = 12 and y = 3, what is the value of x?", source: "Practice Test 2" },
          { id: "RW-042", tag: "Words in Context", text: "The researcher's findings were so ______ that no one could...", source: "QAS March 2023" }
        ].map((q, idx) => (
          <div key={idx} className="bg-[#1b2533] border border-[#262730] rounded-xl p-5 hover:border-[#3b82f6] transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-[#334155] text-white text-xs px-2 py-1 rounded font-mono">{q.id}</span>
                <span className="text-[#3b82f6] text-xs font-bold bg-[#3b82f6]/10 px-2 py-1 rounded border border-[#3b82f6]/30">{q.tag}</span>
                <span className="text-gray-400 text-xs">Nguồn: {q.source}</span>
              </div>
              <p className="text-[#e2e8f0] text-sm line-clamp-2">{q.text}</p>
            </div>
            <button className="bg-[#1e293b] border border-[#334155] hover:bg-[#334155] text-white px-4 py-2 rounded text-sm whitespace-nowrap transition-colors">
              Xem chi tiết
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}
