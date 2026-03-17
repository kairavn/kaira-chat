import type { Options as RehypePrettyCodeOptions } from 'rehype-pretty-code';

/**
 * Shiki configuration for syntax highlighting
 * Supports both light and dark themes
 */
export const shikiConfig: RehypePrettyCodeOptions = {
  // Use github themes for good contrast in both modes
  theme: {
    dark: 'github-dark-dimmed',
    light: 'github-light',
  },
  // Disable Shiki backgrounds - CSS handles them
  keepBackground: false,
  // Enable grid for line numbers support
  grid: true,
  // Custom filter for meta strings (line highlighting, etc.)
  filterMetaString: (meta: string) => {
    // Remove line highlighting notation from meta (e.g., {1,3-5})
    return meta.replace(/\{[^}]*\}/g, '');
  },
  // Callback for customizing code blocks
  onVisitLine(node) {
    // Ensure each line is a block element for proper layout
    if (node.children.length === 0) {
      node.children = [{ type: 'text', value: ' ' }];
    }
  },
  // Callback for highlighted lines
  onVisitHighlightedLine(node) {
    // Add a class to highlighted lines
    if (!node.properties) node.properties = {};
    const classes = (node.properties.className || []) as string[];
    node.properties.className = [...classes, 'line-highlighted'];
  },
  // Callback for highlighted characters
  onVisitHighlightedChars(node) {
    // Add a class to highlighted characters
    if (!node.properties) node.properties = {};
    const classes = (node.properties.className || []) as string[];
    node.properties.className = [...classes, 'chars-highlighted'];
  },
};

/**
 * Parse line highlighting meta from code block
 * Supports: {1,3-5,7}
 */
export function parseHighlightLines(meta: string): number[] {
  const match = meta.match(/\{([^}]+)\}/);
  if (!match || !match[1]) return [];

  const ranges = match[1].split(',');
  const lines: number[] = [];

  for (const range of ranges) {
    if (range.includes('-')) {
      const parts = range.split('-').map(Number);
      const start = parts[0] ?? 0;
      const end = parts[1] ?? start;
      for (let i = start; i <= end; i++) {
        lines.push(i);
      }
    } else {
      lines.push(Number(range));
    }
  }

  return lines;
}
