# SharePoint Presentations

Use this guide when the user provides a SharePoint URL pointing to a `.pptx` file, or mentions a presentation hosted on SharePoint or OneDrive.

---

## Two Modes

|                                            | Mode 1 — Online (default)                 | Mode 2 — Download/Upload (fallback)                   |
| ------------------------------------------ | ----------------------------------------- | ----------------------------------------------------- |
| How                                        | Playwright → PowerPoint Online in browser | Download file → edit locally → upload back            |
| Co-authoring safe                          | Yes — changes merge like any human edit   | **No — last writer wins, overwrites others' changes** |
| Text edits, titles, bullet changes         | ✓                                         | ✓                                                     |
| Add/remove/reorder slides                  | Limited                                   | ✓                                                     |
| Complex formatting, shapes, charts, images | Not reliable                              | ✓                                                     |
| Create from scratch                        | ✗                                         | ✓                                                     |

**Always start with Mode 1.** Only switch to Mode 2 when the user explicitly needs something Mode 1 cannot do — and warn them first.

---

## Mode 1: Online Editing via PowerPoint Online (Default)

SharePoint opens `.pptx` files in PowerPoint Online. Playwright can interact with the live presentation in the browser, and all changes auto-save back to SharePoint with full co-authoring support.

### Prerequisites

- Browser Control (Playwright) must be enabled
- User must be signed into Microsoft 365 in the browser

### Opening the Presentation

```
# Navigate to the SharePoint URL
playwright-browser_navigate → <sharepoint_url>

# Wait for PowerPoint Online to load
playwright-browser_wait_for → text: "Home"  (the ribbon tab)
```

If the URL opens a SharePoint file preview instead of the editor, look for and click the **"Edit"** or **"Open in Browser"** button.

### Navigating Slides

Use the slide panel on the left to navigate. Click a slide thumbnail to select it.

```
# Take a snapshot to see the current state
playwright-browser_snapshot

# Click a slide thumbnail in the panel
playwright-browser_click → ref: <slide_thumbnail_ref>
```

### Editing Text

1. Click the text box you want to edit
2. Double-click to enter edit mode if needed
3. Select all existing text with Ctrl+A, then type the replacement — or click to position cursor and edit

```
playwright-browser_click → ref: <text_box_ref>
playwright-browser_press_key → key: "Control+a"
playwright-browser_type → ref: <text_box_ref>, text: "New text here"
```

**Do NOT use `slowly: true`** for PowerPoint Online — unlike Loop, PowerPoint Online handles bulk text input reliably.

### Verifying Changes

Take a snapshot after each edit to confirm the change applied. PowerPoint Online auto-saves — there is no need to save manually.

### What Mode 1 Cannot Do Reliably

Stop and switch to Mode 2 (with warning) if the user needs:

- Adding new slides
- Deleting or reordering slides
- Inserting images, charts, or tables
- Changing slide layouts or themes
- Creating a presentation from scratch

---

## Mode 2: Download / Upload (Explicit Fallback Only)

> ⚠️ **Co-authoring warning — always tell the user this before proceeding:**
>
> "Downloading the file and re-uploading it will overwrite the current SharePoint version. If anyone else edits the presentation while you're working on it locally, their changes will be lost. Please make sure no one else has the file open before continuing."

Only proceed after the user confirms they want to use this approach.

### Download

1. Navigate to the SharePoint URL in the browser
2. Click the **"..."** (more options) menu or the Download button in the toolbar
3. Click **Download**
4. Use the filesystem MCP to find the downloaded file:

```bash
# Find the most recently downloaded .pptx
ls -t ~/Downloads/*.pptx | head -1
```

### Edit Locally

Hand off to the standard PPTX skill workflows:

- Read/analyze: see [SKILL.md](SKILL.md) → Reading Content
- Edit from template: see [editing.md](editing.md)
- Create from scratch: see [pptxgenjs.md](pptxgenjs.md)

### Upload Back

Use `workiq_upload_file` — pass the original SharePoint URL and the local path of the modified file. The tool resolves the URL to a Graph item automatically and uploads via the Graph API, no browser interaction needed.

```
workiq_upload_file:
  localPath: "/path/to/modified.pptx"
  sharePointUrl: "<the original SharePoint URL from step 1>"
```

On success it returns `{ success: true, name, sizeBytes, lastModified }`. If the upload fails with a 423 (file locked), the file is open in someone's browser — wait and retry, or ask the user to close it.
