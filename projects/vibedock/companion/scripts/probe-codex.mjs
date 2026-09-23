import {CodexRpc} from '../src/rpc.mjs';
const rpc=new CodexRpc();
try {
 await rpc.start();
 const list=await rpc.call('thread/list',{limit:4,sortKey:'updated_at',useStateDbOnly:true});
 console.log(JSON.stringify({connected:true,taskCount:list.data?.length??0,statuses:list.data?.map(t=>t.status)}));
 if(list.data?.[0]) {
  const latest=await rpc.call('thread/turns/list',{threadId:list.data[0].id,limit:1});
  console.log(JSON.stringify({turnListKeys:Object.keys(latest),turnKeys:latest.data?.[0]?Object.keys(latest.data[0]):[],status:latest.data?.[0]?.status}));
 }
 try{const q=await rpc.call('account/rateLimits/read');console.log(JSON.stringify({quotaAvailable:!!q.rateLimits,keys:Object.keys(q)}))}catch{console.log('Quota unavailable')}
}catch(e){console.error(e.message);process.exitCode=1}finally{rpc.close()}
