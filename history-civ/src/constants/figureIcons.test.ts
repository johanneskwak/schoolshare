import { describe, expect, it } from 'vitest';
import { FIGURE_ICONS, iconPrompt } from './figureIcons';
import { PERSONS } from '../lib/chronicle';

describe('위인 아이콘 테이블', () => {
  it('연대기 위인 전원과 후원 인물(가리발디·이달고·볼리바르)에 아이콘이 있다', () => {
    for (const p of PERSONS) expect(FIGURE_ICONS[p.id], p.id).toBeDefined();
    for (const id of ['garibaldi', 'hidalgo', 'bolivar']) expect(FIGURE_ICONS[id]).toBeDefined();
  });
  it('요청된 인물이 모두 포함되고 프롬프트 템플릿이 채워진다', () => {
    const names = Object.values(FIGURE_ICONS).map((f) => f.name);
    for (const n of ['George Washington', 'Otto von Bismarck', 'The Beatles', 'Marie Curie', 'Simón Bolívar']) expect(names).toContain(n);
    expect(iconPrompt('James Watt')).toContain('copperplate engraving portrait icon of James Watt');
    expect(Object.values(FIGURE_ICONS).every((f) => f.src.startsWith('/portraits/'))).toBe(true);
  });
});
