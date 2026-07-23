import type { MasterySummary } from './mastery';

/**
 * ============================================================================
 *  BASE STATS — chỉ số nhân vật sinh từ HIỆU SUẤT HỌC THẬT (§10.B.2, task #18)
 * ============================================================================
 *  QUYẾT ĐỊNH ĐÃ CHỐT: Lực Chiến / chỉ số nhân vật = năng lực SAT thật.
 *  TRANG BỊ & PET CHỈ LÀ BONUS CỘNG THÊM, không phải nguồn gốc chỉ số. Bỏ hẳn
 *  cơ chế "nạp/mua để mạnh" (chống pay-to-win trong giáo dục).
 *
 *  Chỉ số thật (đều suy từ mastery — dữ liệu đã được server xác thực, §9.1):
 *    • Trí Tuệ (intelligence) = mastery trung bình toàn bộ skill (0..100).
 *    • Chính Xác (accuracy)   = tổng câu đúng / tổng câu đã làm (0..100).
 *    • Độ Phủ (coverage)      = % skill đã luyện ít nhất 1 lần (0..100).
 *
 *  Lực Chiến NỀN (basePower) = tổng hợp 3 chỉ số trên. Trang bị cộng thêm
 *  equipmentBonus (mặc định 0) → totalPower. Client KHÔNG được set power.
 *
 *  ⏳ Plan gốc dự kiến "Tốc Độ = pacing"; pacing (task #15) chưa có nên tạm
 *  dùng Độ Phủ làm chỉ số thật thứ ba. Khi #15 xong sẽ thêm chỉ số Tốc Độ.
 *
 *  ⚠️ THUẦN (pure) — chỉ import TYPE. Nhận MasterySummary + equipmentBonus.
 * ============================================================================
 */

export interface CharacterStats {
  intelligence: number; // Trí Tuệ 0..100
  accuracy: number;     // Chính Xác 0..100
  coverage: number;     // Độ Phủ 0..100
  basePower: number;    // Lực Chiến nền (từ học thật)
  equipmentBonus: number;
  totalPower: number;   // basePower + equipmentBonus
}

/** Hệ số quy đổi 3 chỉ số (0..100) thành Lực Chiến nền. */
const POWER_WEIGHTS = { intelligence: 4, accuracy: 3, coverage: 3 };

export function computeStats(summary: MasterySummary, equipmentBonus = 0): CharacterStats {
  const skills = summary.skills;

  const intelligence = summary.overall; // đã là trung bình mastery

  const totalAttempts = skills.reduce((s, k) => s + k.attempts, 0);
  const totalCorrect = skills.reduce((s, k) => s + k.correct, 0);
  const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  const attemptedSkills = skills.filter((k) => k.attempts > 0).length;
  const coverage = skills.length > 0 ? Math.round((attemptedSkills / skills.length) * 100) : 0;

  // Lực Chiến nền: trung bình có trọng số của 3 chỉ số, KHÔNG dính trang bị.
  const wSum = POWER_WEIGHTS.intelligence + POWER_WEIGHTS.accuracy + POWER_WEIGHTS.coverage;
  const basePower = Math.round(
    (intelligence * POWER_WEIGHTS.intelligence +
      accuracy * POWER_WEIGHTS.accuracy +
      coverage * POWER_WEIGHTS.coverage) /
      wSum
  );

  const bonus = Math.max(0, Math.floor(equipmentBonus));

  return {
    intelligence,
    accuracy,
    coverage,
    basePower,
    equipmentBonus: bonus,
    totalPower: basePower + bonus,
  };
}

/**
 * Lực chiến NỀN theo 1 DOMAIN cụ thể (boss theo domain — RPG 60/40 đối kháng gắn
 * học thật). Lọc summary.skills về đúng domainId rồi tính cùng công thức
 * computeStats (KHÔNG trang bị). Boss mỗi rank map 1 domain → muốn thắng phải
 * GIỎI đúng domain đó, không thể mạnh tổng thể mà bỏ qua điểm yếu.
 *
 * ⚠️ THUẦN. Domain không có skill (id sai) → basePower 0 (không đủ lực → gate chặn).
 */
export function computeDomainStats(summary: MasterySummary, domainId: string): CharacterStats {
  const domainSkills = summary.skills.filter((s) => s.domainId === domainId);
  const subSummary: MasterySummary = {
    ...summary,
    skills: domainSkills,
    // overall của domain = trung bình mastery các skill trong domain (0 nếu rỗng).
    overall: domainSkills.length
      ? Math.round(domainSkills.reduce((sum, s) => sum + s.score, 0) / domainSkills.length)
      : 0,
  };
  return computeStats(subSummary, 0);
}
