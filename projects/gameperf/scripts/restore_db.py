"""Explicit offline restore. Stop every process using the target DB beforehand."""
import argparse
import sqlite3
import sys
from pathlib import Path
from datetime import datetime, timezone
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app import db as store

p=argparse.ArgumentParser(description='恢复数据库；必须先停止所有访问数据库的进程')
p.add_argument('backup');p.add_argument('--confirm-offline-restore',action='store_true');args=p.parse_args()
if not args.confirm_offline_restore:p.error('需显式提供 --confirm-offline-restore，确认应用已停止')
source=Path(args.backup).resolve()
if source==store.DB_PATH.resolve() or not source.is_file():p.error('需要有效且不同于目标的备份文件')
src=sqlite3.connect(source.as_uri()+'?mode=ro',uri=True)
try:
    if src.execute('PRAGMA integrity_check').fetchone()[0]!='ok':p.error('备份完整性检查未通过')
    if src.execute("SELECT value FROM meta WHERE key='schema'").fetchone()[0]!='1':p.error('不支持此 schema 版本')
    store.DATA_DIR.mkdir(parents=True,exist_ok=True)
    if store.DB_PATH.exists():
        saved=store.DATA_DIR/('pre-restore-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.sqlite3')
        if saved.exists():p.error('同秒预恢复备份已存在，请稍后重试')
        current=sqlite3.connect(store.DB_PATH);dest=sqlite3.connect(saved)
        try:current.backup(dest)
        finally:dest.close();current.close()
        saved.chmod(0o600);print('已保留当前数据库：',saved)
    target=sqlite3.connect(store.DB_PATH)
    try:
        src.backup(target)
        # Restoring old backups must not resurrect old sessions or revoked tokens.
        target.execute('DELETE FROM sessions');target.execute('DELETE FROM tokens');target.execute('DELETE FROM login_attempts');target.commit()
    finally:target.close()
finally:src.close()
store.DB_PATH.chmod(0o600)
with store.connect() as db:store.audit(db,'server-admin','restore','workspace','main','离线恢复；清除所有会话和集成令牌')
print('恢复完成；请重新登录，并重新签发需要的集成令牌。')
