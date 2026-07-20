import type { MistakeEntry } from './mistakes-store.ts';

/**
 * ============================================================================
 *  ERROR ANALYSIS — LÕI THUẦN (pure) cho phân tích câu sai (tối ưu #7)
 * ============================================================================
 *  Định nghĩa concept `error_tag` (nhóm lỗi Cambridge phổ biến cho HS cấp 2,
 *  KET A2 / PET B1) + heuristic phân loại (classifyError) + gộp tần suất
 *  (aggregateErrors) + gợi ý kỹ năng yếu (weakSubjects).
 *
 *  Phần THUẦN — KHÔNG I/O DB: mảng MistakeEntry NHẬP qua tham số (tầng gọi
 *  load từ Supabase rồi tiêm). Lý do tách: mistakes-store.ts hiện CHƯA có cột
 *  error_tag (migration sau). Module này cho pilot tag + aggregate ngay trên
 *  data hiện có mà không đợi schema, và unit-test được mà không kéo
 *  next/headers/supabase (theo mẫu score-math.ts / mistake-variant.ts).
 *
 *  heuristic KHÔNG hoàn hảo — dựa keyword đơn giản (VN/EN) + skill_id prefix,
 *  fallback 'other'. Khi có cột error_tag do AI gán thì caller dùng tag đó
 *  thay vì classifyError.
 * ============================================================================
 */

/** Nhóm lỗi Cambridge phổ biến cho HS cấp 2 (KET A2 / PET B1). */
export type ErrorTag =
  | 'vocab' // từ vựng chưa biết
  | 'grammar' // sai ngữ pháp (thì / loại từ / giới từ)
  | 'reading_detail' // đọc sót chi tiết
  | 'infer' // suy luận sai
  | 'trap' // dính bẫy distract
  | 'listen_detail' // nghe sót chi tiết
  | 'spelling' // chính tả
  | 'register' // sai trang trọng / sộc (formal vs informal)
  | 'other';

/** Mọi tag theo thứ tự cố định (khởi tạo byTag + tie-break topTags). */
export const ERROR_TAGS: ErrorTag[] = [
  'vocab',
  'grammar',
  'reading_detail',
  'infer',
  'trap',
  'listen_detail',
  'spelling',
  'register',
  'other',
];

/** Kết quả gộp tần suất error_tag từ một mảng câu sai. */
export interface ErrorAggregate {
  byTag: Record<ErrorTag, number>;
  total: number;
  topTags: Array<{ tag: ErrorTag; count: number; pct: number }>;
}

/** Kỹ năng yếu nhất suy ra từ tag phổ biến (khớp Subject của skill-taxonomy). */
export type WeakSubject = 'reading' | 'listening' | 'foundation';

/** Gợi ý kỹ năng yếu kèm lý do (tiếng Việt, hiển thị user). */
export interface WeakSubjectSuggestion {
  subject: WeakSubject;
  reason: string;
}

/**
 * Gộp mọi trường text của entry (lowercase) để khớp keyword VN/EN.
 * Join bằng ' \n ' tránh keyword dính qua biên trường. Dấu VN không đổi sau
 * toLowerCase (chỉ ảnh hưởng ASCII), nên keyword có dấu khớp đúng.
 */
function entryText(entry: MistakeEntry): string {
  return [
    entry.question ?? '',
    entry.passage ?? '',
    entry.explanation ?? '',
    entry.source ?? '',
    entry.skill_id ?? '',
  ]
    .join(' \n ')
    .toLowerCase();
}

/**
 * Phân loại một câu sai sang ErrorTag bằng heuristic THUẦN (keyword + skill_id).
 * Thứ tự ưu tiên (early-return): nghe → bẫy → từ vựng → ngữ pháp → chính tả →
 * register → suy luận → đọc chi tiết → other. Không hoàn hảo — fallback 'other'.
 *
 * skill_id prefix (theo skill-taxonomy.ts): listening.*→nghe, vocabulary.*→vocab,
 * grammar.*→grammar, reading.*→reading_detail. Hậu tố .a2/.b1 = skill nền tảng
 * (grammar/vocabulary), phân biệt qua PREFIX chứ không qua hậu tố.
 */
export function classifyError(entry: MistakeEntry): ErrorTag {
  const text = entryText(entry);
  const skillId = (entry.skill_id ?? '').toLowerCase();
  const has = (kw: string) => text.includes(kw);

  // 1) Nghe: đặc trưng rõ nhất — skill listening.* hoặc question có 'Nghe'/'listen'.
  if (skillId.startsWith('listening.') || has('nghe') || has('listen')) {
    return 'listen_detail';
  }

  // 2) Bẫy distract: thường xuất hiện trong explanation ('bẫy'/'trap'/'distract').
  if (has('bẫy') || has('trap') || has('distract')) {
    return 'trap';
  }

  // 3) Từ vựng: skill vocabulary.* hoặc text có 'từ vựng'/'vocab'.
  if (skillId.startsWith('vocabulary.') || has('từ vựng') || has('vocab')) {
    return 'vocab';
  }

  // 4) Ngữ pháp: skill grammar.* hoặc text có 'ngữ pháp'/'thì'/'giới từ'/'tense'/'preposition'.
  if (
    skillId.startsWith('grammar.') ||
    has('ngữ pháp') ||
    has('thì') ||
    has('giới từ') ||
    has('tense') ||
    has('preposition')
  ) {
    return 'grammar';
  }

  // 5) Chính tả.
  if (has('chính tả') || has('spelling') || has('spelt')) {
    return 'spelling';
  }

  // 6) Sai trang trọng / sộc (register: formal vs informal/casual).
  if (
    has('trang trọng') ||
    has('lịch sự') ||
    has('register') ||
    has('formal') ||
    has('informal') ||
    has('casual')
  ) {
    return 'register';
  }

  // 7) Suy luận sai.
  if (has('suy luận') || has('infer') || has('ngụ ý') || has('imply')) {
    return 'infer';
  }

  // 8) Đọc sót chi tiết: skill reading.* hoặc text có 'chi tiết'/'detail'.
  if (skillId.startsWith('reading.') || has('chi tiết') || has('detail')) {
    return 'reading_detail';
  }

  return 'other';
}

/**
 * Gộp tần suất ErrorTag từ mảng câu sai. byTag khởi tạo MỌI tag = 0;
 * topTags chỉ chứa tag có count > 0, sắp xếp giảm dần theo count (tie-break
 * theo ERROR_TAGS để deterministic), pct = round(count/total*100).
 * total = entries.length; mảng rỗng → total 0, topTags [].
 */
export function aggregateErrors(entries: MistakeEntry[]): ErrorAggregate {
  const byTag = {} as Record<ErrorTag, number>;
  for (const t of ERROR_TAGS) byTag[t] = 0;

  for (const e of entries) {
    byTag[classifyError(e)] += 1;
  }

  const total = entries.length;

  const topTags = ERROR_TAGS.map((tag) => ({ tag, count: byTag[tag] }))
    .filter((x) => x.count > 0)
    .sort(
      (a, b) =>
        b.count - a.count || ERROR_TAGS.indexOf(a.tag) - ERROR_TAGS.indexOf(b.tag)
    )
    .map((x) => ({
      tag: x.tag,
      count: x.count,
      pct: total > 0 ? Math.round((x.count / total) * 100) : 0,
    }));

  return { byTag, total, topTags };
}

/**
 * Gợi ý kỹ năng yếu nhất dựa tag phổ biến. Nhóm tag → subject:
 *   • reading    = trap + reading_detail + infer (dính bẫy / đọc sót / suy luận)
 *   • listening  = listen_detail (nghe sót)
 *   • foundation = grammar + vocab + spelling + register (nền tảng ngôn ngữ)
 * Chọn nhóm count cao nhất; tie-break theo thứ tự reading > listening >
 * foundation (ưu tiên kỹ năng cụ thể hơn). Trả null khi total = 0 HOẶC mọi câu
 * đều rơi vào 'other' (best.count = 0 — không đủ tín hiệu để gợi ý).
 *
 * summary?: truyền kết quả aggregateErrors đã có để tránh tính lại.
 */
export function weakSubjects(
  entries: MistakeEntry[],
  summary?: ErrorAggregate
): WeakSubjectSuggestion | null {
  const agg = summary ?? aggregateErrors(entries);
  if (agg.total === 0) return null;

  const { byTag, total } = agg;

  const groups: Array<{
    subject: WeakSubject;
    count: number;
    reason: (pct: number) => string;
  }> = [
    {
      subject: 'reading',
      count: byTag.trap + byTag.reading_detail + byTag.infer,
      reason: (pct) =>
        `Dính bẫy / đọc sót chi tiết / suy luận sai chiếm ${pct}% lỗi — cần luyện Reading.`,
    },
    {
      subject: 'listening',
      count: byTag.listen_detail,
      reason: (pct) => `Nghe sót chi tiết chiếm ${pct}% lỗi — cần luyện Listening.`,
    },
    {
      subject: 'foundation',
      count: byTag.grammar + byTag.vocab + byTag.spelling + byTag.register,
      reason: (pct) =>
        `Lỗi ngữ pháp / từ vựng / chính tả / trang trọng chiếm ${pct}% — cần củng cố nền tảng.`,
    },
  ];

  // Chọn nhóm count cao nhất; strict '>' giữ tie-break theo thứ tự mảng
  // (reading > listening > foundation).
  let best = groups[0];
  for (const g of groups) {
    if (g.count > best.count) best = g;
  }
  if (best.count === 0) return null;

  const pct = Math.round((best.count / total) * 100);
  return { subject: best.subject, reason: best.reason(pct) };
}
