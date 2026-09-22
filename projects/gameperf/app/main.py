"""GamePerf Studio: authenticated record workbench, not a device execution service."""
import json
import os
import secrets
import sqlite3
import time
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import ValidationError
from starlette.middleware.trustedhost import TrustedHostMiddleware
from . import db as store
from .models import CONTRACTS, Project

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = os.environ.get('GP_ORIGIN','http://localhost:8765').rstrip('/')
SECURE_COOKIE = os.environ.get('GP_COOKIE_SECURE','true').lower() == 'true'
MAX_BODY = 1_000_000
COOKIE = 'gp_session'
EDIT_ROLES = {'admin','editor'}
REVIEW_ROLES = {'admin','reviewer'}

@asynccontextmanager
async def lifespan(app):
    store.init_db()
    yield

app=FastAPI(title='GamePerf Studio',version='0.3.0',docs_url=None,redoc_url=None,openapi_url=None,lifespan=lifespan)
app.add_middleware(TrustedHostMiddleware,allowed_hosts=list({urlparse(ORIGIN).hostname or 'localhost','localhost','127.0.0.1','testserver'}))

@app.middleware('http')
async def security_headers(request,call_next):
    if request.method in {'POST','PUT','DELETE','PATCH'}:
        origin=request.headers.get('origin')
        if origin and origin != ORIGIN:
            return JSONResponse({'detail':'请求来源不匹配，请检查 GP_ORIGIN'},status_code=403)
        if request.headers.get('sec-fetch-site') in {'cross-site','same-site'} and origin != ORIGIN:
            return JSONResponse({'detail':'拒绝跨站写入'},status_code=403)
        try:
            if int(request.headers.get('content-length','0')) > MAX_BODY:
                return JSONResponse({'detail':'请求过大，最大 1 MB'},status_code=413)
        except ValueError:
            return JSONResponse({'detail':'非法 Content-Length'},status_code=400)
    response=await call_next(request)
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['X-Frame-Options']='DENY'
    response.headers['Referrer-Policy']='no-referrer'
    response.headers['Permissions-Policy']='camera=(), microphone=(), geolocation=()'
    response.headers['Content-Security-Policy']="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
    response.headers['Cache-Control']='no-store' if request.url.path.startswith('/api') else 'no-cache'
    return response

async def body(request):
    if request.headers.get('content-type','').split(';')[0].strip() != 'application/json':
        raise HTTPException(415,'需要 application/json')
    chunks=[]; total=0
    async for chunk in request.stream():
        total+=len(chunk)
        if total>MAX_BODY: raise HTTPException(413,'请求过大，最大 1 MB')
        chunks.append(chunk)
    try:
        value=json.loads(b''.join(chunks))
        if not isinstance(value,dict): raise ValueError()
        return value
    except (ValueError,UnicodeDecodeError): raise HTTPException(400,'需要有效的 JSON 对象')

def auth(request,roles=None,write=False):
    token=request.cookies.get(COOKIE,'')
    with store.connect() as db:
        session=db.execute('SELECT s.*,u.role FROM sessions s JOIN users u ON u.name=s.username WHERE s.hash=? AND s.expires>?',(store.digest(token),time.time())).fetchone()
    if not session: raise HTTPException(401,'请登录，或会话已过期')
    if roles and session['role'] not in roles: raise HTTPException(403,'当前角色没有此操作权限')
    if write and not secrets.compare_digest(request.headers.get('x-csrf-token',''),session['csrf']):
        raise HTTPException(403,'CSRF 校验失败，请刷新后重试')
    return dict(name=session['username'],role=session['role'],csrf=session['csrf'])

def parse(kind,data):
    if kind not in CONTRACTS: raise HTTPException(404,'未知记录类型')
    try: return CONTRACTS[kind].model_validate(data).model_dump()
    except ValidationError as exc:
        problems=['.'.join(map(str,e['loc']))+': '+e['msg'] for e in exc.errors()]
        raise HTTPException(422,'；'.join(problems)[:1800])

def ensure_refs(db,kind,data,id=''):
    if kind == 'nodes' and data.get('parentId'):
        seen={id}; parent=data['parentId']
        while parent:
            if parent in seen: raise HTTPException(422,'不能形成父子循环')
            seen.add(parent); n=store.get(db,'nodes',parent)
            if not n: raise HTTPException(422,'父节点不存在')
            parent=n.get('parentId','')
    if kind=='tasks' and data.get('stageId') and not store.get(db,'nodes',data['stageId']):
        raise HTTPException(422,'业务节点不存在')
    if kind in {'experiments','feedback'} and data.get('taskId') and not store.get(db,'tasks',data['taskId']):
        raise HTTPException(422,'关联任务不存在')
    if kind in {'experiments','evolutions'} and data.get('status')=='review':
        fields=['evidence','baseline','candidate','hypothesis','environment'] if kind=='experiments' else ['evidence','oldVersion','candidateVersion','modelVersion','evalVersion','holdout','budget','result']
        missing=[x for x in fields if not data.get(x)]
        if kind=='experiments' and data.get('repeats',0)<1: missing.append('repeats >= 1')
        if data.get('sample'): missing.append('sample 示例不能进入服务器正式审核')
        if missing: raise HTTPException(422,'提交审核前需补齐：'+', '.join(missing))

def expected_version(request):
    try: return int(request.headers.get('if-match','').strip('"'))
    except ValueError: raise HTTPException(428,'需要 If-Match 版本号，避免覆盖别人的修改')

@app.get('/api/health')
def health(): return {'ok':True,'version':'0.3.0'}

@app.get('/api/info')
def info():
    with store.connect() as db:
        initialized=bool(db.execute('SELECT 1 FROM users LIMIT 1').fetchone())
    return {'mode':'server','initialized':initialized,'version':'0.3.0'}

@app.post('/api/login')
async def login(request:Request):
    if request.headers.get('x-gp-client')!='web': raise HTTPException(403,'缺少请求标识')
    data=await body(request)
    username=str(data.get('username',''))[:100]; password=str(data.get('password',''))[:1024]
    ip=request.client.host if request.client else 'unknown'
    key=store.digest(ip+'|'+username); ts=time.time()
    with store.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        row=db.execute('SELECT * FROM login_attempts WHERE key=?',(key,)).fetchone()
        count=row['count'] if row and ts-row['window']<900 else 0
        window=row['window'] if row and ts-row['window']<900 else ts
        if count>=10: raise HTTPException(429,'尝试过多，请在 15 分钟后重试')
        # Commit the attempt even when credentials are wrong.
        db.execute('INSERT OR REPLACE INTO login_attempts VALUES(?,?,?)',(key,count+1,window))
        user=db.execute('SELECT * FROM users WHERE name=?',(username,)).fetchone()
    # Equal-cost password work for unknown users.
    dummy='pbkdf2_sha256$600000$'+'0'*32+'$'+'0'*64
    valid=store.check_password(password,user['password'] if user else dummy)
    if not user or not valid: raise HTTPException(401,'用户名或密码不正确')
    session=secrets.token_urlsafe(32); csrf=secrets.token_urlsafe(32)
    with store.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        db.execute('DELETE FROM login_attempts WHERE key=? OR window<?',(key,ts-86400))
        db.execute('DELETE FROM sessions WHERE expires<?',(ts,))
        db.execute('INSERT INTO sessions VALUES(?,?,?,?)',(store.digest(session),username,csrf,ts+43200))
        store.audit(db,username,'login','session','', '登录成功')
    response=JSONResponse({'name':username,'role':user['role'],'csrf':csrf})
    response.set_cookie(COOKIE,session,max_age=43200,httponly=True,secure=SECURE_COOKIE,samesite='strict',path='/')
    return response

@app.post('/api/logout')
async def logout(request:Request):
    user=auth(request,write=True)
    with store.connect() as db:
        db.execute('DELETE FROM sessions WHERE hash=?',(store.digest(request.cookies.get(COOKIE,'')),))
        store.audit(db,user['name'],'logout','session','')
    response=JSONResponse({'ok':True}); response.delete_cookie(COOKIE,path='/',secure=SECURE_COOKIE,httponly=True,samesite='strict')
    return response

@app.get('/api/me')
def me(request:Request): return auth(request)

@app.get('/api/workspace')
def workspace(request:Request):
    user=auth(request)
    with store.connect() as db:
        data={kind:store.all_of(db,kind) for kind in CONTRACTS}
        data.update(schemaVersion=1,project=store.get(db,'project','main'))
        data['audit']=[dict(r) for r in db.execute('SELECT * FROM audit ORDER BY seq DESC LIMIT 120')]
        data['integration']={'events':db.execute('SELECT count(*) FROM ingestion').fetchone()[0], 'lastEvent':db.execute('SELECT max(at) FROM ingestion').fetchone()[0]}
    data['user']=user
    return data

@app.put('/api/project')
async def edit_project(request:Request):
    user=auth(request,EDIT_ROLES,True); version=expected_version(request)
    try: data=Project.model_validate(await body(request)).model_dump()
    except ValidationError: raise HTTPException(422,'项目字段格式不正确')
    with store.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        if not store.update(db,'project','main',data,version): raise HTTPException(409,'项目已被其他会话修改，请刷新')
        store.audit(db,user['name'],'update','project','main')
        return store.get(db,'project','main')

@app.post('/api/records/{kind}')
async def create(kind:str,request:Request):
    user=auth(request,EDIT_ROLES,True); data=parse(kind,await body(request)); id=secrets.token_hex(12)
    with store.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        ensure_refs(db,kind,data,id)
        if kind in {'experiments','evolutions'}:
            data['contributors']=[user['name']]
        record=store.insert(db,kind,id,data,user['name'])
        store.audit(db,user['name'],'create',kind,id,data.get('title',data.get('name','')))
        return record

@app.put('/api/records/{kind}/{id}')
async def edit(kind:str,id:str,request:Request):
    user=auth(request,EDIT_ROLES,True); version=expected_version(request); data=parse(kind,await body(request))
    with store.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        current=store.get(db,kind,id)
        if not current: raise HTTPException(404,'记录不存在')
        if current['version'] != version: raise HTTPException(409,'记录已被其他会话修改，请刷新后合并')
        if kind in {'experiments','evolutions'} and current.get('status') in {'review','accepted','rejected'}:
            raise HTTPException(409,'提交后的候选已冻结；请复制为新候选，保留原始证据')
        ensure_refs(db,kind,data,id)
        if kind in {'experiments','evolutions'}:
            data['contributors']=sorted(set(current.get('contributors',[current['author']])+[user['name']]))
        if not store.update(db,kind,id,data,version): raise HTTPException(409,'版本冲突，请刷新')
        store.audit(db,user['name'],'update',kind,id,data.get('title',data.get('name','')))
        return store.get(db,kind,id)

@app.delete('/api/records/{kind}/{id}')
def delete(kind:str,id:str,request:Request):
    user=auth(request,EDIT_ROLES,True); version=expected_version(request)
    if kind not in CONTRACTS: raise HTTPException(404,'未知记录类型')
    with store.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        current=store.get(db,kind,id)
        if not current: raise HTTPException(404,'记录不存在')
        if current['version']!=version: raise HTTPException(409,'版本冲突，请刷新')
        if kind in {'experiments','evolutions'} and current.get('status')!='draft': raise HTTPException(409,'已提交或审核记录不可删除')
        if kind=='nodes':
            if id in {'upper','orchestrator','evolution','judge'}: raise HTTPException(409,'核心治理节点不可删除，但可编辑')
            if any(n.get('parentId')==id for n in store.all_of(db,'nodes')) or any(t.get('stageId')==id for t in store.all_of(db,'tasks')):
                raise HTTPException(409,'节点仍被子节点或任务引用')
        if kind=='tasks' and any(r.get('taskId')==id for k in ['experiments','feedback'] for r in store.all_of(db,k)):
            raise HTTPException(409,'任务已有实验或反馈关联，不能删除')
        db.execute('DELETE FROM records WHERE kind=? AND id=? AND version=?',(kind,id,version))
        store.audit(db,user['name'],'delete',kind,id,current.get('title',current.get('name','')))
    return {'ok':True}

@app.post('/api/review/{kind}/{id}')
async def review(kind:str,id:str,request:Request):
    user=auth(request,REVIEW_ROLES,True); version=expected_version(request); data=await body(request)
    if kind not in {'experiments','evolutions'}: raise HTTPException(404,'不支持此类型的审核')
    decision=data.get('decision'); note=data.get('note','')
    if decision not in {'accepted','rejected'} or not isinstance(note,str) or not 5<=len(note)<=4000:
        raise HTTPException(422,'需要审核决定和至少 5 字的审核依据')
    if data.get('attested') is not True: raise HTTPException(422,'需要确认已独立检查原始证据；不是自动评测通过')
    with store.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        current=store.get(db,kind,id)
        if not current: raise HTTPException(404,'记录不存在')
        if current['version']!=version: raise HTTPException(409,'版本冲突，请刷新')
        if current['author']==user['name'] or user['name'] in current.get('contributors',[]): raise HTTPException(403,'提交者不能审核自己的候选；请使用独立审核人账号')
        if current.get('status')!='review': raise HTTPException(409,'候选必须先提交审核')
        values={k:v for k,v in current.items() if k not in {'id','version','author','updatedAt'}}
        values.update(status=decision,reviewer=user['name'],reviewNote=note,reviewedAt=store.now())
        if not store.update(db,kind,id,values,version): raise HTTPException(409,'版本冲突，请刷新')
        store.audit(db,user['name'],'review',kind,id,decision+'：'+note)
        return store.get(db,kind,id)

@app.post('/api/feedback/{id}/task')
async def feedback_to_task(id:str,request:Request):
    user=auth(request,EDIT_ROLES,True); version=expected_version(request)
    with store.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        current=store.get(db,'feedback',id)
        if not current: raise HTTPException(404,'反馈不存在')
        if current['version']!=version: raise HTTPException(409,'版本冲突，请刷新')
        if current.get('taskId'): raise HTTPException(409,'已转为任务，不能重复转换')
        data=parse('tasks',dict(title=current['title'],device=current['device'],game=current['game'],baseline=current['baseline'],notes=current['description'],stageId='diagnose',sample=current.get('sample',False)))
        task=store.insert(db,'tasks',secrets.token_hex(12),data,user['name'])
        values={k:v for k,v in current.items() if k not in {'id','version','author','updatedAt'}}
        values.update(status='linked',taskId=task['id'])
        if not store.update(db,'feedback',id,values,version): raise HTTPException(409,'版本冲突，请刷新')
        store.audit(db,user['name'],'convert','feedback',id,'转为任务 '+task['id'])
        return task

@app.post('/api/import')
async def import_workspace(request:Request):
    user=auth(request,{'admin'},True); incoming=await body(request)
    if incoming.get('schemaVersion')!=1: raise HTTPException(422,'仅支持 schemaVersion=1')
    if any(not isinstance(incoming.get(k,[]),list) for k in CONTRACTS): raise HTTPException(422,'记录集合应为数组')
    if sum(len(incoming.get(k,[])) for k in CONTRACTS)>1000: raise HTTPException(422,'单次最多导入 1000 条记录')
    # Merge new blueprint nodes; never overwrite existing nodes or decisions.
    ids={}; counts={k:0 for k in CONTRACTS}
    with store.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        newnodes=[]
        for raw in incoming.get('nodes',[]):
            if not isinstance(raw,dict): raise HTTPException(422,'节点不是对象')
            old=str(raw.get('id',''))
            if not old or ('nodes',old) in ids: raise HTTPException(422,'节点 ID 缺失或重复')
            if store.get(db,'nodes',old): ids['nodes',old]=old; continue
            new=secrets.token_hex(12); ids['nodes',old]=new
            values={k:v for k,v in raw.items() if k in CONTRACTS['nodes'].model_fields}
            newnodes.append((new,parse('nodes',values)))
        for id,values in newnodes:
            parent=values.get('parentId',''); values['parentId']=ids.get(('nodes',parent),parent)
            store.insert(db,'nodes',id,values,user['name']); counts['nodes']+=1
        for id,values in newnodes: ensure_refs(db,'nodes',values,id)
        for kind in ['tasks','experiments','evolutions','feedback']:
            for raw in incoming.get(kind,[]):
                if not isinstance(raw,dict): raise HTTPException(422,'记录不是对象')
                old=str(raw.get('id','')); new=secrets.token_hex(12)
                if old and (kind,old) in ids: raise HTTPException(422,'记录 ID 重复')
                ids[kind,old]=new
                values={k:v for k,v in raw.items() if k in CONTRACTS[kind].model_fields}
                if kind in {'experiments','evolutions'}: values['status']='draft'
                if values.get('taskId'): values['taskId']=ids.get(('tasks',values['taskId']),values['taskId'])
                if values.get('stageId'): values['stageId']=ids.get(('nodes',values['stageId']),values['stageId'])
                values=parse(kind,values); ensure_refs(db,kind,values,new)
                if kind in {'experiments','evolutions'}: values['contributors']=[user['name']]
                store.insert(db,kind,new,values,user['name']); counts[kind]+=1
        store.audit(db,user['name'],'import','workspace','',json.dumps(counts,ensure_ascii=False)+'；审核结论不导入')
    return {'counts':counts,'note':'业务记录作为副本导入，候选回到草稿；既有蓝图节点未覆盖'}

@app.post('/api/ingest')
async def ingest(request:Request):
    """Write-only integration. Cannot approve, execute code or manipulate devices."""
    token=request.headers.get('authorization','').removeprefix('Bearer ')
    data=await body(request)
    event=str(data.get('eventId','')); kind=data.get('type'); payload=data.get('payload')
    if not 1<=len(event)<=120 or kind not in {'tasks','experiments'} or not isinstance(payload,dict):
        raise HTTPException(422,'需要 eventId、type(tasks/experiments)、payload')
    if kind=='experiments': payload=dict(payload,status='draft')
    payload=parse(kind,payload)
    body_hash=store.digest(json.dumps(dict(type=kind,payload=payload),sort_keys=True,ensure_ascii=False))
    with store.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        t=db.execute('SELECT * FROM tokens WHERE hash=? AND expires>?',(store.digest(token),time.time())).fetchone()
        if not t: raise HTTPException(401,'集成凭证无效或已过期')
        prior=db.execute('SELECT * FROM ingestion WHERE token_id=? AND event_id=?',(t['id'],event)).fetchone()
        if prior:
            if prior['body_hash']!=body_hash: raise HTTPException(409,'相同 eventId 对应不同内容')
            return dict(json.loads(prior['result']),duplicate=True)
        if db.execute('SELECT count(*) FROM ingestion WHERE token_id=? AND at>?',(t['id'],__import__('datetime').datetime.fromtimestamp(time.time()-60,__import__('datetime').timezone.utc).isoformat(timespec='seconds'))).fetchone()[0]>=120:
            raise HTTPException(429,'每分钟最多接收 120 条新事件')
        ensure_refs(db,kind,payload)
        if kind=='experiments': payload['contributors']=['integration:'+t['name']]
        record=store.insert(db,kind,secrets.token_hex(12),payload,'integration:'+t['name'])
        result={'id':record['id'],'version':record['version'],'type':kind}
        db.execute('INSERT INTO ingestion VALUES(?,?,?,?,?)',(t['id'],event,body_hash,json.dumps(result),store.now()))
        db.execute('UPDATE tokens SET last_used=? WHERE id=?',(store.now(),t['id']))
        store.audit(db,'integration:'+t['name'],'ingest',kind,record['id'],event)
        return result

@app.get('/')
def index(): return FileResponse(ROOT/'web/index.html')

@app.get('/{asset}')
def static(asset:str):
    if asset not in {'styles.css','app.js','seed.js','favicon.svg'}: raise HTTPException(404,'页面不存在')
    return FileResponse(ROOT/'web'/asset)
