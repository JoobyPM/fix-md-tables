import { describe, it, expect } from "vitest";
import {
  IDEOGRAPHIC_SPACE,
  countEmoji,
  normalizeIdeographicSpaces,
  isTableSeparatorLine,
  isTableRow,
  parseTableRow,
  calculateMaxEmojiPerColumn,
  compensateSeparatorCell,
  splitCellContent,
  compensateRegularCell,
  processCell,
  buildTableRow,
  processTable,
  fixTableAlignment,
  cleanTableAlignment,
  isMarkdownFile,
} from "../lib/index.mjs";

describe("countEmoji", () => {
  it("counts emoji in a string", () => {
    expect(countEmoji("Hello 🌟 World")).toBe(1);
    expect(countEmoji("🎉🎊🎁")).toBe(3);
    expect(countEmoji("No emoji here")).toBe(0);
  });

  it("counts various emoji ranges", () => {
    expect(countEmoji("☀️")).toBe(1); // U+2600-U+26FF
    expect(countEmoji("✂️")).toBe(1); // U+2700-U+27BF
    expect(countEmoji("⌚")).toBe(1); // U+231A-U+23FA
    expect(countEmoji("⭐")).toBe(1); // U+2B50-U+2B55
  });
});

describe("normalizeIdeographicSpaces", () => {
  it("replaces ideographic spaces with 2 regular spaces", () => {
    expect(normalizeIdeographicSpaces(`Hello${IDEOGRAPHIC_SPACE}World`)).toBe("Hello  World");
    expect(normalizeIdeographicSpaces(`${IDEOGRAPHIC_SPACE}${IDEOGRAPHIC_SPACE}`)).toBe("    ");
  });

  it("leaves regular spaces intact", () => {
    expect(normalizeIdeographicSpaces("Hello World")).toBe("Hello World");
  });
});

describe("isTableSeparatorLine", () => {
  it("detects valid separator lines", () => {
    expect(isTableSeparatorLine("| --- | --- |")).toBe(true);
    expect(isTableSeparatorLine("|---|---|")).toBe(true);
    expect(isTableSeparatorLine("| :--- | ---: |")).toBe(true);
    expect(isTableSeparatorLine("| :---: | :---: |")).toBe(true);
  });

  it("rejects non-separator lines", () => {
    expect(isTableSeparatorLine("| Header | Header |")).toBe(false);
    expect(isTableSeparatorLine("Not a table")).toBe(false);
  });
});

describe("isTableRow", () => {
  it("detects table rows", () => {
    expect(isTableRow("| Cell | Cell |")).toBe(true);
    expect(isTableRow("|Cell|Cell|")).toBe(true);
    expect(isTableRow("  | Cell | Cell |  ")).toBe(true);
  });

  it("rejects non-table rows", () => {
    expect(isTableRow("No pipes here")).toBe(false);
    expect(isTableRow("| Only start pipe")).toBe(false);
    expect(isTableRow("Only end pipe |")).toBe(false);
  });
});

describe("parseTableRow", () => {
  it("splits row into cells", () => {
    expect(parseTableRow("| A | B | C |")).toEqual([" A ", " B ", " C "]);
    expect(parseTableRow("|A|B|C|")).toEqual(["A", "B", "C"]);
  });

  it("preserves internal spacing", () => {
    expect(parseTableRow("|  Padded  |Normal|")).toEqual(["  Padded  ", "Normal"]);
  });
});

describe("calculateMaxEmojiPerColumn", () => {
  it("calculates max emoji per column from data rows only", () => {
    const parsedRows = [
      [" Header ", " Header "], // Row 0: header
      [" --- ", " --- "], // Row 1: separator
      [" 🌟 ", " No emoji "], // Row 2: data
      [" 🎉🎊 ", " 🌟 "], // Row 3: data
    ];
    expect(calculateMaxEmojiPerColumn(parsedRows, 2)).toEqual([2, 1]);
  });

  it("returns zeros for tables without emoji", () => {
    const parsedRows = [
      [" Header ", " Header "],
      [" --- ", " --- "],
      [" Text ", " Text "],
    ];
    expect(calculateMaxEmojiPerColumn(parsedRows, 2)).toEqual([0, 0]);
  });
});

describe("compensateSeparatorCell", () => {
  it("removes dashes, trailing spaces and adds ideographic spaces", () => {
    const result = compensateSeparatorCell(" -------     ", 2);
    expect(result).toBe(` ---${IDEOGRAPHIC_SPACE}${IDEOGRAPHIC_SPACE} `);
  });

  it("preserves alignment colons", () => {
    const result = compensateSeparatorCell(" :-----:   ", 1);
    expect(result).toBe(` :---${IDEOGRAPHIC_SPACE}: `);
  });

  it("returns cell unchanged if not a separator", () => {
    expect(compensateSeparatorCell(" Text ", 1)).toBe(" Text ");
  });
});

describe("splitCellContent", () => {
  it("splits into leading space, content, trailing space", () => {
    expect(splitCellContent("  Hello  ")).toEqual(["  ", "Hello", "  "]);
    expect(splitCellContent("NoSpaces")).toEqual(["", "NoSpaces", ""]);
    expect(splitCellContent("   ")).toEqual(["   ", "", ""]);
  });
});

describe("compensateRegularCell", () => {
  it("adds ideographic spaces and removes equivalent trailing spaces", () => {
    // 5 trailing spaces, compensation=2, needs 4 spaces, leaves 1
    const result = compensateRegularCell(" Text     ", 2);
    expect(result).toBe(` Text${IDEOGRAPHIC_SPACE}${IDEOGRAPHIC_SPACE} `);
  });

  it("caps compensation to available trailing spaces", () => {
    // Only 1 trailing space = floor(1/2) = 0 ideographic spaces possible
    const result = compensateRegularCell(" Text ", 2);
    expect(result).toBe(" Text ");
  });

  it("removes all trailing and adds full compensation when not enough room", () => {
    // 3 trailing spaces < compensation*2=4, so remove all and add full compensation
    const result = compensateRegularCell(" Text   ", 2);
    expect(result).toBe(` Text${IDEOGRAPHIC_SPACE}${IDEOGRAPHIC_SPACE}`);
  });
});

describe("processCell", () => {
  it("compensates cells with fewer emoji than max", () => {
    const maxEmojiPerCol = [2, 1];
    // Formula: base=min(2, max-1)=1, comp=1+2-0=3
    // 5 trailing spaces < 3*2=6, so remove all and add 3 ideographic
    const result = processCell(" Text     ", 0, false, maxEmojiPerCol);
    expect(result).toBe(` Text${IDEOGRAPHIC_SPACE}${IDEOGRAPHIC_SPACE}${IDEOGRAPHIC_SPACE}`);
  });

  it("leaves cells with max emoji unchanged", () => {
    const maxEmojiPerCol = [2, 1];
    const result = processCell(" 🌟🎉 ", 0, false, maxEmojiPerCol);
    expect(result).toBe(" 🌟🎉 ");
  });

  it("handles separator rows differently", () => {
    const maxEmojiPerCol = [1];
    const result = processCell(" ---   ", 0, true, maxEmojiPerCol);
    expect(result).toBe(` -${IDEOGRAPHIC_SPACE} `);
  });
});

describe("buildTableRow", () => {
  it("joins cells with pipes", () => {
    expect(buildTableRow([" A ", " B ", " C "])).toBe("| A | B | C |");
  });
});

describe("processTable", () => {
  it("processes a table with emoji", () => {
    // Each cell has enough trailing spaces for compensation
    const tableRows = ["| Header   | Header |", "| ---   | --- |", "| 🌟 | Text |"];
    const result = processTable(tableRows);

    // Col 0: max emoji=1, header needs 1 compensation, 3 trailing spaces → 1 ideographic
    expect(result[0]).toBe(`| Header${IDEOGRAPHIC_SPACE} | Header |`);
    expect(result[1]).toBe(`| -${IDEOGRAPHIC_SPACE} | --- |`);
    expect(result[2]).toBe("| 🌟 | Text |");
  });

  it("leaves tables without emoji unchanged", () => {
    const tableRows = ["| Header | Header |", "| --- | --- |", "| Text | Text |"];
    const result = processTable(tableRows);
    expect(result).toEqual(tableRows);
  });

  it("normalizes existing ideographic spaces before processing", () => {
    const tableRows = [`| Header${IDEOGRAPHIC_SPACE} | Header |`, "| --- | --- |", "| 🌟 | Text |"];
    const result = processTable(tableRows);

    // Should be re-processed cleanly (after normalizing to 2 spaces, then re-compensating)
    expect(result[0]).toBe(`| Header${IDEOGRAPHIC_SPACE} | Header |`);
  });
});

describe("fixTableAlignment", () => {
  it("processes tables in markdown content", () => {
    const content = `# Title

| Status | Description |
| ------ | ----------- |
| 🌟     | Star        |

Some text after.`;

    const result = fixTableAlignment(content);

    expect(result).toContain("# Title");
    expect(result).toContain("Some text after.");
    expect(result).toContain(IDEOGRAPHIC_SPACE);
  });

  it("handles multiple tables", () => {
    const content = `| A | B |
| - | - |
| 🌟 | X |

| C | D |
| - | - |
| 🎉 | Y |`;

    const result = fixTableAlignment(content);
    const ideographicCount = (result.match(/\u3000/g) || []).length;
    expect(ideographicCount).toBeGreaterThan(0);
  });

  it("preserves non-table content", () => {
    const content = `# Title

Regular paragraph.

- List item
- Another item

\`\`\`code
const x = 1;
\`\`\``;

    const result = fixTableAlignment(content);
    expect(result).toBe(content);
  });

  it("handles tables without emoji", () => {
    const content = `| A | B |
| - | - |
| X | Y |`;

    const result = fixTableAlignment(content);
    expect(result).toBe(content);
  });

  it("skips tables inside fenced code blocks", () => {
    const content = `# Example

\`\`\`markdown
| Status | Description |
| ------ | ----------- |
| ✅     | Complete    |
\`\`\`

Some text.`;

    const result = fixTableAlignment(content);
    // Should NOT add ideographic spaces to table inside code block
    expect(result).toBe(content);
  });

  it("skips tables inside tilde code blocks", () => {
    const content = `~~~md
| A | B |
| - | - |
| 🌟 | X |
~~~`;

    const result = fixTableAlignment(content);
    expect(result).toBe(content);
  });

  it("processes tables after code blocks", () => {
    const content = `\`\`\`
code
\`\`\`

| A | B |
| - | - |
| 🌟 | X |`;

    const result = fixTableAlignment(content);
    // Table after code block should be processed
    expect(result).toContain(IDEOGRAPHIC_SPACE);
  });
});

describe("isMarkdownFile", () => {
  it("detects markdown files", () => {
    expect(isMarkdownFile("README.md")).toBe(true);
    expect(isMarkdownFile("docs/page.mdx")).toBe(true);
    expect(isMarkdownFile("file.MD")).toBe(false); // case sensitive
  });

  it("rejects non-markdown files", () => {
    expect(isMarkdownFile("script.js")).toBe(false);
    expect(isMarkdownFile("data.json")).toBe(false);
  });
});

describe("cleanTableAlignment", () => {
  it("removes ideographic spaces from tables", () => {
    const input = `| Header${IDEOGRAPHIC_SPACE}| Header |
| ---${IDEOGRAPHIC_SPACE}| --- |
| 🌟 | Text |`;

    const result = cleanTableAlignment(input);
    expect(result).not.toContain(IDEOGRAPHIC_SPACE);
    // 1 ideographic space replaced with 2 regular spaces
    expect(result).toContain("| Header  | Header |");
  });

  it("skips tables inside code blocks", () => {
    const input = `\`\`\`
| Header${IDEOGRAPHIC_SPACE} |
\`\`\``;

    const result = cleanTableAlignment(input);
    // Should preserve ideographic space inside code block
    expect(result).toContain(IDEOGRAPHIC_SPACE);
  });

  it("preserves non-table content", () => {
    const input = `# Title

Some paragraph with ${IDEOGRAPHIC_SPACE} space.`;

    const result = cleanTableAlignment(input);
    // Non-table ideographic spaces are preserved
    expect(result).toBe(input);
  });
});

describe("integration: real-world table", () => {
  it("fixes a typical emoji status table", () => {
    // Header cell "Status  " has 2 trailing spaces → floor(2/2) = 1 ideographic space possible
    const input = `| Status  | Meaning     |
| ------  | ----------- |
| ✅      | Complete    |
| 🚧      | In Progress |
| ❌      | Failed      |`;

    const result = fixTableAlignment(input);
    const lines = result.split("\n");

    // Header should have compensation (1 ideographic space in Status column)
    expect(lines[0]).toContain(IDEOGRAPHIC_SPACE);

    // Data rows with emoji should NOT have compensation
    expect(lines[2]).toBe("| ✅      | Complete    |");
    expect(lines[3]).toBe("| 🚧      | In Progress |");
    expect(lines[4]).toBe("| ❌      | Failed      |");
  });

  it("handles table with varying emoji counts per column", () => {
    // Formula: compensation = base + (max - cell), base = min(2, max-1)
    // For 0-emoji cells with max>2: cap at max-1
    const input = `| Col1   | Col2        |
| ------ | ----------- |
| ✅     | Text        |
| Text   | 🔴 🟡 🟢    |`;

    const result = fixTableAlignment(input);
    const lines = result.split("\n");

    // Col1: max=1, base=0, header(0): 0+1-0=1
    // Col2: max=3, base=2, header(0): 2+3-0=5, cap at 2 (0-emoji, max>2)
    // Total: 1 + 2 = 3
    expect(countIdeographicSpaces(lines[0])).toBe(3);

    // Data row 1: Col1 has ✅ (base=0, 0+1-1=0), Col2 has 0 emoji (2+3-0=5, cap at 2)
    expect(countIdeographicSpaces(lines[2])).toBe(2);

    // Data row 2: Col1 has 0 emoji (0+1-0=1), Col2 has 🔴🟡🟢 (2+3-3=2)
    expect(countIdeographicSpaces(lines[3])).toBe(3); // 1 + 2
  });

  it("row with max emoji gets zero compensation", () => {
    // The row with the MOST emoji in a column gets 0 ideographic spaces for that column
    const input = `| Status   | Icons       |
| -------- | ----------- |
| ✅ Done  | 🔴 🟡 🟢 🔵 ⚪ |
| Pending  | 🔴          |`;

    const result = fixTableAlignment(input);
    const lines = result.split("\n");

    // Row with max emoji (5) in Icons column should have 0 compensation for that column
    // But Status column still needs compensation (max=1, row has 0)
    const maxEmojiRow = lines[2]; // "| ✅ Done  | 🔴 🟡 🟢 🔵 ⚪ |"

    // Count ideographic spaces - should only be for Status column compensation
    // Status: max=1, this row has 1 → 0 compensation
    // Icons: max=5, this row has 5 → 0 compensation
    expect(countIdeographicSpaces(maxEmojiRow)).toBe(0);
  });

  it("fixes table with mixed emoji count in different rows and columns", () => {
    const input = `| Macro               | Status        | Conversion                                    |
| ------------------- | ------------- | --------------------------------------------- |
| **"info"**          | ✅ Supported  | Blockquote with ℹ️ Info prefix                |
| **"warning"**       | ✅ Supported  | Blockquote with ⚠️ Warning prefix             |
| **"note"**          | ✅ Supported  | Blockquote with 📝 Note prefix                |
| **"tip"**           | ✅ Supported  | Blockquote with 💡 Tip prefix                 |
| **"code"**          | ✅ Supported  | Markdown code blocks with syntax highlighting |
| **"mermaid-cloud"** | ✅ Supported  | Mermaid code blocks                           |
| **"expand"**        | ✅ Supported  | Content extracted and rendered directly       |
| **"details"**       | ✅ Supported  | Content extracted and rendered directly       |
| **"status"**        | ✅ Supported  | Emoji badges (🔴 🟡 🟢 🔵 ⚪)                 |
| **"toc"**           | ⚠️ Partial    | "<!-- Table of Contents -->" comment          |
| **"children"**      | ⚠️ Partial    | "<!-- Child Pages -->" comment                |
| **Other macros**    | 📋 On request | "<!-- Unsupported macro: {name} -->" comments |`;

    /* eslint-disable no-irregular-whitespace */
    // Expected: compensation = base + (max - cell), where base = min(2, max - 1)
    // - Status column (max=1): header gets 1 ideographic space
    // - Conversion column (max=5): 0-emoji cells get 4, 1-emoji get 6, 5-emoji get 2
    const expected = `| Macro               | Status　      | Conversion　　　　                            |
| ------------------- | -----------　| -------------------------------------　　　　|
| **"info"**          | ✅ Supported  | Blockquote with ℹ️ Info prefix　　　　　　    |
| **"warning"**       | ✅ Supported  | Blockquote with ⚠️ Warning prefix　　　　　　 |
| **"note"**          | ✅ Supported  | Blockquote with 📝 Note prefix　　　　　　    |
| **"tip"**           | ✅ Supported  | Blockquote with 💡 Tip prefix　　　　　　     |
| **"code"**          | ✅ Supported  | Markdown code blocks with syntax highlighting |
| **"mermaid-cloud"** | ✅ Supported  | Mermaid code blocks　　　　                   |
| **"expand"**        | ✅ Supported  | Content extracted and rendered directly　　　　|
| **"details"**       | ✅ Supported  | Content extracted and rendered directly　　　　|
| **"status"**        | ✅ Supported  | Emoji badges (🔴 🟡 🟢 🔵 ⚪)　　             |
| **"toc"**           | ⚠️ Partial    | "<!-- Table of Contents -->" comment　　　　  |
| **"children"**      | ⚠️ Partial    | "<!-- Child Pages -->" comment　　　　        |
| **Other macros**    | 📋 On request | "<!-- Unsupported macro: {name} -->" comments |`;
    /* eslint-enable no-irregular-whitespace */

    const result = fixTableAlignment(input);
    expect(result).toBe(expected);
  });
});

/** Helper to count ideographic spaces in a string */
function countIdeographicSpaces(str) {
  return (str.match(/\u3000/g) || []).length;
}
