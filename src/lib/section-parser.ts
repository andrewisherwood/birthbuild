/**
 * Section parser — pure functions for operating on checkpoint HTML.
 *
 * Parses, extracts, reorders, removes, and replaces HTML sections
 * using the <!-- bb-section:name --> markers.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedSection {
  name: string;
  html: string;
  startIndex: number;
  endIndex: number;
}

// ---------------------------------------------------------------------------
// Regex
// ---------------------------------------------------------------------------

/**
 * Matches opening and closing section markers:
 *   <!-- bb-section:hero --> ... <!-- /bb-section:hero -->
 *
 * Capture groups:
 *   1: section name
 *   2: inner content (including the content between markers)
 */
const SECTION_RE =
  /<!-- bb-section:(\w[\w-]*) -->([\s\S]*?)<!-- \/bb-section:\1 -->/g;

// ---------------------------------------------------------------------------
// Parse all sections
// ---------------------------------------------------------------------------

/**
 * Parse all sections from an HTML string.
 * Returns sections in document order.
 */
export function parseSections(html: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  let match: RegExpExecArray | null;

  // Reset lastIndex since we reuse the regex
  SECTION_RE.lastIndex = 0;

  while ((match = SECTION_RE.exec(html)) !== null) {
    sections.push({
      name: match[1]!,
      html: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Extract single section
// ---------------------------------------------------------------------------

/**
 * Extract a single section by name.
 * Returns null if the section doesn't exist.
 */
export function extractSection(html: string, name: string): ParsedSection | null {
  const sections = parseSections(html);
  return sections.find((s) => s.name === name) ?? null;
}

// ---------------------------------------------------------------------------
// Reorder sections
// ---------------------------------------------------------------------------

/**
 * Reorder sections within <main>. Sections not in newOrder are appended
 * at the end in their original order.
 *
 * Non-section content (between/before/after sections) is preserved.
 */
export function reorderSections(html: string, newOrder: string[]): string {
  const sections = parseSections(html);
  if (sections.length === 0) return html;

  // Find the range that contains all sections (within <main>)
  const firstSection = sections[0]!;
  const lastSection = sections[sections.length - 1]!;

  const before = html.slice(0, firstSection.startIndex);
  const after = html.slice(lastSection.endIndex);

  // Build a map for quick lookup
  const sectionMap = new Map<string, ParsedSection>();
  for (const section of sections) {
    sectionMap.set(section.name, section);
  }

  // Ordered sections first
  const orderedParts: string[] = [];
  const placed = new Set<string>();

  for (const name of newOrder) {
    const section = sectionMap.get(name);
    if (section) {
      orderedParts.push(section.html);
      placed.add(name);
    }
  }

  // Append any sections not in the new order
  for (const section of sections) {
    if (!placed.has(section.name)) {
      orderedParts.push(section.html);
    }
  }

  return before + orderedParts.join("\n") + after;
}

// ---------------------------------------------------------------------------
// Remove section
// ---------------------------------------------------------------------------

/**
 * Remove a section by name. Returns the HTML without that section.
 */
export function removeSection(html: string, name: string): string {
  const section = extractSection(html, name);
  if (!section) return html;

  return html.slice(0, section.startIndex) + html.slice(section.endIndex);
}

// ---------------------------------------------------------------------------
// Replace section
// ---------------------------------------------------------------------------

/**
 * Replace a section's content with new HTML. The new HTML should include
 * the section markers.
 */
export function replaceSection(html: string, name: string, newSectionHtml: string): string {
  const section = extractSection(html, name);
  if (!section) return html;

  return html.slice(0, section.startIndex) + newSectionHtml + html.slice(section.endIndex);
}

/**
 * Replace only the inner content of a section, preserving markers.
 */
export function replaceSectionContent(html: string, name: string, newContent: string): string {
  const wrappedHtml = `<!-- bb-section:${name} -->${newContent}<!-- /bb-section:${name} -->`;
  return replaceSection(html, name, wrappedHtml);
}

// ---------------------------------------------------------------------------
// Section names extraction
// ---------------------------------------------------------------------------

/**
 * Get an ordered list of section names from an HTML string.
 */
export function getSectionNames(html: string): string[] {
  return parseSections(html).map((s) => s.name);
}
