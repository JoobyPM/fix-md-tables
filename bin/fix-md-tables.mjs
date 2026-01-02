#!/usr/bin/env node
/**
 * CLI entry point for fix-md-tables
 *
 * Usage: fix-md-tables [--clean] [file.md|file.mdx...]
 *        npx fix-md-tables
 *        npx fix-md-tables --clean  # Remove ideographic spaces (run before Prettier)
 *        bunx fix-md-tables
 */

import { run } from "../lib/index.mjs";

run(process.argv.slice(2));

