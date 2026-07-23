'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Menu, X } from 'lucide-react';
import { useGamification } from '@/context/GamificationContext';
import { useAuth } from '@/context/AuthContext';

const MENU_GROUPS = [
  {
    title: '🏠 TỔNG QUAN & LỘ TRÌNH',
    items: [
      { name: '✨ Ôn Luyện Hằng Ngày', path: '/' },
      { name: '🎯 Test Xếp Lớp', path: '/diagnostic' },
      { name: '🌳 Cây Năng Lực SAT', path: '/skill-tree' },
      { name: '📊 Nhật Ký Trưởng Thành', path: '/dashboard' },
      { name: '👨‍👩‍👧 Chia Sẻ Phụ Huynh', path: '/parent-share' },
      { name: '💎 Nâng Cấp Gói VIP', path: '/upgrade' },
    ]
  },
  {
    title: '⚔️ THỰC CHIẾN & KIỂM TRA',
    items: [
      { name: '🏆 Đấu Trường Thi Thử', path: '/mock-exams' },
      { name: '🎓 Vượt Vũ Môn Thi Thật', path: '/real-exams' },
      { name: '📚 Thư Viện Đề', path: '/library' },
    ]
  },
  {
    title: '🧠 HUẤN LUYỆN KỸ NĂNG',
    items: [
      { name: '📐 Chinh Phục Toán Học', path: '/math' },
      { name: '📚 Làm Chủ Từ Vựng', path: '/vocab' },
      { name: '🧮 Bí Kíp Hack Desmos', path: '/desmos' },
      { name: '📜 Giải Mã Văn Học Cổ', path: '/literature' },
      { name: '🔥 Khổ Luyện Chuyên Sâu', path: '/grind' },
    ]
  },
  {
    title: '🎮 HỆ SINH THÁI CHIẾN BINH',
    items: [
      { name: '🗺️ Bản Đồ Sưu Tập', path: '/collection' },
      { name: '🛒 Cửa Hàng Vật Phẩm', path: '/shop' },
      { name: '📜 Sổ Tay Nhiệm Vụ', path: '/quests' },
      { name: '🗼 Tháp Vô Tận', path: '/tower' },
      { name: '⚡ Trả Lời Nhanh', path: '/speed-quiz' },
      { name: '🏟️ Đấu Trường PvP', path: '/pvp' },
      { name: '🏆 Bảng Xếp Hạng', path: '/leaderboard' },
      { name: '⚒️ Lò Rèn Chiến Binh', path: '/forge' },
      { name: '🗺️ Hành Trình Chinh Phục', path: '/journey' },
      { name: '📔 Thư Viện Quái Thú', path: '/pets' },
    ]
  }
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { learningMode, setLearningMode, subject, setSubject, focusMode, incrementQuestionKey } = useGamification();
  const { isAuthenticated, signOut } = useAuth();
  const [expandedGroups, setExpandedGroups] = useState<number[]>([0]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  if (focusMode) return null;

  const handleSignOut = async () => {
    await signOut();
    setMobileOpen(false);
    router.push('/login');
  };

  const toggleGroup = (idx: number) => {
    if (expandedGroups.includes(idx)) {
      setExpandedGroups(expandedGroups.filter(i => i !== idx));
    } else {
      setExpandedGroups([...expandedGroups, idx]);
    }
  };

  const renderContent = (isMobile = false) => (
    <>
      {/* Signature Section - Matching Streamlit Custom HTML */}
      <div className="signature-container mx-4">
        <div className="produced-by">PRODUCED BY</div>
        <div className="guru-name">Nghia Guru</div>
      </div>

      <div className="px-4 pb-8 space-y-6">
        {/* CHẾ ĐỘ HỌC TẬP */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-[#fafafa] uppercase tracking-wider mb-2">
            ⚙️ CHẾ ĐỘ HỌC TẬP
          </h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-[#1b2533] rounded">
              <input type="radio" name={isMobile ? 'learning_mode_mobile' : 'learning_mode'} checked={learningMode === 'ai'} onChange={() => setLearningMode('ai')} className="w-4 h-4 text-[#ff4b4b] bg-transparent border-gray-500" />
              <span className="text-[14px] text-[#e2e8f0]">✨ Luyện câu hỏi mới từ AI</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-[#1b2533] rounded">
              <input type="radio" name={isMobile ? 'learning_mode_mobile' : 'learning_mode'} checked={learningMode === 'notebook'} onChange={() => setLearningMode('notebook')} className="w-4 h-4 text-[#ff4b4b] bg-transparent border-gray-500" />
              <span className="text-[14px] text-[#e2e8f0]">📂 Sổ tay ôn câu sai</span>
            </label>
          </div>

          {learningMode === 'ai' && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Chọn môn học:</label>
                <select value={subject} onChange={e => setSubject(e.target.value)} className="w-full bg-[#1b2533] border border-[#262730] text-[#fafafa] text-sm rounded p-2 outline-none focus:border-[#3b82f6]">
                  <option>Reading &amp; Writing (Đọc hiểu)</option>
                  <option>Math (Toán học)</option>
                </select>
              </div>
              <button
                onClick={incrementQuestionKey}
                className="w-full bg-[#262730] hover:bg-[#333] border border-[#404353] hover:border-[#3b82f6] text-[#e2e8f0] px-4 py-2 rounded text-sm transition-colors text-left flex items-center gap-2"
              >
                🔄 Đổi câu hỏi khác
              </button>
            </div>
          )}
        </div>

        <hr className="border-[#262730]" />

        <h2 className="text-[14px] font-bold text-white mb-2 px-2">🗺️ BẢN ĐỒ HUẤN LUYỆN</h2>

        <div className="space-y-4">
          {MENU_GROUPS.map((group, idx) => {
            const isExpanded = expandedGroups.includes(idx);
            return (
              <div key={idx} className="st-expander border-[#262730]">
                <div
                  className="st-expander-header hover:text-white"
                  onClick={() => toggleGroup(idx)}
                >
                  <span>{group.title}</span>
                  {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                </div>

                {isExpanded && (
                  <div className="st-expander-content">
                    {group.items.map((item) => {
                      const isActive = pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          href={item.path}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "px-3 py-2 rounded-md text-[14px] transition-colors duration-200",
                            isActive
                              ? "bg-[rgba(255,255,255,0.08)] text-[#fbbf24] font-semibold border border-[rgba(251,191,36,0.3)] shadow-[0_0_10px_rgba(251,191,36,0.1)]"
                              : "text-[#e2e8f0] hover:bg-[rgba(255,255,255,0.05)] hover:text-white"
                          )}
                        >
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <hr className="border-[#262730]" />

        {/* Lối vào/ra tài khoản */}
        {isAuthenticated ? (
          <button
            onClick={handleSignOut}
            className="w-full text-left px-3 py-2 rounded-md text-[14px] text-[#e2e8f0] hover:bg-[rgba(255,255,255,0.05)] hover:text-white transition-colors"
          >
            🚪 Đăng xuất
          </button>
        ) : (
          <Link
            href="/login"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2 rounded-md text-[14px] text-[#e2e8f0] hover:bg-[rgba(255,255,255,0.05)] hover:text-white transition-colors"
          >
            🔑 Đăng nhập
          </Link>
        )}
      </div>
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 bg-[#0e1117] border border-[#334155] text-white rounded-lg p-2 shadow-lg"
        aria-label="Mở menu điều hướng"
        aria-expanded={mobileOpen}
        aria-controls="mobile-training-menu"
      >
        <Menu size={22} />
      </button>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-label="Đóng menu điều hướng"
          />
          <aside
            id="mobile-training-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu huấn luyện"
            className="relative w-[88vw] max-w-[340px] bg-[#0e1117] border-r border-[#262730] h-screen overflow-y-auto flex flex-col shadow-2xl animate-in slide-in-from-left duration-200"
          >
            <div className="sticky top-0 z-10 bg-[#0e1117]/95 backdrop-blur border-b border-[#262730] flex items-center justify-between px-4 py-3">
              <span className="text-sm font-bold text-white">Menu huấn luyện</span>
              <button ref={closeButtonRef} type="button" onClick={() => setMobileOpen(false)} className="text-gray-300 hover:text-white" aria-label="Đóng menu">
                <X size={22} />
              </button>
            </div>
            {renderContent(true)}
          </aside>
        </div>
      )}

      <aside className="w-[330px] flex-shrink-0 bg-[#0e1117] border-r border-[#262730] h-screen overflow-y-auto hidden md:flex flex-col">
        {renderContent(false)}
      </aside>
    </>
  );
}
