import json
import secrets
import time
import pytest
from fastapi.testclient import TestClient
from app import db as store
from app import main

ORIGIN='http://localhost:8765'
PASSWORD='a-strong-test-password-not-shipped'

@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setattr(store,'DATA_DIR',tmp_path)
    monkeypatch.setattr(store,'DB_PATH',tmp_path/'studio.sqlite3')
    monkeypatch.setattr(main,'SECURE_COOKIE',False)
    with TestClient(main.app,base_url=ORIGIN) as client:
        encoded=store.password_hash(PASSWORD)
        with store.connect() as db:
            for name,role in [('admin','admin'),('editor','editor'),('reviewer','reviewer'),('viewer','viewer')]:
                db.execute('INSERT INTO users VALUES(?,?,?,?)',(name,encoded,role,store.now()))
        yield client

def login(c,name='editor'):
    r=c.post('/api/login',json={'username':name,'password':PASSWORD},headers={'X-GP-Client':'web','Origin':ORIGIN})
    assert r.status_code==200,r.text
    return {'X-CSRF-Token':r.json()['csrf'],'Origin':ORIGIN}

def create(c,headers,kind,data):
    r=c.post('/api/records/'+kind,json=data,headers=headers)
    assert r.status_code==200,r.text
    return r.json()

def sample_task(c,h):return create(c,h,'tasks',{'title':'real task','stageId':'diagnose'})
def sample_exp(c,h,task,status='draft'):
    return create(c,h,'experiments',{'title':'real exp','taskId':task['id'],'hypothesis':'test scheduling delay','baseline':'v1','candidate':'v2','environment':'controlled start temperature','evidence':'controlled://logs/exp-1','repeats':3,'status':status})

def test_login_and_protected_data(client):
    assert client.get('/api/workspace').status_code==401
    assert client.get('/api/health').status_code==200
    assert client.post('/api/login',json={'username':'editor','password':PASSWORD}).status_code==403
    h=login(client)
    w=client.get('/api/workspace').json()
    assert len(w['nodes'])==17 and w['tasks']==[]
    assert client.post('/api/records/tasks',json={'title':'x'},headers={'Origin':ORIGIN}).status_code==403
    assert client.post('/api/records/tasks',json={'title':'x'},headers={**h,'Origin':'https://evil.example'}).status_code==403
    assert 'httponly' in str(client.cookies).lower() or len(client.cookies)>0
    assert "script-src 'self'" in client.get('/').headers['content-security-policy']

def test_password_errors_and_rate_limit(client):
    for _ in range(10):
        r=client.post('/api/login',json={'username':'bad','password':'bad'},headers={'X-GP-Client':'web','Origin':ORIGIN})
        assert r.status_code==401
    assert client.post('/api/login',json={'username':'bad','password':'bad'},headers={'X-GP-Client':'web','Origin':ORIGIN}).status_code==429

def test_crud_conflict_and_references(client):
    h=login(client); t=sample_task(client,h)
    payload={k:v for k,v in t.items() if k in main.CONTRACTS['tasks'].model_fields};payload['title']='updated'
    r=client.put('/api/records/tasks/'+t['id'],json=payload,headers=h)
    assert r.status_code==428
    assert client.put('/api/records/tasks/'+t['id'],json=payload,headers={**h,'If-Match':'1'}).status_code==200
    assert client.put('/api/records/tasks/'+t['id'],json=payload,headers={**h,'If-Match':'1'}).status_code==409
    exp=sample_exp(client,h,t)
    assert client.delete('/api/records/tasks/'+t['id'],headers={**h,'If-Match':'2'}).status_code==409
    assert client.post('/api/records/experiments',json={'title':'bad','taskId':'missing'},headers=h).status_code==422
    assert client.post('/api/records/tasks',json={'title':'bad','arbitraryCommand':'rm -rf'},headers=h).status_code==422
    assert client.get('/../app/seed.json').status_code==404

def test_viewer_no_write_and_reviewer_no_edit(client):
    h=login(client,'viewer')
    assert client.get('/api/workspace').status_code==200
    assert client.post('/api/records/tasks',json={'title':'x'},headers=h).status_code==403
    h=login(client,'reviewer')
    assert client.post('/api/records/tasks',json={'title':'x'},headers=h).status_code==403

def test_independent_review_and_immutability(client):
    h=login(client,'admin');t=sample_task(client,h);e=sample_exp(client,h,t,status='review')
    r=client.post('/api/review/experiments/'+e['id'],json={'decision':'accepted','note':'I independently checked evidence','attested':True},headers={**h,'If-Match':'1'})
    assert r.status_code==403
    assert client.delete('/api/records/experiments/'+e['id'],headers={**h,'If-Match':'1'}).status_code==409
    hr=login(client,'reviewer')
    assert client.post('/api/review/experiments/'+e['id'],json={'decision':'accepted','note':'I independently checked evidence','attested':False},headers={**hr,'If-Match':'1'}).status_code==422
    r=client.post('/api/review/experiments/'+e['id'],json={'decision':'accepted','note':'I independently checked evidence','attested':True},headers={**hr,'If-Match':'1'})
    assert r.status_code==200,r.text
    h=login(client,'admin')
    payload={k:v for k,v in e.items() if k in main.CONTRACTS['experiments'].model_fields};payload['status']='draft'
    assert client.put('/api/records/experiments/'+e['id'],json=payload,headers={**h,'If-Match':'2'}).status_code==409
    payload['status']='accepted'
    assert client.post('/api/records/experiments',json=payload,headers=h).status_code==422

def test_validation_sample_cannot_submit(client):
    h=login(client);t=sample_task(client,h)
    r=client.post('/api/records/experiments',json={'title':'x','taskId':t['id'],'status':'review'},headers=h)
    assert r.status_code==422
    r=client.post('/api/records/experiments',json={'title':'x','taskId':t['id'],'status':'draft','p95Baseline':-1},headers=h)
    assert r.status_code==422
    e=sample_exp(client,h,t)
    p={k:v for k,v in e.items() if k in main.CONTRACTS['experiments'].model_fields};p.update(sample=True,status='review')
    assert client.put('/api/records/experiments/'+e['id'],json=p,headers={**h,'If-Match':'1'}).status_code==422

def test_node_tree_no_cycles(client):
    h=login(client)
    a=create(client,h,'nodes',{'name':'A','parentId':'diagnose'})
    b=create(client,h,'nodes',{'name':'B','parentId':a['id']})
    p={k:v for k,v in a.items() if k in main.CONTRACTS['nodes'].model_fields};p['parentId']=b['id']
    assert client.put('/api/records/nodes/'+a['id'],json=p,headers={**h,'If-Match':'1'}).status_code==422
    assert client.delete('/api/records/nodes/'+a['id'],headers={**h,'If-Match':'1'}).status_code==409

def test_feedback_to_task_is_single_action(client):
    h=login(client);f=create(client,h,'feedback',{'title':'feedback'})
    r=client.post('/api/feedback/'+f['id']+'/task',json={},headers={**h,'If-Match':'1'})
    assert r.status_code==200
    assert client.post('/api/feedback/'+f['id']+'/task',json={},headers={**h,'If-Match':'2'}).status_code==409
    with store.connect() as db:assert len(store.all_of(db,'tasks'))==1

def test_ingestion_idempotency_and_scope(client):
    token='gp_test_'+secrets.token_urlsafe(32)
    with store.connect() as db:db.execute('INSERT INTO tokens VALUES(?,?,?,?,?,NULL)',('t1','test-agent',store.digest(token),store.now(),time.time()+3600))
    headers={'Authorization':'Bearer '+token}
    payload={'eventId':'job1','type':'tasks','payload':{'title':'task from agent'}}
    a=client.post('/api/ingest',json=payload,headers=headers)
    assert a.status_code==200,a.text
    b=client.post('/api/ingest',json=payload,headers=headers)
    assert b.json()['id']==a.json()['id'] and b.json()['duplicate']
    payload['payload']['title']='changed'
    assert client.post('/api/ingest',json=payload,headers=headers).status_code==409
    assert client.get('/api/workspace',headers=headers).status_code==401
    assert client.post('/api/ingest',json={'eventId':'e1','type':'experiments','payload':{'title':'exp','taskId':a.json()['id'],'status':'accepted'}},headers=headers).status_code==200
    with store.connect() as db:
        assert store.all_of(db,'experiments')[0]['status']=='draft'
        db.execute('DELETE FROM tokens WHERE id=?',('t1',))
    assert client.post('/api/ingest',json=payload,headers=headers).status_code==401

def test_import_resets_decisions_and_does_not_overwrite(client):
    h=login(client,'admin')
    data={'schemaVersion':1,'nodes':[{'id':'diagnose','name':'overwrite attempt','group':'business'}], 'tasks':[{'id':'old-task','title':'imported'}], 'experiments':[{'id':'old-exp','title':'imported exp','taskId':'old-task','status':'accepted','reviewer':'forged'}]}
    r=client.post('/api/import',json=data,headers=h)
    assert r.status_code==200,r.text
    w=client.get('/api/workspace').json()
    assert next(n for n in w['nodes'] if n['id']=='diagnose')['name']!='overwrite attempt'
    assert w['experiments'][0]['status']=='draft' and 'reviewer' not in w['experiments'][0]

def test_database_reinitialize_preserves_data(client):
    h=login(client);t=sample_task(client,h);store.init_db()
    with store.connect() as db:
        assert store.get(db,'tasks',t['id'])['title']=='real task'
        assert len(store.all_of(db,'nodes'))==17

def test_request_size_and_invalid_payload(client):
    h=login(client)
    assert client.post('/api/records/tasks',content='x'*1_000_001,headers={**h,'Content-Type':'application/json'}).status_code==413
    assert client.post('/api/records/tasks',json=[],headers=h).status_code==400
    assert client.post('/api/records/tasks',content='not json',headers={**h,'Content-Type':'text/plain'}).status_code==415

def test_contributing_editor_cannot_later_review(client):
    h=login(client,'editor');t=sample_task(client,h);e=sample_exp(client,h,t)
    ha=login(client,'admin')
    p={k:v for k,v in e.items() if k in main.CONTRACTS['experiments'].model_fields};p['status']='review'
    r=client.put('/api/records/experiments/'+e['id'],json=p,headers={**ha,'If-Match':'1'})
    assert r.status_code==200,r.text
    assert client.post('/api/review/experiments/'+e['id'],json={'decision':'accepted','note':'admin also edited this candidate','attested':True},headers={**ha,'If-Match':'2'}).status_code==403

def test_concurrent_feedback_conversion_is_atomic(client):
    from concurrent.futures import ThreadPoolExecutor
    h=login(client);f=create(client,h,'feedback',{'title':'one event only'})
    def convert(_):return client.post('/api/feedback/'+f['id']+'/task',json={},headers={**h,'If-Match':'1'}).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:statuses=list(pool.map(convert,range(2)))
    assert sorted(statuses)==[200,409]
    with store.connect() as db:assert len(store.all_of(db,'tasks'))==1

def test_online_backup_and_offline_restore_revoke_tokens(client,tmp_path):
    import os,subprocess,sys
    from pathlib import Path
    h=login(client);first=sample_task(client,h)
    with store.connect() as db:db.execute('INSERT INTO tokens VALUES(?,?,?,?,?,NULL)',('old','old-agent',store.digest('oldtoken'),store.now(),time.time()+3600))
    root=Path(main.__file__).resolve().parents[1]
    env={**os.environ,'GP_DATA_DIR':str(store.DATA_DIR)}
    backup=tmp_path/'backup.sqlite3'
    r=subprocess.run([sys.executable,str(root/'manage.py'),'backup',str(backup)],env=env,capture_output=True,text=True)
    assert r.returncode==0,r.stderr
    create(client,h,'tasks',{'title':'after backup'})
    # No application DB connection is active at this point; all request contexts close connections.
    r=subprocess.run([sys.executable,str(root/'scripts/restore_db.py'),str(backup),'--confirm-offline-restore'],env=env,capture_output=True,text=True)
    assert r.returncode==0,r.stderr
    with store.connect() as db:
        assert len(store.all_of(db,'tasks'))==1
        assert db.execute('SELECT count(*) FROM sessions').fetchone()[0]==0
        assert db.execute('SELECT count(*) FROM tokens').fetchone()[0]==0

# v0.3 release invariants: UI redesign does not loosen the API/static boundary.
def test_v03_static_assets_and_security_policy(client):
    response=client.get('/')
    assert response.status_code==200
    assert 'name="gp-mode" content="server"' in response.text
    assert 'name="color-scheme" content="dark"' in response.text
    assert '<script src="app.js"></script>' in response.text
    policy=response.headers['content-security-policy']
    assert "script-src 'self'" in policy and 'unsafe-inline' not in policy
    assert 'requirements:requirementsPage' in client.get('/app.js').text
    assert 'function focusedGraph()' in client.get('/app.js').text
    assert 'prefers-reduced-motion:reduce' in client.get('/styles.css').text
    for path in ['/docs/SRV47_DEPLOYMENT.md','/.env','/manage.py','/scripts/inspect-srv47.ps1','/studio.sqlite3']:
        assert client.get(path).status_code==404
    assert client.get('/api/workspace').status_code==401

def test_v03_no_remote_execution_route(client):
    h=login(client,'admin')
    for path in ['/api/exec','/api/ssh','/api/restart-proxy','/api/server/command']:
        assert client.post(path,json={'command':'printf test'},headers=h).status_code==404
    workspace=client.get('/api/workspace').json()
    assert workspace['schemaVersion']==1
    assert workspace['tasks']==[] and workspace['experiments']==[]
