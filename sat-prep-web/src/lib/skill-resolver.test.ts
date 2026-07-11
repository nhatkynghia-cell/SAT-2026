import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSkillId } from './skill-resolver.ts';
import { isValidSkill } from './skill-taxonomy.ts';

describe('skill-resolver — resolveSkillId', () => {
  test('INVARIANT: mọi skillId trả về PHẢI hợp lệ trong taxonomy (chống typo/drift)', () => {
    // Quét rộng các topic đại diện mọi nhánh → id nào trả ra cũng phải tồn tại.
    const topics = [
      'hình học', 'lượng giác', 'đường tròn', 'thể tích khối', 'tam giác',
      'nâng cao', 'phương trình bậc hai', 'parabol đỉnh', 'hàm mũ', 'đa thức',
      'căn thức', 'số liệu thống kê', 'xác suất', 'phần trăm', 'tỉ lệ tốc độ',
      'hệ phương trình', 'bất phương trình', 'hàm số đồ thị', 'phương trình bậc nhất',
      'circle', 'volume', 'triangle', 'quadratic', 'exponential', 'polynomial',
      'radical', 'statistic', 'probability', 'percent', 'ratio', 'rate', 'system',
      'inequality', 'function', 'graph', '', 'chủ đề vu vơ không khớp',
    ];
    for (const mt of ['math', 'desmos', 'vocab', 'literature']) {
      for (const tp of topics) {
        const id = resolveSkillId(mt, tp);
        if (id !== undefined) {
          assert.ok(isValidSkill(id), `resolveSkillId(${mt}, "${tp}") = "${id}" KHÔNG hợp lệ trong taxonomy`);
        }
      }
    }
  });

  test('module reading/writing map cứng theo module', () => {
    assert.equal(resolveSkillId('vocab', 'bất kỳ'), 'rw.vocab');
    assert.equal(resolveSkillId('literature', 'bất kỳ'), 'rw.literature');
  });

  test('module lạ → undefined', () => {
    assert.equal(resolveSkillId('unknown_module', 'topic'), undefined);
    assert.equal(resolveSkillId('', 'topic'), undefined);
  });

  test('Geometry: từ khóa map đúng nhánh con', () => {
    assert.equal(resolveSkillId('math', 'lượng giác'), 'geo.trig');
    assert.equal(resolveSkillId('math', 'trig ratios'), 'geo.trig');
    assert.equal(resolveSkillId('math', 'đường tròn'), 'geo.circles');
    assert.equal(resolveSkillId('math', 'circle equation'), 'geo.circles');
    assert.equal(resolveSkillId('math', 'thể tích'), 'geo.volume');
    assert.equal(resolveSkillId('math', 'volume of cone'), 'geo.volume');
    assert.equal(resolveSkillId('math', 'tam giác đồng dạng'), 'geo.triangles');
  });

  test('Advanced Math: từ khóa map đúng nhánh con', () => {
    assert.equal(resolveSkillId('math', 'hàm mũ'), 'advanced.exponential');
    assert.equal(resolveSkillId('math', 'đa thức'), 'advanced.polynomials');
    assert.equal(resolveSkillId('math', 'căn thức'), 'advanced.radicals');
    assert.equal(resolveSkillId('math', 'phương trình bậc hai'), 'advanced.quadratic');
    assert.equal(resolveSkillId('math', 'parabol'), 'advanced.quadratic');
  });

  test('Data Analysis: từ khóa map đúng nhánh con', () => {
    assert.equal(resolveSkillId('math', 'xác suất'), 'data.probability');
    assert.equal(resolveSkillId('math', 'phần trăm'), 'data.percentages');
    assert.equal(resolveSkillId('math', 'tỉ lệ'), 'data.ratios');
    assert.equal(resolveSkillId('math', 'thống kê'), 'data.statistics');
  });

  test('Heart of Algebra: nhánh mặc định + từ khóa', () => {
    assert.equal(resolveSkillId('math', 'hệ phương trình'), 'algebra.systems');
    assert.equal(resolveSkillId('math', 'bất phương trình'), 'algebra.inequalities');
    assert.equal(resolveSkillId('math', 'hàm số'), 'algebra.linear_fn');
    // Toán không khớp từ khóa nào → mặc định algebra.linear_eq (không undefined).
    assert.equal(resolveSkillId('math', 'chủ đề vu vơ'), 'algebra.linear_eq');
  });

  test('desmos cũng quy về skill Toán như math', () => {
    assert.equal(resolveSkillId('desmos', 'parabol'), 'advanced.quadratic');
    assert.equal(resolveSkillId('desmos', 'vu vơ'), 'algebra.linear_eq');
  });

  test('chuẩn hóa NFD → NFC: dấu tổ hợp vẫn match', () => {
    // "lượng giác" ở dạng NFD (dấu tách rời) phải cho cùng kết quả NFC.
    const nfd = 'lượng giác'.normalize('NFD');
    assert.equal(resolveSkillId('math', nfd), 'geo.trig');
  });

  test('không phân biệt hoa thường', () => {
    assert.equal(resolveSkillId('math', 'PARABOL'), 'advanced.quadratic');
    assert.equal(resolveSkillId('math', 'Circle'), 'geo.circles');
  });
});
