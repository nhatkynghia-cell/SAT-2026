'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/context/ToastContext';

type Cycle = 'day' | 'week' | 'month' | 'year';

const CYCLE_TABS: { key: Cycle; label: string }[] = [
  { key: 'day', label: 'Ngày' },
  { key: 'week', label: 'Tuần' },
  { key: 'month', label: 'Tháng' },
  { key: 'year', label: 'Năm' },
];

interface Entry {
  rank: number;
  nickname: string;
  basePower: number; // ở đây MANG NGHĨA số câu đúng của lượt tốt nhất
  isMe: boolean;
}

interface BoardData {
  cycle: Cycle;
  cycleLabel: string;
  msLeft: number;
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

/** Đếm ngược msLeft → chuỗi dễ đọc ("2 ngày 3 giờ" / "5 giờ" / "12 phút"). */
function formatMsLeft(ms: number): string {
  if (ms <= 0) return 'sắp kết thúc';
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days} ngày ${hours} giờ`;
  if (hours > 0) return `${hours} giờ ${mins} phút`;
  return `${mins} phút`;
}

/**
 * Bảng xếp hạng Speed Quiz — 4 chu kỳ (ngày/tuần/tháng/năm). Metric = số câu đúng
 * của LƯỢT TỐT NHẤT trong kỳ. Tái dùng khối bí danh/opt-in chung (/api/profile)
 * với bảng xếp hạng năng lực (cùng nickname + opt_in_leaderboard).
 */
export function SpeedQuizLeaderboard() {
  const { showToast } = useToast();
  const [cycle, setCycle] = useState<Cycle>('day');
  const [board, setBoard] = useState<BoardData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [nickInput, setNickInput] = useState('');
  const [saving, setSaving] = useState(false);

  const loadBoard = useCallback(async (c: Cycle) => {
    setLoading(true);
    try {
      const [bRes, pRes] = await Promise.all([
        fetch(`/api/speed-quiz/leaderboard?cycle=${c}`),
        fetch('/api/profile'),
      ]);
      if (bRes.ok) setBoard(await bRes.json());
      if (pRes.ok) {
        const p = await pRes.json();
        setProfile(p);
        if (p.nickname) setNickInput(p.nickname);
      }
    } catch (e) {
      console.error('Failed to load speed-quiz leaderboard', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Tải bảng khi đổi cycle (data-fetch-on-dependency-change hợp lệ). loadBoard set
  // loading=true đồng bộ để đổi tab thấy trạng thái tải ngay — không phải cascading render.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadBoard(cycle); }, [cycle, loadBoard]);

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
        await loadBoard(cycle);
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
        await loadBoard(cycle);
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
    <div className="space-y-6">
      {/* Tabs chu kỳ */}
      <div className="flex gap-2 flex-wrap">
        {CYCLE_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setCycle(t.key)}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${cycle === t.key ? 'bg-[#fbbf24] text-[#78350f]' : 'bg-[#1b2533] text-gray-300 hover:bg-[#26344a]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-gray-400 p-12">Đang tải bảng xếp hạng...</div>
      ) : !board?.available ? (
        <div className="bg-[#1b2533] border border-[#262730] rounded-xl p-12 text-center">
          <div className="text-5xl mb-4">🚧</div>
          <h2 className="text-xl font-bold text-white mb-2">Bảng xếp hạng sắp ra mắt</h2>
          <p className="text-gray-400">Tính năng đang được hoàn thiện. Quay lại sau nhé!</p>
        </div>
      ) : (
        <>
          {/* Nhãn kỳ + đếm ngược */}
          <div className="flex items-center justify-between bg-[#1b2533] border border-[#262730] rounded-xl px-6 py-4">
            <div className="text-lg font-black text-[#fbbf24]">🗓️ {board.cycleLabel}</div>
            <div className="text-sm text-gray-400">Còn <span className="text-white font-bold">{formatMsLeft(board.msLeft)}</span></div>
          </div>

          {/* Khối bí danh + opt-in (dùng chung với bảng năng lực) */}
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

          {/* Danh sách xếp hạng */}
          {board.top.length === 0 ? (
            <div className="bg-[#1b2533] border border-[#262730] rounded-xl p-12 text-center text-gray-400">
              Chưa có ai trên bảng kỳ này. Hãy là người đầu tiên!
            </div>
          ) : (
            <div className="bg-[#1b2533] border border-[#262730] rounded-xl overflow-hidden">
              {board.top.map((e) => (
                <div
                  key={e.rank}
                  className={`flex items-center justify-between px-6 py-3 border-b border-[#0f172a] last:border-0 ${e.isMe ? 'bg-[rgba(251,191,36,0.12)]' : ''}`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className={`text-lg font-black w-10 text-center ${e.rank <= 3 ? 'text-[#fbbf24]' : 'text-gray-500'}`}>
                      {e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : `#${e.rank}`}
                    </span>
                    <span className={`font-bold truncate ${e.isMe ? 'text-[#fbbf24]' : 'text-white'}`}>
                      {e.nickname} {e.isMe && <span className="text-xs text-amber-400">(Bạn)</span>}
                    </span>
                  </div>
                  <span className="text-sm font-mono text-[#38bdf8] shrink-0">⚡ {e.basePower} câu</span>
                </div>
              ))}
            </div>
          )}

          {/* Vị trí của mình nếu ngoài top hiển thị */}
          {board.me && !board.top.some((e) => e.isMe) && (
            <div className="bg-[rgba(251,191,36,0.12)] border border-[rgba(251,191,36,0.3)] rounded-xl px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-lg font-black w-10 text-center text-[#fbbf24]">#{board.me.rank}</span>
                <span className="font-bold text-[#fbbf24]">{board.me.nickname} <span className="text-xs text-amber-400">(Bạn)</span></span>
              </div>
              <span className="text-sm font-mono text-[#38bdf8]">⚡ {board.me.basePower} câu</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
