'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RETRY_CORRECT_NEEDED } from '@/lib/gate-exam';

/**
 * SKILL TREE PAGE (implementation_plan.md §10.B.1, task #17 / Nhóm 6 T3)
 *
 * Hiển thị bản đồ năng lực SAT — HỆ TIẾN TRÌNH DUY NHẤT (đã bỏ Level phẳng).
 * Đọc /api/skill-tree (buildSkillTree từ mastery thật). Mỗi node = 1 skill;
 * chương phụ thuộc bị KHÓA tới khi chương tiên quyết đạt ngưỡng.
 *
 * Kèm panel "Luyện Mục Tiêu" (Nhóm 6 T4) đọc /api/adaptive → đề xuất skill yếu
 * nhất + độ khó kế tiếp, deep-link sang trang luyện tương ứng.
 */

type NodeState = 'locked' | 'available' | 'in_progress' | 'mastered';
type GateStatus = 'not_required' | 'available' | 'locked' | 'passed' | 'cooldown';

interface SkillNode {
  id: string;
  label: string;
  domainId: string;
  domainLabel: string;
  score: number;
  state: NodeState;
  lockedBy?: string[];
}
interface DomainProgress {
  id: string;
  label: string;
  avgScore: number;
  satisfied: boolean;
  gateStatus: GateStatus;
  correctSinceFail?: number;
}
interface SkillTreeView {
  domains: DomainProgress[];
  nodes: SkillNode[];
  masteredCount: number;
  totalNodes: number;
}

/** Đề xuất từ /api/adaptive (recommendNext). */
interface AdaptiveRecommendation {
  skillId: string;
  label: string;
  moduleType: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  masteryScore: number;
  reason: string;
}

/** moduleType → route trang luyện tương ứng (deep-link nút "Luyện ngay"). */
const MODULE_ROUTE: Record<string, string> = {
  math: '/math',
  literature: '/literature',
  vocab: '/vocabulary',
  desmos: '/desmos',
};

const DIFFICULTY_LABEL: Record<AdaptiveRecommendation['difficulty'], { text: string; cls: string }> = {
  Easy: { text: 'Dễ', cls: 'text-green-400 border-green-400' },
  Medium: { text: 'Vừa', cls: 'text-yellow-400 border-yellow-400' },
  Hard: { text: 'Khó', cls: 'text-red-400 border-red-400' },
};

const STATE_META: Record<NodeState, { label: string; badge: string; card: string; bar: string }> = {
  mastered: {
    label: '✅ Tinh thông',
    badge: 'bg-[#064e3b] text-[#34d399] border-[#10b981]',
    card: 'bg-[#052e23] border-[#10b981] shadow-[0_0_12px_rgba(16,185,129,0.25)]',
    bar: 'bg-[#10b981]',
  },
  in_progress: {
    label: '⚡ Đang luyện',
    badge: 'bg-[#1e3a8a] text-[#93c5fd] border-[#3b82f6]',
    card: 'bg-[#0f1d3a] border-[#3b82f6]',
    bar: 'bg-[#3b82f6]',
  },
  available: {
    label: '🔓 Sẵn sàng',
    badge: 'bg-[#1b2533] text-gray-300 border-gray-600',
    card: 'bg-[#1b2533] border-[#334155] hover:border-[#3b82f6]',
    bar: 'bg-gray-500',
  },
  locked: {
    label: '🔒 Đang khóa',
    badge: 'bg-[#1a1a1a] text-gray-500 border-gray-700',
    card: 'bg-[#14181f] border-[#262730] opacity-60',
    bar: 'bg-gray-700',
  },
};

export default function SkillTreePage() {
  const [tree, setTree] = useState<SkillTreeView | null>(null);
  const [rec, setRec] = useState<AdaptiveRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [treeRes, adaptiveRes] = await Promise.all([
          fetch('/api/skill-tree'),
          fetch('/api/adaptive'),
        ]);
        if (treeRes.ok) setTree(await treeRes.json());
        else setError(true);
        // Adaptive: 404 khi chưa có skill khớp — không phải lỗi, chỉ là chưa có đề xuất.
        if (adaptiveRes.ok) {
          const data = await adaptiveRes.json();
          if (data.recommendation) setRec(data.recommendation);
        }
      } catch (e) {
        console.error('Lỗi tải Skill Tree', e);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const masteredPct =
    tree && tree.totalNodes > 0 ? Math.round((tree.masteredCount / tree.totalNodes) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="math-academy-header epic-shake-active" style={{ background: 'linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)' }}>
        <div className="math-title-container">
          <div className="math-icon">🌳</div>
          <div>
            <h1 className="math-title" style={{ background: 'linear-gradient(to right, #818cf8, #6366f1)', WebkitBackgroundClip: 'text' }}>CÂY NĂNG LỰC SAT</h1>
            <p className="math-subtitle text-indigo-200">Bản đồ tiến trình thật — mở khóa bằng năng lực, không phải điểm kinh nghiệm.</p>
          </div>
        </div>
      </div>

      {/* Tổng quan tiến trình — thay cho chỉ số "Level" cũ */}
      <div className="bg-[#1b2533] p-6 rounded-xl border border-[#262730] shadow-lg">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xl font-bold text-white">Tiến Trình Tinh Thông</h3>
          <span className="text-2xl font-black text-[#818cf8]">
            {loading ? '...' : `${tree?.masteredCount ?? 0}/${tree?.totalNodes ?? 0}`}
          </span>
        </div>
        <div className="w-full h-4 bg-[#0e1117] rounded-full overflow-hidden border border-[#334155]">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700" style={{ width: `${masteredPct}%` }} />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Bạn đã tinh thông {masteredPct}% số kỹ năng SAT. Mỗi kỹ năng tinh thông là một bước tiến thật tới điểm số mục tiêu.
        </p>
      </div>

      {/* Luyện Mục Tiêu (Nhóm 6 T4) — đề xuất skill yếu nhất + độ khó kế tiếp từ /api/adaptive */}
      {!loading && rec && MODULE_ROUTE[rec.moduleType] && (
        <div className="bg-gradient-to-br from-[#1e1b4b] to-[#0f172a] p-6 rounded-xl border border-[#6366f1] shadow-[0_0_15px_rgba(99,102,241,0.2)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🎯</span>
                <h3 className="text-lg font-bold text-white">Luyện Mục Tiêu</h3>
                <span className={`text-xs px-2 py-0.5 rounded border bg-[rgba(0,0,0,0.3)] font-bold ${DIFFICULTY_LABEL[rec.difficulty].cls}`}>
                  Độ khó đề xuất: {DIFFICULTY_LABEL[rec.difficulty].text}
                </span>
              </div>
              <p className="text-[#e2e8f0] font-medium">{rec.label}</p>
              <p className="text-xs text-indigo-300 mt-1">{rec.reason}</p>
            </div>
            <Link
              href={MODULE_ROUTE[rec.moduleType]}
              className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-bold px-6 py-3 rounded-xl transition-all text-center whitespace-nowrap shadow-lg"
            >
              ⚡ Luyện ngay
            </Link>
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-[#1b2533] p-12 rounded-xl border border-[#262730] flex flex-col items-center justify-center">
          <div className="text-4xl animate-spin mb-4">⚙️</div>
          <div className="text-white font-bold">Đang dựng bản đồ năng lực...</div>
        </div>
      )}

      {error && !loading && (
        <div className="bg-[#450a0a] border border-[#ef4444] text-[#fca5a5] p-6 rounded-xl">
          Không tải được Cây Năng Lực. Vui lòng đăng nhập và thử lại.
        </div>
      )}

      {tree && !loading && (
        <div className="space-y-8">
          {tree.domains.map((domain) => {
            const domainNodes = tree.nodes.filter((n) => n.domainId === domain.id);
            return (
              <div key={domain.id} className="bg-[#13171f] border border-[#262730] rounded-xl p-6">
                {/* Header chương + thanh đạt ngưỡng mở khóa */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="w-1.5 h-5 bg-[#6366f1] rounded-full inline-block" />
                    {domain.label}
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="w-40 h-2.5 bg-[#0e1117] rounded-full overflow-hidden border border-[#334155]">
                      <div className={`h-full ${domain.satisfied ? 'bg-[#10b981]' : 'bg-[#f59e0b]'} transition-all`} style={{ width: `${Math.min(100, domain.avgScore)}%` }} />
                    </div>
                    <span className="text-sm font-bold text-gray-300 whitespace-nowrap">{domain.avgScore}/100</span>
                    {domain.gateStatus === 'passed' && (
                      <span className="text-xs bg-[#064e3b] text-[#34d399] border border-[#10b981] px-2 py-0.5 rounded">✅ Đã vượt cổng</span>
                    )}
                    {domain.gateStatus === 'available' && (
                      <Link
                        href={`/gate-exam/${domain.id}`}
                        className="text-xs bg-red-600 hover:bg-red-500 text-white font-bold px-3 py-1 rounded border border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)] transition-all hover:scale-105"
                      >
                        ⚔️ Thi Cổng
                      </Link>
                    )}
                    {domain.gateStatus === 'cooldown' && (
                      <span className="text-xs bg-[#451a03] text-amber-300 border border-amber-600 px-2 py-0.5 rounded">
                        🔄 Cần {RETRY_CORRECT_NEEDED - (domain.correctSinceFail ?? 0)} câu đúng
                      </span>
                    )}
                    {domain.gateStatus === 'not_required' && domain.satisfied && (
                      <span className="text-xs bg-[#064e3b] text-[#34d399] border border-[#10b981] px-2 py-0.5 rounded">Đã mở khóa chương sau</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {domainNodes.map((node) => {
                    const meta = STATE_META[node.state];
                    return (
                      <div key={node.id} className={`p-4 rounded-xl border-2 transition-all ${meta.card}`}>
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <h4 className="text-sm font-bold text-gray-100 leading-snug">{node.label}</h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded border whitespace-nowrap ${meta.badge}`}>{meta.label}</span>
                        </div>
                        <div className="w-full h-2 bg-[#0e1117] rounded-full overflow-hidden border border-[#334155]">
                          <div className={`h-full ${meta.bar} transition-all`} style={{ width: `${Math.min(100, node.score)}%` }} />
                        </div>
                        <div className="flex justify-between items-center mt-1.5">
                          <span className="text-xs text-gray-400">{node.score}/100</span>
                          {node.state === 'locked' && node.lockedBy && node.lockedBy.length > 0 && (
                            <span className="text-[11px] text-amber-500">Cần: {node.lockedBy.join(', ')}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
