const metadata = await fetch('./release.json').then(response => {
  if (!response.ok) throw Error('Release metadata unavailable');
  return response.json();
}).catch(() => null);
if (metadata && /^[a-f0-9]{64}$/.test(metadata.sha256)) {
  document.querySelector('#archive-sha').textContent = metadata.sha256;
  const copy = document.querySelector('#copy-sha');
  copy.disabled = false;
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(metadata.sha256);
      document.querySelector('#copy-status').textContent = '校验值已复制';
    } catch {
      document.querySelector('#copy-status').textContent = '请选中校验值手动复制';
    }
  });
}
document.querySelector('#toggle-quota').addEventListener('click', event => {
  const used = event.currentTarget.getAttribute('aria-pressed') !== 'true';
  event.currentTarget.setAttribute('aria-pressed', String(used));
  for (const [selector, remaining, color, track] of [['.five',82,'#588464','#dfe6d7'],['.weekly',64,'#978cb6','#e5e1ef']]) {
    const ring = document.querySelector(selector);
    const value = used ? 100 - remaining : remaining;
    ring.replaceChildren(document.createTextNode(String(value)), Object.assign(document.createElement('small'), {textContent:'%'}));
    ring.style.background = `conic-gradient(${color} ${value}%,${track} 0)`;
    ring.nextElementSibling.querySelector('small').textContent = `${used ? '已用' : '剩余'} · 示例`;
  }
});
