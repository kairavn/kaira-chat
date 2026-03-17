import fs from 'fs';
import path from 'path';

interface SearchResult {
  title: string;
  href: string;
  description?: string;
}

/**
 * Extract title and description from MDX content
 * Looks for:
 * - First H1 heading (# Title) as title
 * - First paragraph as description
 */
function extractMetadata(content: string, href: string): SearchResult {
  // Extract title from first H1
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() ?? 'Untitled';

  // Extract description from first paragraph (not starting with # or special chars)
  const lines = content.split('\n');
  let description = '';

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines, headings, code blocks, and JSX
    if (
      trimmed &&
      !trimmed.startsWith('#') &&
      !trimmed.startsWith('```') &&
      !trimmed.startsWith('<') &&
      !trimmed.startsWith('import') &&
      !trimmed.startsWith('export')
    ) {
      // Get first sentence (up to first period or 150 chars)
      const sentence = trimmed.split(/[.!?]/)[0] ?? '';
      description = sentence.length > 150 ? sentence.slice(0, 150) + '...' : sentence;
      break;
    }
  }

  return { title, href, description };
}

/**
 * Generate search data from all MDX files in the app directory
 */
export function generateSearchData(): SearchResult[] {
  const appDir = path.join(process.cwd(), 'app');
  const results: SearchResult[] = [];

  // Root page
  const rootPagePath = path.join(appDir, 'page.mdx');
  if (fs.existsSync(rootPagePath)) {
    const content = fs.readFileSync(rootPagePath, 'utf-8');
    results.push(extractMetadata(content, '/'));
  }

  // Scan all subdirectories for page.mdx files
  const entries = fs.readdirSync(appDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const pagePath = path.join(appDir, entry.name, 'page.mdx');
      if (fs.existsSync(pagePath)) {
        const content = fs.readFileSync(pagePath, 'utf-8');
        const href = `/${entry.name}/`;
        results.push(extractMetadata(content, href));
      }
    }
  }

  return results;
}

// If run directly, output JSON
if (require.main === module) {
  const data = generateSearchData();
  console.log(JSON.stringify(data, null, 2));
}
