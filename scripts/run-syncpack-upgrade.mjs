import { execFileSync } from 'node:child_process';
import process from 'node:process';

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

function escapeRegexPattern(pattern) {
  return pattern.replaceAll(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function createDependencyMatcher(pattern) {
  const regexPattern = `^${escapeRegexPattern(pattern).replaceAll('*', '.*')}$`;

  return new RegExp(regexPattern);
}

function parseSemver(version) {
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

function isEligibleUpdate(currentVersion, candidateVersion, target) {
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

function getTarget(rawArguments) {
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

function normalizeArguments(rawArguments) {
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

function run(command, args) {
  execFileSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
}

function getDependencyFilters(syncpackArguments) {
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

function getManagedOutdatedEntries(syncpackArguments) {
  const dependencyMatchers = getDependencyFilters(syncpackArguments).map(createDependencyMatcher);
  const targetIndex = syncpackArguments.indexOf('--target');
  const target = targetIndex === -1 ? 'minor' : syncpackArguments[targetIndex + 1];

  let stdout = '';

  try {
    stdout = execFileSync('pnpm', ['outdated', '-r', '--format', 'json'], {
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

  const parsed = stdout.trim();

  if (!parsed) {
    return [];
  }

  const entries = Object.entries(JSON.parse(parsed));

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
        !('wanted' in metadata)
      ) {
        return null;
      }

      const currentVersion = metadata.current;
      const wantedVersion = metadata.wanted;

      if (typeof currentVersion !== 'string' || typeof wantedVersion !== 'string') {
        return null;
      }

      if (!isEligibleUpdate(currentVersion, wantedVersion, target)) {
        return null;
      }

      return {
        dependencyName,
        currentVersion,
        wantedVersion,
      };
    })
    .filter((entry) => entry !== null);
}

function printOutdatedEntries(entries, target) {
  if (entries.length === 0) {
    console.log(`✓ No eligible ${target} updates found for managed dependencies.`);
    return;
  }

  console.log(`Eligible ${target} updates for managed dependencies:`);

  for (const entry of entries) {
    console.log(`- ${entry.dependencyName}: ${entry.currentVersion} -> ${entry.wantedVersion}`);
  }
}

function buildPackageSpecs(entries) {
  return entries.map((entry) => `${entry.dependencyName}@^${entry.wantedVersion}`);
}

function main() {
  const rawArguments = process.argv.slice(2);
  const syncpackArguments = normalizeArguments(rawArguments);
  const targetIndex = syncpackArguments.indexOf('--target');
  const target = targetIndex === -1 ? 'minor' : syncpackArguments[targetIndex + 1];

  if (rawArguments.includes('--check')) {
    const outdatedEntries = getManagedOutdatedEntries(syncpackArguments);

    printOutdatedEntries(outdatedEntries, target);
    return;
  }

  const outdatedEntries = getManagedOutdatedEntries(syncpackArguments);

  if (rawArguments.includes('--dry-run')) {
    printOutdatedEntries(outdatedEntries, target);
    return;
  }

  if (outdatedEntries.length === 0) {
    console.log(`✓ No eligible ${target} updates found for managed dependencies.`);
    return;
  }

  run('pnpm', ['up', '-r', ...buildPackageSpecs(outdatedEntries)]);
  run('pnpm', ['deps:fix']);
  run('pnpm', ['install']);
  run('pnpm', ['validate']);
}

main();
