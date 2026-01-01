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

/** Replace all ideographic spaces with 2 regular spaces (same visual width) */
export function normalizeIdeographicSpaces(str) {
  return str.replaceAll("\u3000", "  ");
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
  // Also remove trailing spaces to maintain column width
  const spacesToRemove = compensation * 2;
  const newTrailingSpace = trailingSpace.length > spacesToRemove ? trailingSpace.slice(spacesToRemove) : "";

  return leadingSpace + leftColon + newDashes + IDEOGRAPHIC_SPACE.repeat(compensation) + rightColon + newTrailingSpace;
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

/** Compensate a regular cell by adding ideographic spaces and removing equivalent regular spaces */
export function compensateRegularCell(cell, compensation) {
  const [leadingSpace, content, trailingSpace] = splitCellContent(cell);
  // Remove 2 regular spaces per ideographic space (both are 2 cols visually)
  const spacesToRemove = compensation * 2;
  const newTrailingSpace = trailingSpace.length > spacesToRemove ? trailingSpace.slice(spacesToRemove) : "";
  return leadingSpace + content + IDEOGRAPHIC_SPACE.repeat(compensation) + newTrailingSpace;
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

/** Count ideographic spaces in a string */
export function countIdeographicSpaces(str) {
  return (str.match(/\u3000/g) || []).length;
}

/** Process a complete table, applying emoji compensation to all rows */
export function processTable(tableRows) {
  // Parse original rows to count existing ideographic spaces
  const originalParsedRows = tableRows.map(parseTableRow);

  // Normalize for emoji counting (but we'll use original cells when adequate)
  const cleanedRows = tableRows.map(normalizeIdeographicSpaces);
  const cleanedParsedRows = cleanedRows.map(parseTableRow);

  // Check if table has any emoji
  const hasEmoji = cleanedRows.some((row) => countEmoji(row) > 0);
  if (!hasEmoji || cleanedParsedRows.length < 2) {
    return cleanedRows;
  }

  const numCols = Math.max(...cleanedParsedRows.map((r) => r.length));
  const maxEmojiPerCol = calculateMaxEmojiPerColumn(cleanedParsedRows, numCols);

  // Rebuild all rows with compensation
  return originalParsedRows.map((originalRow, rowIdx) => {
    const cleanedRow = cleanedParsedRows[rowIdx];
    const isSeparatorRow = rowIdx === 1;

    const processedCells = originalRow.map((originalCell, col) => {
      const cleanedCell = cleanedRow[col];
      const existingCompensation = countIdeographicSpaces(originalCell);
      const maxEmoji = maxEmojiPerCol[col] || 0;
      const cellEmoji = countEmoji(cleanedCell);
      const neededCompensation = maxEmoji - cellEmoji;

      // If existing compensation is adequate, keep original cell
      if (existingCompensation >= neededCompensation) {
        return originalCell;
      }

      // Need more compensation - use normalized cell and add what's needed
      const additionalCompensation = neededCompensation - existingCompensation;
      return isSeparatorRow ? compensateSeparatorCell(cleanedCell, additionalCompensation) : compensateRegularCell(cleanedCell, additionalCompensation);
    });

    return buildTableRow(processedCells);
  });
}

/** Check if a line starts a fenced code block */
function isCodeFenceStart(line) {
  const trimmed = line.trim();
  return trimmed.startsWith("```") || trimmed.startsWith("~~~");
}

/** Check if a line ends a fenced code block */
function isCodeFenceEnd(line, fence) {
  const trimmed = line.trim();
  return trimmed === fence || trimmed.startsWith(fence);
}

/** Handle code fence state transitions, returns updated state */
function handleCodeFence(line, inCodeBlock, codeFence) {
  if (!inCodeBlock && isCodeFenceStart(line)) {
    const match = line.trim().match(/^(`{3,}|~{3,})/);
    return { inCodeBlock: true, codeFence: match ? match[1] : "```" };
  }
  if (inCodeBlock && isCodeFenceEnd(line, codeFence)) {
    return { inCodeBlock: false, codeFence: "" };
  }
  return { inCodeBlock, codeFence };
}

/** Traverse markdown content and process tables with a callback */
function traverseMarkdownTables(content, tableProcessor) {
  const lines = content.split("\n");
  const result = [];
  let i = 0;
  let inCodeBlock = false;
  let codeFence = "";

  while (i < lines.length) {
    const line = lines[i];
    const prevInCodeBlock = inCodeBlock;
    ({ inCodeBlock, codeFence } = handleCodeFence(line, inCodeBlock, codeFence));

    // If entering or inside code block, just push the line
    if (inCodeBlock || prevInCodeBlock) {
      result.push(line);
      i++;
      continue;
    }

    // Detect table start: line with | followed by separator line
    if (line.includes("|") && i + 1 < lines.length && isTableSeparatorLine(lines[i + 1])) {
      const tableRows = [];
      while (i < lines.length && isTableRow(lines[i])) {
        tableRows.push(lines[i]);
        i++;
      }
      result.push(...tableProcessor(tableRows));
    } else {
      result.push(line);
      i++;
    }
  }

  return result.join("\n");
}

/** Main function to fix table alignment in markdown content */
export function fixTableAlignment(content) {
  return traverseMarkdownTables(content, processTable);
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

/** Clean table by normalizing ideographic spaces to regular spaces */
function cleanTable(tableRows) {
  return tableRows.map(normalizeIdeographicSpaces);
}

/** Clean table alignment by removing ideographic spaces (run before Prettier) */
export function cleanTableAlignment(content) {
  return traverseMarkdownTables(content, cleanTable);
}

/** Process a single file, applying table alignment fixes */
export function processFile(filePath, cleanMode = false) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const processed = cleanMode ? cleanTableAlignment(content) : fixTableAlignment(content);

    if (content !== processed) {
      fs.writeFileSync(filePath, processed, "utf8");
      console.log(`  ✓ ${cleanMode ? "Cleaned" : "Fixed"}: ${filePath}`);
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
  // Parse flags
  const cleanMode = args.includes("--clean");
  const fileArgs = args.filter((arg) => !arg.startsWith("--"));

  const files = fileArgs.length > 0 ? fileArgs : getDefaultFiles(process.cwd());

  const modeLabel = cleanMode ? "Cleaning" : "Processing";
  console.log(`  ${modeLabel} ${files.length} markdown/MDX file(s)...`);

  let processedCount = 0;
  for (const file of files) {
    if (processFile(file, cleanMode)) {
      processedCount++;
    }
  }

  if (processedCount > 0) {
    const action = cleanMode ? "Cleaned ideographic spaces from" : "Fixed";
    console.log(`  ${action} ${processedCount} file(s).`);
  }

  return processedCount;
}
