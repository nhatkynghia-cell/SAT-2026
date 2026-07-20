import seedData from '@/data/vocab_seed.json';
import { todayStr } from '@/lib/leitner';
import type { VocabWord } from '@/lib/vocab-store';

/**
 * ============================================================================
 *  VOCAB SEED (Cambridge KET/PET) — Phase 1
 * ============================================================================
 *  Bộ từ vựng seed tĩnh cho học sinh cấp 2 luyện Cambridge KET (A2) / PET (B1).
 *  Nạp vào SRS Leitner lần đầu khi user mở /vocab và chưa có marker seed
 *  (lazy-seed trong GET /api/vocab). Module THUẦN, mirror diagnostic.ts:
 *    • getVocabSeed()        — bộ từ đầy đủ (CHỈ dùng nội bộ server).
 *    • getSeedWords(exam)    — lọc theo exam (KET mặc định khi chưa biết CEFR).
 *    • toSrsWords(seed)      — chuyển seed → VocabWord (box=1 + next_review
 *                              STAGGER theo lô DAILY_NEW, chống ồ ạt).
 *    • makeSeedMarker()      — sentinel {id:'__seed_version__'} chống double-seed.
 *
 *  Dữ liệu tĩnh bundle lúc build (serverless-safe). Không I/O DB.
 * ============================================================================
 */

export type CefrLevel = 'A2' | 'B1';
export type CambridgeExam = 'KET' | 'PET';

export interface VocabSeedWord {
  id: string;
  word: string;
  pos?: string;
  ipa?: string;
  meaning_vi: string;
  meaning_en?: string;
  example: string;
  cefr: CefrLevel;
  exam: CambridgeExam;
  topic: string;
  audio_url: string;
}

/** Phiên bản schema seed — tăng khi thay đổi cấu trúc để re-seed (Phase 2+). */
export const SEED_VERSION = 1;

/** id sentinel chống seed lại 2 lần (lưu trong words[] cùng từ vựng). */
export const SEED_MARKER_ID = '__seed_version__';

const SEED: VocabSeedWord[] = (seedData as VocabSeedWord[]).filter(
  (w) => w && w.id && w.id !== SEED_MARKER_ID
);

/** Bộ từ seed đầy đủ (KET + PET). */
export function getVocabSeed(): VocabSeedWord[] {
  return SEED;
}

/** CEFR level → exam Cambridge tương ứng (A2→KET, B1→PET). */
export function levelToExam(level: CefrLevel): CambridgeExam {
  return level === 'A2' ? 'KET' : 'PET';
}

/** Lọc seed theo exam (KET mặc định khi user chưa có CEFR). */
export function getSeedWords(exam: CambridgeExam = 'KET'): VocabSeedWord[] {
  return SEED.filter((w) => w.exam === exam);
}

/** Sentinel marker ghi vào words[] — hasSeedMarker() phát hiện để chống double-seed. */
export function makeSeedMarker(): VocabWord {
  return {
    id: SEED_MARKER_ID,
    box: 0,
    next_review: '',
    value: SEED_VERSION,
    seededAt: new Date().toISOString(),
  };
}

/**
 * Cộng n ngày vào ngày YYYY-MM-DD, trả YYYY-MM-DD. Thuần, không dùng Date.now
 * (chỉ thao tác trên chuỗi base truyền vào → testable).
 */
function addDays(baseYyyyMmDd: string, n: number): string {
  const d = new Date(baseYyyyMmDd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

/**
 * Chuyển seed → VocabWord cho SRS: box=1 + next_review STAGGER theo lô.
 *  • Lô 0 (DAILY_NEW từ đầu) → due HÔM NAY (học ngay).
 *  • Lô k (k≥1) → due hôm nay + k ngày → mỗi ngày đúng DAILY_NEW từ mới due.
 *
 *  KHÔNG áp nextReview(1) cho mọi lô (sai: toàn bộ cùng due 1 ngày, ồ ạt).
 */
export function toSrsWords(seed: VocabSeedWord[], DAILY_NEW = 20): VocabWord[] {
  const today = todayStr();
  return seed.map((w, i) => {
    const batch = Math.floor(i / DAILY_NEW);
    return {
      id: w.id,
      box: 1,
      next_review: addDays(today, batch),
      word: w.word,
      pos: w.pos,
      ipa: w.ipa,
      meaning_vi: w.meaning_vi,
      meaning_en: w.meaning_en,
      example: w.example,
      cefr: w.cefr,
      exam: w.exam,
      topic: w.topic,
      audio_url: w.audio_url,
    } as VocabWord;
  });
}
