---
name: loop
description: "Edit Microsoft Loop documents in the browser using Playwright automation. Use when the user wants to create, edit, or update a Loop document, mentions 'Loop', 'Loop page', or 'Loop workspace', or wants to add content to a shared document in Loop."
---

# Loop Document Editing Skill

Edit Microsoft Loop documents in the browser using Playwright automation.

## When to Use

- User wants to create, edit, or update a Loop document
- User mentions "Loop", "Loop page", or "Loop workspace"
- User wants to add content to a shared document in Loop

## Prerequisites

- Browser must be open (use Playwright tools)
- User must be signed into Microsoft 365 in the browser

## Opening Loop

1. Navigate to `https://loop.microsoft.com`
2. Wait for the page to load and authenticate
3. Use the sidebar tree to navigate to the target workspace/document

## Creating a New Document

1. Click "Create new" → "Page"
2. Click the title area and type the title
3. Press Enter to move to the body

## Editing Documents

### CRITICAL RULES

1. **ALWAYS use `playwright-browser_type` with `slowly: true`** for content input
   - Character-by-character input triggers Loop's rich text processing properly
   - This is the ONLY reliable method

2. **NEVER use `fill()` or `playwright-browser_fill_form`** for Loop content
   - `fill()` silently fails or breaks formatting
   - Loop's contenteditable areas don't respond to bulk fill

3. **For title editing**: Click the title area, then type with `slowly: true`

4. **For body editing**: Click in the body area, then type with `slowly: true`

### Markdown Support

Loop automatically interprets markdown as you type:

- `## ` → H2 heading
- `### ` → H3 heading
- `- ` → Bullet list item
- `1. ` → Numbered list item
- `✅ ` → Checkmark/completed item
- `[]` → Checkbox (unchecked)
- `**text**` → Bold
- `*text*` → Italic

### Multi-line Content

To enter multiple lines:

1. Type the first line with `slowly: true`
2. Use `playwright-browser_press_key` with key `Enter` to create a new line
3. Type the next line with `slowly: true`
4. Repeat as needed

**Do NOT try to include `\n` in the text** — use explicit Enter key presses between lines.

### Example Workflow

```
# 1. Navigate to Loop
playwright-browser_navigate → https://loop.microsoft.com

# 2. Wait for load
playwright-browser_wait_for → text: "My workspace"

# 3. Take snapshot to find elements
playwright-browser_snapshot

# 4. Click on target document in sidebar
playwright-browser_click → ref: <from snapshot>

# 5. Click in content area
playwright-browser_click → ref: <from snapshot>

# 6. Type content slowly
playwright-browser_type → ref: <from snapshot>, text: "## Meeting Notes", slowly: true

# 7. New line
playwright-browser_press_key → key: Enter

# 8. Type more content
playwright-browser_type → ref: <from snapshot>, text: "- Action item 1", slowly: true
```

## Finding Documents

- **My workspace**: Click "My workspace 😎" in the sidebar
- **Shared workspaces**: Expand workspace names in the sidebar tree
- **Search**: Use the search bar at the top of Loop

## Saving

- Loop saves automatically in real-time
- No explicit save action needed
- Changes are immediately visible to collaborators

## Troubleshooting

- **Content not appearing**: Make sure you used `slowly: true` — without it, Loop may not process the input
- **Wrong element clicked**: Loop has overlapping elements; always use `playwright-browser_snapshot` to get accurate refs
- **Authentication popup**: Wait for it and click through, or ensure the user is already signed in
