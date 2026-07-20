import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSkillId } from './skill-resolver.ts';
import { isValidSkill } from './skill-taxonomy.ts';

describe('skill-resolver — resolveSkillId Cambridge', () => {
  test('INVARIANT: mọi skillId trả về PHẢI hợp lệ trong taxonomy', () => {
    const topics = [
      'notice', 'matching', 'gapped text', 'open cloze', 'detail', 'điền từ vựng',
      'short message', 'email 100', 'story pictures', 'article',
      'short conversation', 'long conversation', 'form gap fill', 'listening matching',
      'interview', 'collaborative', 'long turn photo', 'discussion',
      'grammar a2', 'relative clause b1', 'pet vocab', '', 'chủ đề vu vơ',
    ];
    for (const mt of ['reading', 'writing', 'listening', 'speaking', 'grammar', 'vocabulary', 'vocab']) {
      for (const tp of topics) {
        const id = resolveSkillId(mt, tp);
        if (id !== undefined) {
          assert.ok(isValidSkill(id), `resolveSkillId(${mt}, "${tp}") = "${id}" KHÔNG hợp lệ trong taxonomy`);
        }
      }
    }
  });

  test('reading map theo dạng bài Cambridge', () => {
    assert.equal(resolveSkillId('reading', 'matching'), 'reading.matching');
    assert.equal(resolveSkillId('reading', 'gapped text'), 'reading.gapped_text');
    assert.equal(resolveSkillId('reading', 'open cloze'), 'reading.open_cloze');
    assert.equal(resolveSkillId('reading', 'detail long passage'), 'reading.detail_mcq');
    assert.equal(resolveSkillId('reading', 'notice'), 'reading.notice_mcq');
  });

  test('productive skills map đúng writing/speaking', () => {
    assert.equal(resolveSkillId('writing', 'email'), 'writing.email_100');
    assert.equal(resolveSkillId('writing', 'story pictures'), 'writing.story_pictures');
    assert.equal(resolveSkillId('writing', 'article'), 'writing.article_or_story');
    assert.equal(resolveSkillId('speaking', 'long turn photo'), 'speaking.long_turn');
    assert.equal(resolveSkillId('speaking', 'discussion'), 'speaking.discussion');
  });

  test('foundation skills map theo CEFR hint', () => {
    assert.equal(resolveSkillId('grammar', 'relative clause b1'), 'grammar.b1');
    assert.equal(resolveSkillId('grammar', 'present simple'), 'grammar.a2');
    assert.equal(resolveSkillId('vocabulary', 'pet topic'), 'vocabulary.b1');
    assert.equal(resolveSkillId('vocab', 'basic'), 'vocabulary.a2');
  });

  test('module lạ → undefined', () => {
    assert.equal(resolveSkillId('math', 'parabol'), undefined);
    assert.equal(resolveSkillId('desmos', 'graph'), undefined);
    assert.equal(resolveSkillId('unknown_module', 'topic'), undefined);
  });

  test('chuẩn hóa NFD → NFC và không phân biệt hoa thường', () => {
    const nfd = 'điền từ vựng'.normalize('NFD');
    assert.equal(resolveSkillId('reading', nfd), 'reading.cloze_vocab');
    assert.equal(resolveSkillId('writing', 'EMAIL'), 'writing.email_100');
  });
});
