import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const braces = require('braces') as {
  (pattern: string): string;
  expand(pattern: string): string[];
};
const micromatch = require('micromatch') as {
  braceExpand(pattern: string): string[];
};

describe('vendored braces security patch', () => {
  it('rejects nested brace patterns beyond the guarded depth', () => {
    const hostilePattern = '{a,'.repeat(1_200) + 'b' + '}'.repeat(1_200);

    expect(hostilePattern.length).toBeLessThan(10_000);
    expect(() => braces(hostilePattern)).toThrow(/exceeds max depth/);
    expect(() => micromatch.braceExpand(hostilePattern)).toThrow(
      /exceeds max depth/
    );
  });

  it('rejects deeply nested parenthesis patterns', () => {
    const hostilePattern = '('.repeat(101) + 'a' + ')'.repeat(101);

    expect(() => braces(hostilePattern)).toThrow(/exceeds max depth/);
  });

  it('preserves ordinary brace expansion behavior', () => {
    expect(braces.expand('src/{api,domain}/{index,test}.ts')).toEqual([
      'src/api/index.ts',
      'src/api/test.ts',
      'src/domain/index.ts',
      'src/domain/test.ts'
    ]);
  });
});
