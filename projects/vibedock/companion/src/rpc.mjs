import {spawn} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {createInterface} from 'node:readline';

export class CodexRpc extends EventEmitter {
  constructor({command=process.env.VIBEDOCK_CODEX_BIN || 'codex', timeout=15000}={}) {
    super(); this.command=command; this.timeout=timeout; this.pending=new Map(); this.nextId=1;
  }
  async start() {
    if(this.child) return;
    this.child=spawn(this.command,['app-server','--stdio'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    this.child.on('error',e=>this.fail(e));
    const child=this.child;
    this.child.on('exit',()=>{if(this.child===child){this.child=null;this.fail(new Error('Codex 连接已关闭'))}});
    this.child.stderr.on('data',()=>{}); // Never forward CLI stderr: it may contain private paths/config.
    this.child.stdin.on('error',e=>this.fail(e));
    createInterface({input:this.child.stdout}).on('line',line=>{
      let message; try { message=JSON.parse(line); } catch { return; }
      if(message.method) { this.emit(message.id===undefined?'notification':'request',message); return; }
      const pending=this.pending.get(message.id); if(!pending)return;
      clearTimeout(pending.timer);this.pending.delete(message.id);
      if(message.error)pending.reject(new Error(message.error.message||'Codex 请求失败'));
      else pending.resolve(message.result);
    });
    try {
      await this.call('initialize',{clientInfo:{name:'vibedock',title:'VibeDock Companion',version:'0.1.0'},capabilities:{experimentalApi:false}});
      this.child.stdin.write(JSON.stringify({method:'initialized'})+'\n');
    } catch(e) { this.close(); throw e; }
  }
  call(method,params={}) {
    if(!this.child || this.child.killed)return Promise.reject(new Error('Codex 未连接'));
    const id=this.nextId++;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`Codex ${method} 请求超时`))},this.timeout);
      this.pending.set(id,{resolve,reject,timer});
      this.child.stdin.write(JSON.stringify({id,method,params})+'\n',e=>{if(e){clearTimeout(timer);this.pending.delete(id);reject(e)}});
    });
  }
  fail(error){for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(error)}this.pending.clear();this.emit('disconnected',error);}
  close(){const child=this.child;this.child=null;if(child){child.stdin.end();child.kill()}this.fail(new Error('Codex 已断开'));}
}
