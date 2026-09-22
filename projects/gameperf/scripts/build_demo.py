"""Generate the standalone demo from the shared UI; deterministic UTF-8 output."""
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

def replace_once(text: str, old: str, new: str) -> str:
    if text.count(old) != 1:
        raise ValueError(f"Expected one build marker: {old[:80]}")
    return text.replace(old, new, 1)

def render_demo() -> str:
    html = (ROOT / 'web/index.html').read_text(encoding='utf-8')
    html = replace_once(html, 'content="server"', 'content="demo"')
    html = replace_once(html, '<link rel="icon" href="favicon.svg" type="image/svg+xml">', '')
    css = (ROOT / 'web/styles.css').read_text(encoding='utf-8')
    html = replace_once(html, '<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>')
    for name in ['seed', 'app']:
        script = (ROOT / f'web/{name}.js').read_text(encoding='utf-8').replace('</script', '<\\/script')
        html = replace_once(html, f'<script src="{name}.js"></script>', '<script>\n' + script + '\n</script>')
    return html

if __name__ == '__main__':
    path = ROOT / 'gameperf-preview.html'
    path.write_text(render_demo(), encoding='utf-8', newline='\n')
    print(path)
