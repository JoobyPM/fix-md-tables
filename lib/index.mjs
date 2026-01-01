/**
 * Fix markdown/MDX table alignment for emoji by adding ideographic spaces (U+3000).
 *
 * Problem: Emoji display as 2 columns but count as 1 char. Prettier aligns by
 * char count, so headers (no emoji) appear shorter than data rows (with emoji).
 *
 * Solution: Add ideographic spaces (U+3000, also 2 cols wide) to cells with
 * fewer emoji to compensate. 1 ideographic space = 1 emoji worth of width.
 *
 * Compatible with Node.js and Bun. Supports both .md and .mdx files.
 */

import fs from "node:fs";
import path from "node:path";

// === Constants ===

export const IDEOGRAPHIC_SPACE = "\u3000"; // Displays as 2 columns, like emoji
export const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{231A}-\u{23FA}]|[\u{2B50}-\u{2B55}]/gu;
export const SEPARATOR_REGEX = /^(\s*)(:*)(-+)(:*)(\s*)$/;
export const TABLE_SEPARATOR_LINE_REGEX = /^\s*\|[\s:|\-\u3000]+\|\s*$/;
export const MARKDOWN_EXTENSIONS = [".md", ".mdx"];

// === Pure Helper Functions ===

/** Count emoji characters in a string */
export function countEmoji(str) {
  return (str.match(EMOJI_REGEX) || []).length;
}

/** Remove all ideographic spaces from a string */
export function stripIdeographicSpaces(str) {
  return str.replaceAll("\u3000", "");
}

/** Check if a line is a markdown table separator */
export function isTableSeparatorLine(line) {
  return TABLE_SEPARATOR_LINE_REGEX.test(line);
}

/** Check if a line is a table row (starts and ends with |) */
export function isTableRow(line) {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|");
}

/** Parse a table row into cells (preserving internal spacing) */
export function parseTableRow(row) {
  const trimmed = row.trim();
  const inner = trimmed.slice(1, -1); // Remove outer |
  return inner.split("|");
}

/** Calculate max emoji count per column from data rows */
export function calculateMaxEmojiPerColumn(parsedRows, numCols) {
  const maxEmojiPerCol = new Array(numCols).fill(0);

  // Skip header (row 0) and separator (row 1), only look at data rows
  for (let rowIdx = 2; rowIdx < parsedRows.length; rowIdx++) {
    const row = parsedRows[rowIdx];
    for (let col = 0; col < row.length; col++) {
      const emojiCount = countEmoji(row[col] || "");
      maxEmojiPerCol[col] = Math.max(maxEmojiPerCol[col], emojiCount);
    }
  }

  return maxEmojiPerCol;
}

/** Compensate a separator cell by removing dashes and adding ideographic spaces */
export function compensateSeparatorCell(cell, compensation) {
  const match = cell.match(SEPARATOR_REGEX);
  if (!match) {
    return cell;
  }

  const [, leadingSpace, leftColon, dashes, rightColon, trailingSpace] = match;
  // Remove 2 dashes per ideographic space (both are 2 cols visually)
  const dashesToRemove = compensation * 2;
  const newDashes = dashes.length > dashesToRemove ? dashes.slice(0, -dashesToRemove) : dashes;

  return leadingSpace + leftColon + newDashes + IDEOGRAPHIC_SPACE.repeat(compensation) + rightColon + trailingSpace;
}

/** Split cell into [leadingSpace, content, trailingSpace] without regex (ReDoS-safe) */
export function splitCellContent(cell) {
  let leadingEnd = 0;
  while (leadingEnd < cell.length && /\s/.test(cell[leadingEnd])) {
    leadingEnd++;
  }

  let trailingStart = cell.length;
  while (trailingStart > leadingEnd && /\s/.test(cell[trailingStart - 1])) {
    trailingStart--;
  }

  return [cell.slice(0, leadingEnd), cell.slice(leadingEnd, trailingStart), cell.slice(trailingStart)];
}

/** Compensate a regular cell by adding ideographic spaces before trailing whitespace */
export function compensateRegularCell(cell, compensation) {
  const [leadingSpace, content, trailingSpace] = splitCellContent(cell);
  return leadingSpace + content + IDEOGRAPHIC_SPACE.repeat(compensation) + trailingSpace;
}

/** Process a single cell, applying emoji compensation */
export function processCell(cell, col, isSeparatorRow, maxEmojiPerCol) {
  const maxEmoji = maxEmojiPerCol[col] || 0;
  const cellEmoji = countEmoji(cell);
  const compensation = maxEmoji - cellEmoji;

  if (compensation <= 0) {
    return cell;
  }

  return isSeparatorRow ? compensateSeparatorCell(cell, compensation) : compensateRegularCell(cell, compensation);
}

/** Build a table row string from cells */
export function buildTableRow(cells) {
  return "|" + cells.join("|") + "|";
}

/** Process a complete table, applying emoji compensation to all rows */
export function processTable(tableRows) {
  // Strip existing ideographic spaces to start fresh
  const cleanedRows = tableRows.map(stripIdeographicSpaces);
  const parsedRows = cleanedRows.map(parseTableRow);

  // Check if table has any emoji
  const hasEmoji = cleanedRows.some((row) => countEmoji(row) > 0);
  if (!hasEmoji || parsedRows.length < 2) {
    return cleanedRows;
  }

  const numCols = Math.max(...parsedRows.map((r) => r.length));
  const maxEmojiPerCol = calculateMaxEmojiPerColumn(parsedRows, numCols);

  // Rebuild all rows with compensation
  return parsedRows.map((row, rowIdx) => {
    const isSeparatorRow = rowIdx === 1;
    const processedCells = row.map((cell, col) => processCell(cell, col, isSeparatorRow, maxEmojiPerCol));
    return buildTableRow(processedCells);
  });
}

/** Main function to fix table alignment in markdown content */
export function fixTableAlignment(content) {
  const lines = content.split("\n");
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Detect table start: line with | followed by separator line
    if (line.includes("|") && i + 1 < lines.length && isTableSeparatorLine(lines[i + 1])) {
      const tableRows = [];

      // Collect all table rows
      while (i < lines.length && isTableRow(lines[i])) {
        tableRows.push(lines[i]);
        i++;
      }

      result.push(...processTable(tableRows));
    } else {
      result.push(line);
      i++;
    }
  }

  return result.join("\n");
}

// === File System Functions ===

/** Check if a filename has a markdown extension */
export function isMarkdownFile(filename) {
  return MARKDOWN_EXTENSIONS.some((ext) => filename.endsWith(ext));
}

/** Recursively find all markdown/MDX files in a directory */
export function findMarkdownFiles(dir, files = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files; // Directory not readable, skip silently
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
      findMarkdownFiles(fullPath, files);
    } else if (entry.isFile() && isMarkdownFile(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

/** Get default files to process (root .md/.mdx files + docs directory) */
export function getDefaultFiles(cwd) {
  const files = [];

  // Root markdown/MDX files
  let rootEntries;
  try {
    rootEntries = fs.readdirSync(cwd, { withFileTypes: true });
  } catch {
    return files; // Can't read cwd, return empty
  }

  for (const entry of rootEntries) {
    if (entry.isFile() && isMarkdownFile(entry.name)) {
      files.push(path.join(cwd, entry.name));
    }
  }

  // Docs directory
  const docsDir = path.join(cwd, "docs");
  if (fs.existsSync(docsDir)) {
    findMarkdownFiles(docsDir, files);
  }

  return files;
}

/** Process a single file, applying table alignment fixes */
export function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const fixed = fixTableAlignment(content);

    if (content !== fixed) {
      fs.writeFileSync(filePath, fixed, "utf8");
      console.log(`  ✓ Fixed: ${filePath}`);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`  ✗ Error processing ${filePath}: ${err.message}`);
    return false;
  }
}

/** Main CLI runner */
export function run(args = []) {
  const files = args.length > 0 ? args : getDefaultFiles(process.cwd());

  console.log(`  Processing ${files.length} markdown/MDX file(s)...`);

  let fixedCount = 0;
  for (const file of files) {
    if (processFile(file)) {
      fixedCount++;
    }
  }

  if (fixedCount > 0) {
    console.log(`  Fixed ${fixedCount} file(s) with ideographic space compensation.`);
  }

  return fixedCount;
}
