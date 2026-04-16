import { describe, expect, it, vi } from 'vitest';

import {
  assertCleanGitWorktree,
  buildPackageSpecs,
  getManagedOutdatedEntries,
  main,
  normalizeArguments,
  runManagedUpgrade,
  selectManagedOutdatedEntries,
} from './run-syncpack-upgrade.mjs';

function createOutdatedStdout() {
  return JSON.stringify({
    next: {
      current: '16.2.3',
      latest: '16.2.4',
      wanted: '16.2.3',
    },
    eslint: {
      current: '9.39.4',
      latest: '10.2.0',
      wanted: '9.39.4',
    },
    vitest: {
      current: '3.2.4',
      latest: '3.2.5',
      wanted: '3.2.4',
    },
    typescript: {
      current: '5.9.3',
      latest: '6.0.2',
      wanted: '5.9.3',
    },
    react: {
      current: '19.2.5',
      latest: '20.0.0',
      wanted: '19.2.5',
    },
    '@types/node': {
      current: '22.19.17',
      latest: '22.20.0',
      wanted: '22.19.17',
    },
    malformed: {
      current: 'workspace:*',
      latest: 'workspace:*',
      wanted: 'workspace:*',
    },
  });
}

describe('run-syncpack-upgrade', () => {
  it('selects curated same-major updates from latest even when wanted stays current', () => {
    const entries = selectManagedOutdatedEntries(
      JSON.parse(createOutdatedStdout()),
      normalizeArguments([]),
    );

    expect(entries).toEqual([
      {
        dependencyName: 'next',
        currentVersion: '16.2.3',
        latestVersion: '16.2.4',
      },
      {
        dependencyName: 'vitest',
        currentVersion: '3.2.4',
        latestVersion: '3.2.5',
      },
      {
        dependencyName: '@types/node',
        currentVersion: '22.19.17',
        latestVersion: '22.20.0',
      },
    ]);
  });

  it('supports patch-only targeting for curated dependencies', () => {
    const entries = selectManagedOutdatedEntries(
      JSON.parse(createOutdatedStdout()),
      normalizeArguments(['--target', 'patch']),
    );

    expect(entries).toEqual([
      {
        dependencyName: 'next',
        currentVersion: '16.2.3',
        latestVersion: '16.2.4',
      },
      {
        dependencyName: 'vitest',
        currentVersion: '3.2.4',
        latestVersion: '3.2.5',
      },
    ]);
  });

  it('ignores malformed and non-curated entries', () => {
    const entries = selectManagedOutdatedEntries(
      {
        malformed: {
          current: 'workspace:*',
          latest: 'workspace:*',
        },
        'lucide-react': {
          current: '0.577.0',
          latest: '1.8.0',
        },
      },
      normalizeArguments([]),
    );

    expect(entries).toEqual([]);
  });

  it('reads outdated JSON from pnpm stdout when pnpm exits with status 1', () => {
    const commandRunner = vi.fn().mockImplementation((command) => {
      if (command !== 'pnpm') {
        throw new Error(`Unexpected command: ${command}`);
      }

      const error = new Error('outdated dependencies');
      error.stdout = createOutdatedStdout();
      throw error;
    });

    const entries = getManagedOutdatedEntries(normalizeArguments([]), commandRunner);

    expect(entries).toEqual([
      {
        dependencyName: 'next',
        currentVersion: '16.2.3',
        latestVersion: '16.2.4',
      },
      {
        dependencyName: 'vitest',
        currentVersion: '3.2.4',
        latestVersion: '3.2.5',
      },
      {
        dependencyName: '@types/node',
        currentVersion: '22.19.17',
        latestVersion: '22.20.0',
      },
    ]);
  });

  it('formats package specs with caret ranges for upgrades', () => {
    expect(
      buildPackageSpecs([
        {
          dependencyName: 'next',
          currentVersion: '16.2.3',
          latestVersion: '16.2.4',
        },
      ]),
    ).toEqual(['next@^16.2.4']);
  });

  it('updates prod and dev dependencies without targeting peer dependencies', () => {
    const commandRunner = vi.fn();

    runManagedUpgrade(
      [
        {
          dependencyName: 'next',
          currentVersion: '16.2.3',
          latestVersion: '16.2.4',
        },
        {
          dependencyName: 'react',
          currentVersion: '19.2.5',
          latestVersion: '19.2.6',
        },
      ],
      commandRunner,
    );

    expect(commandRunner.mock.calls).toEqual([
      [
        'pnpm',
        ['up', '-r', '--prod', 'next@^16.2.4', 'react@^19.2.6'],
        expect.objectContaining({
          cwd: expect.any(String),
          stdio: 'inherit',
        }),
      ],
      [
        'pnpm',
        ['up', '-r', '--dev', 'next@^16.2.4', 'react@^19.2.6'],
        expect.objectContaining({
          cwd: expect.any(String),
          stdio: 'inherit',
        }),
      ],
    ]);
  });

  it('fails upgrade before mutation on a dirty git worktree', () => {
    const commandRunner = vi.fn().mockImplementation((command) => {
      if (command === 'git') {
        return ' M package.json\n';
      }

      throw new Error(`Unexpected command: ${command}`);
    });

    expect(() => main([], commandRunner, vi.fn())).toThrow(
      /Cannot run deps:upgrade with a dirty git worktree\./,
    );
    expect(commandRunner).toHaveBeenCalledTimes(1);
  });

  it('allows a clean git worktree', () => {
    const commandRunner = vi.fn().mockReturnValue('');

    expect(() => assertCleanGitWorktree(commandRunner)).not.toThrow();
    expect(commandRunner).toHaveBeenCalledWith(
      'git',
      ['status', '--short', '--untracked-files=all'],
      expect.objectContaining({
        cwd: expect.any(String),
        encoding: 'utf8',
      }),
    );
  });

  it('uses the same selection for check and dry-run output without mutating files', () => {
    const logger = vi.fn();
    const commandRunner = vi.fn().mockImplementation((command, args) => {
      if (command === 'pnpm' && args[0] === 'outdated') {
        return createOutdatedStdout();
      }

      throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
    });

    main(['--check'], commandRunner, logger);
    main(['--dry-run'], commandRunner, logger);

    expect(logger.mock.calls).toEqual([
      ['Eligible minor updates for managed dependencies:'],
      ['- next: 16.2.3 -> 16.2.4'],
      ['- vitest: 3.2.4 -> 3.2.5'],
      ['- @types/node: 22.19.17 -> 22.20.0'],
      ['Eligible minor updates for managed dependencies:'],
      ['- next: 16.2.3 -> 16.2.4'],
      ['- vitest: 3.2.4 -> 3.2.5'],
      ['- @types/node: 22.19.17 -> 22.20.0'],
    ]);
    expect(commandRunner).toHaveBeenCalledTimes(2);
  });

  it('runs split prod/dev upgrade commands before fix/install/validate', () => {
    const logger = vi.fn();
    const commandRunner = vi.fn().mockImplementation((command, args) => {
      if (command === 'git') {
        return '';
      }

      if (command === 'pnpm' && args[0] === 'outdated') {
        return createOutdatedStdout();
      }

      return '';
    });

    main([], commandRunner, logger);

    expect(commandRunner.mock.calls).toEqual([
      [
        'git',
        ['status', '--short', '--untracked-files=all'],
        expect.objectContaining({
          cwd: expect.any(String),
          encoding: 'utf8',
        }),
      ],
      [
        'pnpm',
        ['outdated', '-r', '--format', 'json'],
        expect.objectContaining({
          cwd: expect.any(String),
          encoding: 'utf8',
        }),
      ],
      [
        'pnpm',
        ['up', '-r', '--prod', 'next@^16.2.4', 'vitest@^3.2.5', '@types/node@^22.20.0'],
        expect.objectContaining({
          cwd: expect.any(String),
          stdio: 'inherit',
        }),
      ],
      [
        'pnpm',
        ['up', '-r', '--dev', 'next@^16.2.4', 'vitest@^3.2.5', '@types/node@^22.20.0'],
        expect.objectContaining({
          cwd: expect.any(String),
          stdio: 'inherit',
        }),
      ],
      [
        'pnpm',
        ['deps:fix'],
        expect.objectContaining({
          cwd: expect.any(String),
          stdio: 'inherit',
        }),
      ],
      [
        'pnpm',
        ['install'],
        expect.objectContaining({
          cwd: expect.any(String),
          stdio: 'inherit',
        }),
      ],
      [
        'pnpm',
        ['validate'],
        expect.objectContaining({
          cwd: expect.any(String),
          stdio: 'inherit',
        }),
      ],
    ]);
    expect(logger).not.toHaveBeenCalled();
  });
});
