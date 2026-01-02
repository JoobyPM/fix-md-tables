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
// Emoji regex covering common ranges:
// - Miscellaneous Symbols and Pictographs, Emoticons (1F300-1F9FF)
// - Miscellaneous Symbols (2600-26FF) - ⚠️, ☀️, etc.
// - Dingbats (2700-27BF) - ✅, ✏️, etc.
// - Watch/Hourglass (231A-23FA) - ⌚, ⏰, etc.
// - Stars (2B50-2B55) - ⭐, 🔴, etc.
// - Letterlike Symbols (2100-214F) - ℹ️, ™️, etc.
export const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{231A}-\u{23FA}]|[\u{2B50}-\u{2B55}]|[\u{2100}-\u{214F}]/gu;
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

/** Separator cells must remain valid markdown (only dashes, colons, spaces) - no compensation */
export function compensateSeparatorCell(cell) {
  // Separator rows should not be modified - ideographic spaces break markdown table syntax
  return cell;
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

  // Preferred: remove 2 spaces per ideographic (maintains visual width proportionally)
  const spacesToRemove = compensation * 2;

  if (trailingSpace.length >= spacesToRemove) {
    // Enough room for proportional removal
    const newTrailingSpace = trailingSpace.slice(spacesToRemove);
    return leadingSpace + content + IDEOGRAPHIC_SPACE.repeat(compensation) + newTrailingSpace;
  } else if (trailingSpace.length >= compensation) {
    // Partial room - remove all trailing, add full compensation
    // This makes the cell shorter but maintains visual alignment
    return leadingSpace + content + IDEOGRAPHIC_SPACE.repeat(compensation);
  } else {
    // Not enough trailing space for meaningful compensation - skip
    // Adding ideographic spaces without removing equivalent regular spaces
    // would make the cell disproportionately wider
    return cell;
  }
}

/**
 * Calculate compensation needed for a cell based on emoji count.
 *
 * Formula: base + (max - cell), where base = min(2, max - 1)
 * - Even cells with max emoji get base compensation for visual consistency
 * - Base is capped at 2 to avoid excessive compensation in high-emoji columns
 * - For 0-emoji cells in high-emoji columns (max > 2), cap total at max - 1
 *   to prevent over-compensation that would make the cell too wide
 */
export function calculateCompensation(maxEmoji, cellEmoji) {
  if (maxEmoji === 0) {
    return 0;
  }

  const base = Math.min(2, maxEmoji - 1);
  let compensation = base + maxEmoji - cellEmoji;

  // For 0-emoji cells with max > 2: cap at max - 1
  if (cellEmoji === 0 && maxEmoji > 2) {
    compensation = Math.min(compensation, maxEmoji - 1);
  }

  return Math.max(0, compensation);
}

/** Process a single cell, applying emoji compensation */
export function processCell(cell, col, isSeparatorRow, maxEmojiPerCol) {
  const maxEmoji = maxEmojiPerCol[col] || 0;
  const cellEmoji = countEmoji(cell);

  const compensation = calculateCompensation(maxEmoji, cellEmoji);

  if (compensation <= 0) {
    return cell;
  }

  // Skip separator rows - they must remain valid markdown (only dashes, colons, spaces)
  if (isSeparatorRow) {
    return cell;
  }

  return compensateRegularCell(cell, compensation);
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

      const neededCompensation = calculateCompensation(maxEmoji, cellEmoji);

      // Skip if no compensation needed or already adequate
      if (neededCompensation <= 0 || existingCompensation >= neededCompensation) {
        return originalCell;
      }

      // Skip separator rows - they must remain valid markdown
      if (isSeparatorRow) {
        return cleanedCell;
      }

      // Need more compensation - use normalized cell (0 IS) and apply full neededCompensation
      return compensateRegularCell(cleanedCell, neededCompensation);
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
  const knownFlags = new Set(["--clean"]);
  const flags = args.filter((arg) => arg.startsWith("--"));
  const unknownFlags = flags.filter((flag) => !knownFlags.has(flag));
  if (unknownFlags.length > 0) {
    console.warn(`  ⚠ Unknown flags ignored: ${unknownFlags.join(", ")}`);
  }
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
