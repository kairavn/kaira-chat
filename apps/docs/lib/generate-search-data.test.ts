import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { generateSearchData } from './generate-search-data';
import { SEARCH_DATA } from './search-data';

const currentDir = fileURLToPath(new URL('.', import.meta.url));
const docsAppDir = resolve(currentDir, '../app');

describe('docs search data', () => {
  it('includes the critical top-level routes', () => {
    const generated = generateSearchData(docsAppDir);
    const hrefs = generated.map((entry) => entry.href);

    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/',
        '/architecture/',
        '/core-api/',
        '/events/',
        '/quick-start/',
        '/transport/',
        '/ui/',
      ]),
    );
    expect(hrefs).toEqual([...hrefs].sort((left, right) => left.localeCompare(right)));
  });

  it('skips low-value lead-ins when deriving descriptions', () => {
    const generated = generateSearchData(docsAppDir);
    const examplesEntry = generated.find((entry) => entry.href === '/examples/');

    expect(examplesEntry?.description?.startsWith('Server route layer owns DitTransport')).toBe(
      true,
    );
    expect(examplesEntry?.description).not.toBe('Recommended pattern in this repo:');
  });

  it('matches the committed search artifact', () => {
    const generated = generateSearchData(docsAppDir);

    expect(generated).toEqual(SEARCH_DATA);
  });
});
