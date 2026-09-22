"""Interactive rendering tests; explicit memory adapter, no policy bypass.
Chromium file/localhost navigation may be blocked in the authoring environment.
These tests use set_content by design, NOT production browser end-to-end tests.
"""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('GP_QA_OUT',str(ROOT/'qa-output')));OUT.mkdir(parents=True,exist_ok=True)
HTML=(ROOT/'gameperf-preview.html').read_text()
STORAGE="""Object.defineProperty(window,'localStorage',{configurable:true,value:(()=>{let d={};return {getItem:k=>d[k]??null,setItem:(k,v)=>d[k]=String(v),removeItem:k=>delete d[k],clear:()=>d={}}})()});"""
results=[];errors=[]
def load(browser, width=1640, height=1160, reduced=False):
    page=browser.new_page(viewport={'width':width,'height':height},reduced_motion='reduce' if reduced else 'no-preference')
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.evaluate(STORAGE);page.set_content(HTML,wait_until='domcontentloaded');page.wait_for_selector('.graph-canvas');page.wait_for_timeout(550)
    return page

def save_form(page):
    page.locator('button[form="record-form"]').click();page.wait_for_selector('.drawer',state='detached')

def goto(page, route):
    page.locator(f'.sidebar [data-route="{route}"]').click();page.wait_for_timeout(100)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('GP_CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page=load(browser)
    assert page.locator('.business-node').count()==5
    assert page.locator('.metric-number').all_inner_texts()==['17个','1项','3项','0条']
    assert page.locator('.graph-node').evaluate_all('(els)=>els.every(e=>e.scrollHeight<=e.clientHeight+1)'), 'Diagram text overflows its nodes'
    page.screenshot(path=str(OUT/'overview-desktop.png'),full_page=True)
    results.append('1640px architecture: 5 business stages, 17 nodes, no synthetic telemetry, node contents fit')
    page.locator('.graph-node[data-id="optimize"]').click()
    assert '参数 / 策略 / 代码优化' in page.locator('#insight-panel').inner_text()
    page.screenshot(path=str(OUT/'overview-selected.png'),full_page=True)
    page.locator('#insight-panel [data-action="drill-node"]').click()
    assert page.locator('.focus-child').count()==1
    assert '现有高通参数调优 Agent' in page.locator('.focus-child').inner_text()
    page.screenshot(path=str(OUT/'capability-drilldown.png'),full_page=True)
    page.locator('.focus-head [data-action="add-child"]').click()
    page.locator('#f-name').fill('QA 独立策略能力')
    page.locator('#f-subtitle').fill('测试拆分，不是真实接入')
    save_form(page)
    assert page.locator('.focus-child').count()==2
    page.locator('.focus-child',has_text='QA 独立策略能力').click()
    page.locator('#insight-panel [data-action="edit"]').click()
    page.locator('#f-notes').fill('QA: preserve input/output and validation boundaries')
    save_form(page)
    stored=json.loads(page.evaluate("localStorage.getItem('gameperf-studio-v02')"))
    assert any(n['name']=='QA 独立策略能力' and n['parentId']=='optimize' and n['notes'].startswith('QA:') for n in stored['nodes'])
    results.append('Select → contract → drill-down → add child → edit; persisted to explicit test memory adapter')
    # Compatibility: load same v02 schema/key without wiping stored work.
    page.set_content(HTML,wait_until='domcontentloaded');page.wait_for_selector('.graph-canvas')
    assert page.locator('.metric-number').first.inner_text()=='18个'
    results.append('v02 storage key and schema 1 retained through UI bootstrap (not physical browser disk persistence)')
    page.locator('#search').fill('CPU')
    assert 'CPU 调度分析' in page.locator('.additional-nodes').inner_text()
    page.locator('#search').fill('')
    page.locator('[data-action="graph-filter"][data-value="evolution"]').click()
    assert page.locator('.business-node.map-muted').count()==5
    page.locator('[data-action="graph-filter"][data-value="all"]').click()
    results.append('Graph filter and nested-node search work without changing business data')
    before=page.evaluate("localStorage.getItem('gameperf-studio-v02')")
    page.clock.install()
    page.locator('[data-action="tour"]').click()
    assert '演示 1/7' in page.locator('#tour-caption').inner_text()
    for _ in range(7): page.clock.fast_forward(2700)
    assert '关系示意' in page.locator('#tour-caption').inner_text()
    assert page.evaluate("localStorage.getItem('gameperf-studio-v02')")==before
    page.locator('[data-action="toggle-motion"]').click()
    assert page.locator('.signal-wires').evaluate('(e)=>getComputedStyle(e).animationName')=='none'
    page.locator('[data-action="present"]').first.click()
    assert page.locator('body').evaluate("e=>e.classList.contains('presentation-mode')")
    page.keyboard.press('Escape')
    assert not page.locator('body').evaluate("e=>e.classList.contains('presentation-mode')")
    results.append('7-step illustrative tour ends cleanly, does not mutate records; motion toggle and presentation/Esc work')
    goto(page,'tasks')
    page.locator('[data-action="new"][data-kind="tasks"]').click()
    page.locator('#f-title').fill('QA 候选验证任务');page.locator('#f-device').fill('Device-QA');save_form(page)
    page.locator('.task-card',has_text='QA 候选验证任务').click()
    page.locator('[data-action="task-experiment"]').click()
    assert page.locator('#f-device').input_value()=='Device-QA'
    for field,value in {'title':'QA 实验候选','hypothesis':'UI 验证，不是性能实测','baseline':'qa-v1','candidate':'qa-v2','environment':'QA 环境','evidence':'qa://test-only','repeats':'3'}.items():
        page.locator('#f-'+field).fill(value)
    page.locator('#f-status').select_option('review');save_form(page)
    goto(page,'experiments');page.locator('tr',has_text='QA 实验候选').click()
    assert page.locator('#f-title').get_attribute('readonly') is not None
    page.locator('#review-note').fill('前端演示核验，未运行真实设备实验。');page.locator('#review-attest').check()
    page.locator('[data-action="review"][data-decision="rejected"]').click();page.wait_for_selector('.drawer',state='detached')
    assert '审核未通过' in page.locator('#page').inner_text()
    results.append('Task → linked experiment → required fields → freeze → explicitly demo-only review remains functional')
    goto(page,'feedback');page.once('dialog',lambda d:d.accept());page.locator('[data-action="convert-feedback"]').click()
    page.wait_for_selector('[data-action="edit"][data-kind="tasks"]')
    results.append('Feedback conversion creates linked task without executing an Agent')
    # User-controlled strings remain text, not HTML.
    goto(page,'capabilities');page.locator('[data-action="new"]').click()
    page.locator('#f-name').fill('<img src=x onerror="window.gpXss=1">');save_form(page)
    assert page.evaluate('window.gpXss||0')==0 and page.locator('.tree-main img').count()==0
    results.append('HTML-like node name remains escaped in directory and graph')
    routes=['overview','requirements','tasks','experiments','evolutions','feedback','capabilities','integrations','roadmap','settings']
    for route in routes:
        goto(page,route);assert page.locator('h1').count()==1
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    goto(page,'requirements');page.screenshot(path=str(OUT/'requirements-desktop.png'),full_page=True)
    results.append('All 10 desktop pages render, exactly one page heading, no page-level horizontal overflow')
    mobile=load(browser,390,844,reduced=True)
    assert mobile.locator('.signal-wires').evaluate('(e)=>getComputedStyle(e).animationName')=='none'
    mobile.screenshot(path=str(OUT/'overview-mobile.png'),full_page=True)
    for route in routes:
        mobile.locator('[data-action="menu"]').click();goto(mobile,route)
        assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth'),route
    results.append('390px mobile: all 10 views/nav fit; architecture canvas scrolls internally; OS reduced-motion respected')
    # Fresh screenshots have only seed data; QA records never ship with the preview.
    fresh=load(browser)
    goto(fresh,'tasks');fresh.screenshot(path=str(OUT/'tasks-desktop.png'),full_page=True)
    goto(fresh,'requirements');fresh.screenshot(path=str(OUT/'requirements-desktop.png'),full_page=True)
    goto(fresh,'evolutions');fresh.screenshot(path=str(OUT/'evolution-desktop.png'),full_page=True)
    assert not errors,errors
    browser.close()
report={'version':'0.3.0','checks':results,'pageErrors':errors,'method':'Playwright set_content with an explicit memory localStorage adapter. File navigation was attempted separately and blocked by browser policy. No policy was disabled. This is UI rendering/interaction validation, not real browser-to-server login, disk persistence, deployment or real-device acceptance.'}
(OUT/'browser-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
