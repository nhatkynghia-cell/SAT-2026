'use client';

import { useState } from 'react';

/**
 * TRANG ADMIN — HÀNG ĐỢI ĐỔI QUÀ (shared-secret, KHÔNG dùng auth user).
 * Admin nhập secret (khớp ENV ADMIN_SECRET) → xem phiếu 'pending' → fulfill (đã
 * giao) / cancel (hủy + hoàn xu). Secret gửi qua header `x-admin-secret`, GIỮ
 * trong state React (KHÔNG lưu localStorage — tránh rò rỉ trên máy dùng chung).
 *
 * ⚠️ Đây là công cụ vận hành nội bộ nhẹ cho beta. Khi có role system đầy đủ thì
 * thay bằng trang admin có phân quyền thật.
 */

interface Row {
  id: string;
  userId: string;
  rewardId: string;
  rewardName: string;
  costCoins: number;
  status: string;
  createdAt: string;
}

export default function AdminRedemptionsPage() {
  const [secret, setSecret] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadQueue() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/redemptions', {
        headers: { 'x-admin-secret': secret },
      });
      if (res.status === 403) {
        setRows(null);
        setMsg({ kind: 'err', text: 'Secret không đúng hoặc chưa cấu hình ADMIN_SECRET.' });
        return;
      }
      const data = await res.json();
      setRows(data.redemptions ?? []);
      if ((data.redemptions ?? []).length === 0) {
        setMsg({ kind: 'ok', text: 'Không có phiếu nào đang chờ xử lý.' });
      }
    } catch {
      setMsg({ kind: 'err', text: 'Lỗi kết nối. Thử lại.' });
    } finally {
      setLoading(false);
    }
  }

  async function act(id: string, action: 'fulfill' | 'cancel') {
    if (action === 'cancel' && !confirm('Hủy phiếu này sẽ HOÀN xu về tài khoản học sinh. Tiếp tục?')) {
      return;
    }
    setBusyId(id);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/redemptions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ redemptionId: id, action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMsg({ kind: 'err', text: data.error ?? 'Không xử lý được phiếu.' });
        return;
      }
      const verb = action === 'fulfill' ? 'Đã đánh dấu ĐÃ GIAO' : 'Đã HỦY + hoàn xu';
      const extra = action === 'cancel' && typeof data.coins === 'number' ? ` (số dư mới: ${data.coins})` : '';
      setMsg({ kind: 'ok', text: `${verb} phiếu ${id.slice(0, 8)}…${extra}` });
      // Bỏ phiếu vừa xử lý khỏi hàng đợi (nó không còn 'pending').
      setRows((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
    } catch {
      setMsg({ kind: 'err', text: 'Lỗi kết nối. Thử lại.' });
    } finally {
      setBusyId(null);
    }
  }

  const kindLabel: Record<string, string> = {
    voucher: '🎟️ Voucher',
    material: '📚 Tài liệu',
    ai_perk: '🤖 Gói AI',
  };

  return (
    <div className="min-h-screen bg-[#0e1117] px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-black text-white">🎁 Quản lý phiếu đổi quà</h1>
          <p className="text-gray-400 text-sm">Xử lý hàng đợi đổi xu → quà thật (fulfill / hủy + hoàn xu).</p>
        </header>

        <div className="bg-[#1b2533] p-4 rounded-xl border border-[#334155] flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="flex-1 space-y-1">
            <span className="text-xs text-gray-400">Admin secret</span>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && secret && loadQueue()}
              placeholder="Nhập ADMIN_SECRET"
              className="w-full bg-[#0e1117] border border-[#334155] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </label>
          <button
            onClick={loadQueue}
            disabled={!secret || loading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-lg text-sm transition"
          >
            {loading ? 'Đang tải…' : 'Tải hàng đợi'}
          </button>
        </div>

        {msg && (
          <div
            className={`p-3 rounded-lg text-sm border ${
              msg.kind === 'ok'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            {msg.text}
          </div>
        )}

        {rows && rows.length > 0 && (
          <div className="space-y-3">
            {rows.map((r) => (
              <div
                key={r.id}
                className="bg-[#1b2533] p-4 rounded-xl border border-[#334155] flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold">{r.rewardName}</div>
                  <div className="text-xs text-gray-400 mt-1 space-x-2">
                    <span>{kindLabel[r.rewardId] ?? r.rewardId}</span>
                    <span className="text-amber-300">💰 {r.costCoins.toLocaleString('vi-VN')} xu</span>
                    <span className="text-gray-500">HS: {r.userId.slice(0, 8)}…</span>
                  </div>
                  <div className="text-[11px] text-gray-600 mt-0.5">
                    {new Date(r.createdAt).toLocaleString('vi-VN')} · phiếu {r.id.slice(0, 8)}…
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => act(r.id, 'fulfill')}
                    disabled={busyId === r.id}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
                  >
                    ✅ Đã giao
                  </button>
                  <button
                    onClick={() => act(r.id, 'cancel')}
                    disabled={busyId === r.id}
                    className="bg-red-600/80 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
                  >
                    ✕ Hủy + hoàn xu
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
