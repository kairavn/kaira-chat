import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export interface SearchResult {
  title: string;
  href: string;
  description?: string;
}

const DESCRIPTION_MAX_LENGTH = 160;

function stripMarkdown(value: string): string {
  return value
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isIgnoredLine(line: string): boolean {
  return (
    line.length === 0 ||
    line.startsWith('#') ||
    line.startsWith('```') ||
    line.startsWith('<') ||
    line.startsWith('import') ||
    line.startsWith('export')
  );
}

function normalizeDescriptionLine(line: string): string | null {
  if (line.startsWith('>')) {
    return null;
  }

  if (isIgnoredLine(line)) {
    return null;
  }

  const normalizedLine = line
    .replace(/^[-*]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .trim();

  return normalizedLine.length > 0 ? normalizedLine : null;
}

function isLowValueLeadIn(line: string): boolean {
  const normalizedLine = stripMarkdown(line);
  return normalizedLine.endsWith(':') && !/[.!?]$/.test(normalizedLine);
}

function truncateDescription(value: string): string {
  if (value.length <= DESCRIPTION_MAX_LENGTH) {
    return value;
  }

  const truncated = value.slice(0, DESCRIPTION_MAX_LENGTH);
  const boundaryIndex = truncated.lastIndexOf(' ');
  return `${(boundaryIndex > 0 ? truncated.slice(0, boundaryIndex) : truncated).trim()}...`;
}

function extractFirstParagraph(content: string): string {
  const lines = content.split('\n');
  const paragraphLines: string[] = [];
  let inCodeBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      continue;
    }

    if (paragraphLines.length > 0 && line.length === 0) {
      break;
    }

    if (line.length === 0) {
      continue;
    }

    const normalizedLine = normalizeDescriptionLine(line);
    if (!normalizedLine) {
      continue;
    }

    if (paragraphLines.length === 0 && isLowValueLeadIn(normalizedLine)) {
      continue;
    }

    paragraphLines.push(normalizedLine);
  }

  return truncateDescription(stripMarkdown(paragraphLines.join(' ')));
}

/**
 * Extract title and description from MDX content.
 */
export function extractMetadata(content: string, href: string): SearchResult {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() ?? 'Untitled';
  const description = extractFirstParagraph(content);

  return {
    title,
    href,
    ...(description ? { description } : {}),
  };
}

/**
 * Generate search data from all MDX files in the docs app directory.
 */
export function generateSearchData(
  appDir: string = path.join(process.cwd(), 'app'),
): SearchResult[] {
  const results: SearchResult[] = [];

  const rootPagePath = path.join(appDir, 'page.mdx');
  if (fs.existsSync(rootPagePath)) {
    const content = fs.readFileSync(rootPagePath, 'utf-8');
    results.push(extractMetadata(content, '/'));
  }

  const entries = fs.readdirSync(appDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const pagePath = path.join(appDir, entry.name, 'page.mdx');
    if (!fs.existsSync(pagePath)) {
      continue;
    }

    const content = fs.readFileSync(pagePath, 'utf-8');
    results.push(extractMetadata(content, `/${entry.name}/`));
  }

  return results.sort((left, right) => left.href.localeCompare(right.href));
}

function isDirectExecution(): boolean {
  const currentFile = fileURLToPath(import.meta.url);
  const entryFile = process.argv[1];
  return typeof entryFile === 'string' && path.resolve(entryFile) === currentFile;
}

if (isDirectExecution()) {
  console.log(JSON.stringify(generateSearchData(), null, 2));
}
