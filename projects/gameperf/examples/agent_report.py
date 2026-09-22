"""Small write-only adapter for your existing Agent; standard library only.

Set GP_URL=https://your-domain and GP_TOKEN in the Agent's trusted environment.
Never put GP_TOKEN in browser JS or logs. Import StudioClient into your existing
Agent and call report() after an actual event. This module executes no devices.
"""
from __future__ import annotations
import json
import os
import time
import urllib.error
import urllib.request
from typing import Any
from urllib.parse import urlparse

class StudioClient:
    def __init__(self, url: str | None = None, token: str | None = None, timeout: float = 20):
        self.url=(url or os.environ.get('GP_URL','')).rstrip('/')
        self.token=token or os.environ.get('GP_TOKEN','')
        self.timeout=timeout
        parsed=urlparse(self.url)
        local=parsed.hostname in {'localhost','127.0.0.1'}
        if not parsed.netloc or (parsed.scheme!='https' and not (local and parsed.scheme=='http')):
            raise ValueError('GP_URL must use HTTPS, except loopback development.')
        if parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError('Do not put credentials, queries or fragments in GP_URL.')
        if not self.token:raise ValueError('Set GP_TOKEN in a trusted environment.')

    def report(self, event_id: str, kind: str, payload: dict[str,Any], attempts: int = 3) -> dict[str,Any]:
        """Use a stable event_id on retries. HTTP 200 only means record accepted."""
        if kind not in {'tasks','experiments'}:raise ValueError('Only task and experiment-draft ingestion is supported.')
        if not 1<=len(event_id)<=120:raise ValueError('event_id must contain 1–120 characters.')
        raw=json.dumps({'eventId':event_id,'type':kind,'payload':payload},ensure_ascii=False,allow_nan=False).encode()
        if len(raw)>1_000_000:raise ValueError('Payload exceeds 1 MB; send evidence references, not raw logs.')
        request=urllib.request.Request(self.url+'/api/ingest',data=raw,headers={'Authorization':'Bearer '+self.token,'Content-Type':'application/json'},method='POST')
        for attempt in range(max(1,attempts)):
            try:
                with urllib.request.urlopen(request,timeout=self.timeout) as response:
                    return json.load(response)
            except urllib.error.HTTPError as exc:
                message=exc.read(4096).decode(errors='replace')
                if exc.code not in {429,502,503,504} or attempt==attempts-1:
                    raise RuntimeError(f'Studio rejected the event (HTTP {exc.code}): {message}') from None
            except urllib.error.URLError:
                if attempt==attempts-1:raise RuntimeError('Studio could not be reached; retain the event and retry later.') from None
            time.sleep(min(2**attempt,8))
        raise RuntimeError('No attempt was performed.')

if __name__=='__main__':
    print('Import StudioClient into the existing Agent. This example does not auto-send fabricated performance data.')
    print('See docs/API.md for the task → experiment contract and idempotency behavior.')
