export const BLE_SERVICE='7b35a100-9c52-4f97-8e4d-d94275da6f10';
export const BLE_SNAPSHOT='7b35a101-9c52-4f97-8e4d-d94275da6f10';
export const BLE_TOUCH='7b35a102-9c52-4f97-8e4d-d94275da6f10';
export function encodeFrames(value,{kind=1,id=1,mtu=20}={}){
 if(!Number.isInteger(mtu)||mtu<20||mtu>512||![1,2,3].includes(kind))throw Error('无效蓝牙帧设置');
 const bytes=new TextEncoder().encode(JSON.stringify(value));if(bytes.length>65536)throw Error('蓝牙消息过大');
 const size=mtu-12,count=Math.ceil(bytes.length/size),frames=[];
 for(let i=0;i<count;i++){const frame=new Uint8Array(12+Math.min(size,bytes.length-i*size)),view=new DataView(frame.buffer);frame[0]=86;frame[1]=68;frame[2]=1;frame[3]=kind;view.setUint32(4,id,true);view.setUint16(8,i,true);view.setUint16(10,count,true);frame.set(bytes.subarray(i*size,(i+1)*size),12);frames.push(frame)}
 return frames;
}
export class FrameReader {
 constructor({now=Date.now,timeout=15000}={}){this.messages=new Map();this.now=now;this.timeout=timeout}
 push(input){
  const bytes=input instanceof DataView?new Uint8Array(input.buffer,input.byteOffset,input.byteLength):new Uint8Array(input.buffer||input,input.byteOffset||0,input.byteLength);
  if(bytes.length<13||bytes.length>512||bytes[0]!==86||bytes[1]!==68||bytes[2]!==1||![1,2,3].includes(bytes[3]))throw Error('无效蓝牙帧');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),id=view.getUint32(4,true),index=view.getUint16(8,true),count=view.getUint16(10,true),kind=bytes[3];
  if(count<1||count>8192||index>=count)throw Error('无效分片序号');
  for(const [key,m]of this.messages)if(this.now()-m.at>this.timeout)this.messages.delete(key);
  let m=this.messages.get(id);if(!m){if(this.messages.size>=4)throw Error('蓝牙消息队列已满');m={kind,count,at:this.now(),chunks:new Map(),size:0};this.messages.set(id,m)}
  if(m.kind!==kind||m.count!==count){this.messages.delete(id);throw Error('分片上下文冲突')}
  const payload=bytes.slice(12),previous=m.chunks.get(index);if(previous){if(previous.length!==payload.length||previous.some((v,i)=>v!==payload[i])){this.messages.delete(id);throw Error('重复分片内容冲突')}return null}
  m.chunks.set(index,payload);m.size+=payload.length;if(m.size>65536){this.messages.delete(id);throw Error('蓝牙消息过大')}
  if(m.chunks.size!==count)return null;
  this.messages.delete(id);const joined=new Uint8Array(m.size);let offset=0;for(let i=0;i<count;i++){joined.set(m.chunks.get(i),offset);offset+=m.chunks.get(i).length}
  return {kind,id,value:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(joined))};
 }
}
