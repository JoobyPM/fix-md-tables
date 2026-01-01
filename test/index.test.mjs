import { describe, it, expect } from "vitest";
import {
  IDEOGRAPHIC_SPACE,
  countEmoji,
  stripIdeographicSpaces,
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

describe("stripIdeographicSpaces", () => {
  it("removes ideographic spaces", () => {
    expect(stripIdeographicSpaces(`Hello${IDEOGRAPHIC_SPACE}World`)).toBe("HelloWorld");
    expect(stripIdeographicSpaces(`${IDEOGRAPHIC_SPACE}${IDEOGRAPHIC_SPACE}`)).toBe("");
  });

  it("leaves regular spaces intact", () => {
    expect(stripIdeographicSpaces("Hello World")).toBe("Hello World");
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
  it("removes dashes and adds ideographic spaces", () => {
    const result = compensateSeparatorCell(" ------- ", 2);
    expect(result).toBe(` ---${IDEOGRAPHIC_SPACE}${IDEOGRAPHIC_SPACE} `);
  });

  it("preserves alignment colons", () => {
    const result = compensateSeparatorCell(" :---: ", 1);
    expect(result).toBe(` :-${IDEOGRAPHIC_SPACE}: `);
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
    // 2 ideographic spaces = 4 columns, so remove 4 trailing spaces
    const result = compensateRegularCell(" Text     ", 2);
    expect(result).toBe(` Text${IDEOGRAPHIC_SPACE}${IDEOGRAPHIC_SPACE} `);
  });

  it("removes all trailing spaces if not enough", () => {
    // Only 1 trailing space, but need to remove 4 (compensation=2, 2*2=4)
    const result = compensateRegularCell(" Text ", 2);
    expect(result).toBe(` Text${IDEOGRAPHIC_SPACE}${IDEOGRAPHIC_SPACE}`);
  });
});

describe("processCell", () => {
  it("compensates cells with fewer emoji than max", () => {
    const maxEmojiPerCol = [2, 1];
    // Only 1 trailing space, compensation=2 removes 4 spaces, so no trailing space left
    const result = processCell(" Text ", 0, false, maxEmojiPerCol);
    expect(result).toBe(` Text${IDEOGRAPHIC_SPACE}${IDEOGRAPHIC_SPACE}`);
  });

  it("leaves cells with max emoji unchanged", () => {
    const maxEmojiPerCol = [2, 1];
    const result = processCell(" 🌟🎉 ", 0, false, maxEmojiPerCol);
    expect(result).toBe(" 🌟🎉 ");
  });

  it("handles separator rows differently", () => {
    const maxEmojiPerCol = [1];
    const result = processCell(" --- ", 0, true, maxEmojiPerCol);
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
    const tableRows = ["| Header | Header |", "| --- | --- |", "| 🌟 | Text |"];
    const result = processTable(tableRows);

    // compensation=1, removes 2 trailing spaces, only 1 exists, so none left
    expect(result[0]).toBe(`| Header${IDEOGRAPHIC_SPACE}| Header |`);
    expect(result[1]).toBe(`| -${IDEOGRAPHIC_SPACE} | --- |`);
    expect(result[2]).toBe("| 🌟 | Text |");
  });

  it("leaves tables without emoji unchanged", () => {
    const tableRows = ["| Header | Header |", "| --- | --- |", "| Text | Text |"];
    const result = processTable(tableRows);
    expect(result).toEqual(tableRows);
  });

  it("strips existing ideographic spaces before processing", () => {
    const tableRows = [`| Header${IDEOGRAPHIC_SPACE} | Header |`, "| --- | --- |", "| 🌟 | Text |"];
    const result = processTable(tableRows);

    // Should be re-processed cleanly (after stripping, same as above)
    expect(result[0]).toBe(`| Header${IDEOGRAPHIC_SPACE}| Header |`);
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

describe("integration: real-world table", () => {
  it("fixes a typical emoji status table", () => {
    const input = `| Status | Meaning     |
| ------ | ----------- |
| ✅     | Complete    |
| 🚧     | In Progress |
| ❌     | Failed      |`;

    const result = fixTableAlignment(input);
    const lines = result.split("\n");

    // Header should have compensation
    expect(lines[0]).toContain(IDEOGRAPHIC_SPACE);

    // Data rows with emoji should NOT have compensation
    expect(lines[2]).toBe("| ✅     | Complete    |");
    expect(lines[3]).toBe("| 🚧     | In Progress |");
    expect(lines[4]).toBe("| ❌     | Failed      |");
  });
});
