---
applyTo: '**'
description: Keeps image files out of chat context unless the user asked for them.
---

# Context hygiene

## Do not open image files on your own initiative

Treat image files — `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp`, `.svg`, `.ico`,
`.tif`, `.tiff`, `.avif`, `.heic` — as opaque binaries.

Read one **only** when the user has pointed at that specific image: attached or pasted it,
named its path, or asked you to look at it. A request to look at a screenshot, mockup, or
diagram counts as pointing at it.

Never read an image because you found it while exploring. Specifically, when the user
attaches or names a **folder**, a workspace, or an application root, that is a request for
the code in it, not a request for every asset underneath. Walking the tree and opening the
images you happen to pass is the failure this rule exists to prevent: it is slow, it costs
a great deal of context, and it puts pictures the user never chose in front of the model.

The same applies to screenshots produced by tools. Take one when the task needs visual
verification, not as a routine way to look around.

When you need to know what an image is, use its path, name, and surrounding code. Say what
you need and ask, rather than opening it speculatively.

## Report images as skipped, not as shared

If a folder you were given contains images, do not describe them as something the user
shared with you. They did not. Mention them only if their presence matters to the task,
and describe them by filename.
