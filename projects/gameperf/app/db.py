"""SQLite repository, server-side sessions, immutable-through-API audit trail."""
import hashlib
import json
import os
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

DATA_DIR = Path(os.environ.get('GP_DATA_DIR', str(Path(__file__).resolve().parents[1] / 'data')))
DB_PATH = DATA_DIR / 'studio.sqlite3'

def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')

def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()

@contextmanager
def connect():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    db.execute('PRAGMA busy_timeout=15000')
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def init_db():
    with connect() as db:
        db.execute('PRAGMA journal_mode=WAL')
        db.executescript('''
        CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS users(name TEXT PRIMARY KEY,password TEXT NOT NULL,role TEXT NOT NULL,created TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,username TEXT NOT NULL REFERENCES users(name) ON DELETE CASCADE,csrf TEXT NOT NULL,expires REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,version INTEGER NOT NULL,author TEXT NOT NULL,updated TEXT NOT NULL,PRIMARY KEY(kind,id));
        CREATE TABLE IF NOT EXISTS audit(seq INTEGER PRIMARY KEY AUTOINCREMENT,at TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,kind TEXT NOT NULL,target TEXT NOT NULL,detail TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS tokens(id TEXT PRIMARY KEY,name TEXT NOT NULL,hash TEXT NOT NULL UNIQUE,created TEXT NOT NULL,expires REAL NOT NULL,last_used TEXT);
        CREATE TABLE IF NOT EXISTS ingestion(token_id TEXT NOT NULL,event_id TEXT NOT NULL,body_hash TEXT NOT NULL,result TEXT NOT NULL,at TEXT NOT NULL,PRIMARY KEY(token_id,event_id));
        CREATE TABLE IF NOT EXISTS login_attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,window REAL NOT NULL);
        ''')
        if not db.execute("SELECT 1 FROM meta WHERE key='schema'").fetchone():
            seed = json.loads((Path(__file__).parent / 'seed.json').read_text())
            db.execute("INSERT INTO meta VALUES('schema','1')")
            project = {k:v for k,v in seed['project'].items() if k != 'version'}
            insert(db,'project','main',project,'system')
            for node in seed['nodes']:
                node = dict(node); id = node.pop('id'); node.pop('version',None)
                insert(db,'nodes',id,node,'system')
            audit(db,'system','initialize','workspace','main','初始化蓝图；没有接入设备或运行 Agent')
    try: DB_PATH.chmod(0o600)
    except OSError: pass

def audit(db,actor,action,kind,target,detail=''):
    db.execute('INSERT INTO audit(at,actor,action,kind,target,detail) VALUES(?,?,?,?,?,?)', (now(),actor,action,kind,target,detail[:3000]))

def public(row):
    if row is None: return None
    return dict(json.loads(row['data']), id=row['id'], version=row['version'], author=row['author'], updatedAt=row['updated'])

def get(db,kind,id):
    return public(db.execute('SELECT * FROM records WHERE kind=? AND id=?',(kind,id)).fetchone())

def all_of(db,kind):
    return [public(r) for r in db.execute('SELECT * FROM records WHERE kind=? ORDER BY rowid',(kind,))]

def insert(db,kind,id,data,author):
    db.execute('INSERT INTO records VALUES(?,?,?,?,?,?)', (kind,id,json.dumps(data,ensure_ascii=False,allow_nan=False),1,author,now()))
    return get(db,kind,id)

def update(db,kind,id,data,version):
    return db.execute('UPDATE records SET data=?,version=version+1,updated=? WHERE kind=? AND id=? AND version=?', (json.dumps(data,ensure_ascii=False,allow_nan=False),now(),kind,id,version)).rowcount

def password_hash(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac('sha256',password.encode(),salt.encode(),600000).hex()
    return f'pbkdf2_sha256$600000${salt}${key}'

def check_password(password,encoded):
    try:
        algorithm,rounds,salt,key=encoded.split('$')
        if algorithm != 'pbkdf2_sha256': return False
        candidate=hashlib.pbkdf2_hmac('sha256',password.encode(),salt.encode(),int(rounds)).hex()
        return secrets.compare_digest(candidate,key)
    except (ValueError,TypeError): return False
