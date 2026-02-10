#!/usr/bin/env node
/**
 * Check if Mermaid CLI (mmdc) and Pandoc are available
 * 
 * Usage:
 *   node check-deps.js
 */

const { checkDependencies } = require('./lib/mermaid');

function main() {
  try {
    console.error('Checking dependencies...\n');
    
    const result = checkDependencies();
    
    // Check mmdc (optional)
    if (result.mmdc.ok) {
      console.error('✓ Mermaid CLI (mmdc) is available');
      console.error(`  Command: ${result.mmdc.command}`);
      if (result.mmdc.version) {
        console.error(`  Version: ${result.mmdc.version}`);
      }
    } else {
      console.error('○ Mermaid CLI (mmdc) not found (optional)');
      console.error(`  Tried: ${result.mmdc.tried.join(', ')}`);
      console.error(`  Note: Without mmdc, diagrams will be kept as code blocks`);
      console.error('\n  Install with: npm install -g @mermaid-js/mermaid-cli');
    }
    
    console.error('');
    
    // Check pandoc
    if (result.pandoc.ok) {
      console.error('✓ Pandoc is available');
      console.error(`  Command: ${result.pandoc.command}`);
      if (result.pandoc.version) {
        console.error(`  Version: ${result.pandoc.version}`);
      }
    } else {
      console.error('✗ Pandoc not found');
      console.error(`  Tried: ${result.pandoc.tried.join(', ')}`);
      console.error(`  Error: ${result.pandoc.error}`);
      console.error('\n  Install from: https://pandoc.org/installing.html');
    }
    
    console.error('');
    
    // Output JSON result to stdout
    console.log(JSON.stringify(result, null, 2));
    
    // Exit with error only if required dependency (pandoc) is missing
    const requiredOk = result.pandoc.ok;
    const allOk = result.mmdc.ok && result.pandoc.ok;
    
    if (allOk) {
      console.error('All dependencies are available!');
    } else if (requiredOk) {
      console.error('Required dependencies are available. Optional mmdc not found.');
      console.error('You can still convert markdown to Word, but diagrams will appear as code blocks.');
    } else {
      console.error('Required dependency (Pandoc) is missing. Please install it before using this skill.');
    }
    
    process.exit(requiredOk ? 0 : 1);
  } catch (error) {
    console.error('\nError:', error.message);
    console.log(JSON.stringify({ status: 'error', error: error.message }, null, 2));
    process.exit(1);
  }
}

main();
