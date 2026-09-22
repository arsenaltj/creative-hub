import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const projects = JSON.parse(await read('projects.json'));
const home = await read('index.html');
const demo = await read('projects/gameperf/index.html');
test('three distinct projects preserve existing entries', () => {
  assert.deepEqual(projects.map(p=>p.path), ['vibedock','qiban','gameperf']);
  assert.equal(new Set(projects.map(p=>p.path)).size, 3);
});
test('all advertised demo and source entry points exist', async () => {
  for (const p of projects) { assert.ok((await read(`projects/${p.path}/index.html`)).includes('<html')); assert.ok(home.includes(`href="./projects/${p.path}/"`)); assert.ok(home.includes(`/tree/main/projects/${p.path}`)); }
});
test('portfolio cards and count are regenerated', () => {
  assert.equal((home.match(/<article class="project /g)||[]).length, 3);
  assert.ok(home.includes('SELECTED EXPERIMENTS / 01—03')); assert.ok(!/<!-- (PROJECTS|COUNT|ARCHIVE) -->/.test(home));
});
test('Pages uses demo mode, explicit limits, relative return link and no remote assets', () => {
  assert.ok(demo.includes('name="gp-mode" content="demo"')); assert.ok(demo.includes('作品集演示 · 非云端工作台')); assert.ok(demo.includes('connect-src \'none\''));
  assert.ok(demo.includes('href="../../"')); assert.equal(new URL('../../','https://arsenaltj.github.io/creative-hub/projects/gameperf/').pathname,'/creative-hub/');
  assert.ok(!/<script[^>]+src=/.test(demo)); assert.ok(!/<link[^>]+href="https?:/.test(demo));
  for (const [,script] of demo.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Script(script);
});
test('server UI and API source remain separate', async () => { assert.ok((await read('projects/gameperf/web/index.html')).includes('name="gp-mode" content="server"')); assert.ok((await read('projects/gameperf/app/main.py')).includes('/api/ingest')); });
test('standalone preview stays independent of the portfolio path', async () => { const standalone=await read('projects/gameperf/gameperf-preview.html'); assert.ok(standalone.includes('name="gp-mode" content="demo"')); assert.ok(!standalone.includes('class="portfolio-back"')); });
