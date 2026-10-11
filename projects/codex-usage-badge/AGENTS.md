# Codex Usage Badge in Creative Hub

- This directory is an attributed MIT snapshot of jaykinhoo9/codex-usage-badge plus the documented Hub changes. Keep LICENSE and UPSTREAM.md. Preserve the upstream macOS source; only the Hub Windows package is advertised as maintained.
- Read UPSTREAM.md for source commit and changed behavior. Never silently label this package as an official OpenAI or upstream release.
- Never commit runtime configuration, account data, logs, local screenshots, databases, built agent.cjs, dist/ or ZIP archives. Release assets belong in GitHub Releases.
- Build with python scripts/build_hub_release.py. The bootstrap template contains placeholders; installer/Install-CodexUsageBadge.cmd and release.json are generated, pinned to the resulting archive checksum.
- Keep local debugging bound to 127.0.0.1. Keep upstream automatic updates disabled for Hub installations. Installation must remain per-user and reversible, preserve unrelated shortcuts, and never terminate an existing user session.
- Test changes to installation with tests/windows.ps1, tests/windows-launch.ps1, tests/hub-bootstrap.ps1. Native tests use a synthetic client, a separate debug port and temporary links. Do not replace the user's running trial installation during tests.
- Audit the staged source and archives with scripts/audit_release.py; run the repository portfolio tests after page changes.
