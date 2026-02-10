/**
 * Mermaid to Word conversion library
 * Ported from mermaid-to-word-mcp/src/lib/mermaid.ts
 * Uses only Node.js built-ins: fs, path, child_process
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Default configuration
const DEFAULT_DIAGRAM_WIDTH = 1400;
const DEFAULT_DIAGRAM_SCALE = 2;
const DEFAULT_DIAGRAM_BACKGROUND = 'white';
const DEFAULT_TOC_DEPTH = 3;
const DEFAULT_DIAGRAM_TIMEOUT_MS = 60000;
const DEFAULT_PANDOC_TIMEOUT_MS = 180000;
const DIAGRAM_LABEL_PREFIX = 'Process Flow Diagram';

// Regex pattern for mermaid blocks
const MERMAID_BLOCK_PATTERN = /```mermaid\r?\n([\s\S]*?)```/;

/**
 * Format diagram number with leading zeros
 */
function formatDiagramNumber(index) {
  return String(index).padStart(2, '0');
}

/**
 * Convert path to POSIX format (forward slashes)
 */
function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

/**
 * Get relative POSIX path from one directory to another
 */
function toRelativePosix(fromDir, toDir) {
  const relativePath = path.relative(fromDir, toDir);
  if (!relativePath || relativePath === '.') {
    return '';
  }
  return toPosixPath(relativePath).replace(/\/+$/, '');
}

/**
 * Ensure directory exists, create if not
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Run a command and return result
 */
function runCommand(command, args, options = {}) {
  const startTime = Date.now();
  
  // On Windows with .cmd files, we need shell:true and proper quoting
  const needsShell = process.platform === 'win32' && command.endsWith('.cmd');
  const quotedArgs = needsShell
    ? args.map(arg => (arg.includes(' ') || arg.includes('(') || arg.includes(')')) ? `"${arg}"` : arg)
    : args;
  
  const result = spawnSync(command, quotedArgs, {
    cwd: options.cwd,
    timeout: options.timeoutMs,
    encoding: 'utf8',
    windowsHide: true,
    shell: needsShell,
  });

  return {
    command,
    args,
    exitCode: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error ? result.error.message : undefined,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Parse version from command output
 */
function parseVersion(output) {
  const line = output.split(/\r?\n/).find(l => l.trim().length > 0);
  if (!line) return undefined;
  const match = line.match(/\d+\.\d+\.\d+(?:\.\d+)?/);
  return match ? match[0] : undefined;
}

/**
 * Probe for a command by trying multiple candidates
 */
function probeCommand(candidates, args, timeoutMs = 5000) {
  const tried = [];
  let lastResult;

  for (const candidate of candidates) {
    tried.push(candidate);
    const result = runCommand(candidate, args, { timeoutMs });
    lastResult = result;

    if (result.exitCode === 0 && !result.error) {
      return {
        ok: true,
        command: candidate,
        version: parseVersion(result.stdout || result.stderr),
        tried,
        result,
      };
    }
  }

  return {
    ok: false,
    tried,
    error: lastResult?.error || 'Command failed to execute',
    result: lastResult,
  };
}

/**
 * Resolve mermaid CLI candidates
 */
function resolveMermaidCandidates(customPath) {
  const candidates = [];
  if (customPath) {
    candidates.push(customPath);
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (appData) {
      candidates.push(path.join(appData, 'npm', 'mmdc.cmd'));
    }
  }
  candidates.push('mmdc');
  return candidates;
}

/**
 * Resolve pandoc candidates
 */
function resolvePandocCandidates(customPath) {
  const candidates = [];
  if (customPath) {
    candidates.push(customPath);
  }
  candidates.push('pandoc');
  return candidates;
}

/**
 * Extract mermaid code blocks from markdown content
 */
function extractMermaidBlocks(markdown) {
  const blocks = [];
  const mermaidBlockRegex = new RegExp(MERMAID_BLOCK_PATTERN.source, 'g');
  let match;
  let index = 0;

  while ((match = mermaidBlockRegex.exec(markdown)) !== null) {
    index += 1;
    blocks.push({ index, code: match[1] });
  }

  return blocks;
}

/**
 * Replace mermaid blocks with image references
 */
function replaceMermaidBlocksWithImages(markdown, options) {
  const mermaidBlockRegex = new RegExp(MERMAID_BLOCK_PATTERN.source, 'g');
  let imageCounter = 0;
  const imagePaths = [];
  const labelPrefix = options.labelPrefix || DIAGRAM_LABEL_PREFIX;
  const normalizedImageDir = options.imageDir.replace(/^\.?\//, '');

  const content = markdown.replace(mermaidBlockRegex, () => {
    imageCounter += 1;
    const diagramNum = formatDiagramNumber(imageCounter);
    const imageFile = `diagram_${diagramNum}.png`;
    const imagePath = normalizedImageDir
      ? `${normalizedImageDir}/${imageFile}`
      : imageFile;
    imagePaths.push(imagePath);
    return `\n![${labelPrefix} ${imageCounter}](${imagePath})\n`;
  });

  return { content, imagePaths };
}

/**
 * Write mermaid blocks to .mmd files
 */
function writeMermaidFiles(blocks, outputDir) {
  ensureDir(outputDir);
  const files = [];

  for (const block of blocks) {
    const diagramNum = formatDiagramNumber(block.index);
    const diagramName = `diagram_${diagramNum}`;
    const mmdFile = path.join(outputDir, `${diagramName}.mmd`);
    fs.writeFileSync(mmdFile, block.code, 'utf8');
    files.push(mmdFile);
  }

  return files;
}

/**
 * Extract mermaid blocks from a markdown file
 */
function extractMermaidBlocksFromFile(options) {
  const markdownPath = path.resolve(options.markdownPath);
  if (!fs.existsSync(markdownPath)) {
    throw new Error(`Markdown file not found: ${markdownPath}`);
  }

  const content = fs.readFileSync(markdownPath, 'utf8');
  const blocks = extractMermaidBlocks(content);
  const limitedBlocks = options.maxDiagrams !== undefined
    ? blocks.slice(0, options.maxDiagrams)
    : blocks;

  let outputDir;
  let files;
  if (options.writeFiles) {
    const resolvedOutputDir = path.resolve(
      options.outputDir || path.join(path.dirname(markdownPath), 'diagrams')
    );
    outputDir = resolvedOutputDir;
    files = writeMermaidFiles(limitedBlocks, resolvedOutputDir);
  }

  return {
    markdownPath,
    total: blocks.length,
    extracted: limitedBlocks.length,
    outputDir,
    files,
    blocks: limitedBlocks.map(block => ({
      index: block.index,
      chars: block.code.length,
      lines: block.code.split(/\r?\n/).length,
      ...(options.includeCode ? { code: block.code } : {}),
    })),
  };
}

/**
 * Check that Mermaid CLI and Pandoc are available
 */
function checkDependencies(options = {}) {
  const timeoutMs = options.timeoutMs || 5000;
  const mmdcCandidates = resolveMermaidCandidates(options.mmdcPath);
  const pandocCandidates = resolvePandocCandidates(options.pandocPath);

  return {
    mmdc: probeCommand(mmdcCandidates, ['--version'], timeoutMs),
    pandoc: probeCommand(pandocCandidates, ['--version'], timeoutMs),
  };
}

/**
 * Convert markdown with mermaid blocks into a Word document
 */
function convertMarkdownToWord(options) {
  const markdownPath = path.resolve(options.markdownPath);
  if (!fs.existsSync(markdownPath)) {
    throw new Error(`Markdown file not found: ${markdownPath}`);
  }

  const markdownDir = path.dirname(markdownPath);
  const outputDir = path.resolve(
    options.outputDir || path.join(markdownDir, 'diagrams')
  );
  const outputDocx = path.resolve(
    options.outputPath ||
    path.join(markdownDir, `${path.parse(markdownPath).name}.docx`)
  );
  const modifiedMarkdown = path.resolve(
    path.join(
      markdownDir,
      `${path.parse(markdownPath).name}_with_images.md`
    )
  );

  const dependencies = checkDependencies({
    mmdcPath: options.mmdcPath,
    pandocPath: options.pandocPath,
  });

  // Pandoc is required, mmdc is optional
  if (!dependencies.pandoc.ok) {
    throw new Error(
      'Pandoc is required but not found. Install from https://pandoc.org/installing.html'
    );
  }

  const hasMmdc = dependencies.mmdc.ok;
  if (!hasMmdc) {
    console.warn('Warning: Mermaid CLI (mmdc) not found. Diagrams will be kept as code blocks.');
  }

  const content = fs.readFileSync(markdownPath, 'utf8');
  const mermaidBlocks = extractMermaidBlocks(content);

  let modifiedContent = content;
  const diagramResults = [];

  if (hasMmdc && mermaidBlocks.length > 0) {
    // mmdc is available, render diagrams
    ensureDir(outputDir);

    const diagramWidth = options.diagramWidth || DEFAULT_DIAGRAM_WIDTH;
    const diagramScale = options.diagramScale || DEFAULT_DIAGRAM_SCALE;
    const diagramBackground = options.diagramBackground || DEFAULT_DIAGRAM_BACKGROUND;
    const diagramTimeoutMs = options.diagramTimeoutMs || DEFAULT_DIAGRAM_TIMEOUT_MS;
    const mmdcCommand = dependencies.mmdc.command;

    for (const block of mermaidBlocks) {
      const diagramNum = formatDiagramNumber(block.index);
      const diagramName = `diagram_${diagramNum}`;
      const mmdFile = path.join(outputDir, `${diagramName}.mmd`);
      const pngFile = path.join(outputDir, `${diagramName}.png`);

      fs.writeFileSync(mmdFile, block.code, 'utf8');

      const args = [
        '-i', mmdFile,
        '-o', pngFile,
        '-b', diagramBackground,
        '-w', String(diagramWidth),
        '-s', String(diagramScale),
      ];

      const commandResult = runCommand(mmdcCommand, args, {
        timeoutMs: diagramTimeoutMs,
      });
      const success = commandResult.exitCode === 0 && !commandResult.error;

      diagramResults.push({
        index: block.index,
        name: diagramName,
        mmdFile,
        pngFile,
        success,
        command: commandResult,
      });
    }

    const imageDir = toRelativePosix(markdownDir, outputDir);
    const replacement = replaceMermaidBlocksWithImages(content, {
      imageDir,
    });
    modifiedContent = replacement.content;
  } else if (mermaidBlocks.length > 0) {
    // mmdc not available, keep diagrams as code blocks
    console.warn(`Found ${mermaidBlocks.length} Mermaid diagram(s) but mmdc is not available.`);
    console.warn('Diagrams will be kept as code blocks in the Word document.');
  }

  fs.writeFileSync(modifiedMarkdown, modifiedContent, 'utf8');

  const resourcePaths = new Set();
  resourcePaths.add(markdownDir);
  resourcePaths.add(outputDir);
  for (const resourcePath of options.resourcePaths || []) {
    const resolvedPath = path.resolve(markdownDir, resourcePath);
    resourcePaths.add(resolvedPath);
  }

  const pandocArgs = [modifiedMarkdown, '-o', outputDocx];
  if (options.toc !== false) {
    pandocArgs.push('--toc');
    const tocDepth = options.tocDepth || DEFAULT_TOC_DEPTH;
    pandocArgs.push(`--toc-depth=${tocDepth}`);
  }
  pandocArgs.push('--standalone');
  pandocArgs.push('--resource-path', Array.from(resourcePaths).join(path.delimiter));

  const pandocTimeoutMs = options.pandocTimeoutMs || DEFAULT_PANDOC_TIMEOUT_MS;
  const pandocCommand = dependencies.pandoc.command;
  const pandocResult = runCommand(pandocCommand, pandocArgs, {
    timeoutMs: pandocTimeoutMs,
  });

  if (pandocResult.exitCode !== 0 || pandocResult.error) {
    const errorDetail = pandocResult.error || pandocResult.stderr || 'unknown';
    throw new Error(`Pandoc failed: ${errorDetail}`);
  }

  let fileSizeBytes;
  let fileSizeMB;
  if (fs.existsSync(outputDocx)) {
    const stats = fs.statSync(outputDocx);
    fileSizeBytes = stats.size;
    fileSizeMB = Number((stats.size / (1024 * 1024)).toFixed(2));
  }

  let modifiedMarkdownDeleted = false;
  if (!options.keepMarkdown) {
    try {
      fs.unlinkSync(modifiedMarkdown);
      modifiedMarkdownDeleted = true;
    } catch {
      modifiedMarkdownDeleted = false;
    }
  }

  const succeeded = diagramResults.filter(r => r.success).length;
  const skipped = hasMmdc ? 0 : mermaidBlocks.length;

  return {
    input: {
      markdownPath,
      outputDocx,
      outputDir,
      modifiedMarkdown,
    },
    dependencies,
    diagrams: {
      total: mermaidBlocks.length,
      succeeded,
      failed: hasMmdc ? (mermaidBlocks.length - succeeded) : 0,
      skipped,
      outputs: diagramResults,
    },
    pandoc: pandocResult,
    output: {
      fileSizeBytes,
      fileSizeMB,
    },
    modifiedMarkdownDeleted,
  };
}

module.exports = {
  extractMermaidBlocks,
  replaceMermaidBlocksWithImages,
  writeMermaidFiles,
  extractMermaidBlocksFromFile,
  checkDependencies,
  convertMarkdownToWord,
};
