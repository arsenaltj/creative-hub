#!/usr/bin/env python3
"""Administrative actions happen in a trusted server shell, not public HTTP."""
import argparse
import getpass
import json
import re
import secrets
import sqlite3
import sys
import time
from pathlib import Path
from app import db as store

def main():
    p=argparse.ArgumentParser(description='GamePerf Studio 管理工具；请在服务器本地执行')
    sub=p.add_subparsers(dest='command',required=True)
    for command in ['create-user','reset-password']:
        c=sub.add_parser(command); c.add_argument('username')
        if command=='create-user': c.add_argument('--role',choices=['admin','editor','reviewer','viewer'],default='editor')
    sub.add_parser('list-users')
    c=sub.add_parser('delete-user'); c.add_argument('username')
    c=sub.add_parser('create-token'); c.add_argument('name'); c.add_argument('--days',type=int,default=30)
    sub.add_parser('list-tokens')
    c=sub.add_parser('revoke-token'); c.add_argument('id')
    c=sub.add_parser('backup'); c.add_argument('output')
    sub.add_parser('init')
    args=p.parse_args(); store.init_db()
    if args.command in {'create-user','reset-password'}:
        if not re.fullmatch(r'[A-Za-z0-9_.-]{2,64}',args.username): p.error('用户名用 2–64 位字母、数字、._-')
        password=getpass.getpass('密码（至少 14 位，不显示）：')
        if len(password)<14: p.error('密码至少 14 位')
        if password!=getpass.getpass('再次输入：'): p.error('两次密码不同')
        hashed=store.password_hash(password)
        with store.connect() as db:
            if args.command=='create-user':
                if db.execute('SELECT 1 FROM users WHERE name=?',(args.username,)).fetchone(): p.error('用户已存在')
                db.execute('INSERT INTO users VALUES(?,?,?,?)',(args.username,hashed,args.role,store.now()))
            else:
                if not db.execute('UPDATE users SET password=? WHERE name=?',(hashed,args.username)).rowcount: p.error('用户不存在')
                db.execute('DELETE FROM sessions WHERE username=?',(args.username,))
            store.audit(db,'server-admin',args.command,'user',args.username)
        print('完成；密码未写入命令行或项目文件。')
    elif args.command=='list-users':
        with store.connect() as db:
            for r in db.execute('SELECT name,role,created FROM users'): print(*r,sep='\t')
    elif args.command=='delete-user':
        with store.connect() as db:
            role=db.execute('SELECT role FROM users WHERE name=?',(args.username,)).fetchone()
            if not role: p.error('用户不存在')
            if role[0]=='admin' and db.execute("SELECT count(*) FROM users WHERE role='admin'").fetchone()[0]<2: p.error('不能删除最后一个管理员')
            if input(f'删除用户 {args.username}？输入 DELETE：')!='DELETE': return
            db.execute('DELETE FROM users WHERE name=?',(args.username,)); store.audit(db,'server-admin','delete-user','user',args.username)
    elif args.command=='create-token':
        if not 1<=args.days<=365: p.error('--days 应在 1–365 之间')
        if not re.fullmatch(r'[A-Za-z0-9_.-]{2,64}',args.name): p.error('集成名用 2–64 位字母、数字、._-')
        token='gp_'+secrets.token_urlsafe(40); id=secrets.token_hex(8)
        with store.connect() as db:
            db.execute('INSERT INTO tokens VALUES(?,?,?,?,?,NULL)',(id,args.name,store.digest(token),store.now(),time.time()+args.days*86400))
            store.audit(db,'server-admin','create-token','integration',id,args.name)
        print('仅显示一次。请放入 Agent 所在环境的凭证管理或 GP_TOKEN 环境变量，不要发到聊天、前端或仓库。')
        print(token)
    elif args.command=='list-tokens':
        with store.connect() as db:
            for r in db.execute('SELECT id,name,created,expires,last_used FROM tokens'): print(*r,sep='\t')
    elif args.command=='revoke-token':
        with store.connect() as db:
            db.execute('DELETE FROM tokens WHERE id=?',(args.id,)); store.audit(db,'server-admin','revoke-token','integration',args.id)
        print('已撤销。')
    elif args.command=='backup':
        path=Path(args.output)
        if path.exists(): p.error('备份文件已存在，拒绝覆盖')
        path.parent.mkdir(parents=True,exist_ok=True)
        with store.connect() as db:
            dest=sqlite3.connect(path)
            try: db.backup(dest)
            finally: dest.close()
        path.chmod(0o600); print('已备份：',path)
    else: print('数据库已初始化。')

if __name__=='__main__': main()
