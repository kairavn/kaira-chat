import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const statusSourcePath = path.join(repoRoot, 'docs/internal/feature-status.json');
const implementationStatusPath = path.join(repoRoot, 'docs/internal/IMPLEMENTATION_STATUS.md');
const featureMatrixPath = path.join(repoRoot, 'docs/internal/FEATURE_MATRIX.md');

const mode = process.argv[2] ?? 'sync';
const supportedModes = new Set(['sync', 'check']);

if (!supportedModes.has(mode)) {
  console.error(`Unsupported mode "${mode}". Use "sync" or "check".`);
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveRepoPath(relativePath) {
  return path.join(repoRoot, relativePath);
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function isDocOnlyEvidence(evidencePath) {
  const normalized = toPosixPath(evidencePath);
  return (
    normalized.endsWith('/README.md') ||
    normalized === 'README.md' ||
    normalized.endsWith('.md') ||
    normalized.endsWith('.mdx')
  );
}

function mdEscape(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function boolLabel(value) {
  return value ? 'yes' : 'no';
}

function validateStatusData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('feature-status.json must be an object.');
  }

  const { meta, entries } = data;
  if (!meta || typeof meta !== 'object') {
    throw new Error('feature-status.json is missing a valid meta section.');
  }

  if (!Array.isArray(meta.maintainabilityRules) || meta.maintainabilityRules.length === 0) {
    throw new Error('meta.maintainabilityRules must be a non-empty array.');
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('feature-status.json must contain at least one entry.');
  }

  const allowedStatuses = new Set(Object.keys(meta.statusVocabulary));
  const allowedSurfaceTypes = new Set(Object.keys(meta.surfaceTypes));
  const allowedBackingTypes = new Set(Object.keys(meta.backingTypes));
  const seenIds = new Set();

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      throw new Error('Each entry must be an object.');
    }

    const requiredStringFields = [
      'id',
      'category',
      'feature',
      'surfaceType',
      'ownerArea',
      'status',
      'backing',
      'notes',
    ];

    for (const field of requiredStringFields) {
      if (typeof entry[field] !== 'string' || entry[field].trim().length === 0) {
        throw new Error(`Entry is missing required non-empty string field "${field}".`);
      }
    }

    if (seenIds.has(entry.id)) {
      throw new Error(`Duplicate entry id "${entry.id}".`);
    }
    seenIds.add(entry.id);

    if (typeof entry.publicSurface !== 'boolean') {
      throw new Error(`Entry "${entry.id}" must define publicSurface as a boolean.`);
    }

    if (typeof entry.roadmapCandidate !== 'boolean') {
      throw new Error(`Entry "${entry.id}" must define roadmapCandidate as a boolean.`);
    }

    if (!allowedStatuses.has(entry.status)) {
      throw new Error(`Entry "${entry.id}" uses unsupported status "${entry.status}".`);
    }

    if (!allowedSurfaceTypes.has(entry.surfaceType)) {
      throw new Error(`Entry "${entry.id}" uses unsupported surfaceType "${entry.surfaceType}".`);
    }

    if (!allowedBackingTypes.has(entry.backing)) {
      throw new Error(`Entry "${entry.id}" uses unsupported backing "${entry.backing}".`);
    }

    if (
      !Array.isArray(entry.evidence) ||
      entry.evidence.length === 0 ||
      entry.evidence.length > 3
    ) {
      throw new Error(`Entry "${entry.id}" must cite one to three evidence paths.`);
    }

    if (entry.evidence.some((value) => typeof value !== 'string' || value.trim().length === 0)) {
      throw new Error(`Entry "${entry.id}" contains an invalid evidence path.`);
    }

    for (const evidencePath of entry.evidence) {
      const absolutePath = resolveRepoPath(evidencePath);
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Entry "${entry.id}" references missing evidence path "${evidencePath}".`);
      }

      if (!fs.statSync(absolutePath).isFile()) {
        throw new Error(
          `Entry "${entry.id}" must reference file-backed evidence, not "${evidencePath}".`,
        );
      }
    }

    const hasSourceBackedEvidence = entry.evidence.some(
      (evidencePath) => !isDocOnlyEvidence(evidencePath),
    );
    if (!hasSourceBackedEvidence) {
      throw new Error(
        `Entry "${entry.id}" must not rely only on docs or README files as evidence.`,
      );
    }

    if (
      (entry.status === 'partial' || entry.status === 'missing') &&
      entry.notes.trim().length < 20
    ) {
      throw new Error(
        `Entry "${entry.id}" must explain the concrete gap for ${entry.status} status.`,
      );
    }
  }
}

function groupEntries(entries) {
  const orderedCategories = [];
  const categoryMap = new Map();

  for (const entry of entries) {
    if (!categoryMap.has(entry.category)) {
      categoryMap.set(entry.category, []);
      orderedCategories.push(entry.category);
    }
    categoryMap.get(entry.category).push(entry);
  }

  return orderedCategories.map((category) => ({
    category,
    entries: categoryMap.get(category),
  }));
}

function renderImplementationStatus(data) {
  const grouped = groupEntries(data.entries);
  const lines = [
    '# Implementation Status',
    '',
    '> Generated from `docs/internal/feature-status.json` by `scripts/render-feature-status.mjs`. Do not edit this file by hand.',
    '',
    'This is the canonical human-readable status view for the repo. Use source code, config, tests, and workflow files as primary evidence when updating the JSON inventory.',
    '',
    '## Status vocabulary',
    '',
  ];

  for (const [status, description] of Object.entries(data.meta.statusVocabulary)) {
    lines.push(`- \`${status}\`: ${description}`);
  }

  lines.push('', '## Maintainability rules', '');

  for (const rule of data.meta.maintainabilityRules) {
    lines.push(`- ${rule}`);
  }

  for (const group of grouped) {
    lines.push('', `## ${group.category}`, '');
    lines.push(
      '| Feature | Surface Type | Owner Area | Public Surface | Status | Backing | Evidence | Known Gaps / Notes | Roadmap Candidate |',
    );
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');

    for (const entry of group.entries) {
      const evidence = entry.evidence.map((value) => `\`${value}\``).join('<br>');
      lines.push(
        `| ${mdEscape(entry.feature)} | \`${entry.surfaceType}\` | ${mdEscape(entry.ownerArea)} | ${boolLabel(
          entry.publicSurface,
        )} | \`${entry.status}\` | \`${entry.backing}\` | ${evidence} | ${mdEscape(
          entry.notes,
        )} | ${boolLabel(entry.roadmapCandidate)} |`,
      );
    }
  }

  lines.push(
    '',
    'See also:',
    '',
    '- [README.md](./README.md)',
    '- [AGENT_GUIDE.md](./AGENT_GUIDE.md)',
    '- [ARCHITECTURE_INTERNAL.md](./ARCHITECTURE_INTERNAL.md)',
    '- [ENGINEERING_WORKFLOW.md](./ENGINEERING_WORKFLOW.md)',
    '- [DECISIONS_AND_CONSTRAINTS.md](./DECISIONS_AND_CONSTRAINTS.md)',
    '',
  );

  return `${lines.join('\n')}\n`;
}

function renderFeatureMatrix(data) {
  const lines = [
    '# Feature Matrix',
    '',
    '> Generated from `docs/internal/feature-status.json` by `scripts/render-feature-status.mjs`. Do not edit this file by hand.',
    '',
    'Quick-scan summary for planning and safe edits. For full evidence and notes, use [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md).',
    '',
    '| Feature | Status | Surface Type | Public Surface | Owner Area | Backing | Canonical Details |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const entry of data.entries) {
    lines.push(
      `| ${mdEscape(entry.feature)} | \`${entry.status}\` | \`${entry.surfaceType}\` | ${boolLabel(
        entry.publicSurface,
      )} | ${mdEscape(entry.ownerArea)} | \`${entry.backing}\` | ${mdEscape(entry.notes)} |`,
    );
  }

  lines.push('', 'Status source of truth: [`feature-status.json`](./feature-status.json)', '');

  return `${lines.join('\n')}\n`;
}

function writeOrCheck(filePath, nextContent) {
  if (mode === 'sync') {
    fs.writeFileSync(filePath, nextContent, 'utf8');
    return;
  }

  const currentContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  if (currentContent !== nextContent) {
    console.error(`${path.relative(repoRoot, filePath)} is out of sync with feature-status.json.`);
    process.exitCode = 1;
  }
}

const data = readJson(statusSourcePath);
validateStatusData(data);

writeOrCheck(implementationStatusPath, renderImplementationStatus(data));
writeOrCheck(featureMatrixPath, renderFeatureMatrix(data));

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}
