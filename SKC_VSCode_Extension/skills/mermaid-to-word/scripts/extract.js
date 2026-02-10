#!/usr/bin/env node
/**
 * Extract Mermaid diagram blocks from a markdown file
 * 
 * Usage:
 *   node extract.js <markdownPath> [options]
 * 
 * Options:
 *   --writeFiles              Write extracted diagrams to .mmd files
 *   --includeCode             Include diagram code in output
 *   --outputDir <dir>         Directory for .mmd files (default: diagrams/)
 *   --max <count>             Maximum number of diagrams to extract
 */

const { extractMermaidBlocksFromFile } = require('./lib/mermaid');

function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Extract Mermaid diagram blocks from a markdown file

Usage:
  node extract.js <markdownPath> [options]

Options:
  --writeFiles              Write extracted diagrams to .mmd files
  --includeCode             Include diagram code in output
  --outputDir <dir>         Directory for .mmd files (default: diagrams/)
  --max <count>             Maximum number of diagrams to extract

Examples:
  node extract.js my-document.md
  node extract.js my-document.md --writeFiles --includeCode
  node extract.js my-document.md --max 5
    `);
    process.exit(0);
  }

  const options = {
    markdownPath: args[0],
    writeFiles: false,
    includeCode: false,
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--writeFiles':
        options.writeFiles = true;
        break;
      case '--includeCode':
        options.includeCode = true;
        break;
      case '--outputDir':
        options.outputDir = nextArg;
        i++;
        break;
      case '--max':
        options.maxDiagrams = parseInt(nextArg, 10);
        i++;
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  return options;
}

function main() {
  try {
    const options = parseArgs();
    console.error('Extracting Mermaid diagrams...');
    console.error(`Input: ${options.markdownPath}`);
    
    const result = extractMermaidBlocksFromFile(options);
    
    console.error('\nExtraction complete!');
    console.error(`Found: ${result.total} diagram(s)`);
    console.error(`Extracted: ${result.extracted} diagram(s)`);
    if (result.outputDir) {
      console.error(`Output directory: ${result.outputDir}`);
    }
    
    // Output JSON result to stdout
    console.log(JSON.stringify(result, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('\nError:', error.message);
    console.log(JSON.stringify({ status: 'error', error: error.message }, null, 2));
    process.exit(1);
  }
}

main();
