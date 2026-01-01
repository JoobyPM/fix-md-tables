#!/usr/bin/env node
/**
 * CLI entry point for fix-md-tables
 *
 * Usage: fix-md-tables [file.md|file.mdx...]
 *        npx fix-md-tables
 *        bunx fix-md-tables
 */

import { run } from "../lib/index.mjs";

run(process.argv.slice(2));

