'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/context/ToastContext';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';

interface FrameCosmetic {
  icon?: string;
  cssClass?: string;
  label?: string;
}

interface Entry {
  rank: number;
  nickname: string;
  basePower: number;
  isMe: boolean;
  /** Khung viền danh vọng — CHỈ trang trí, KHÔNG đổi thứ hạng. */
  frame?: FrameCosmetic;
  /** Danh hiệu danh vọng — badge cạnh bí danh, KHÔNG đổi thứ hạng. */
  title?: string;
}

interface LeaderboardData {
  season: { key: string; label: string; daysLeft: number };
  top: Entry[];
  me: Entry | null;
  available: boolean;
}

interface ProfileData {
  available: boolean;
  nickname: string | null;
  optIn: boolean;
  canChangeNickname: boolean;
}

export default function LeaderboardPage() {
  const { showToast } = useToast();
  const [board, setBoard] = useState<LeaderboardData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [nickInput, setNickInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [bRes, pRes] = await Promise.all([fetch('/api/leaderboard'), fetch('/api/profile')]);
        if (bRes.ok) setBoard(await bRes.json());
        if (pRes.ok) {
          const p = await pRes.json();
          setProfile(p);
          if (p.nickname) setNickInput(p.nickname);
        }
      } catch (e) {
        console.error('Failed to load leaderboard', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const refresh = async () => {
    const [bRes, pRes] = await Promise.all([fetch('/api/leaderboard'), fetch('/api/profile')]);
    if (bRes.ok) setBoard(await bRes.json());
    if (pRes.ok) setProfile(await pRes.json());
  };

  const saveNickname = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickInput }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('✅ Đã lưu bí danh!', 'success');
        await refresh();
      } else {
        showToast(`❌ ${data.error ?? 'Không lưu được bí danh.'}`, 'error');
      }
    } catch {
      showToast('❌ Lỗi kết nối.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleOptIn = async (next: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optIn: next }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(next ? '🏆 Bạn đã tham gia bảng xếp hạng!' : 'Đã ẩn khỏi bảng xếp hạng.', 'success');
        await refresh();
      } else {
        showToast(`❌ ${data.error ?? 'Không đổi được.'}`, 'error');
      }
    } catch {
      showToast('❌ Lỗi kết nối.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header epic-shake-active" style={{ background: 'linear-gradient(135deg, #78350f 0%, #451a03 100%)' }}>
        <div className="math-title-container">
          <div className="math-icon">🏆</div>
          <div>
            <h1 className="math-title" style={{ background: 'linear-gradient(to right, #fcd34d, #fbbf24)', WebkitBackgroundClip: 'text' }}>BẢNG XẾP HẠNG</h1>
            <p className="math-subtitle text-amber-200">
              Xếp theo LỰC CHIẾN từ năng lực học thật — càng giỏi càng cao. Học thật, hạng thật!
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Đang tải bảng xếp hạng..." />
      ) : !board?.available ? (
        <EmptyState icon="🚧" title="Bảng xếp hạng sắp ra mắt" message="Tính năng đang được hoàn thiện. Quay lại sau nhé!" />
      ) : (
        <>
          {/* Nhãn mùa + đếm ngược */}
          <div className="flex items-center justify-between bg-[#1b2533] border border-[#262730] rounded-xl px-6 py-4">
            <div className="text-lg font-black text-[#fbbf24]">🗓️ {board.season.label}</div>
            <div className="text-sm text-gray-400">Còn <span className="text-white font-bold">{board.season.daysLeft}</span> ngày</div>
          </div>

          {/* Khối bí danh + opt-in */}
          <div className="bg-[#1b2533] border border-[#262730] rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">🪪 Bí danh của bạn</h2>
            <p className="text-sm text-gray-400">
              Chọn một bí danh (không phải tên thật) để hiển thị trên bảng. Mặc định bạn KHÔNG xuất hiện — chỉ khi bạn tự bật.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={nickInput}
                onChange={(e) => setNickInput(e.target.value)}
                placeholder="Nhập bí danh (3-20 ký tự)"
                aria-label="Bí danh hiển thị trên bảng xếp hạng"
                maxLength={20}
                className="flex-1 bg-[#0f172a] border border-[#334155] text-white rounded px-4 py-2 outline-none focus:border-[#fbbf24]"
              />
              <button
                onClick={saveNickname}
                disabled={saving || !profile?.canChangeNickname}
                className="bg-[#fbbf24] hover:bg-[#f59e0b] text-[#78350f] font-bold px-6 py-2 rounded transition-colors disabled:opacity-50"
                title={!profile?.canChangeNickname ? 'Chỉ đổi bí danh mỗi 24 giờ' : ''}
              >
                {profile?.nickname ? 'Đổi bí danh' : 'Lưu bí danh'}
              </button>
            </div>
            {!profile?.canChangeNickname && (
              <p className="text-xs text-amber-400">⏳ Bạn vừa đổi bí danh — chỉ đổi được mỗi 24 giờ.</p>
            )}

            <label className="flex items-center gap-3 cursor-pointer pt-2 border-t border-[#262730]">
              <input
                type="checkbox"
                checked={profile?.optIn ?? false}
                disabled={saving || !profile?.nickname}
                onChange={(e) => toggleOptIn(e.target.checked)}
                className="w-5 h-5"
              />
              <span className="text-sm text-[#e2e8f0]">
                Hiển thị tôi trên bảng xếp hạng
                {!profile?.nickname && <span className="text-gray-500"> (đặt bí danh trước)</span>}
              </span>
            </label>
          </div>

          {/* Bảng xếp hạng */}
          {board.top.length === 0 ? (
            <EmptyState message="Chưa có ai trên bảng mùa này. Hãy là người đầu tiên!" />
          ) : (
            <div className="bg-[#1b2533] border border-[#262730] rounded-xl overflow-hidden">
              {board.top.map((e) => (
                <div
                  key={e.rank}
                  className={`flex items-center justify-between px-6 py-3 border-b border-[#0f172a] last:border-0 ${e.isMe ? 'bg-[rgba(251,191,36,0.12)]' : ''} ${e.frame?.cssClass ?? ''}`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className={`text-lg font-black w-10 text-center ${e.rank <= 3 ? 'text-[#fbbf24]' : 'text-gray-500'}`}>
                      {e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : `#${e.rank}`}
                    </span>
                    <span className={`font-bold truncate ${e.isMe ? 'text-[#fbbf24]' : 'text-white'}`}>
                      {e.nickname} {e.isMe && <span className="text-xs text-amber-400">(Bạn)</span>}
                    </span>
                    {/* Danh hiệu danh vọng — CHỈ khoe, KHÔNG đổi thứ hạng. */}
                    {e.title && (
                      <span
                        className="text-xs font-bold text-amber-300 bg-[rgba(251,191,36,0.15)] border border-[rgba(251,191,36,0.3)] rounded px-2 py-0.5 shrink-0"
                        title={e.title}
                      >
                        {e.frame?.icon ?? '🎖️'} {e.title}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-mono text-[#60a5fa] shrink-0">⚔️ {e.basePower}</span>
                </div>
              ))}
            </div>
          )}

          {/* Vị trí của mình nếu ngoài top hiển thị */}
          {board.me && !board.top.some((e) => e.isMe) && (
            <div className={`bg-[rgba(251,191,36,0.12)] border border-[rgba(251,191,36,0.3)] rounded-xl px-6 py-3 flex items-center justify-between ${board.me.frame?.cssClass ?? ''}`}>
              <div className="flex items-center gap-4">
                <span className="text-lg font-black w-10 text-center text-[#fbbf24]">#{board.me.rank}</span>
                <span className="font-bold text-[#fbbf24]">{board.me.nickname} <span className="text-xs text-amber-400">(Bạn)</span></span>
                {/* Danh hiệu danh vọng — CHỈ khoe, KHÔNG đổi thứ hạng. */}
                {board.me.title && (
                  <span
                    className="text-xs font-bold text-amber-300 bg-[rgba(251,191,36,0.15)] border border-[rgba(251,191,36,0.3)] rounded px-2 py-0.5 shrink-0"
                    title={board.me.title}
                  >
                    {board.me.frame?.icon ?? '🎖️'} {board.me.title}
                  </span>
                )}
              </div>
              <span className="text-sm font-mono text-[#60a5fa]">⚔️ {board.me.basePower}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
