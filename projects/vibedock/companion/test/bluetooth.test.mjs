import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encodeFrames,FrameReader} from '../public/ble-codec.mjs';
import {BadgeBluetooth} from '../public/bluetooth.mjs';
test('BLE snapshot/touch/ack frames survive minimum MTU, multibyte text, duplicate and out-of-order delivery',()=>{
 const value={type:'snapshot',title:'官网深色模式 🌙',output:'回复'.repeat(900)},frames=encodeFrames(value,{mtu:20,id:99}),reader=new FrameReader();let result;assert.ok(frames.every(frame=>frame.length<=20));
 reader.push(frames[0]);reader.push(frames[0]);for(const frame of frames.slice(1).reverse())result=reader.push(frame)||result;assert.deepEqual(result.value,value);assert.equal(result.id,99);
 for(const kind of [2,3]){const r=new FrameReader();let message;for(const f of encodeFrames({type:kind===2?'task.select':'ack'},{kind,mtu:180}))message=r.push(f)||message;assert.equal(message.kind,kind)}
});

test('snapshot coalescing never drops pending Bluetooth action acknowledgements',async()=>{
 const badge=new BadgeBluetooth(),reader=new FrameReader(),messages=[];let unblock;let blocked=true;
 badge.session={};badge.writer={writeValueWithResponse:async frame=>{if(blocked){blocked=false;await new Promise(resolve=>unblock=resolve)}const decoded=reader.push(frame);if(decoded)messages.push(decoded)} };
 const initial=badge.write({revision:1},1);await badge.write({actionId:'action-one',ok:true},3);await badge.write({revision:2},1);await badge.write({actionId:'action-two',ok:true},3);await badge.write({revision:3},1);unblock();await initial;
 assert.deepEqual(messages.map(m=>m.kind),[1,3,3,1]);assert.equal(messages.at(-1).value.revision,3);assert.deepEqual(messages.filter(m=>m.kind===3).map(m=>m.value.actionId),['action-one','action-two']);
});
test('BLE receiver bounds messages and rejects corrupt headers, conflicting duplicates and expired partial transfers',()=>{
 assert.throws(()=>encodeFrames({text:'x'.repeat(65537)}),/过大/);assert.throws(()=>new FrameReader().push(new Uint8Array([1,2,3])),/无效/);
 const frames=encodeFrames({text:'多端圆屏'.repeat(15)}),reader=new FrameReader();reader.push(frames[0]);const corrupt=frames[0].slice();corrupt[12]^=1;assert.throws(()=>reader.push(corrupt),/冲突/);
 let now=0;const expiring=new FrameReader({now:()=>now,timeout:5});expiring.push(frames[0]);now=10;for(const frame of frames.slice(1))assert.equal(expiring.push(frame),null);
});
