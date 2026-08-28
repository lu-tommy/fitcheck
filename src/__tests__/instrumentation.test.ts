import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Next only reads `src/instrumentation.ts` when the project uses a `src`
 * directory — a copy at the repository root is silently ignored, and the
 * reminder loop simply never starts. Nothing errors, nothing logs, and the
 * daily reminder just does not arrive. This is the cheapest possible guard
 * against that happening again.
 */
describe('server start-up hook', () => {
  const root = path.resolve(import.meta.dirname, '../..');

  it('lives where Next will actually look for it', () => {
    expect(existsSync(path.join(root, 'src/instrumentation.ts'))).toBe(true);
  });

  it('has no stray copy at the repository root', () => {
    expect(existsSync(path.join(root, 'instrumentation.ts'))).toBe(false);
  });
});
