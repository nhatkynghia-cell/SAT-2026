'use client';

import { useEffect, useRef } from 'react';
import { useGamification } from '@/context/GamificationContext';
import { useToast } from '@/context/ToastContext';
import { BADGE_CATALOG } from '@/lib/rpg-rules';

/**
 * Theo dõi `unlockedBadges` (dẫn xuất từ state) và BẮN TOAST khi có huy hiệu MỚI
 * mở khóa. Đặt BÊN TRONG ToastProvider (GamificationProvider là tổ tiên nên đọc
 * được cả hai context — GamificationContext KHÔNG tự gọi useToast được vì nó bọc
 * NGOÀI ToastProvider).
 *
 * First-load guard: lần đầu chỉ GHI NHẬN tập badge hiện có (không toast) để tránh
 * spam mọi huy hiệu đã sở hữu khi mới vào app. Từ lần sau, chỉ toast phần CHÊNH.
 */
export function BadgeUnlockWatcher() {
  const { unlockedBadges } = useGamification();
  const { showToast } = useToast();
  const seenRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    // Lần đầu: ghi nhận baseline, không thông báo.
    if (seenRef.current === null) {
      seenRef.current = new Set(unlockedBadges);
      return;
    }
    const seen = seenRef.current;
    for (const id of unlockedBadges) {
      if (!seen.has(id)) {
        seen.add(id);
        const badge = BADGE_CATALOG.find((b) => b.id === id);
        if (badge) {
          showToast(`${badge.icon} Mở khóa huy hiệu: ${badge.title}!`, 'success');
        }
      }
    }
  }, [unlockedBadges, showToast]);

  return null;
}
