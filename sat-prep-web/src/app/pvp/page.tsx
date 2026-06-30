'use client';

import { useState, useEffect } from 'react';
import { useGamification } from '@/context/GamificationContext';
import { PVP_OPPONENTS, getPvpRankName } from '@/helpers/pvp';
import { PVP_COMBAT_SCALE, PVP_MIN_POWER_RATIO } from '@/lib/economy';

export default function PvPPage() {
  const { pvpRank, fightPvP } = useGamification();
  const [log, setLog] = useState<{message: string, success: boolean, won: boolean} | null>(null);
  const [isFighting, setIsFighting] = useState(false);

  // Lực chiến THẬT từ server (basePower từ mastery) — KHÔNG dùng maxPower client
  // (bị trang bị bơm, không phản ánh năng lực học). null = đang tải.
  const [basePower, setBasePower] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setBasePower(data.basePower ?? 0); })
      .catch(() => setBasePower(0));
  }, []);

  const targetRank = Math.max(1, pvpRank - 1);
  const opponent = PVP_OPPONENTS[targetRank];

  // Lực chiến quy đổi (cùng thang với luc_chien của đối thủ) + cổng năng lực.
  const combatPower = basePower !== null ? basePower * PVP_COMBAT_SCALE : null;
  const eligible =
    combatPower !== null && opponent ? combatPower >= opponent.luc_chien * PVP_MIN_POWER_RATIO : false;

  const handleFight = async () => {
    if (isFighting) return;
    setIsFighting(true);
    try {
      const result = await fightPvP();
      setLog(result);
      setTimeout(() => setLog(null), 4000);
      // Cập nhật lại lực chiến hiển thị (mastery có thể đổi giữa các trận).
      fetch('/api/stats')
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data) setBasePower(data.basePower ?? 0); })
        .catch(() => {});
    } finally {
      setIsFighting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 flex flex-col items-center justify-center min-h-[80vh]">
      <div className="text-[120px] animate-bounce">🏟️</div>
      <h1 className="text-4xl font-black text-[#fbbf24] mb-2 uppercase tracking-widest text-shadow-sm">Đấu Trường PvP</h1>
      <p className="text-xl text-[#94a3b8] mb-4 text-center max-w-2xl">
        Danh hiệu hiện tại: <b>{getPvpRankName(pvpRank)}</b><br/>
        Lực chiến của bạn: <b className="text-red-400">{combatPower !== null ? combatPower.toLocaleString() : '...'}</b>
        <span className="block text-sm text-gray-500 mt-1">Lực chiến sinh từ năng lực học thật (mastery) — luyện càng giỏi, đánh càng mạnh. Trang bị không tính vào đấu trường.</span>
      </p>

      {log && (
        <div className={`p-4 rounded-xl text-center font-bold text-lg w-full max-w-lg mb-4 ${log.won ? 'bg-green-900 text-green-300 border-green-500' : 'bg-red-900 text-red-300 border-red-500'} border animate-in slide-in-from-top`}>
          {log.message}
        </div>
      )}

      <div className="bg-[#1b2533] p-8 rounded-xl border border-[#ef4444] shadow-[0_0_30px_rgba(239,68,68,0.2)] w-full max-w-lg text-center">
        {opponent ? (
          <>
            <h3 className="text-xl text-gray-400 mb-2">Mục tiêu Thách Đấu</h3>
            <div className="text-5xl mb-4">{opponent.icon}</div>
            <h2 className="text-3xl font-bold text-white mb-2">{opponent.name}</h2>
            <div className="flex justify-center gap-4 text-sm mb-8">
              <span className="bg-[#0e1117] px-3 py-1 rounded border border-[#334155] text-gray-300">Cấp: {opponent.level}</span>
              <span className="bg-[#0e1117] px-3 py-1 rounded border border-red-900 text-red-400">Lực chiến: {opponent.luc_chien.toLocaleString()}</span>
            </div>

            {combatPower !== null && !eligible && (
              <p className="mb-4 text-sm text-yellow-400 bg-yellow-950/40 border border-yellow-800/50 rounded-lg px-4 py-2">
                ⚠️ Lực chiến chưa đủ để thách đấu (cần tối thiểu {Math.ceil(opponent.luc_chien * PVP_MIN_POWER_RATIO).toLocaleString()}). Hãy luyện thêm để nâng năng lực thật!
              </p>
            )}

            <button
              onClick={handleFight}
              disabled={isFighting || combatPower === null || !eligible}
              className={`w-full text-white py-4 rounded-lg font-bold text-xl uppercase tracking-widest transition-colors shadow-lg flex justify-center items-center gap-2 ${isFighting || combatPower === null || !eligible ? 'bg-gray-700 cursor-not-allowed opacity-60' : 'bg-[#ef4444] hover:bg-[#dc2626]'}`}>
              <span>{isFighting ? '⏳ Đang giao chiến...' : '⚔️ Thách Đấu'}</span>
            </button>
            <p className="mt-4 text-xs text-gray-500">Phần thưởng: {opponent.reward_xp.toLocaleString()} XP & {opponent.reward_coins.toLocaleString()} Xu</p>
          </>
        ) : (
          <h2 className="text-3xl font-bold text-[#fbbf24] mb-2">Đỉnh Cao Tuyệt Đối!</h2>
        )}
      </div>
    </div>
  );
}
