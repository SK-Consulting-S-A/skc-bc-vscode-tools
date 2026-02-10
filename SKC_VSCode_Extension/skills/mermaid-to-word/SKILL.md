---
name: mermaid-to-word
description: "Convert Markdown with Mermaid diagrams to Word (.docx) using Pandoc (required) and optionally mmdc for diagram rendering. Use when user wants to export documentation with Mermaid diagrams to Word, create .docx from .md with embedded diagrams, or extract/analyze Mermaid diagrams from markdown. Works with or without mmdc installed."
---

# Mermaid to Word Conversion

Convert Markdown files with embedded Mermaid diagrams into professional Word (.docx) documents using local tools.

## Prerequisites

### Required
- **Node.js** 18+ - [Download](https://nodejs.org/)
- **Pandoc** - [Download and install](https://pandoc.org/installing.html)

### Optional (for diagram rendering)
- **Mermaid CLI (mmdc)** - Install globally:
  ```bash
  npm install -g @mermaid-js/mermaid-cli
  ```

**Note:** Without mmdc, you can still extract diagrams and convert markdown to Word, but diagrams will appear as code blocks instead of rendered images.

Verify installation:
```bash
node --version    # Should be >= 18
pandoc --version  # Should show Pandoc version
mmdc --version    # (Optional) Should show Mermaid CLI version
```

## Quick Start

```bash
# Check if dependencies are installed
node scripts/check-deps.js

# Convert markdown with diagrams to Word
node scripts/convert.js path/to/document.md

# Convert with custom output path
node scripts/convert.js path/to/document.md --output path/to/output.docx

# Extract mermaid diagrams from markdown
node scripts/extract.js path/to/document.md --includeCode
```

## Workflow Decision Tree

### What do you want to do?

**Convert markdown to Word document**
→ Use `convert.js` with the markdown file path

**Extract and analyze Mermaid diagrams**
→ Use `extract.js` to see what diagrams are in the file

**Check if tools are installed**
→ Use `check-deps.js` to verify mmdc and pandoc

**Customize diagram appearance**
→ Use `convert.js` with `--width`, `--scale`, `--background` options

**Debug conversion issues**
→ Use `--keepMarkdown` to inspect intermediate markdown file

## Script Reference

### convert.js

Convert markdown files with Mermaid diagrams into Word documents.

```bash
node scripts/convert.js <markdownPath> [options]
```

**Options:**
- `--output <path>` - Output .docx path (default: same name as input)
- `--diagramDir <dir>` - Directory for diagram assets (default: `diagrams/`)
- `--width <pixels>` - Mermaid render width (default: 1400)
- `--scale <factor>` - Mermaid render scale (default: 2)
- `--background <color>` - Diagram background color (default: "white")
- `--toc` - Include table of contents (default: true)
- `--no-toc` - Disable table of contents
- `--tocDepth <depth>` - TOC depth (default: 3)
- `--keepMarkdown` - Keep intermediate markdown file with image references
- `--diagramTimeout <ms>` - Timeout for each diagram render (default: 60000)
- `--pandocTimeout <ms>` - Timeout for Pandoc conversion (default: 180000)

**Examples:**
```bash
# Basic conversion
node scripts/convert.js my-document.md

# High-quality diagrams with custom output
node scripts/convert.js my-document.md --output report.docx --width 1600 --scale 3

# Transparent background diagrams
node scripts/convert.js my-document.md --background transparent

# Keep intermediate files for debugging
node scripts/convert.js my-document.md --keepMarkdown
```

**Output:**
- `.docx` file at specified location
- `diagrams/` folder with PNG images and .mmd source files
- JSON result with conversion details

### extract.js

Extract Mermaid diagram blocks from a markdown file.

```bash
node scripts/extract.js <markdownPath> [options]
```

**Options:**
- `--writeFiles` - Write extracted diagrams to .mmd files
- `--includeCode` - Include diagram code in output
- `--outputDir <dir>` - Directory for .mmd files (default: `diagrams/`)
- `--max <count>` - Maximum number of diagrams to extract

**Examples:**
```bash
# List diagrams in a file
node scripts/extract.js my-document.md

# Extract and save diagrams with code
node scripts/extract.js my-document.md --writeFiles --includeCode

# Extract first 5 diagrams only
node scripts/extract.js my-document.md --max 5
```

**Output:**
- JSON with diagram count, statistics, and optionally code
- If `--writeFiles`: .mmd files in output directory

### check-deps.js

Check if Mermaid CLI and Pandoc are available.

```bash
node scripts/check-deps.js
```

**Output:**
- JSON with status of mmdc and pandoc
- Version numbers if found
- Error messages if not found

## How It Works

The conversion process:

1. **Extract Mermaid blocks** - Finds all ` ```mermaid ... ``` ` code blocks in markdown
2. **Render diagrams** - If mmdc is available, converts each block to PNG image
3. **Replace blocks** - Substitutes mermaid blocks with image references (or keeps as code if mmdc unavailable)
4. **Convert to Word** - Uses `pandoc` to convert markdown to .docx

### Without mmdc

If mmdc is not installed, the conversion will:
- Keep mermaid code blocks as-is in the markdown
- Convert to Word with diagrams shown as code blocks
- You can then manually render diagrams or use online tools

## Common Tasks

### Converting documentation with diagrams

```bash
# Standard conversion with table of contents
node scripts/convert.js architecture-doc.md

# Result: architecture-doc.docx with embedded diagram images
```

### Customizing diagram quality

For presentations or high-DPI displays:
```bash
node scripts/convert.js presentation.md --width 1800 --scale 3
```

For web documentation (smaller file size):
```bash
node scripts/convert.js web-doc.md --width 1200 --scale 1.5
```

### Debugging conversion issues

1. Check dependencies:
   ```bash
   node scripts/check-deps.js
   ```

2. Extract diagrams to verify syntax:
   ```bash
   node scripts/extract.js document.md --includeCode
   ```

3. Keep intermediate files:
   ```bash
   node scripts/convert.js document.md --keepMarkdown
   ```

4. Check the generated `document_with_images.md` file

### Working with large documents

For documents with many diagrams or complex content:
```bash
node scripts/convert.js large-doc.md --diagramTimeout 120000 --pandocTimeout 300000
```

## Troubleshooting

### mmdc not found (Optional)

Mermaid CLI is optional. Without it, diagrams will appear as code blocks in the Word document.

To install mmdc for diagram rendering:

**Windows:**
```powershell
npm install -g @mermaid-js/mermaid-cli
# Verify: should be in %APPDATA%\npm\mmdc.cmd
mmdc --version
```

**macOS/Linux:**
```bash
npm install -g @mermaid-js/mermaid-cli
mmdc --version
```

**Alternatives without mmdc:**
- Use online Mermaid editors (mermaid.live) to render diagrams manually
- Export diagrams as PNG and insert into Word separately
- Use the docx skill to add images after conversion

### pandoc not found

Download and install from [pandoc.org](https://pandoc.org/installing.html), then verify:
```bash
pandoc --version
```

### Diagram rendering fails

- **Check Mermaid syntax** - Use `extract.js --includeCode` to review diagram code
- **Increase timeout** - Use `--diagramTimeout 120000` for complex diagrams
- **Check mmdc version** - Older versions may not support all diagram types

### Pandoc conversion fails

- **Check file paths** - Ensure no spaces in paths, or use quotes
- **Increase timeout** - Use `--pandocTimeout 300000` for large documents
- **Check resource paths** - Images must be accessible relative to markdown file

### Large file size

- **Reduce diagram size** - Use `--width 1200 --scale 1.5` instead of defaults
- **Optimize images** - Diagrams are PNG; consider post-processing compression
- **Remove intermediate files** - Don't use `--keepMarkdown` in production

## Integration with Other Skills

This skill works well with:

- **docx skill** - For further editing of generated Word documents with tracked changes, comments, or advanced formatting. After conversion, use the docx skill to refine the document.

## Advanced Usage

### Custom resource paths

If your markdown references images from multiple directories:
```bash
# Not directly supported via CLI; edit convert.js to add resourcePaths option
```

### Batch conversion

Process multiple files:
```bash
for file in *.md; do
  node scripts/convert.js "$file"
done
```

### CI/CD integration

```yaml
# GitHub Actions example
- name: Install dependencies
  run: |
    npm install -g @mermaid-js/mermaid-cli
    sudo apt-get install pandoc

- name: Convert docs
  run: |
    node scripts/convert.js README.md
```

## Performance

- **Typical conversion**: ~8 seconds for documents with 2-3 diagrams
- **Diagram quality**: 1400px width, 2x scale (configurable)
- **Supported sizes**: Unlimited (tested with 250+ page documents)
- **All Mermaid types**: flowchart, sequence, class, state, ER, gantt, pie, etc.

## Upstream Reference

This skill is based on [mermaid-to-word-mcp](https://github.com/SK-Consulting-S-A/mermaid-to-word-mcp). For the MCP server version with additional features, see the upstream repository.
