# Creative Hub

The user requested source consolidation of three projects: VibeDock (`projects/vibedock/`), QIBAN (`projects/qiban/`), and GamePerf Studio (`projects/gameperf/`). Do not import unrelated projects or private runtime data.

- Maintain each project in its directory. Preserve the existing VibeDock and QIBAN sources unless a task explicitly changes them.
- Edit projects.json/template.html/style.css and run `node build.mjs`. Commit generated index.html and README.md.
- GitHub Pages publishes main/root under /creative-hub/. Keep internal links relative. The portfolio only runs static browser demos.
- GamePerf includes complete FastAPI/SQLite source, but Pages MUST use its generated demo index.html, never web/index.html in server mode. No default accounts, anonymous backend data, server tokens, or live device claims.
- After changing GamePerf UI, run both `python projects/gameperf/scripts/build_demo.py` and `python projects/gameperf/scripts/build_pages.py`. Nested AGENTS.md defines product/security constraints.
- Test `node --test tests/portfolio.test.mjs`; run GamePerf backend tests separately. Verify all three deployed routes and the return-to-portfolio link.
- Previous standalone repositories remain unchanged legacy snapshots. Never delete, archive, or change their visibility without a separate request.
- The user authorized publishing VibeDock PC companion source and a Windows preview. Keep tokens, SSH material, local history, vendor SDKs, raw traces, real databases and user-specific deployment configuration out of this PUBLIC repository. The PC source lives at projects/vibedock/companion/; downloadable ZIP files belong in GitHub Releases, not the Pages tree.
- Browser demo edits remain in localStorage, not GitHub or a shared server. Same-origin pages share a trust boundary; use only nonsensitive samples.
