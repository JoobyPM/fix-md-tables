# fix-md-tables

Fix markdown table alignment for emoji using ideographic spaces (U+3000).

## The Problem

Emoji display as 2 columns in terminals but count as 1 character. When Prettier formats markdown tables, it aligns by character count, so headers (no emoji) appear shorter than data rows (with emoji):

```markdown
| Status | Description    | Comments |
| ------ | -------------- | -------- |
| ✅     | ✅ Complete    | ❌       |
| 🚧     | 🚧 In Progress | ⚠️       |
```

Renders misaligned:

```
| Status | Description    | Comments |
| ------ | -------------- | -------- |
| ✅     | ✅ Complete    | ❌       |  ← emoji takes 2 cols but counts as 1 char
| 🚧     | 🚧 In Progress | ⚠️       |
```

## The Solution

Add ideographic spaces (U+3000) to cells with fewer emoji. Ideographic spaces also display as 2 columns, compensating for the width difference:

```markdown
| Status　 | Description　  | Comments　 |
| -------- | -------------- | ---------- |
| ✅       | ✅ Complete    | ❌         |
| 🚧       | 🚧 In Progress | ⚠️         |
```

Now renders aligned:

```
| Status　 | Description　    | Comments　 |
| ------　 | --------------　 | --------　 |
| ✅       | ✅ Complete      | ❌         |
| 🚧       | 🚧 In Progress   | ⚠️         |
```

## Installation

```bash
# One-off via npx (no install)
npx fix-md-tables

# Or with bun
bunx fix-md-tables

# Install globally
npm install -g fix-md-tables
fix-md-tables

# As dev dependency in project
npm install -D fix-md-tables
pnpm add -D fix-md-tables
```

## Usage

### CLI

```bash
# Process default files (*.md, *.mdx in root + docs/)
fix-md-tables

# Process specific files
fix-md-tables README.md docs/guide.mdx

# Via npx
npx fix-md-tables
```

### Programmatic

```javascript
import { fixTableAlignment } from "fix-md-tables";

const markdown = `| Status | Description    | Comments |
                  | ------ | -------------- | -------- |
                  | ✅     | ✅ Complete    | ❌       |
                  | 🚧     | 🚧 In Progress | ⚠️       |`;

const fixed = fixTableAlignment(markdown);
console.log(fixed);
```

### With Prettier (recommended)

Run after Prettier to fix table alignment:

```bash
prettier --write "*.md" "docs/**/*.md" && npx fix-md-tables
```

Or in your `package.json`:

```json
{
  "scripts": {
    "format": "prettier --write . && fix-md-tables"
  }
}
```

Or in a Makefile:

```makefile
docs-format:
	@prettier --write "*.md" "docs/**/*.md"
	@npx fix-md-tables
```

## How It Works

1. Finds all markdown tables in content
2. For each table, calculates max emoji count per column (from data rows only)
3. Adds ideographic spaces to compensate:
   - Header cells: adds spaces after text
   - Separator cells: removes dashes, adds ideographic spaces
   - Data cells with fewer emoji: adds compensating spaces

## API

### `fixTableAlignment(content: string): string`

Main function to fix table alignment in markdown content.

### `countEmoji(str: string): number`

Count emoji characters in a string.

### `stripIdeographicSpaces(str: string): string`

Remove all ideographic spaces from a string.

### `processTable(tableRows: string[]): string[]`

Process a complete table, applying emoji compensation to all rows.

### `run(args?: string[]): number`

CLI runner. Returns count of fixed files.

## Supported Emoji Ranges

- U+1F300-U+1F9FF (Miscellaneous Symbols and Pictographs, Emoticons, etc.)
- U+2600-U+26FF (Miscellaneous Symbols)
- U+2700-U+27BF (Dingbats)
- U+231A-U+23FA (Miscellaneous Technical)
- U+2B50-U+2B55 (Miscellaneous Symbols and Arrows)

## File Types

Supports `.md` and `.mdx` files.

## Requirements

- Node.js >= 18
- Also works with Bun

## License

MIT
