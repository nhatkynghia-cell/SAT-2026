/**
 * EmptyState — trạng thái "trống / chưa có dữ liệu / sắp ra mắt" DÙNG CHUNG.
 *
 * Cùng tinh thần với LoadingState: gom hai khối bị COPY gần y hệt qua nhiều
 * trang game — card "🚧 sắp ra mắt" (available:false) và card "Chưa có ai..."
 * (danh sách rỗng) — chỉ khác icon/chữ. Trước đây leaderboard, SpeedQuizLeaderboard
 * và quests mỗi nơi tự viết inline với class lệch nhau (gray-400 vs gray-500,
 * p-12 vs không) → nhìn không đồng bộ.
 *
 * - có icon + title  → biến thể GIÀU (icon lớn + tiêu đề + mô tả).
 * - chỉ có message   → biến thể GỌN (một dòng chữ căn giữa trong card).
 *
 * Props hành động (actionHref/actionLabel, secondaryHref/secondaryLabel) TÙY CHỌN
 * và backward-compatible: caller cũ không truyền → render y hệt trước. Dùng cho
 * empty-state cần CTA dẫn user đi hành động (vd dashboard trống → /diagnostic).
 *
 * Lỗi (fetch fail) KHÔNG dùng component này — toast qua useToast vẫn là chuẩn
 * de-facto (xem ghi chú trong LoadingState.tsx). Empty ≠ Error: empty là "không
 * có gì để hiện", error là "gọi hỏng"; gộp sẽ che mất khác biệt cho người dùng.
 */
import Link from 'next/link';

export function EmptyState({
  icon,
  title,
  message,
  actionHref,
  actionLabel,
  secondaryHref,
  secondaryLabel,
}: {
  icon?: string;
  title?: string;
  message: string;
  actionHref?: string;
  actionLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="bg-[#1b2533] border border-[#262730] rounded-xl p-12 text-center">
      {icon && <div className="text-5xl mb-4">{icon}</div>}
      {title && <h2 className="text-xl font-bold text-white mb-2">{title}</h2>}
      <p className="text-gray-400">{message}</p>
      {(actionHref || secondaryHref) && (
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center items-center">
          {actionHref && actionLabel && (
            <Link
              href={actionHref}
              className="inline-block text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-3 rounded-lg hover:from-emerald-400 hover:to-teal-400 shadow-lg"
            >
              {actionLabel}
            </Link>
          )}
          {secondaryHref && secondaryLabel && (
            <Link href={secondaryHref} className="text-sm text-indigo-300 hover:text-indigo-200">
              {secondaryLabel} →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
