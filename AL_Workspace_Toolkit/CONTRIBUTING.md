# Contributing

Contributions are welcome through pull requests.

1. Use synthetic examples only. Do not include customer names, tenant IDs, credentials, internal URLs, production data, or workstation paths.
2. Run `npm ci`, `npm run check:public`, `npm test`, `npm run typecheck`, and `npm run build`.
3. Keep file operations workspace-contained and require confirmation for agent-initiated writes.
4. Add tests for parser, path, or safety behavior changes.

Marketplace publication is performed only by the manual GitHub Actions workflow after review.
