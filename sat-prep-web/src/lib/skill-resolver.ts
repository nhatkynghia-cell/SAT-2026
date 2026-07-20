/**
 * ============================================================================
 *  SKILL RESOLVER — suy skillId taxonomy Cambridge từ (moduleType, topic tự do)
 * ============================================================================
 *  Chỉ dùng khi client KHÔNG gửi skillId tường minh. UI kỹ năng gửi skillId chính
 *  xác; resolver này là fallback cho caller cũ / topic tự do.
 * ============================================================================
 */

export function resolveSkillId(moduleType: string, topic: string): string | undefined {
  const t = (topic || '').normalize('NFC').toLowerCase();

  switch (moduleType) {
    case 'reading':
      if (/matching|match|ghép/.test(t)) return 'reading.matching';
      if (/gap|gapped|điền câu/.test(t)) return 'reading.gapped_text';
      if (/open cloze|điền từ tự do/.test(t)) return 'reading.open_cloze';
      if (/cloze|điền từ vựng/.test(t)) return 'reading.cloze_vocab';
      if (/detail|chi tiết|đoạn dài/.test(t)) return 'reading.detail_mcq';
      return 'reading.notice_mcq';

    case 'writing':
      if (/email|100/.test(t)) return 'writing.email_100';
      if (/story|truyện|tranh|picture/.test(t)) return 'writing.story_pictures';
      if (/article|bài báo/.test(t)) return 'writing.article_or_story';
      return 'writing.short_message';

    case 'listening':
      if (/matching|match|ghép/.test(t)) return 'listening.matching';
      if (/gap|form|điền/.test(t)) return 'listening.gap_fill';
      if (/long|dài/.test(t)) return 'listening.long_convo';
      return 'listening.short_convo';

    case 'speaking':
      if (/collaborative|thảo luận cặp|pair/.test(t)) return 'speaking.collaborative';
      if (/long turn|mô tả ảnh|photo/.test(t)) return 'speaking.long_turn';
      if (/discussion|thảo luận/.test(t)) return 'speaking.discussion';
      return 'speaking.interview';

    case 'grammar':
      return /b1|pet|hoàn thành|điều kiện|bị động|quan hệ|relative|passive|conditional/.test(t)
        ? 'grammar.b1'
        : 'grammar.a2';

    case 'vocabulary':
    case 'vocab':
      return /b1|pet/.test(t) ? 'vocabulary.b1' : 'vocabulary.a2';

    default:
      return undefined;
  }
}
