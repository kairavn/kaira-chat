import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const MANAGED_DEPENDENCIES = [
  '@types/node',
  '@types/react',
  '@types/react-dom',
  'babel-plugin-react-compiler',
  'eslint',
  'next',
  'react',
  'react-dom',
  'typescript',
  'vitest',
];

const OPTION_FLAGS_WITH_VALUE = new Set([
  '--config',
  '--dependencies',
  '--dependency-types',
  '--log-levels',
  '--show',
  '--sort',
  '--source',
  '--specifier-types',
  '--target',
]);

export function escapeRegexPattern(pattern) {
  return pattern.replaceAll(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

export function createDependencyMatcher(pattern) {
  const regexPattern = `^${escapeRegexPattern(pattern).replaceAll('*', '.*')}$`;

  return new RegExp(regexPattern);
}

export function parseSemver(version) {
  const match = version.match(/(\d+)\.(\d+)\.(\d+)/);

  if (!match) {
    return null;
  }

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  };
}

export function isEligibleUpdate(currentVersion, candidateVersion, target) {
  const current = parseSemver(currentVersion);
  const candidate = parseSemver(candidateVersion);

  if (!current || !candidate) {
    return false;
  }

  if (current.major !== candidate.major) {
    return false;
  }

  if (target === 'patch') {
    return current.minor === candidate.minor && candidate.patch > current.patch;
  }

  return (
    candidate.minor > current.minor ||
    (candidate.minor === current.minor && candidate.patch > current.patch)
  );
}

export function getTarget(rawArguments) {
  const targetIndex = rawArguments.indexOf('--target');

  if (targetIndex === -1) {
    return 'minor';
  }

  const target = rawArguments[targetIndex + 1];

  if (!target) {
    throw new Error('Missing value for option "--target".');
  }

  if (target !== 'minor' && target !== 'patch') {
    throw new Error(`Unsupported target "${target}". Use "--target minor" or "--target patch".`);
  }

  return target;
}

export function normalizeArguments(rawArguments) {
  const normalizedArguments = [];
  const target = getTarget(rawArguments);
  const collectedDependencies = [];
  let sawExplicitDependenciesFlag = false;

  normalizedArguments.push('--target', target);

  for (let index = 0; index < rawArguments.length; index += 1) {
    const argument = rawArguments[index];

    if (OPTION_FLAGS_WITH_VALUE.has(argument)) {
      const optionValue = rawArguments[index + 1];

      if (!optionValue) {
        throw new Error(`Missing value for option "${argument}".`);
      }

      if (argument === '--dependencies') {
        collectedDependencies.push(optionValue);
        sawExplicitDependenciesFlag = true;
      } else if (argument !== '--target') {
        normalizedArguments.push(argument, optionValue);
      }

      index += 1;
      continue;
    }

    if (argument.startsWith('-')) {
      normalizedArguments.push(argument);
      continue;
    }

    if (sawExplicitDependenciesFlag) {
      throw new Error(
        `Unexpected positional argument "${argument}" after "--dependencies". Pass all dependency filters via "--dependencies <pattern>".`,
      );
    }

    collectedDependencies.push(argument);
  }

  const dependenciesToUpdate =
    collectedDependencies.length > 0 ? collectedDependencies : MANAGED_DEPENDENCIES;

  for (const dependency of dependenciesToUpdate) {
    normalizedArguments.push('--dependencies', dependency);
  }

  return normalizedArguments;
}

export function run(command, args, commandRunner = execFileSync) {
  commandRunner(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
}

export function getDependencyFilters(syncpackArguments) {
  const filters = [];

  for (let index = 0; index < syncpackArguments.length; index += 1) {
    if (syncpackArguments[index] === '--dependencies') {
      const dependencyFilter = syncpackArguments[index + 1];

      if (dependencyFilter) {
        filters.push(dependencyFilter);
      }
    }
  }

  return filters;
}

export function parseOutdatedReport(stdout) {
  const parsed = stdout.trim();

  if (!parsed) {
    return {};
  }

  const report = JSON.parse(parsed);

  if (typeof report !== 'object' || report === null || Array.isArray(report)) {
    return {};
  }

  return report;
}

export function selectManagedOutdatedEntries(outdatedReport, syncpackArguments) {
  const dependencyMatchers = getDependencyFilters(syncpackArguments).map(createDependencyMatcher);
  const targetIndex = syncpackArguments.indexOf('--target');
  const target = targetIndex === -1 ? 'minor' : syncpackArguments[targetIndex + 1];
  const entries = Object.entries(outdatedReport);

  return entries
    .filter(([dependencyName]) =>
      dependencyMatchers.some((dependencyMatcher) => dependencyMatcher.test(dependencyName)),
    )
    .map(([dependencyName, dependencyMeta]) => {
      const metadata = dependencyMeta;

      if (
        typeof metadata !== 'object' ||
        metadata === null ||
        !('current' in metadata) ||
        !('latest' in metadata)
      ) {
        return null;
      }

      const currentVersion = metadata.current;
      const latestVersion = metadata.latest;

      if (typeof currentVersion !== 'string' || typeof latestVersion !== 'string') {
        return null;
      }

      if (!isEligibleUpdate(currentVersion, latestVersion, target)) {
        return null;
      }

      return {
        dependencyName,
        currentVersion,
        latestVersion,
      };
    })
    .filter((entry) => entry !== null);
}

export function getManagedOutdatedEntries(syncpackArguments, commandRunner = execFileSync) {
  let stdout = '';

  try {
    stdout = commandRunner('pnpm', ['outdated', '-r', '--format', 'json'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    if (!(error instanceof Error) || !('stdout' in error)) {
      throw error;
    }

    const errorStdout = error.stdout;

    if (typeof errorStdout !== 'string') {
      throw error;
    }

    stdout = errorStdout;
  }

  return selectManagedOutdatedEntries(parseOutdatedReport(stdout), syncpackArguments);
}

export function printOutdatedEntries(entries, target, logger = console.log) {
  if (entries.length === 0) {
    logger(`✓ No eligible ${target} updates found for managed dependencies.`);
    return;
  }

  logger(`Eligible ${target} updates for managed dependencies:`);

  for (const entry of entries) {
    logger(`- ${entry.dependencyName}: ${entry.currentVersion} -> ${entry.latestVersion}`);
  }
}

export function buildPackageSpecs(entries) {
  return entries.map((entry) => `${entry.dependencyName}@^${entry.latestVersion}`);
}

export function runManagedUpgrade(entries, commandRunner = execFileSync) {
  const packageSpecs = buildPackageSpecs(entries);

  run('pnpm', ['up', '-r', '--prod', ...packageSpecs], commandRunner);
  run('pnpm', ['up', '-r', '--dev', ...packageSpecs], commandRunner);
}

export function assertCleanGitWorktree(commandRunner = execFileSync) {
  const stdout = commandRunner('git', ['status', '--short', '--untracked-files=all'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (!stdout.trim()) {
    return;
  }

  throw new Error(
    [
      'Cannot run deps:upgrade with a dirty git worktree.',
      'Commit, stash, or discard local changes first.',
      stdout.trim(),
    ].join('\n'),
  );
}

export function main(
  rawArguments = process.argv.slice(2),
  commandRunner = execFileSync,
  logger = console.log,
) {
  const syncpackArguments = normalizeArguments(rawArguments);
  const targetIndex = syncpackArguments.indexOf('--target');
  const target = targetIndex === -1 ? 'minor' : syncpackArguments[targetIndex + 1];

  if (rawArguments.includes('--check')) {
    const outdatedEntries = getManagedOutdatedEntries(syncpackArguments, commandRunner);

    printOutdatedEntries(outdatedEntries, target, logger);
    return;
  }

  if (rawArguments.includes('--dry-run')) {
    const outdatedEntries = getManagedOutdatedEntries(syncpackArguments, commandRunner);

    printOutdatedEntries(outdatedEntries, target, logger);
    return;
  }

  assertCleanGitWorktree(commandRunner);

  const outdatedEntries = getManagedOutdatedEntries(syncpackArguments, commandRunner);

  if (outdatedEntries.length === 0) {
    logger(`✓ No eligible ${target} updates found for managed dependencies.`);
    return;
  }

  runManagedUpgrade(outdatedEntries, commandRunner);
  run('pnpm', ['deps:fix'], commandRunner);
  run('pnpm', ['install'], commandRunner);
  run('pnpm', ['validate'], commandRunner);
}

const isDirectExecution =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectExecution) {
  main();
}
