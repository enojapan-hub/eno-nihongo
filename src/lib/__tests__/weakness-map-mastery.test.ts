import { describe, expect, it } from 'vitest';
import { analyzeMastery } from '@/lib/mastery-analysis';

describe('weakness map mastery dimensions', () => {
  it('keeps the same aspect separate across materials', () => {
    const stats = analyzeMastery([
      { item_type: 'kanji', rating: 3, aspect: 'meaning', used_hint: false, response_ms: 3000 },
      { item_type: 'vocabulary', rating: 0, aspect: 'meaning', used_hint: true, response_ms: 12000 },
    ]);
    expect(stats).toHaveLength(2);
    expect(stats.map(x => x.label)).toContain('Kanji · Arti');
    expect(stats.map(x => x.label)).toContain('Kotoba · Arti');
    expect(stats[0].label).toBe('Kotoba · Arti');
  });

  it('keeps kanji meaning and reading as independent mastery', () => {
    const stats = analyzeMastery([
      { item_type: 'kanji', rating: 3, aspect: 'meaning', used_hint: false, response_ms: 2500 },
      { item_type: 'kanji', rating: 1, aspect: 'reading', used_hint: false, response_ms: 4000 },
    ]);
    expect(stats.find(x => x.aspect === 'meaning')?.mastery).toBe(100);
    expect(stats.find(x => x.aspect === 'reading')?.mastery).toBe(0);
  });
});
