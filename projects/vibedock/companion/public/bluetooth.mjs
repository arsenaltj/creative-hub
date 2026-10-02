import {BLE_SERVICE,BLE_SNAPSHOT,BLE_TOUCH,encodeFrames,FrameReader} from './ble-codec.mjs';
export class BadgeBluetooth {
 constructor({api,onStatus=()=>{}}={}){this.api=api;this.onStatus=onStatus;this.reader=new FrameReader();this.counter=1;this.session=null;this.device=null;this.writer=null;this.mock=false;this.sending=false;this.latest=null;this.acks=[];this.timer=null}
 async connect(mock=false){
  let device;
  if(!mock){if(!navigator.bluetooth||!window.isSecureContext)throw Error('请在电脑的 Chrome / Edge 本机页面连接蓝牙');
   device=await navigator.bluetooth.requestDevice({filters:[{services:[BLE_SERVICE]}]});
  }
  await this.disconnect();this.mock=mock;
  try{
  if(!mock){this.device=device;
   this.device.addEventListener('gattserverdisconnected',()=>void this.disconnect());
   const server=await this.device.gatt.connect(),service=await server.getPrimaryService(BLE_SERVICE);this.writer=await service.getCharacteristic(BLE_SNAPSHOT);const notify=await service.getCharacteristic(BLE_TOUCH);
   notify.addEventListener('characteristicvaluechanged',e=>{try{const message=this.reader.push(e.target.value);if(message?.kind===2)void this.touch(message.value).catch(error=>this.onStatus(error.message))}catch(error){this.onStatus(error.message)}});await notify.startNotifications();
  }
  this.session=await this.api('/api/ble/session',{name:mock?'蓝牙联调模拟':this.device.name||'蓝牙吧唧'});await this.sync();this.timer=setInterval(()=>void this.sync().catch(e=>this.onStatus(e.message)),2000);this.onStatus(mock?'联调模拟已连接（未连接物理设备）':`已连接蓝牙：${this.device.name||'吧唧'}`)}catch(e){await this.disconnect();throw e}
 }
 async sync(){if(!this.session)return;const next=await this.api('/api/ble/state',{credential:this.session.credential});this.session={...this.session,...next};const s=next.snapshot;await this.write({v:1,type:'snapshot',epoch:s.epoch,revision:s.revision,tool:s.tool,mode:s.mode,connected:s.connected,selected:s.selected,attention:s.attention.length,usage:s.usage,tasks:s.tasks.map(t=>t?{id:t.id,title:t.title.slice(0,48),state:t.state,summary:t.summary?.slice(0,100),output:t.output?{text:t.output.text.slice(0,400)}:null,approval:t.approval,capabilities:t.capabilities}:null)},1)}
 async write(value,kind){
  if(kind===3){if(this.acks.length>=32)throw Error('设备回执过多，请重新连接');this.acks.push({value,kind})}else this.latest={value,kind};if(this.sending)return;this.sending=true;
  try{while((this.acks.length||this.latest)&&this.session){const next=this.acks.length?this.acks.shift():this.latest;if(next.kind!==3)this.latest=null;const frames=encodeFrames(next.value,{kind:next.kind,id:this.counter++});if(this.mock){const reader=new FrameReader();for(const frame of frames)reader.push(frame)}else for(const frame of frames){if(!this.writer)break;await this.writer.writeValueWithResponse(frame)}}}finally{this.sending=false}
 }
 async touch(message){if(!this.session)throw Error('蓝牙尚未授权');try{const result=await this.api('/api/ble/command',{credential:this.session.credential,key:this.session.key,message});await this.write({v:1,type:'ack',actionId:message.actionId,ok:result.ok},3);await this.sync();return result}catch(e){await this.write({v:1,type:'ack',actionId:String(message?.actionId||'').slice(0,80),ok:false,error:e.message.slice(0,120)},3);throw e}}
 async mockTouch(){if(!this.mock||!this.session)throw Error('请先开启联调模拟');const s=this.session.snapshot,t=s.tasks.find(Boolean);if(!t)throw Error('暂无任务');const message={v:1,actionId:crypto.randomUUID(),epoch:s.epoch,tool:s.tool,type:'task.select',taskId:t.id,source:'device'},reader=new FrameReader();let decoded;for(const frame of encodeFrames(message,{kind:2,id:this.counter++}))decoded=reader.push(frame)||decoded;await this.touch(decoded.value);this.onStatus(`模拟触控已确认：${t.title}`)}
 async disconnect(){clearInterval(this.timer);this.timer=null;const session=this.session,device=this.device;this.session=null;this.device=null;this.latest=null;this.acks=[];this.writer=null;this.reader=new FrameReader();if(device?.gatt.connected)device.gatt.disconnect();if(session)try{await this.api('/api/devices/revoke',{id:session.access.id})}catch{}this.onStatus('蓝牙未连接')}
}
