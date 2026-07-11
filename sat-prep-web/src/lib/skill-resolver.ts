/**
 * ============================================================================
 *  SKILL RESOLVER — suy skillId taxonomy từ (moduleType, topic tự do)
 * ============================================================================
 *  Tách khỏi generate-practice/route.ts để PURE (không I/O) → unit-test được
 *  bằng node:test. Đây là mắt xích quyết định skillId gắn cho MỖI câu (cả câu
 *  sinh mới lẫn câu lưu vào Question Bank) → nếu misroute thì mastery attribution
 *  lệch VÀ cột skill_id trong bank (curation Bước 0) bị sai. Test bảo vệ 2 điều:
 *    1) MỌI skillId hàm này trả về PHẢI tồn tại trong taxonomy (chống typo/drift).
 *    2) Từ khóa chủ đề map đúng nhánh skill.
 *
 *  Chỉ dùng khi client KHÔNG gửi skillId tường minh (caller cũ / desmos). Khi UI
 *  gửi skillId hợp lệ → route ưu tiên cái đó (chính xác hơn heuristic từ khóa).
 * ============================================================================
 */

/**
 * Map (moduleType, topic) → skillId chuẩn trong skill-taxonomy.
 * Reading/Writing map cứng theo module; Toán (math + desmos) match theo từ khóa
 * chủ đề vì topic là chuỗi tự do từ UI. Trả undefined nếu không khớp skill nào.
 */
export function resolveSkillId(moduleType: string, topic: string): string | undefined {
  // Chuẩn hóa NFC trước khi match: dấu tiếng Việt có thể tới ở dạng tổ hợp (NFD)
  // từ một số nguồn input → regex literal (NFC trong source) sẽ trượt nếu không normalize.
  const t = (topic || '').normalize('NFC').toLowerCase();

  if (moduleType === 'vocab') return 'rw.vocab';
  if (moduleType === 'literature') return 'rw.literature';

  // desmos là công cụ Toán → vẫn quy về skill Toán như math.
  if (moduleType === 'math' || moduleType === 'desmos') {
    // Geometry & Trigonometry
    if (/geo|hình|lượng giác|trig|đường tròn|circle|tam giác|triangle|thể tích|volume/.test(t)) {
      if (/lượng giác|trig/.test(t)) return 'geo.trig';
      if (/đường tròn|circle/.test(t)) return 'geo.circles';
      if (/thể tích|volume/.test(t)) return 'geo.volume';
      return 'geo.triangles';
    }
    // Advanced Math
    if (/advanced|nâng cao|bậc hai|quadratic|parabol|đỉnh|vertex|mũ|exponential|đa thức|polynomial|căn|radical/.test(t)) {
      if (/mũ|exponential/.test(t)) return 'advanced.exponential';
      if (/đa thức|polynomial/.test(t)) return 'advanced.polynomials';
      if (/căn|radical/.test(t)) return 'advanced.radicals';
      return 'advanced.quadratic';
    }
    // Data Analysis
    if (/data|số liệu|thống kê|statistic|xác suất|probability|phần trăm|percent|tỉ lệ|tỷ lệ|ratio|rate|tốc độ/.test(t)) {
      if (/xác suất|probability/.test(t)) return 'data.probability';
      if (/phần trăm|percent/.test(t)) return 'data.percentages';
      if (/tỉ lệ|tỷ lệ|ratio|rate|tốc độ/.test(t)) return 'data.ratios';
      return 'data.statistics';
    }
    // Heart of Algebra (mặc định cho Toán)
    if (/hệ phương trình|system/.test(t)) return 'algebra.systems';
    if (/bất phương trình|inequal/.test(t)) return 'algebra.inequalities';
    if (/hàm số|function|đồ thị|graph/.test(t)) return 'algebra.linear_fn';
    return 'algebra.linear_eq';
  }

  return undefined;
}
