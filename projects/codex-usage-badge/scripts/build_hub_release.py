"""Build the reviewed Windows snapshot and pin a single-file bootstrap to its hash."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
package = json.loads((root / 'package.json').read_text(encoding='utf-8'))
version = package['hubVersion']
name = f'CodexUsageBadge-Windows-{version}'
tag = f'codex-usage-badge-v{version}'
base = f'https://github.com/arsenaltj/creative-hub/releases/download/{tag}'
subprocess.run([sys.executable, str(root / 'scripts/build_release.py'), '--platform', 'Windows'], check=True)
dist = root / 'dist'
upstream_name = f"CodexUsageBadge-Windows-{package['windowsVersion']}"
with zipfile.ZipFile(dist / (upstream_name + '.zip')) as archive:
    payload = {n.removeprefix(upstream_name + '/'): archive.read(n) for n in archive.namelist()}
payload.pop('SHA256SUMS.txt')
payload['UPSTREAM.md'] = (root / 'UPSTREAM.md').read_bytes()
payload['README-Windows.md'] = payload['UPSTREAM.md']
payload['SHA256SUMS.txt'] = ''.join(f'{hashlib.sha256(data).hexdigest()}  {file}\n' for file, data in sorted(payload.items())).encode()
archive_path = dist / (name + '.zip')
with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as archive:
    for file, data in sorted(payload.items()):
        info = zipfile.ZipInfo(name + '/' + file, date_time=(2026, 1, 1, 0, 0, 0))
        info.create_system = 3
        info.external_attr = 0o100644 << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(info, data)
digest = hashlib.sha256(archive_path.read_bytes()).hexdigest()
installer = (root / 'installer/bootstrap.cmd.in').read_text(encoding='utf-8').replace('@VERSION@', version).replace('@URL@', base + '/' + archive_path.name).replace('@NAME@', name).replace('@SHA256@', digest)
if any(token in installer for token in ['@VERSION@', '@URL@', '@NAME@', '@SHA256@']):
    raise SystemExit('Unresolved bootstrap placeholder')
installer_data = installer.replace('\r\n', '\n').replace('\n', '\r\n').encode('ascii')
(dist / 'Install-CodexUsageBadge.cmd').write_bytes(installer_data)
(root / 'installer/Install-CodexUsageBadge.cmd').write_bytes(installer_data)
installer_digest = hashlib.sha256(installer_data).hexdigest()
metadata = {'version': version, 'upstreamVersion': package['windowsVersion'], 'tag': tag,
            'release': f'https://github.com/arsenaltj/creative-hub/releases/tag/{tag}',
            'archive': base + '/' + archive_path.name, 'sha256': digest,
            'installer': base + '/Install-CodexUsageBadge.cmd', 'installerSha256': installer_digest}
(root / 'release.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8', newline='\n')
(dist / 'HUB-SHA256SUMS.txt').write_text(f'{digest}  {archive_path.name}\n{installer_digest}  Install-CodexUsageBadge.cmd\n', encoding='utf-8', newline='\n')
print('Built Hub release:', archive_path.name)
print('SHA256:', digest)
