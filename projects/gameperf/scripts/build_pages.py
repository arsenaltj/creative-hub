"""Build only the public browser demo, never the authenticated server UI."""
from build_demo import ROOT, render_demo, replace_once

def render_pages() -> str:
    html = render_demo()
    policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'"
    meta = '<meta name="gp-portfolio" content="creative-hub">\n'
    meta += '<meta name="description" content="GamePerf Studio 游戏性能研发蓝图、任务与实验记录演示。修改仅存本浏览器，未接入设备与云端后端。">\n'
    meta += f'<meta http-equiv="Content-Security-Policy" content="{policy}">\n'
    html = replace_once(html, '<meta name="gp-mode" content="demo">', '<meta name="gp-mode" content="demo">\n' + meta)
    html = replace_once(html, '<span>整机协作网络</span>', '<a class="portfolio-back" href="../../" aria-label="返回创意实验室作品集">← 作品集</a>')
    html = replace_once(html, '<strong>本机预览</strong>', '<strong>作品集演示 · 非云端工作台</strong>')
    html = replace_once(html, '业务记录为示例；修改只保存在此浏览器。图中动效是链路示意，不是 Agent 运行状态。', '示例记录与修改仅存此浏览器，不写回 GitHub、不跨设备同步；请勿填入敏感资料。动效不代表真实执行。')
    style = '<style>.portfolio-back{color:#64e2cf;white-space:nowrap}.portfolio-back:focus-visible{outline:2px solid currentColor;outline-offset:4px}</style>'
    html = replace_once(html, '</head>', style + '\n</head>')
    return html

if __name__ == '__main__':
    target = ROOT / 'index.html'
    target.write_text(render_pages(), encoding='utf-8', newline='\n')
    print(target)
