#!/usr/bin/env node
/**
 * Convert markdown with Mermaid diagrams to Word (.docx)
 * 
 * Usage:
 *   node convert.js <markdownPath> [options]
 * 
 * Options:
 *   --output <path>           Output .docx path
 *   --diagramDir <dir>        Directory for diagram assets (default: diagrams/)
 *   --width <pixels>          Mermaid render width (default: 1400)
 *   --scale <factor>          Mermaid render scale (default: 2)
 *   --background <color>      Diagram background color (default: white)
 *   --toc                     Include table of contents (default: true)
 *   --no-toc                  Disable table of contents
 *   --tocDepth <depth>        TOC depth (default: 3)
 *   --keepMarkdown            Keep intermediate markdown file
 *   --diagramTimeout <ms>     Timeout for each diagram (default: 60000)
 *   --pandocTimeout <ms>      Timeout for pandoc (default: 180000)
 */

const { convertMarkdownToWord } = require('./lib/mermaid');

function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Convert markdown with Mermaid diagrams to Word (.docx)

Usage:
  node convert.js <markdownPath> [options]

Options:
  --output <path>           Output .docx path
  --diagramDir <dir>        Directory for diagram assets (default: diagrams/)
  --width <pixels>          Mermaid render width (default: 1400)
  --scale <factor>          Mermaid render scale (default: 2)
  --background <color>      Diagram background color (default: white)
  --toc                     Include table of contents (default: true)
  --no-toc                  Disable table of contents
  --tocDepth <depth>        TOC depth (default: 3)
  --keepMarkdown            Keep intermediate markdown file
  --diagramTimeout <ms>     Timeout for each diagram (default: 60000)
  --pandocTimeout <ms>      Timeout for pandoc (default: 180000)

Examples:
  node convert.js my-document.md
  node convert.js my-document.md --output report.docx --width 1600
  node convert.js my-document.md --background transparent --no-toc
    `);
    process.exit(0);
  }

  const options = {
    markdownPath: args[0],
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--output':
        options.outputPath = nextArg;
        i++;
        break;
      case '--diagramDir':
        options.outputDir = nextArg;
        i++;
        break;
      case '--width':
        options.diagramWidth = parseInt(nextArg, 10);
        i++;
        break;
      case '--scale':
        options.diagramScale = parseFloat(nextArg);
        i++;
        break;
      case '--background':
        options.diagramBackground = nextArg;
        i++;
        break;
      case '--toc':
        options.toc = true;
        break;
      case '--no-toc':
        options.toc = false;
        break;
      case '--tocDepth':
        options.tocDepth = parseInt(nextArg, 10);
        i++;
        break;
      case '--keepMarkdown':
        options.keepMarkdown = true;
        break;
      case '--diagramTimeout':
        options.diagramTimeoutMs = parseInt(nextArg, 10);
        i++;
        break;
      case '--pandocTimeout':
        options.pandocTimeoutMs = parseInt(nextArg, 10);
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
    console.error('Converting markdown to Word...');
    console.error(`Input: ${options.markdownPath}`);
    
    const result = convertMarkdownToWord(options);
    
    console.error('\nConversion complete!');
    console.error(`Output: ${result.input.outputDocx}`);
    if (result.diagrams.skipped > 0) {
      console.error(`Diagrams: ${result.diagrams.skipped}/${result.diagrams.total} kept as code blocks (mmdc not available)`);
    } else {
      console.error(`Diagrams: ${result.diagrams.succeeded}/${result.diagrams.total} succeeded`);
    }
    if (result.output.fileSizeMB) {
      console.error(`File size: ${result.output.fileSizeMB} MB`);
    }
    
    // Output JSON result to stdout
    console.log(JSON.stringify(result, null, 2));
    
    // Exit with error only if diagrams failed (not if skipped due to missing mmdc)
    process.exit(result.diagrams.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\nError:', error.message);
    console.log(JSON.stringify({ status: 'error', error: error.message }, null, 2));
    process.exit(1);
  }
}

main();
