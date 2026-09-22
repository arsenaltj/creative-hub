# Creative Hub

This repository contains exactly two public interactive prototypes: VibeDock in `projects/vibedock/` and QIBAN in `projects/qiban/`. Do not import other repositories or local client data without user instructions.

- Edit project source in its corresponding directory. These are browser demos, not production hardware/client integrations.
- The landing page is generated: edit `projects.json`, `template.html`, or `style.css`, then run `node build.mjs`. Commit the generated `index.html` and `README.md` when they change.
- GitHub Pages serves `main` from the root under `/creative-hub/`. Keep asset paths and internal links relative. There is no package installation or backend requirement.
- Verify both demo entry points after changing routing or shared structure. Preserve simulation labels and avoid claiming real approvals, audio capture, or device connections.
- Previous standalone repositories remain legacy snapshots. Future changes belong here; do not modify or delete those repositories unless requested.
- Keep tokens, local task history, firmware SDKs, and user-specific configuration out of this public repository.
